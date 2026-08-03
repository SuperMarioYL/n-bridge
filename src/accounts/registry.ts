import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import type { TokenStore } from '../oauth/token-store.js';
import type { Surface } from '../config.js';

export type { Surface };

/** A mounted account. The refresh token itself lives in the keychain under `tokenRef`. */
export interface Account {
  id: string;
  surfaces: Surface[];
  profile: { email: string; displayName?: string };
  /** Keychain key under which the refresh token is stored. */
  tokenRef: string;
}

/** On-disk metadata shape (no tokens — tokens are in the keychain only). */
export interface AccountMetadata {
  id: string;
  surfaces: Surface[];
  profile: { email: string; displayName?: string };
  tokenRef: string;
}

/**
 * Account registry — in-memory map of mounted accounts, persisted as a small
 * metadata JSON file (email + tokenRef only) and rehydrated from the keychain
 * at `nbridge up`.
 */
export class AccountRegistry {
  private accounts: Account[] = [];

  constructor(
    private readonly accountsFile: string,
    private readonly tokenStore: TokenStore,
  ) {}

  async load(): Promise<void> {
    let raw: string;
    try {
      raw = await fs.readFile(this.accountsFile, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        this.accounts = [];
        return;
      }
      throw e;
    }
    const meta = JSON.parse(raw) as AccountMetadata[];
    this.accounts = meta.map((m) => ({ ...m }));
  }

  list(): Account[] {
    return [...this.accounts];
  }

  get(id: string): Account | undefined {
    return this.accounts.find((a) => a.id === id);
  }

  forSurface(surface: Surface): Account[] {
    return this.accounts.filter((a) => a.surfaces.includes(surface));
  }

  async add(account: Account, refreshToken: string): Promise<void> {
    // Token goes to the keychain first; metadata to disk second.
    await this.tokenStore.save(account.tokenRef, refreshToken);
    const without = this.accounts.filter((a) => a.id !== account.id);
    without.push(account);
    this.accounts = without;
    await this.persist();
  }

  async remove(id: string): Promise<void> {
    const acct = this.get(id);
    if (acct) {
      await this.tokenStore.delete(acct.tokenRef);
    }
    this.accounts = this.accounts.filter((a) => a.id !== id);
    await this.persist();
  }

  async getToken(account: Account): Promise<string | null> {
    return this.tokenStore.get(account.tokenRef);
  }

  private async persist(): Promise<void> {
    await fs.mkdir(dirname(this.accountsFile), { recursive: true });
    const meta: AccountMetadata[] = this.accounts.map((a) => ({
      id: a.id,
      surfaces: a.surfaces,
      profile: a.profile,
      tokenRef: a.tokenRef,
    }));
    await fs.writeFile(
      this.accountsFile,
      JSON.stringify(meta, null, 2) + '\n',
      'utf8',
    );
  }
}
