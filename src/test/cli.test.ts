import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';

/**
 * CLI smoke tests. Only keychain-free paths are exercised here — CI has no
 * Google credentials and no user keychain, so flows that touch tokens are
 * covered by unit tests with fakes instead (token-store.test.ts,
 * mcp-tools.test.ts).
 */

interface CliResult {
  status: number;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], env: NodeJS.ProcessEnv = {}): CliResult {
  try {
    const stdout = execFileSync(process.execPath, ['dist/index.js', ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return {
      status: err.status ?? 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
    };
  }
}

test('`nbridge remove` without an id exits 1 with usage and touches no keychain', () => {
  const r = runCli(['remove']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage: nbridge remove <account_id>/);
});

test('`nbridge remove` with an unknown id exits 1 pointing at `nbridge list`', () => {
  // A HOME without mounted accounts exercises the metadata-only lookup path
  // (no keychain access) with a nonexistent id.
  const r = runCli(['remove', 'no-such-account'], { HOME: tmpdir() });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unknown account: no-such-account/);
  assert.match(r.stderr, /nbridge list/);
});

test('`nbridge --help` documents the remove command', () => {
  const r = runCli(['--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /nbridge remove <id>/);
});

test('`nbridge list` with an empty HOME reports no accounts and exits 0', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nbridge-cli-home-'));
  const r = runCli(['list'], { HOME: dir });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /no accounts mounted/);
  await rm(dir, { recursive: true, force: true });
});
