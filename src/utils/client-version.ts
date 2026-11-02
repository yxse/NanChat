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
    return originalFetch(input, { ...init, headers });
  };
};
