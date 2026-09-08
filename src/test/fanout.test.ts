import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fanout, selectAccounts } from '../surfaces/fanout.js';
import type { SurfaceClient, ToolRes } from '../surfaces/fanout.js';
import type { Account, Surface } from '../accounts/registry.js';

function acct(id: string, email: string, surfaces: Surface[] = ['gmail', 'calendar', 'drive']): Account {
  return { id, surfaces, profile: { email }, tokenRef: id };
}

/** Fake upstream: one item per account, tagged with the account email. */
const fakeClient: SurfaceClient = {
  async list(surface: Surface, account: Account): Promise<ToolRes> {
    return {
      account_id: account.id,
      surface,
      items: [{ id: `${account.id}-msg-1`, from: account.profile.email }],
    };
  },
};

test('selectAccounts fans out across every account matching the surface by default', () => {
  const all = [acct('a1', 'a1@x.com'), acct('a2', 'a2@x.com')];
  assert.equal(selectAccounts(all, 'gmail').length, 2);
});

test('selectAccounts with account_id "*" fans out across all accounts', () => {
  const all = [acct('a1', 'a1@x.com'), acct('a2', 'a2@x.com')];
  assert.equal(selectAccounts(all, 'gmail', '*').length, 2);
});

test('selectAccounts with a specific account_id scopes to that one account', () => {
  const all = [acct('a1', 'a1@x.com'), acct('a2', 'a2@x.com')];
  const picked = selectAccounts(all, 'gmail', 'a2');
  assert.equal(picked.length, 1);
  assert.equal(picked[0].id, 'a2');
});

test('selectAccounts returns empty for an unknown account_id', () => {
  const all = [acct('a1', 'a1@x.com')];
  assert.equal(selectAccounts(all, 'gmail', 'nope').length, 0);
});

test('selectAccounts skips accounts missing that surface', () => {
  const all = [acct('a1', 'a1@x.com', ['calendar'])];
  assert.equal(selectAccounts(all, 'gmail').length, 0);
  assert.equal(selectAccounts(all, 'calendar').length, 1);
});

test('fanout merges account-tagged results across 2 accounts', async () => {
  const all = [acct('a1', 'a1@x.com'), acct('a2', 'a2@x.com')];
  const res = await fanout(all, 'gmail', { account_id: '*' }, fakeClient);
  assert.equal(res.length, 2);
  assert.ok(res.some((r) => r.account_id === 'a1'));
  assert.ok(res.some((r) => r.account_id === 'a2'));
  // each result carries the surface it came from
  for (const r of res) assert.equal(r.surface, 'gmail');
});

test('fanout with a specific account_id returns only that account', async () => {
  const all = [acct('a1', 'a1@x.com'), acct('a2', 'a2@x.com')];
  const res = await fanout(all, 'gmail', { account_id: 'a2' }, fakeClient);
  assert.equal(res.length, 1);
  assert.equal(res[0].account_id, 'a2');
});

test('fanout with no matching account returns an empty merged result', async () => {
  const all = [acct('a1', 'a1@x.com')];
  const res = await fanout(all, 'gmail', { account_id: 'missing' }, fakeClient);
  assert.equal(res.length, 0);
});

test('fanout results are account-tagged so a caller can attribute each item', async () => {
  const all = [acct('a1', 'alpha@x.com'), acct('a2', 'beta@x.com')];
  const res = await fanout(all, 'drive', {}, fakeClient);
  const senders = res.map((r) => (r.items[0] as { from: string }).from);
  assert.ok(senders.includes('alpha@x.com'));
  assert.ok(senders.includes('beta@x.com'));
});

test('fanout isolates a failed account and still returns healthy accounts', async () => {
  const all = [acct('bad', 'bad@x.com'), acct('good', 'good@x.com')];
  const client: SurfaceClient = {
    async list(surface, account) {
      if (account.id === 'bad') throw new Error('token revoked');
      return { account_id: account.id, surface, items: [{ id: 'm1' }] };
    },
  };
  const res = await fanout(all, 'gmail', {}, client);
  assert.equal(res.length, 2);
  const failed = res.find((r) => r.account_id === 'bad');
  assert.ok(failed);
  assert.equal(failed.error, 'token revoked');
  assert.deepEqual(failed.items, []);
  const healthy = res.find((r) => r.account_id === 'good');
  assert.ok(healthy);
  assert.equal(healthy.error, undefined);
  assert.equal(healthy.items.length, 1);
});

test('fanout scoped to a failing account returns an error entry, not a rejection', async () => {
  const client: SurfaceClient = {
    async list() {
      throw new Error('upstream 500');
    },
  };
  const all = [acct('a1', 'a1@x.com'), acct('a2', 'a2@x.com')];
  const res = await fanout(all, 'gmail', { account_id: 'a1' }, client);
  assert.equal(res.length, 1);
  assert.equal(res[0].account_id, 'a1');
  assert.equal(res[0].error, 'upstream 500');
  assert.deepEqual(res[0].items, []);
});

test('fanout where every account fails returns error entries for all', async () => {
  const client: SurfaceClient = {
    async list() {
      throw new Error('offline');
    },
  };
  const all = [acct('a1', 'a1@x.com'), acct('a2', 'a2@x.com')];
  const res = await fanout(all, 'drive', {}, client);
  assert.equal(res.length, 2);
  assert.ok(res.every((r) => r.error === 'offline'));
  assert.ok(res.every((r) => r.items.length === 0));
});
