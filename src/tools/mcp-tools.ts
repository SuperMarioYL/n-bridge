import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { AppConfig, Surface } from '../config.js';
import type { Account, AccountRegistry } from '../accounts/registry.js';
import type { ListQuery, SurfaceClient, ToolRes } from '../surfaces/fanout.js';

export const GMAIL_LIST = 'gmail.list';
export const CALENDAR_LIST = 'calendar.list';
export const DRIVE_LIST = 'drive.list';

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

function baseInputSchema(surface: Surface): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      account_id: {
        type: 'string',
        description: `Optional. Account id to scope the call to one account. Omit or pass "*" to fan out across every mounted ${surface} account and merge.`,
      },
      maxResults: {
        type: 'number',
        description: 'Max items returned per account (default 10).',
      },
      q: {
        type: 'string',
        description: 'Optional upstream query/filter (e.g. Gmail search query, Drive query string).',
      },
    },
    additionalProperties: false,
  };
}

/** The three MCP tools the bridge exposes. */
export function toolDefs(): ToolDef[] {
  return [
    {
      name: GMAIL_LIST,
      description:
        'List Gmail messages. With no account_id, fans out across every mounted account and returns merged, account-tagged results.',
      inputSchema: baseInputSchema('gmail'),
    },
    {
      name: CALENDAR_LIST,
      description:
        'List upcoming Calendar events. With no account_id, fans out across every mounted account and returns merged, account-tagged results.',
      inputSchema: baseInputSchema('calendar'),
    },
    {
      name: DRIVE_LIST,
      description:
        'List Drive files. With no account_id, fans out across every mounted account and returns merged, account-tagged results.',
      inputSchema: baseInputSchema('drive'),
    },
  ];
}

export function surfaceForTool(name: string): Surface | null {
  if (name === GMAIL_LIST) return 'gmail';
  if (name === CALENDAR_LIST) return 'calendar';
  if (name === DRIVE_LIST) return 'drive';
  return null;
}

/**
 * Real surface client: refreshes each account's access token on demand and
 * calls the Google API for the requested surface. One call per account;
 * the fanout layer runs them concurrently.
 */
export class GoogleSurfaceClient implements SurfaceClient {
  constructor(
    private readonly registry: AccountRegistry,
    private readonly config: AppConfig,
  ) {}

  private async oauthFor(account: Account): Promise<OAuth2Client> {
    const refreshToken = await this.registry.getToken(account);
    if (!refreshToken) {
      throw new Error(`no refresh token in keychain for account ${account.id} (${account.profile.email}); run \`nbridge add\` again.`);
    }
    const o = new OAuth2Client({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      redirectUri: this.config.redirectUri,
    });
    o.setCredentials({ refresh_token: refreshToken });
    return o;
  }

  async list(surface: Surface, account: Account, query: ListQuery): Promise<ToolRes> {
    const max = query.maxResults ?? 10;
    if (surface === 'gmail') return this.listGmail(account, max, query.q);
    if (surface === 'calendar') return this.listCalendar(account, max);
    return this.listDrive(account, max, query.q);
  }

  private async listGmail(
    account: Account,
    max: number,
    q?: string,
  ): Promise<ToolRes> {
    const o = await this.oauthFor(account);
    const gmail = google.gmail({ version: 'v1', auth: o });
    const list = await gmail.users.messages.list({
      userId: 'me',
      maxResults: max,
      q,
    });
    const ids = list.data.messages ?? [];
    const items = await Promise.all(
      ids.slice(0, max).map(async (m) => {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: m.id!,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'],
        });
        const headers = Object.fromEntries(
          (msg.data.payload?.headers ?? []).map((h) => [h.name, h.value]),
        );
        return {
          id: m.id,
          threadId: m.threadId,
          snippet: msg.data.snippet,
          subject: headers.Subject,
          from: headers.From,
          date: headers.Date,
        };
      }),
    );
    return { account_id: account.id, surface: 'gmail', items };
  }

  private async listCalendar(account: Account, max: number): Promise<ToolRes> {
    const o = await this.oauthFor(account);
    const calendar = google.calendar({ version: 'v3', auth: o });
    const now = new Date().toISOString();
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now,
      maxResults: max,
      singleEvents: true,
      orderBy: 'startTime',
    });
    const items = (res.data.items ?? []).map((e) => ({
      id: e.id,
      summary: e.summary,
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
    }));
    return { account_id: account.id, surface: 'calendar', items };
  }

  private async listDrive(
    account: Account,
    max: number,
    q?: string,
  ): Promise<ToolRes> {
    const o = await this.oauthFor(account);
    const drive = google.drive({ version: 'v3', auth: o });
    const res = await drive.files.list({
      pageSize: max,
      q,
      fields: 'files(id, name, mimeType, modifiedTime)',
    });
    const items = (res.data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
    }));
    return { account_id: account.id, surface: 'drive', items };
  }
}
