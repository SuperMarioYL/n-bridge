# Using N-Bridge

Mount two Google accounts once, then read both inboxes in one tool call.

```bash
# 1. mount account #1 (browser OAuth, refresh token stored in the OS keychain)
nbridge add

# 2. mount account #2
nbridge add

# 3. boot the bridge + MCP server on stdio
nbridge up
```

Then point your agent at it (see `agent-config.json`):

```json
{ "mcpServers": { "nbridge": { "command": "nbridge", "args": ["up"] } } }
```

Ask the agent: *"list unread mail across my accounts"* — one `gmail.list` call
returns merged, account-tagged results from every mounted inbox.

## Scope a call to one account

By default every tool fans out across all mounted accounts. Pass a specific
`account_id` (from `nbridge list`) to scope a call:

```json
{ "account_id": "acct-1", "maxResults": 5 }
```
