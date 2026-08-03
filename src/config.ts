import { homedir } from 'node:os';
import { join } from 'node:path';

export const VERSION = '0.1.0';

/** Surfaces the bridge knows how to fan out across. */
export type Surface = 'gmail' | 'calendar' | 'drive';

export const ALL_SURFACES: Surface[] = ['gmail', 'calendar', 'drive'];

export interface AppConfig {
  /** Google OAuth client id (env-driven, never committed). */
  clientId: string;
  /** Google OAuth client secret (env-driven, never committed). */
  clientSecret: string;
  /** OAuth redirect URI — must match the Google console. */
  redirectUri: string;
  /** Local port the OAuth callback server listens on. */
  callbackPort: number;
  /** Keychain service name under which refresh tokens are stored. */
  keychainService: string;
  /** Local data directory (account metadata only — never tokens). */
  dataDir: string;
  /** Path to the account metadata JSON file. */
  accountsFile: string;
  /** OAuth scopes requested at consent. */
  scopes: string[];
}

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'openid',
  'email',
  'profile',
];

/**
 * Load config from environment with overrides. Credentials come from the
 * environment (or a one-shot override) so no secrets are ever written to disk.
 */
export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const callbackPort =
    overrides.callbackPort ??
    Number(process.env.NBRIDGE_CALLBACK_PORT ?? '8421');
  const redirectUri =
    overrides.redirectUri ??
    process.env.NBRIDGE_REDIRECT_URI ??
    `http://127.0.0.1:${callbackPort}/cb`;
  const dataDir = overrides.dataDir ?? join(homedir(), '.nbridge');
  const accountsFile =
    overrides.accountsFile ?? join(dataDir, 'accounts.json');
  return {
    clientId: overrides.clientId ?? process.env.NBRIDGE_GOOGLE_CLIENT_ID ?? '',
    clientSecret:
      overrides.clientSecret ??
      process.env.NBRIDGE_GOOGLE_CLIENT_SECRET ??
      '',
    redirectUri,
    callbackPort,
    keychainService: overrides.keychainService ?? 'nbridge',
    dataDir,
    accountsFile,
    scopes: overrides.scopes ?? DEFAULT_SCOPES,
  };
}

/** Human-readable summary used by `nbridge list` / `nbridge up` banners. */
export function describeConfig(config: AppConfig): string {
  const hasCreds = Boolean(config.clientId && config.clientSecret);
  return [
    `keychain service: ${config.keychainService}`,
    `metadata: ${config.accountsFile}`,
    `oauth callback: ${config.redirectUri}`,
    `credentials: ${hasCreds ? 'present' : 'MISSING (set NBRIDGE_GOOGLE_CLIENT_ID / _SECRET)'}`,
  ].join('\n');
}
