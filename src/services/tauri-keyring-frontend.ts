import { invoke } from '@tauri-apps/api/core';

function isMacOS(): boolean {
  return /Mac/i.test(navigator.platform ?? navigator.userAgent);
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
const loaded = new Set<string>();

async function loadBundle(service: string): Promise<Record<string, string>> {
  if (loaded.has(service)) {
    return bundleCache.get(service) ?? {};
  }
  loaded.add(service);
  try {
    const raw = await invoke('get_secret', { service, username: BUNDLE_KEY }) as string;
    const parsed = JSON.parse(raw) as Record<string, string>;
    bundleCache.set(service, parsed);
    return parsed;
  } catch {
    // no bundle yet — start empty, also migrate legacy individual entries
    const bundle: Record<string, string> = {};
    bundleCache.set(service, bundle);
    await migrateLegacyKeys(service, bundle);
    return bundle;
  }
}

// One-time migration: pull existing individual keychain entries into the bundle
// and remove them so the user isn't prompted for old entries again.
async function migrateLegacyKeys(service: string, bundle: Record<string, string>) {
  let migrated = false;
  for (const username of LEGACY_KEYS) {
    try {
      const secret = await invoke('get_secret', { service, username }) as string;
      if (secret) {
        bundle[username] = secret;
        migrated = true;
        await invoke('delete_secret', { service, username }).catch(() => {});
      }
    } catch {
      // key didn't exist, skip
    }
  }
  if (migrated) {
    await persistBundle(service, bundle);
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
  static async saveSecret(service: string, username: string, password: string) {
    if (!isMacOS()) {
      try {
        await invoke('save_secret', { service, username, password });
        console.log('Secret saved successfully');
      } catch (error) {
        console.error('Failed to save secret:', error);
      }
      return;
    }
    try {
      const bundle = await loadBundle(service);
      if (bundle[username] === password) {
        return; // unchanged — skip keychain write
      }
      bundle[username] = password;
      await persistBundle(service, bundle);
    } catch (error) {
      console.error('Failed to save secret:', error);
    }
  }

  static async getSecret(service: string, username: string) {
    if (!isMacOS()) {
      try {
        const secret = await invoke('get_secret', { service, username });
        return secret;
      } catch (error) {
        console.error('Failed to retrieve secret:', error);
        return null;
      }
    }
    try {
      const bundle = await loadBundle(service);
      return bundle[username] ?? null;
    } catch (error) {
      console.error('Failed to retrieve secret:', error);
      return null;
    }
  }

  static async deleteSecret(service: string, username: string) {
    if (!isMacOS()) {
      try {
        await invoke('delete_secret', { service, username });
        console.log('Secret deleted successfully');
      } catch (error) {
        console.error('Failed to delete secret:', error);
      }
      return;
    }
    try {
      const bundle = await loadBundle(service);
      if (username in bundle) {
        delete bundle[username];
        await persistBundle(service, bundle);
      }
    } catch (error) {
      console.error('Failed to delete secret:', error);
    }
  }
}

export default KeyringService;
