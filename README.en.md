<div align="right"><sub><b>English</b> &nbsp;|&nbsp; [简体中文](./README.md)</sub></div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/hero-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./assets/hero-light.svg">
  <img src="./assets/hero-light.svg" width="880" alt="N-Bridge — local multi-account connector bridge">
</picture>

<p align="center"><sub>The local bridge that mounts N Google accounts so An Ai Agent can reach them all in one call — no re-OAuth, no sign-out/sign-in.</sub></p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-0071E3" alt="license"></a>
  <a href="https://github.com/SuperMarioYL/n-bridge--ma7c2n4k/releases"><img src="https://img.shields.io/github/v/release/SuperMarioYL/n-bridge--ma7c2n4k?label=release" alt="release"></a>
  <a href="https://github.com/SuperMarioYL/n-bridge--ma7c2n4k/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/SuperMarioYL/n-bridge--ma7c2n4k/ci.yml?branch=main&label=ci" alt="ci"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A522-339933" alt="node">
  <a href="https://www.npmjs.com/package/n-bridge"><img src="https://img.shields.io/npm/v/n-bridge?label=npm" alt="npm"></a>
  <a href="https://gitee.com/SuperMarioYL/n-bridge"><img src="https://img.shields.io/badge/mirror-gitee-CC2222" alt="gitee"></a>
  <img src="https://img.shields.io/badge/Agentic-5E5CE6" alt="agentic">
  <img src="https://img.shields.io/badge/AI--First-10A37F" alt="ai-first">
</p>

