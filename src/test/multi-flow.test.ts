import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { waitForCode } from '../oauth/multi-flow.js';

/** Bind port 0, read the assigned port, close again — a free TCP port. */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Poll until the callback server answers (any status). A bare GET /cb has no
 * code/error params, so it answers 400 without settling the flow — a safe
 * readiness probe.
 */
async function awaitServer(port: number): Promise<void> {
  for (let i = 0; i < 40; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}/cb`);
      return;
    } catch {
      await sleep(50);
    }
  }
  throw new Error(`callback server on :${port} never came up`);
}

/**
 * True once the port refuses new connections — proves waitForCode actually
 * closed its callback server. Retries for a while: the shutdown path lets the
 * consent response flush for ~250ms before reaping keep-alive sockets, and the
 * fetch pool may reuse a still-open socket in the meantime.
 */
async function connectionRefused(port: number): Promise<boolean> {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}/cb`);
      await sleep(50);
    } catch {
      return true;
    }
  }
  return false;
}

test('waitForCode resolves with the code from the callback request', async () => {
  const port = await freePort();
  const waiting = waitForCode(port);
  await awaitServer(port);
  const res = await fetch(`http://127.0.0.1:${port}/cb?code=abc123`);
  assert.equal(res.status, 200);
  assert.equal(await waiting, 'abc123');
});

test('waitForCode rejects on a provider error and closes the callback server', async () => {
  const port = await freePort();
  const waiting = waitForCode(port);
  await awaitServer(port);
  // Attach the rejection handler before triggering the error, so the rejection
  // is never pending-unhandled while the triggering fetch is awaited.
  const outcome = assert.rejects(waiting, /access_denied/);
  await fetch(`http://127.0.0.1:${port}/cb?error=access_denied`);
  await outcome;
  assert.ok(
    await connectionRefused(port),
    'callback server should refuse connections after an error settle',
  );
});

test('waitForCode closes the callback server after a successful consent', async () => {
  const port = await freePort();
  const waiting = waitForCode(port);
  await awaitServer(port);
  await fetch(`http://127.0.0.1:${port}/cb?code=xyz`);
  assert.equal(await waiting, 'xyz');
  assert.ok(
    await connectionRefused(port),
    'callback server should refuse connections after a successful settle',
  );
});
