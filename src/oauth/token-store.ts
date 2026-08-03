/**
 * Token store — refresh tokens live in the OS keychain, never on disk.
 *
 * The keychain backend is an injectable interface so the round-trip logic can
 * be tested with an in-memory fake (the real keychain prompts the user and is
 * unavailable in CI). `getSystemKeychain()` lazily loads the native `keytar`
 * binding so that importing this module never requires a working keychain —
 * only an actual `save`/`get`/`delete` call touches the native binding.
 */

export interface KeychainBackend {
  setPassword(service: string, account: string, password: string): Promise<void>;
  getPassword(service: string, account: string): Promise<string | null>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

let _systemBackend: KeychainBackend | null = null;

/**
 * Lazily import the native keytar binding and adapt it to the KeychainBackend
 * interface. Throws only when actually called in an environment with no native
 * keychain — importing the module is safe.
 */
export async function getSystemKeychain(): Promise<KeychainBackend> {
  if (_systemBackend) return _systemBackend;
  // `keytar` is a CommonJS module with named exports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod: any = await import('keytar');
  const fn = mod.default ?? mod;
  const backend: KeychainBackend = {
    setPassword: (service, account, password) =>
      fn.setPassword(service, account, password),
    getPassword: (service, account) => fn.getPassword(service, account),
    deletePassword: (service, account) => fn.deletePassword(service, account),
  };
  _systemBackend = backend;
  return backend;
}

/** A keychain namespace + backend pair that stores one refresh token per account. */
export class TokenStore {
  constructor(
    private readonly backend: KeychainBackend,
    private readonly service: string,
  ) {}

  async save(tokenRef: string, refreshToken: string): Promise<void> {
    if (!refreshToken) throw new Error('refusing to store an empty refresh token');
    await this.backend.setPassword(this.service, tokenRef, refreshToken);
  }

  async get(tokenRef: string): Promise<string | null> {
    return this.backend.getPassword(this.service, tokenRef);
  }

  async delete(tokenRef: string): Promise<boolean> {
    return this.backend.deletePassword(this.service, tokenRef);
  }
}
