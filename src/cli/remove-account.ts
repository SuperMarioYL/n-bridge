import { loadConfig } from '../config.js';
import { AccountRegistry } from '../accounts/registry.js';
import {
  getSystemKeychain,
  TokenStore,
  unavailableKeychain,
} from '../oauth/token-store.js';

/**
 * `nbridge remove <account_id>` — unmount a Google account: delete its
 * keychain refresh token and drop it from the metadata registry.
 *
 * The id is resolved from metadata BEFORE any keychain access, so a missing
 * or unknown id fails fast even on hosts where the keytar binding cannot
 * load. Ids come from `nbridge list`.
 */
export async function removeAccount(id?: string): Promise<void> {
  if (!id) {
    console.error('usage: nbridge remove <account_id>  (ids come from `nbridge list`)');
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();

  // Phase 1 — metadata lookup only; the token store is never called here.
  const lookup = new AccountRegistry(
    config.accountsFile,
    new TokenStore(unavailableKeychain(), config.keychainService),
  );
  await lookup.load();
  const acct = lookup.get(id);
  if (!acct) {
    console.error(`unknown account: ${id}. run \`nbridge list\` to see mounted accounts.`);
    process.exitCode = 1;
    return;
  }

  // Phase 2 — actual removal needs the real keychain to delete the token.
  const backend = await getSystemKeychain();
  const registry = new AccountRegistry(
    config.accountsFile,
    new TokenStore(backend, config.keychainService),
  );
  await registry.load();
  await registry.remove(id);
  console.log(`account removed: ${acct.profile.email} (id: ${acct.id})`);
}
