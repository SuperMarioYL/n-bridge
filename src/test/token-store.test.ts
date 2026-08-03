import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { TokenStore } from '../oauth/token-store.js';
import type { KeychainBackend } from '../oauth/token-store.js';
import { AccountRegistry } from '../accounts/registry.js';
import type { Account } from '../accounts/registry.js';

/** In-memory keychain fake — same surface as keytar, no native binding. */
class FakeKeychain implements KeychainBackend {
  private store = new Map<string, string>();
  private key(service: string, account: string): string {
    return `${service}/${account}`;
  }
  async setPassword(service: string, account: string, password: string): Promise<void> {
    this.store.set(this.key(service, account), password);
  }
  async getPassword(service: string, account: string): Promise<string | null> {
    return this.store.get(this.key(service, account)) ?? null;
  }
  async deletePassword(service: string, account: string): Promise<boolean> {
    return this.store.delete(this.key(service, account));
  }
  size(): number {
    return this.store.size;
  }
}

function sampleAccount(id: string, email: string): Account {
  return {
    id,
    surfaces: ['gmail', 'calendar', 'drive'],
    profile: { email },
    tokenRef: id,
  };
}

test('token store round-trip: save then get returns the same token', async () => {
  const fake = new FakeKeychain();
  const store = new TokenStore(fake, 'nbridge');
  await store.save('acct-1', 'refresh-token-abc');
  assert.equal(await store.get('acct-1'), 'refresh-token-abc');
  assert.equal(fake.size(), 1);
});

test('token store delete removes the token', async () => {
  const fake = new FakeKeychain();
  const store = new TokenStore(fake, 'nbridge');
  await store.save('acct-1', 'refresh-token-abc');
  assert.equal(await store.delete('acct-1'), true);
  assert.equal(await store.get('acct-1'), null);
});

test('token store refuses to store an empty token', async () => {
  const fake = new FakeKeychain();
  const store = new TokenStore(fake, 'nbridge');
  await assert.rejects(() => store.save('acct-1', ''), /empty refresh token/);
});

test('registry add -> getToken round-trips through the keychain', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nbridge-test-'));
  const accountsFile = join(dir, 'accounts.json');
  const fake = new FakeKeychain();
  const store = new TokenStore(fake, 'nbridge');
  const registry = new AccountRegistry(accountsFile, store);

  const acct = sampleAccount('acct-1', 'founder@workmail.com');
  await registry.add(acct, 'refresh-token-123');

  // metadata file must NOT contain the refresh token (only email + tokenRef).
  const raw = await readFile(accountsFile, 'utf8');
  assert.ok(!raw.includes('refresh-token-123'), 'token leaked into metadata file');
  assert.ok(raw.includes('founder@workmail.com'));

  // round-trip via the registry pulls the token from the keychain.
  assert.equal(await registry.getToken(acct), 'refresh-token-123');
  assert.equal(fake.size(), 1);
  await rm(dir, { recursive: true, force: true });
});

test('registry reload rehydrates accounts from the metadata file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nbridge-test-'));
  const accountsFile = join(dir, 'accounts.json');
  const fake = new FakeKeychain();
  const store = new TokenStore(fake, 'nbridge');

  const a = new AccountRegistry(accountsFile, store);
  await a.load();
  assert.equal(a.list().length, 0);

  await a.add(sampleAccount('acct-1', 'one@x.com'), 'tok-1');
  await a.add(sampleAccount('acct-2', 'two@x.com'), 'tok-2');
  assert.equal(a.list().length, 2);

  // a fresh registry instance sees both accounts after reload.
  const b = new AccountRegistry(accountsFile, store);
  await b.load();
  assert.equal(b.list().length, 2);
  assert.ok(b.list().some((x) => x.profile.email === 'two@x.com'));

  // removing one also clears its keychain entry.
  await b.remove('acct-1');
  assert.equal(b.list().length, 1);
  assert.equal(await store.get('acct-1'), null);
  assert.equal(await store.get('acct-2'), 'tok-2');
  await rm(dir, { recursive: true, force: true });
});
