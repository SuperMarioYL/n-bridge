import { exec } from 'node:child_process';
import { Hono } from 'hono';
import { serve, type ServerType } from '@hono/node-server';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { AppConfig } from '../config.js';
import type { TokenStore } from './token-store.js';

export interface OAuthResult {
  refreshToken: string | undefined;
  email: string;
  displayName?: string;
}

const OK_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>N-Bridge</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f7;color:#1d1d1f}h1{font-weight:600}</style></head>
<body><h1>✓ Account mounted — you can close this tab.</h1></body></html>`;

/**
 * Run a single Google account through OAuth consent on a local callback port,
 * exchange the code for a refresh token, and hand it to the token store.
 *
 * `tokenRef` is the keychain key the token will be stored under — caller owns
 * it so the registry can persist the ref in metadata before the token lands.
 */
export async function runConsentFlow(
  config: AppConfig,
  tokenStore: TokenStore,
  tokenRef: string,
): Promise<OAuthResult> {
  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      'Google OAuth credentials are missing. Set NBRIDGE_GOOGLE_CLIENT_ID and NBRIDGE_GOOGLE_CLIENT_SECRET (see BUILD_SETUP_NEXT_STEPS.md).',
    );
  }

  const o = new OAuth2Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  });

  const authUrl = o.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: config.scopes,
  });

  openBrowser(authUrl);
  console.error('\nWaiting for consent in your browser…');
  console.error(`If it did not open, visit:\n  ${authUrl}\n`);

  const code = await waitForCode(config.callbackPort);
  const tokenResponse = await o.getToken(code);
  const tokens = tokenResponse.tokens;
  const refreshToken = tokens.refresh_token;

  if (!refreshToken) {
    // Google only returns a refresh_token the first time a user consents, or
    // when prompt=consent forces it. If the user already consented without
    // forcing, we need to ask them to revoke and re-consent.
    throw new Error(
      'Google returned no refresh_token. Revoke access at https://myaccount.google.com/permissions and run `nbridge add` again.',
    );
  }

  await tokenStore.save(tokenRef, refreshToken);
  o.setCredentials(tokens);

  const profile = await resolveProfile(o);
  return { refreshToken, email: profile.email, displayName: profile.displayName };
}

async function resolveProfile(
  o: OAuth2Client,
): Promise<{ email: string; displayName?: string }> {
  const oauth2 = google.oauth2({ version: 'v2', auth: o });
  const r = await oauth2.userinfo.get();
  const data = r.data;
  return {
    email: data.email ?? 'unknown',
    displayName: data.name ?? undefined,
  };
}

function waitForCode(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const app = new Hono();
    let settled = false;
    let server: ServerType;

    app.get('/cb', async (c) => {
      const err = c.req.query('error');
      const code = c.req.query('code');
      if (err) {
        if (!settled) {
          settled = true;
          reject(new Error(`OAuth provider returned error: ${err}`));
        }
        return c.text(`OAuth error: ${err}`, 400);
      }
      if (!code) return c.text('missing code parameter', 400);
      if (!settled) {
        settled = true;
        resolve(code);
      }
      return c.html(OK_HTML);
    });

    server = serve({ fetch: app.fetch, port }, (info) => {
      console.error(`OAuth callback listening on http://127.0.0.1:${info.port}/cb`);
    });

    // Safety net — never block forever.
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        server.close();
        reject(new Error('OAuth consent timed out after 300s.'));
      }
    }, 300_000);
    // Keep the timer from keeping the process alive past resolution.
    timeout.unref?.();
  });
}

function openBrowser(url: string): void {
  const escaped = url.replace(/"/g, '\\&');
  const cmd =
    process.platform === 'darwin'
      ? `open "${escaped}"`
      : process.platform === 'win32'
        ? `start "" "${escaped}"`
        : `xdg-open "${escaped}"`;
  exec(cmd, () => {
    /* best-effort; the URL is also printed for manual fallback */
  });
}
