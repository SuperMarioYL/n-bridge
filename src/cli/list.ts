import { loadConfig } from '../config.js';
import { AccountRegistry } from '../accounts/registry.js';
import { getSystemKeychain, TokenStore } from '../oauth/token-store.js';

/**
 * `nbridge list` — show every mounted account.
 *
 * Reads only the metadata file (email + tokenRef). Tokens stay in the
 * keychain and are never read by this command.
 */
export async function listAccounts(): Promise<void> {
  const config = loadConfig();
  const backend = await getSystemKeychain();
  const tokenStore = new TokenStore(backend, config.keychainService);
  const registry = new AccountRegistry(config.accountsFile, tokenStore);
  await registry.load();

  const list = registry.list();
  if (list.length === 0) {
    console.log('no accounts mounted. run `nbridge add` to mount your first Google account.');
    return;
  }
  console.log(`${list.length} account(s) mounted:`);
  for (const a of list) {
    const name = a.profile.displayName ? `${a.profile.displayName} ` : '';
    console.log(
      `  ${a.id}  ${name}<${a.profile.email}>  [${a.surfaces.join(', ')}]`,
    );
  }
}
