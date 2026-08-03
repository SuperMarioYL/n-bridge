# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-08-04

First public release. A local multi-account connector bridge that lets an AI
agent reach N Gmail / Calendar / Drive accounts through one MCP server.

### m1 — add account OAuth
- `nbridge add` walks a Google account through OAuth consent on a local callback
  port and persists the refresh token in the OS keychain (macOS Keychain /
  Windows Credential Manager / Linux Secret Service). No plaintext tokens on
  disk.
- `nbridge list` shows every mounted account.

### m2 — fanout MCP server
- Stdio MCP server exposing `gmail.list`, `calendar.list`, and `drive.list`.
- Omitting `account_id` (or passing `"*"`) fans a call out across every mounted
  account and returns merged, account-tagged results.
- Passing a specific `account_id` scopes the call to that single account.

### m3 — one-command up + demo
- `nbridge up` boots the account registry and the MCP server from a single
  command on stdio — point Claude Code / Codex / an open agent-framework node
  at it and read two inboxes in one tool call.

[0.1.0]: https://github.com/SuperMarioYL/n-bridge--ma7c2n4k/releases/tag/v0.1.0
