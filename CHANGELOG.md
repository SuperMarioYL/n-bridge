# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] — 2026-10-10

Tool-contract fixes on the query path, a keychain-free `nbridge list`, and the
missing half of the account lifecycle: `nbridge remove`.

### m5 — tool-call contract fixes
- `calendar.list` no longer silently drops the `q` parameter: the tool schema
  advertises it on every surface, and the Calendar API supports free-text
  search, so `q` is now forwarded to `events.list`.
- One deleted Gmail message no longer fails the whole account call. Each
  message fetch is isolated: a failed message comes back as an inline
  `{id, error}` entry while the other messages still return.
- A targeted call with an unknown `account_id` now returns an account-tagged
  error entry naming the requested id (and the mounted ids) instead of a
  silent empty result that looked like "no matches".

### m6 — `nbridge list` without a keychain
- `nbridge list` reads only the metadata file, so it no longer fails on hosts
  where the keytar native binding cannot load (headless Linux, minimal
  containers). `nbridge add` / `nbridge up` still require a working keychain
  and fail fast with a clear error when it is unavailable.

### m7 — `nbridge remove <account_id>`
- New command to unmount an account: deletes its keychain refresh token and
  drops it from the metadata registry. Ids come from `nbridge list`; a missing
  or unknown id exits 1 without touching the keychain.

### m8 — v0.3.0 version bump
- `VERSION`, `package.json`, `src/config.ts` and `web/site.json`
  (`meta.content_version`) all carry 0.3.0 in lockstep.

## [0.2.0] — 2026-09-09

Patch release: the OAuth consent flow no longer hangs the CLI, fanout degrades
per account instead of failing the whole call, and the repository URLs point
at the real repo.

### m1 — fix OAuth callback server hang
- `nbridge add` previously hung forever after a successful consent (and after a
  provider error): the local OAuth callback server was never closed, keeping
  the Node process alive. Every settle path now closes the listener and reaps
  lingering connections, so the CLI exits promptly after consent.

### m2 — fanout partial success
- A single failed account (revoked or expired refresh token, network error)
  no longer rejects the whole `gmail.list` / `calendar.list` / `drive.list`
  call. A failed account comes back as an account-tagged entry with an `error`
  field and no items; healthy accounts still return their results in the same
  merged call.

### m3 — fix repository URLs
- `package.json` repository/homepage/bugs, the CLI help text, the changelog
  links and both READMEs now point at the real repository
  (`SuperMarioYL/n-bridge`) instead of a dead build-slug URL that 404ed.

### m4 — v0.2.0 version bump
- `VERSION`, `package.json`, `src/config.ts` and `web/site.json`
  (`meta.content_version`) all carry 0.2.0 in lockstep.

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

[0.1.0]: https://github.com/SuperMarioYL/n-bridge/releases/tag/v0.1.0
[0.2.0]: https://github.com/SuperMarioYL/n-bridge/releases/tag/v0.2.0
[0.3.0]: https://github.com/SuperMarioYL/n-bridge/releases/tag/v0.3.0