> **Official connectors hard-code "one account per service" — multi-account means signing out and back in. N-Bridge mounts N Google accounts behind one bridge for your AI agent; refresh tokens live in the OS keychain and never leave your machine.**

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Architecture](#architecture)
- [Install](#install)
- [Quickstart](#quickstart)
- [Usage](#usage)
- [Demo](#demo)
- [Configuration](#configuration)
- [vs googleworkspace/cli](#vs-googleworkspacecli)
- [Pricing](#pricing)
- [Roadmap](#roadmap)
- [FAQ](#faq)
- [Share this](#share-this)

## Why this exists

Official ChatGPT/Codex Gmail and Calendar connectors bake "one account per service, per user" into their billing/identity model. With 2+ Gmail inboxes and 2+ calendars, getting an agent to read "the other account" means manually signing out and back in, or copy-pasting across accounts — exactly the "meat proxy" chore agents exist to remove. N-Bridge drops a local bridge between the agent and Google: mount N accounts once, no re-OAuth, no account-switching. It's a pluggable multi-account connector node for open agent frameworks like [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent).

## <img src="https://api.iconify.design/tabler:topology-star-3.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> Architecture

Three in-process modules, one binary: OAuth + token store (keychain) → account registry → MCP server (stdio, fanout + merge).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/atlas-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./assets/atlas-light.svg">
  <img src="./assets/atlas-light.svg" width="880" alt="Architecture: Agent -stdio-> N-Bridge MCP server -fanout-> Google accounts; OS keychain feeds refresh tokens">
</picture>

The core primitive is the **account registry + fanout tool**. Each mounted account is `{id, surface, profile, tokenRef}`; the refresh token lives only in the keychain. The MCP tools `gmail.list` / `calendar.list` / `drive.list` take an optional `account_id`; omit it (or pass `"*"`) and the tool **fans out** across every mounted account for that surface, returning merged, account-tagged results. It inverts the vendor's "one connector, one account" into "one bridge, N accounts" — the exact cut the official per-user-billing model cannot structurally copy.

## <img src="https://api.iconify.design/tabler:rocket.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> Install

```bash
npm install -g n-bridge
# or from source: git clone https://github.com/SuperMarioYL/n-bridge--ma7c2n4k && npm install && npm run build
```

Requires Node ≥ 22 (the keytar native binding ships prebuilt for macOS Keychain / Windows Credential Manager / Linux Secret Service).

## <img src="https://api.iconify.design/tabler:rocket.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> Quickstart

3 commands from cold clone to reading two inboxes:

```bash
export NBRIDGE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com   # one-time, see BUILD_SETUP_NEXT_STEPS
export NBRIDGE_GOOGLE_CLIENT_SECRET=xxxx
nbridge add        # browser OAuth -> refresh token saved to keychain
nbridge add        # mount a 2nd account
nbridge up         # boot the bridge + MCP server (stdio)
```

<details><summary>Sample output</summary>

```
$ nbridge list
2 account(s) mounted:
  acct-1  Founder <founder@workmail.com>  [gmail, calendar, drive]
  acct-2  <ops@sidehive.io>  [gmail, calendar, drive]

$ nbridge up
nbridge up — 2 account(s) mounted. MCP server starting on stdio…
```
</details>

## <img src="https://api.iconify.design/tabler:terminal-2.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> Usage

The 5 most common workflows (full examples in [`examples/`](./examples)):

```bash
nbridge add          # mount a Google account (browser OAuth, token -> keychain)
nbridge list         # show mounted accounts (metadata only; tokens stay in the keychain)
nbridge up           # boot the bridge + MCP server (stdio) for an agent to connect
nbridge --version
nbridge --help
```

Point an agent (Claude Code / Codex / an open-framework node) at `nbridge up`:

```json
{ "mcpServers": { "nbridge": { "command": "nbridge", "args": ["up"] } } }
```

Ask the agent *"list unread mail across my accounts"* — one `gmail.list` call fans out and merges every mounted inbox. To scope to one account, pass its `account_id` (from `nbridge list`):

```json
{ "account_id": "acct-1", "maxResults": 5 }
```

## <img src="https://api.iconify.design/tabler:photo.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> Demo

`nbridge add` ×2 → `nbridge up` → an agent calls `gmail.list` across both inboxes:

![demo](assets/demo.gif)

> Tape source in [`docs/demo.tape`](./docs/demo.tape), rendered by `.github/workflows/demo.yml` with vhs.

## <img src="https://api.iconify.design/tabler:adjustments.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> Configuration

All configuration is environment variables (no config file, no plaintext on disk):

| Variable | Type | Default | Meaning |
|---|---|---|---|
| `NBRIDGE_GOOGLE_CLIENT_ID` | string | — | Google OAuth client id (required, see BUILD_SETUP_NEXT_STEPS) |
| `NBRIDGE_GOOGLE_CLIENT_SECRET` | string | — | Google OAuth client secret (required) |
| `NBRIDGE_CALLBACK_PORT` | number | `8421` | Local port the OAuth callback server listens on |
| `NBRIDGE_REDIRECT_URI` | string | `http://127.0.0.1:8421/cb` | OAuth redirect URI (must match the Google console) |

Account metadata lives at `~/.nbridge/accounts.json` (email + tokenRef only, **no tokens**); refresh tokens live only in the OS keychain under the `nbridge` service.

## vs googleworkspace/cli

| Axis | [googleworkspace/cli](https://github.com/googleworkspace/cli) | N-Bridge |
|---|:---:|:---:|
| Unifies Gmail / Calendar / Drive for agents | ✓ | ✓ |
| Multi-account (N Google accounts, one bridge) | — | ✓ |
| One OAuth persisted, no re-consent | — | ✓ |
| Refresh tokens in OS keychain, never leave host | — | ✓ |
| Google-backed, community scale | ✓ (30k★) | — |

Honest take: googleworkspace/cli wins decisively on surface breadth and ecosystem scale — it folds Drive/Sheets/Docs into one tool. N-Bridge only cuts the slice it doesn't: **multi-account + persistent tokens**. It's a complement, not a replacement.

## <img src="https://api.iconify.design/tabler:coin.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> Pricing

| Tier | Price | What it is |
|---|---|---|
| **Local OSS** | free forever | This repo. Single-operator local bridge; tokens never leave the host |
| **Hosted team tier** *(planned)* | ¥99 / seat / month (3-seat min) | Hosted multi-account bridge + enterprise account pool (shared refresh-token pool, rotation, audit log) + connector packs for CN coding agents (Doubao / Trae / Kimi) |

Hosted shape: [Fly.io](https://fly.io) (global) + Alibaba Cloud (CN latency); billing via Stripe (global) + WeChat Pay (CN); refresh tokens encrypted at rest, isolated per-team KMS. **Self-hosted free is the funnel; the hosted team tier is the commercial close.**

> v0.1 ships the local OSS layer only. The hosted team tier is a roadmap item, not implemented in this release.

## <img src="https://api.iconify.design/tabler:map-2.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> Roadmap

- [x] **m1 — add account OAuth**: `nbridge add` runs browser consent, stores refresh token in the keychain
- [x] **m2 — fanout MCP server**: `gmail.list` / `calendar.list` / `drive.list` fan out and merge account-tagged results
- [x] **m3 — one-command up + demo**: `nbridge up` boots the registry + MCP server from one command
- [ ] Hosted team tier (enterprise account pool + audit + CN coding-agent connector packs)
- [ ] Non-Google surfaces (Microsoft / Slack etc. — explicitly out of scope in v0.1)
- [ ] Web dashboard (v0.1 is CLI + MCP only)
- [ ] Push notifications / webhooks (v0.1 is polling fanout only)

## <img src="https://api.iconify.design/tabler:help-circle.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> FAQ

**Why can't the official ChatGPT/Codex connectors do multi-account?**
It's not a feature gap, it's a model conflict. The vendor's per-user billing/identity model bakes "one subscription = one identity" into the spine — mounting N accounts would break its billing spine, which is exactly why their plugins team publicly solicited multi-account as the #1 friction. N-Bridge routes around that wall from the outside.

**Where is my refresh token stored? Does it leave my machine?**
The OS keychain: macOS Keychain / Windows Credential Manager / Linux Secret Service. Never written to disk in plaintext, never uploaded. `~/.nbridge/accounts.json` holds only email + tokenRef, no tokens.

**What happens if OpenAI ships native multi-account?**
That's the single biggest risk. Mitigation: anchor as an open-framework node (NousResearch/hermes-agent and friends) the vendor can't reach. If they announce within 90 days, pivot to the "open-framework standard node" route; the local OSS layer stays free forever and doesn't depend on the official roadmap.

## <img src="https://api.iconify.design/tabler:share-2.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> Share this

```
N-Bridge — the local bridge that mounts N Google accounts for An Ai Agent. One `nbridge up` and your Claude Code agent reads 2 Gmail inboxes in one tool call. Refresh tokens stay in the OS keychain. https://github.com/SuperMarioYL/n-bridge--ma7c2n4k
```

## License

[MIT](./LICENSE) · held by an independent maintainer. Issues and PRs welcome: [issues](https://github.com/SuperMarioYL/n-bridge--ma7c2n4k/issues).

<p align="center"><sub><a href="./LICENSE">MIT</a> © 2026 SuperMarioYL</sub></p>
