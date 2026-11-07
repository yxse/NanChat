import { invoke } from '@tauri-apps/api/core';

function isMacOS(): boolean {
  return /Mac/i.test(navigator.platform ?? navigator.userAgent);
}

// Thrown when the secret storage can't be used (keyring missing, locked,
// access denied...). Distinct from "secret not found", which returns null:
// treating a storage failure as a missing wallet would send the user back to
// onboarding, or make them believe a wallet was saved when it wasn't.
export class SecureStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecureStorageError';
  }
}

function toStorageError(error: unknown): SecureStorageError {
  return new SecureStorageError(typeof error === 'string' ? error : (error as Error)?.message ?? String(error));
}

export type SecureStorageBackend = 'keyring' | 'file';
// keyringError: why the system keyring wasn't used (Linux file fallback)
export type SecureStorageStatus = { backend: SecureStorageBackend | null; error: string | null; keyringError?: string | null };

let statusPromise: Promise<SecureStorageStatus> | null = null;

// Where secrets are stored on this computer. "file" means no system keyring is
// available (some Linux setups): the seed must then be password-encrypted.
export function getSecureStorageStatus(recheck = false): Promise<SecureStorageStatus> {
  if (recheck || !statusPromise) {
    statusPromise = invoke<SecureStorageStatus>('secure_storage_status', { recheck }).catch((error) => {
      statusPromise = null;
      return { backend: null, error: toStorageError(error).message, keyringError: null };
    });
  }
  return statusPromise;
}

// macOS ties keychain "Always Allow" decisions to the app's code signature,
// which isn't stable across dev/unsigned builds. That means every distinct
// keychain entry (seed, chatTokens, pin, ...) re-prompts the user. To avoid
// that, on macOS we bundle all secrets for a service into a single keychain
// entry and cache it in memory, so there's at most one prompt per session.
// Windows/Linux don't have this issue, so they keep the original 1:1 behavior.

const BUNDLE_KEY = '__bundle__';
const LEGACY_KEYS = ['seed', 'chatTokens', 'pin'];

// cache: service → { username → secret }
const bundleCache = new Map<string, Record<string, string>>();
const bundleLoading = new Map<string, Promise<Record<string, string>>>();

function loadBundle(service: string): Promise<Record<string, string>> {
  const cached = bundleCache.get(service);
  if (cached) return Promise.resolve(cached);
  let loading = bundleLoading.get(service);
  if (!loading) {
    loading = readBundle(service).finally(() => bundleLoading.delete(service));
    bundleLoading.set(service, loading);
  }
  return loading;
}

async function readBundle(service: string): Promise<Record<string, string>> {
  // throws if the keychain can't be read (e.g. prompt denied): don't treat that
  // as an empty bundle, the next save would overwrite the real one
  const raw = await invoke<string | null>('get_secret', { service, username: BUNDLE_KEY });
  if (raw != null) {
    const bundle = JSON.parse(raw) as Record<string, string>;
    bundleCache.set(service, bundle);
    return bundle;
  }
  // no bundle yet: migrate legacy individual entries
  const bundle: Record<string, string> = {};
  await migrateLegacyKeys(service, bundle);
  bundleCache.set(service, bundle);
  return bundle;
}

// One-time migration: pull existing individual keychain entries into the bundle
// and remove them so the user isn't prompted for old entries again.
async function migrateLegacyKeys(service: string, bundle: Record<string, string>) {
  let migrated = false;
  for (const username of LEGACY_KEYS) {
    try {
      const secret = await invoke<string | null>('get_secret', { service, username });
      if (secret) {
        bundle[username] = secret;
        migrated = true;
      }
    } catch {
      // unreadable entry, skip
    }
  }
  if (migrated) {
    await persistBundle(service, bundle);
    // delete the old entries only once the bundle is safely saved
    for (const username of LEGACY_KEYS) {
      if (username in bundle) {
        await invoke('delete_secret', { service, username }).catch(() => {});
      }
    }
  }
}

async function persistBundle(service: string, bundle: Record<string, string>) {
  await invoke('save_secret', {
    service,
    username: BUNDLE_KEY,
    password: JSON.stringify(bundle),
  });
}

class KeyringService {
  // Throws SecureStorageError if the secret couldn't be saved
  static async saveSecret(service: string, username: string, password: string): Promise<void> {
    try {
      if (!isMacOS()) {
        await invoke('save_secret', { service, username, password });
        return;
      }
      const bundle = await loadBundle(service);
      if (bundle[username] === password) {
        return; // unchanged — skip keychain write
      }
      const updated = { ...bundle, [username]: password };
      await persistBundle(service, updated);
      bundleCache.set(service, updated); // only once saved, so the cache never lies
    } catch (error) {
      console.error('Failed to save secret:', error);
      throw toStorageError(error);
    }
  }

  // null when the secret doesn't exist, throws SecureStorageError if the storage can't be read
  static async getSecret(service: string, username: string): Promise<string | null> {
    try {
      if (!isMacOS()) {
        return await invoke<string | null>('get_secret', { service, username });
      }
      const bundle = await loadBundle(service);
      return bundle[username] ?? null;
    } catch (error) {
      console.error('Failed to retrieve secret:', error);
      throw toStorageError(error);
    }
  }

  static async deleteSecret(service: string, username: string): Promise<void> {
    try {
      if (!isMacOS()) {
        await invoke('delete_secret', { service, username });
        return;
      }
      const bundle = await loadBundle(service);
      if (username in bundle) {
        const updated = { ...bundle };
        delete updated[username];
        await persistBundle(service, updated);
        bundleCache.set(service, updated);
      }
    } catch (error) {
      console.error('Failed to delete secret:', error);
      throw toStorageError(error);
    }
  }
}

export default KeyringService;
