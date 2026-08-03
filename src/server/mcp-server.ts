import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { VERSION, type AppConfig } from '../config.js';
import type { AccountRegistry } from '../accounts/registry.js';
import { fanout, type ListQuery } from '../surfaces/fanout.js';
import {
  GoogleSurfaceClient,
  surfaceForTool,
  toolDefs,
} from '../tools/mcp-tools.js';

/**
 * Boot the N-Bridge MCP server on stdio. One tool per Google surface
 * (gmail.list / calendar.list / drive.list); each fans out across the mounted
 * accounts and returns merged, account-tagged results.
 */
export async function startMcpServer(
  registry: AccountRegistry,
  config: AppConfig,
): Promise<void> {
  const server = new Server(
    { name: 'n-bridge', version: VERSION },
    { capabilities: { tools: {} } },
  );
  const client = new GoogleSurfaceClient(registry, config);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefs(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const surface = surfaceForTool(name);
    if (!surface) {
      return {
        content: [{ type: 'text' as const, text: `unknown tool: ${name}` }],
        isError: true,
      };
    }
    const query: ListQuery = {
      account_id: (args as { account_id?: string } | undefined)?.account_id,
      maxResults: (args as { maxResults?: number } | undefined)?.maxResults,
      q: (args as { q?: string } | undefined)?.q,
    };
    try {
      const results = await fanout(registry.list(), surface, query, client);
      const payload = {
        surface,
        accounts: results.length,
        results,
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
      };
    } catch (err) {
      return {
        content: [
          { type: 'text' as const, text: `nbridge error: ${(err as Error).message}` },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
