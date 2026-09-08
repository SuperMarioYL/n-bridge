import type { Account, Surface } from '../accounts/registry.js';

export interface ListQuery {
  /** Account id to scope the call to. `"*"` (default) fans out across all mounted accounts. */
  account_id?: string;
  /** Max items per account. */
  maxResults?: number;
  /** Query / filter string passed through to the upstream API. */
  q?: string;
}

export interface ToolRes {
  account_id: string;
  surface: Surface;
  items: unknown[];
  /**
   * Present when this account's upstream call failed (revoked token, network
   * error, quota). `items` is then empty; other accounts still return results.
   */
  error?: string;
}

/** A surface client does the actual per-account upstream call. */
export interface SurfaceClient {
  list(surface: Surface, account: Account, query: ListQuery): Promise<ToolRes>;
}

/**
 * Pick the accounts a fanout should hit for a surface + optional account_id.
 * A specific id scopes to that one account; `"*"` / undefined fans out.
 */
export function selectAccounts(
  all: Account[],
  surface: Surface,
  accountId?: string,
): Account[] {
  if (accountId && accountId !== '*') {
    const a = all.find((x) => x.id === accountId);
    return a && a.surfaces.includes(surface) ? [a] : [];
  }
  return all.filter((a) => a.surfaces.includes(surface));
}

/**
 * Fan a query out across the selected accounts and merge the results.
 * Calls run concurrently; the returned ToolRes[] is account-tagged so callers
 * can attribute each item back to its source account.
 *
 * One account's failure must not blank the whole merged call: each failed
 * account comes back as an account-tagged entry with `error` set and no
 * items, while healthy accounts still return their results.
 */
export async function fanout(
  all: Account[],
  surface: Surface,
  query: ListQuery,
  client: SurfaceClient,
): Promise<ToolRes[]> {
  const targets = selectAccounts(all, surface, query.account_id);
  if (targets.length === 0) return [];
  const settled = await Promise.allSettled(
    targets.map((a) => client.list(surface, a, query)),
  );
  return settled.map((outcome, i) => {
    if (outcome.status === 'rejected') {
      const reason = outcome.reason;
      return {
        account_id: targets[i].id,
        surface,
        items: [] as unknown[],
        error: reason instanceof Error ? reason.message : String(reason),
      };
    }
    return outcome.value;
  });
}
