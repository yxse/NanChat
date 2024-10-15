import type { ReactNode } from "react";
import { SWRConfig } from "swr";

function localStorageProvider() {
  // localStorage.removeItem('app-cache')
  // When initializing, we restore the data from `localStorage` into a map.
  const map = new Map(JSON.parse(localStorage.getItem('app-cache') || '[]'))
 
  // Before unloading the app, we write back all the data into `localStorage`.
  window.addEventListener('beforeunload', () => {
    const appCache = JSON.stringify(Array.from(map.entries()))
    localStorage.setItem('app-cache', appCache)
  })
  window.addEventListener('unload', () => {
    // console.log('unload')
    const appCache = JSON.stringify(Array.from(map.entries()))
    localStorage.setItem('app-cache', appCache)
  })
 
  // We still use the map for write & read for performance.
  return map
}

export default function PopupWrapper({
  children,
  theme,
}: {
  children: ReactNode;
  theme: "light" | "dark";
}) {
  return (
    <SWRConfig value={{ provider: localStorageProvider }}>
    <div
      >{children}</div></SWRConfig>
  );
}
