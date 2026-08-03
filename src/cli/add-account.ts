import { randomUUID } from 'node:crypto';
import { ALL_SURFACES, loadConfig } from '../config.js';
import { AccountRegistry } from '../accounts/registry.js';
import { getSystemKeychain, TokenStore } from '../oauth/token-store.js';
import { runConsentFlow } from '../oauth/multi-flow.js';
import type { Account } from '../accounts/registry.js';

/**
 * `nbridge add` — mount a new Google account.
 *
 * Walks the user through OAuth consent in their browser, persists the refresh
 * token in the OS keychain (never to disk), and records the account in the
 * metadata file so the registry can reload it at `nbridge up`.
 */
export async function addAccount(): Promise<void> {
  const config = loadConfig();
  if (!config.clientId || !config.clientSecret) {
    console.error(
      'Missing Google OAuth credentials. Set NBRIDGE_GOOGLE_CLIENT_ID and NBRIDGE_GOOGLE_CLIENT_SECRET first (see BUILD_SETUP_NEXT_STEPS.md).',
    );
    process.exitCode = 1;
    return;
  }

  const backend = await getSystemKeychain();
  const tokenStore = new TokenStore(backend, config.keychainService);
  const registry = new AccountRegistry(config.accountsFile, tokenStore);
  await registry.load();

  const tokenRef = `acct-${randomUUID()}`;
  console.error('Mounting a new Google account. Authorize when your browser opens.');
  const result = await runConsentFlow(config, tokenStore, tokenRef);

  const account: Account = {
    id: tokenRef,
    surfaces: [...ALL_SURFACES],
    profile: {
      email: result.email,
      displayName: result.displayName,
    },
    tokenRef,
  };
  // The refresh token is already in the keychain; add() records metadata.
  await registry.add(account, result.refreshToken ?? '');
  console.log(`account added: ${result.email} (id: ${account.id})`);
}
