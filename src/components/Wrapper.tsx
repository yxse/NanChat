import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { Capacitor } from "@capacitor/core";

function localStorageProvider() {
  // localStorage.removeItem('app-cache')
  // When initializing, we restore the data from `localStorage` into a map.
  const map = new Map(JSON.parse(localStorage.getItem('app-cache') || '[]'))
 
  // Before unloading the app, we write back all the data into `localStorage`.
  // window.addEventListener('beforeunload', () => {
  //   let appCache = JSON.stringify(Array.from(map.entries())
  //   .filter(([key, _]) => !key.startsWith('$inf$/messages'))) // not keeping all message history in cache as decrypting all messages is expensive, eventually could be kept decrypted or use virtualized list
  //   localStorage.setItem('app-cache', appCache)
  // })
  // window.addEventListener('unload', () => {
  //   // console.log('unload')
  //   let appCache = JSON.stringify(Array.from(map.entries()).filter(([key, _]) => !key.includes('/messages') || key.includes('&page=0')))
  //   localStorage.setItem('app-cache', appCache)
  // })
 
  // We still use the map for write & read for performance.
  return map
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_PUBLIC_firebase_apiKey,
  authDomain: import.meta.env.VITE_PUBLIC_firebase_authDomain,
  projectId: import.meta.env.VITE_PUBLIC_firebase_projectId,
  storageBucket: import.meta.env.VITE_PUBLIC_firebase_storageBucket,
  messagingSenderId: import.meta.env.VITE_PUBLIC_firebase_messagingSenderId,
  appId: import.meta.env.VITE_PUBLIC_firebase_appId,
  measurementId: import.meta.env.VITE_PUBLIC_firebase_measurementId,
  vapidKey: import.meta.env.VITE_PUBLIC_firebase_vapidKey,
};



export default function PopupWrapper({
  children,
  theme,
}: {
  children: ReactNode;
  theme: "light" | "dark";
}) {
  if (Capacitor.getPlatform() === "web") {
    const app = initializeApp(firebaseConfig);
    const analytics = getAnalytics(app);
  }
  return (
    <SWRConfig value={{ provider: localStorageProvider }}>
    <div
      >{children}</div></SWRConfig>
  );
}
