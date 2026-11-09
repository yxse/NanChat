// Keys for the iOS notification service extension (ios/App/NanChatNotificationService), which
// decrypts message previews natively so they show even when iOS won't wake the app.
//
// Only Curve25519 secret keys are exported (blake2b of the account key, clamped: what
// multi-nano-web's box uses for decryption). They are a one way derivation of the account keys:
// they can read messages but cannot sign blocks, so they can't move funds.
// Keys are only exported while "Message preview" is enabled, and wiped when it is disabled
// or the wallet is removed.
import { Capacitor, registerPlugin } from "@capacitor/core";
import Curve25519Module from "multi-nano-web/dist/lib/util/curve25519";

interface NotificationKeysPlugin {
  setAccountKeys(options: { keys: Record<string, string> }): Promise<void>;
  addSharedKeys(options: { keys: Record<string, string> }): Promise<void>;
  clear(): Promise<void>;
}

const NotificationKeys = registerPlugin<NotificationKeysPlugin>("NotificationKeys");

// CJS default export: depending on the bundler interop it is either the class or the module
const Curve25519: any = (Curve25519Module as any).default ?? Curve25519Module;

const SYNCED_ADDRESSES_KEY = "notificationKeysAddresses";

export const isNotificationKeysSupported = () => Capacitor.getPlatform() === "ios";

const hexToBytes = (hex: string) => Uint8Array.from(hex.match(/.{2}/g) || [], (b) => parseInt(b, 16));
const bytesToHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** Curve25519 secret key used by `box.decrypt` for a Nano private key (hex). */
export function toCurveSecretKey(privateKey: string): string {
  return bytesToHex(new Curve25519().convertEd25519SecretKeyToCurve25519(hexToBytes(privateKey)));
}

/** Keys are indexed by the address without its ticker prefix (nano_, ban_, xrb_...). */
export const addressKeyId = (address: string) => address.slice(address.lastIndexOf("_") + 1);

let previewEnabled = false;
// group keys seen this session (sharedAccount -> private key), exported once preview is enabled
const sessionSharedKeys = new Map<string, string>();

async function exportSharedKeys(entries: Array<[string, string]>) {
  if (entries.length === 0) return;
  const keys: Record<string, string> = {};
  for (const [sharedAccount, privateKey] of entries) {
    keys[addressKeyId(sharedAccount)] = toCurveSecretKey(privateKey);
  }
  await NotificationKeys.addSharedKeys({ keys });
}

/**
 * Mirror the current wallet accounts to the extension when message preview is enabled,
 * or wipe everything when it is not.
 */
export async function syncNotificationKeys(
  isPreviewEnabled: boolean,
  accounts: Array<{ address: string; privateKey?: string }>,
) {
  if (!isNotificationKeysSupported()) return;
  previewEnabled = isPreviewEnabled;
  try {
    if (!isPreviewEnabled) {
      await clearNotificationKeys();
      return;
    }
    const keys: Record<string, string> = {};
    for (const account of accounts) {
      if (!account?.address || !account.privateKey) continue; // e.g. ledger accounts
      keys[addressKeyId(account.address)] = toCurveSecretKey(account.privateKey);
    }
    const addresses = Object.keys(keys).sort().join(",");
    if (localStorage.getItem(SYNCED_ADDRESSES_KEY) !== addresses) {
      // different wallet/accounts: drop group keys that belonged to the previous ones
      await NotificationKeys.clear();
      localStorage.setItem(SYNCED_ADDRESSES_KEY, addresses);
    }
    await NotificationKeys.setAccountKeys({ keys });
    await exportSharedKeys([...sessionSharedKeys.entries()]);
  } catch (error) {
    console.error("Failed to sync notification keys", error);
  }
}

/** Called whenever a group chat shared key is resolved. */
export function rememberSharedKey(sharedAccount: string, sharedKey: string) {
  if (!isNotificationKeysSupported() || !sharedAccount || typeof sharedKey !== "string") return;
  if (sessionSharedKeys.get(sharedAccount) === sharedKey) return;
  sessionSharedKeys.set(sharedAccount, sharedKey);
  if (previewEnabled) {
    exportSharedKeys([[sharedAccount, sharedKey]]).catch((error) =>
      console.error("Failed to export group notification key", error),
    );
  }
}

export async function clearNotificationKeys() {
  if (!isNotificationKeysSupported()) return;
  localStorage.removeItem(SYNCED_ADDRESSES_KEY);
  try {
    await NotificationKeys.clear();
  } catch (error) {
    console.error("Failed to clear notification keys", error);
  }
}
