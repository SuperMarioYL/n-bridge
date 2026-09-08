[简体中文](./README.md) · [Website](https://n-bridge.lei6393.com) · [GitHub](https://github.com/SuperMarioYL/n-bridge)

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="./assets/presentation/hero-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="./assets/presentation/hero-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="./assets/presentation/hero-dark.svg">
  <img src="./assets/presentation/hero-light.svg" width="960" alt="Hero diagram">
</picture>

# N-Bridge

**Query the right Google accounts in one call**

N-Bridge registers multiple Google accounts behind a local MCP server. Select one account or query every account that supports the requested Gmail, Calendar or Drive surface.

## Why use it

When work and personal data live in separate accounts, a useful result needs both routing and attribution. N-Bridge selects eligible accounts before calling their APIs and keeps account_id on every returned group.

- **Choose scope explicitly** — An account_id selects one account; an omitted ID or * selects all eligible accounts.
- **Preserve attribution** — Merged results remain grouped by account and service.
- **Separate tokens from metadata** — Refresh tokens go through an OS-keychain backend; account metadata is stored separately.

## Architecture

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="./assets/presentation/architecture-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="./assets/presentation/architecture-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="./assets/presentation/architecture-dark.svg">
  <img src="./assets/presentation/architecture-light.svg" width="960" alt="Architecture diagram">
</picture>

OAuth consent populates the account registry and token store. The stdio MCP server exposes gmail.list, calendar.list and drive.list. selectAccounts filters by surface and optional ID; fanout invokes GoogleSurfaceClient concurrently and returns account-tagged results.

| Component | Responsibility |
| --- | --- |
| `MCP request` | tool + optional account_id |
| `Account selection` | registered service coverage |
| `Google client` | per-account API calls |
| `Tagged results` | account_id + surface + items |
| `OS keychain` | refresh-token storage |

## Install and quickstart

Node.js 22+. Real account access also needs a working keytar OS-keychain backend and Google OAuth client configuration. The routing example needs neither credentials nor keychain access.

```bash
git clone https://github.com/SuperMarioYL/n-bridge.git
cd n-bridge
npm ci
npm run build
```

The shipped example calls the production selectAccounts function with complete synthetic account metadata. It shows routing decisions only; it does not simulate or claim successful Google queries.

```bash
node examples/presentation-demo.mjs
```

## Recorded demo

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="./assets/presentation/process-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="./assets/presentation/process-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="./assets/presentation/process-dark.svg">
  <img src="./assets/presentation/process-light.svg" width="960" alt="Process diagram">
</picture>

Four routing queries show service filtering and explicit account selection; no Google data is fetched.

```text
{"surface":"gmail","account_id":"*","selected":["work","personal"]}
{"surface":"gmail","account_id":"personal","selected":["personal"]}
{"surface":"calendar","account_id":"*","selected":["work","calendar-only"]}
{"surface":"drive","account_id":"work","selected":[]}
Scope: actual account-routing function on synthetic metadata; no OAuth, keychain or Google API access.
```

The complete command and output are recorded in [docs/demo-results.json](./docs/demo-results.json). Inputs and reproduction code are included in the repository.

![Existing terminal recording](./assets/demo.gif)

The existing recording is retained for context; the text example above documents the reproducible scenario.

## Usage

After setting your OAuth client variables, add opens browser consent for one account. Repeat it for other accounts. list displays mounted metadata; up serves MCP over stdio. Configure an MCP client to launch node with the absolute path to dist/index.js and argument up. Tools accept account_id, maxResults and q; q is used by Gmail and Drive, not Calendar.

```bash
node dist/index.js add
node dist/index.js list
node dist/index.js up
```

## Configuration

NBRIDGE_GOOGLE_CLIENT_ID and NBRIDGE_GOOGLE_CLIENT_SECRET supply OAuth credentials. NBRIDGE_CALLBACK_PORT defaults to 8421; NBRIDGE_REDIRECT_URI defaults to http://127.0.0.1:<port>/cb and must match your registered redirect. ~/.nbridge/accounts.json contains profiles, supported surfaces and token references; keytar stores refresh tokens under the nbridge service. Tokens are used with Google for authentication, and queried data is returned to the connected MCP client.

## Integrations and responsibilities

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="./assets/presentation/integrations-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="./assets/presentation/integrations-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="./assets/presentation/integrations-dark.svg">
  <img src="./assets/presentation/integrations-light.svg" width="960" alt="Integrations diagram">
</picture>

The implemented tools list Google data using read-only scopes. Gmail returns message metadata and snippets, Calendar queries the primary calendar, and Drive lists selected file metadata. This local bridge does not provide Microsoft/Slack adapters or a hosted team account pool.

| Route | Implemented role |
| --- | --- |
| Gmail | message metadata listing |
| Calendar | upcoming primary-calendar events |
| Drive | file metadata listing |
| MCP stdio | three read-only list tools |
| OS keychain | refresh-token backend |

## Limits and next steps

- The offline example verifies account selection only. OAuth consent, token refresh, keychain operation and live Google APIs require separate setup and verification.
- If one account fails, that account returns an error entry with no items while the other accounts still return their results.
- The current list tools do not paginate through every result or provide write operations.

Implemented: multi-account registration, OS-keychain storage, three MCP list tools and per-account failure isolation. Future work includes pagination and additional providers. Hosted pooling, billing, a web dashboard and notifications are not implemented.

## License and contributions

See [LICENSE](./LICENSE). When reporting an issue, include a minimal input, the command, and the observed output.
