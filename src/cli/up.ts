import { loadConfig } from '../config.js';
import { AccountRegistry } from '../accounts/registry.js';
import { getSystemKeychain, TokenStore } from '../oauth/token-store.js';
import { startMcpServer } from '../server/mcp-server.js';

/**
 * `nbridge up` — boot the account registry and the MCP server on stdio from a
 * single command. Point your agent at this process and read N inboxes in one
 * tool call.
 *
 * Logs go to stderr so stdio stays clean for the MCP transport.
 */
export async function up(): Promise<void> {
  const config = loadConfig();
  const backend = await getSystemKeychain();
  const tokenStore = new TokenStore(backend, config.keychainService);
  const registry = new AccountRegistry(config.accountsFile, tokenStore);
  await registry.load();

  const count = registry.list().length;
  if (count === 0) {
    console.error('warning: no accounts mounted yet. run `nbridge add` first.');
  }
  console.error(
    `nbridge up — ${count} account(s) mounted. MCP server starting on stdio…`,
  );
  await startMcpServer(registry, config);
}
