import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchCalendarItems,
  fetchGmailItems,
} from '../tools/mcp-tools.js';
import type {
  CalendarEventsHandle,
  GmailMessagesHandle,
} from '../tools/mcp-tools.js';

/**
 * The Google surface fetch helpers take structural handles (the real
 * googleapis client satisfies them), so tests exercise the fetch logic with
 * fakes — no credentials, no network.
 */

function fakeGmail(opts: { failIds?: string[] } = {}): {
  handle: GmailMessagesHandle;
  calls: { list?: Record<string, unknown>; get: string[] };
} {
  const calls: { list?: Record<string, unknown>; get: string[] } = { get: [] };
  const handle: GmailMessagesHandle = {
    async list(params) {
      calls.list = params as unknown as Record<string, unknown>;
      return {
        data: {
          messages: Array.from({ length: 3 }, (_, i) => ({
            id: `msg-${i}`,
            threadId: `t-${i}`,
          })),
        },
      };
    },
    async get(params) {
      calls.get.push(params.id);
      if (opts.failIds?.includes(params.id)) {
        throw new Error(`.NotFound: ${params.id}`);
      }
      return {
        data: {
          snippet: `snippet ${params.id}`,
          payload: {
            headers: [
              { name: 'Subject', value: `subject ${params.id}` },
              { name: 'From', value: `from ${params.id}` },
              { name: 'Date', value: 'Mon, 01 Jan 2026 10:00:00 +0000' },
            ],
          },
        },
      };
    },
  };
  return { handle, calls };
}

test('gmail fetch returns hydrated metadata for every healthy message', async () => {
  const { handle } = fakeGmail();
  const items = await fetchGmailItems(handle, 10);
  assert.equal(items.length, 3);
  const first = items[0] as { subject: string; from: string };
  assert.equal(first.subject, 'subject msg-0');
  assert.equal(first.from, 'from msg-0');
});

test('gmail fetch isolates a deleted message instead of failing the whole call', async () => {
  const { handle } = fakeGmail({ failIds: ['msg-1'] });
  const items = await fetchGmailItems(handle, 10);
  // 2 healthy entries + 1 inline error entry
  assert.equal(items.length, 3);
  const failed = items.find((x) => (x as { error?: string }).error) as {
    id: string;
    error: string;
  };
  assert.equal(failed.id, 'msg-1');
  assert.match(failed.error, /NotFound/);
  const healthy = items.filter((x) => !(x as { error?: string }).error);
  assert.equal(healthy.length, 2);
});

test('gmail fetch forwards maxResults and q to the upstream list call', async () => {
  const { handle, calls } = fakeGmail();
  await fetchGmailItems(handle, 5, 'label:unread');
  assert.equal(calls.list?.maxResults, 5);
  assert.equal(calls.list?.q, 'label:unread');
});

function fakeCalendar(): {
  handle: CalendarEventsHandle;
  calls: { list?: Record<string, unknown> };
} {
  const calls: { list?: Record<string, unknown> } = {};
  const handle: CalendarEventsHandle = {
    async list(params) {
      calls.list = params as unknown as Record<string, unknown>;
      return {
        data: {
          items: [
            {
              id: 'evt-1',
              summary: 'standup',
              start: { dateTime: '2026-10-10T09:00:00Z' },
              end: { dateTime: '2026-10-10T09:30:00Z' },
            },
            {
              id: 'evt-all-day',
              summary: 'offsite',
              start: { date: '2026-10-11' },
              end: { date: '2026-10-12' },
            },
          ],
        },
      };
    },
  };
  return { handle, calls };
}

test('calendar fetch forwards q to events.list when provided', async () => {
  const { handle, calls } = fakeCalendar();
  const items = await fetchCalendarItems(handle, 10, 'standup');
  assert.equal(calls.list?.q, 'standup');
  assert.equal(calls.list?.maxResults, 10);
  assert.equal((items[0] as { summary: string }).summary, 'standup');
});

test('calendar fetch omits q when absent and maps all-day events', async () => {
  const { handle, calls } = fakeCalendar();
  const items = await fetchCalendarItems(handle, 10);
  assert.equal(calls.list?.q, undefined);
  const allDay = items[1] as { start: string };
  assert.equal(allDay.start, '2026-10-11');
});
