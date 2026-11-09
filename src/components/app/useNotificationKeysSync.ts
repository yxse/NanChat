import { useEffect } from "react";
import useSWR from "swr";
import { fetcherMessages } from "../messaging/fetcher";
import { useWallet } from "../useWallet";
import { isNotificationKeysSupported, syncNotificationKeys } from "../../services/notificationKeys";

// Keeps the iOS notification service extension's decryption keys in sync with the
// "Message preview" setting and the wallet accounts (see services/notificationKeys.ts).
export function useNotificationKeysSync() {
  const supported = isNotificationKeysSupported();
  // same key as NotificationSettings, so toggling the setting updates this immediately
  const { data: notificationSettings } = useSWR(supported ? "/config-notification" : null, fetcherMessages);
  const { wallet } = useWallet();
  const accounts = wallet?.accounts || [];
  const accountsId = accounts.map((account: { address: string; privateKey?: string }) => `${account.address}:${account.privateKey ? 1 : 0}`).join(",");
  const previewSetting = notificationSettings?.messagePreview;

  useEffect(() => {
    if (!supported || previewSetting === undefined) return; // settings not loaded yet: keep what is stored
    if (previewSetting && accounts.length === 0) return; // wallet not loaded yet
    syncNotificationKeys(!!previewSetting, accounts);
  }, [supported, previewSetting, accountsId]);
}
