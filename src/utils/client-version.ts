import { Capacitor } from "@capacitor/core";
import appVersion from "../../version.json";

// Sent to the backend so it can refuse to deliver messages to clients with known
// vulnerabilities (see MIN_CLIENT_VERSION in nanchat-backend). Clients older than
// this mechanism send nothing, which the backend treats as outdated.
export const APP_VERSION = appVersion.version;
export const APP_PLATFORM = Capacitor.getPlatform();

export const versionHeaders = {
  "X-App-Version": APP_VERSION,
  "X-App-Platform": APP_PLATFORM,
};

// Patch fetch once so every request to our backend carries the version headers,
// without touching each call site. Requests to third-party hosts are left alone.
export const installVersionHeaders = () => {
  const backend = import.meta.env.VITE_PUBLIC_BACKEND;
  if (!backend || typeof globalThis.fetch !== "function") return;
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(backend)) return originalFetch(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    for (const [key, value] of Object.entries(versionHeaders)) {
      if (!headers.has(key)) headers.set(key, value);
    }
    return originalFetch(input, { ...init, headers }).then((res) => {
      // 426 = backend refuses this version (MIN_CLIENT_VERSION); the body carries minVersion
      if (res.status === 426) {
        res.clone().json()
          .then((body) => markUpdateRequired(body?.minVersion))
          .catch(() => markUpdateRequired());
      }
      return res;
    });
  };
};

// "Update required" signal, raised by a 426 from the backend or a socket handshake refusal.
// Kept framework-free so the fetch patch and the socket can set it; UpdateRequiredModal listens.
type UpdateRequiredState = { required: boolean; minVersion?: string };
let updateRequired: UpdateRequiredState = { required: false };
const listeners = new Set<(s: UpdateRequiredState) => void>();

export const markUpdateRequired = (minVersion?: string) => {
  if (updateRequired.required && (!minVersion || minVersion === updateRequired.minVersion)) return;
  updateRequired = { required: true, minVersion: minVersion ?? updateRequired.minVersion };
  listeners.forEach((l) => l(updateRequired));
};

export const getUpdateRequired = () => updateRequired;

export const onUpdateRequired = (listener: (s: UpdateRequiredState) => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
