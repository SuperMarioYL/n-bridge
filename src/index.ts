#!/usr/bin/env node
import { VERSION } from './config.js';
import { addAccount } from './cli/add-account.js';
import { listAccounts } from './cli/list.js';
import { up } from './cli/up.js';

const HELP = `nbridge — local multi-account connector bridge for AI agents
https://github.com/SuperMarioYL/n-bridge--ma7c2n4k

usage:
  nbridge add          mount a Google account (OAuth consent, refresh token
                       stored in the OS keychain — never on disk)
  nbridge list         list mounted accounts
  nbridge up           boot the bridge + MCP server on stdio
  nbridge --version    print version
  nbridge --help       show this help

point your agent (Claude Code / Codex / an open agent-framework node) at
\`nbridge up\` as an MCP server and call gmail.list / calendar.list / drive.list
across all mounted accounts in one tool call.`;

async function main(): Promise<void> {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'add':
      await addAccount();
      break;
    case 'list':
      await listAccounts();
      break;
    case 'up':
      await up();
      break;
    case undefined:
    case 'help':
    case '-h':
    case '--help':
      console.log(HELP);
      break;
    case '-v':
    case '--version':
      console.log(VERSION);
      break;
    default:
      console.error(`unknown command: ${cmd}\nrun \`nbridge --help\` for usage.`);
      process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
