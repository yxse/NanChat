import { Capacitor, registerPlugin } from "@capacitor/core";
import { InAppBrowser } from "@capacitor/inappbrowser";
import { isTauri } from "@tauri-apps/api/core";
import { APP_VERSION } from "./client-version";

const GITHUB_REPO = "yxse/nanchat";
export const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.nanchat.app";
const APP_STORE_URL = "https://apps.apple.com/app/id6745021466";
const PLAY_STORE_INSTALLER = "com.android.vending";

// How this client gets updates:
// - tauri: built-in updater (latest.json on GitHub releases)
// - apk: Android installed outside Google Play, updated with the APK attached to GitHub releases
// - play / appstore: the store listing
// - web: a reload serves the latest build
export type UpdateChannel = "tauri" | "apk" | "play" | "appstore" | "web";

const InstallSource = registerPlugin<{ get(): Promise<{ installer: string | null }> }>("InstallSource");

let channelPromise: Promise<UpdateChannel> | null = null;
export const getUpdateChannel = (): Promise<UpdateChannel> => {
  channelPromise ??= (async () => {
    if (isTauri()) return "tauri";
    const platform = Capacitor.getPlatform();
    if (platform === "ios") return "appstore";
    if (platform !== "android") return "web";
    try {
      const { installer } = await InstallSource.get();
      return installer === PLAY_STORE_INSTALLER ? "play" : "apk";
    } catch {
      return "play"; // unknown: the store link is the safe default
    }
  })();
  return channelPromise;
};

const parseVersion = (v: string) => v.match(/(\d+)\.(\d+)\.(\d+)/)?.slice(1).map(Number) ?? null;

export const isNewerVersion = (candidate: string, current = APP_VERSION) => {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
};

export type ApkRelease = { version: string; url: string; size: number };

// The APK is not attached to every release, so take the newest published release that has one.
let apkPromise: Promise<ApkRelease | null> | null = null;
export const getLatestApk = (): Promise<ApkRelease | null> => {
  apkPromise ??= fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=15`, {
    headers: { Accept: "application/vnd.github+json" },
  })
    .then((res) => (res.ok ? res.json() : []))
    .then((releases: any[]) => {
      for (const release of releases) {
        if (release.draft || release.prerelease) continue;
        const apks = (release.assets ?? []).filter(
          (a: any) => a.name?.toLowerCase().endsWith(".apk") && !a.name.toLowerCase().includes("debug"),
        );
        const apk = apks.find((a: any) => a.name === "app-release.apk") ?? apks[0];
        const version = parseVersion(release.tag_name ?? "")?.join(".");
        if (apk && version) return { version, url: apk.browser_download_url, size: apk.size };
      }
      return null;
    })
    .catch((err) => {
      console.error("APK update check failed:", err);
      apkPromise = null; // allow a retry later
      return null;
    });
  return apkPromise;
};

// Opens outside the app: the external browser downloads the APK and hands it to the system
// installer (so NanChat doesn't need REQUEST_INSTALL_PACKAGES, which Play forbids for self-updates),
// and store URLs are picked up by the Play Store / App Store apps.
export const openExternal = async (url: string) => {
  if (Capacitor.isNativePlatform()) {
    await InAppBrowser.openInExternalBrowser({ url });
  } else if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

export const openStoreListing = (channel: UpdateChannel) => {
  if (channel === "play") return openExternal(PLAY_STORE_URL);
  if (channel === "appstore") return openExternal(APP_STORE_URL);
  if (channel === "web") return window.location.reload();
  return openExternal(RELEASES_URL);
};
