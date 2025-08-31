import { useEffect, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";
import { EventProvider } from "./messaging/components/EventContext";
import '../i18n';
import { getWindowDimensions } from "../hooks/use-windows-dimensions";
import { refreshStatusBarTheme } from "./messaging/utils";

export function saveCache(map) {
  console.log("saving cache")
  // clear cache 
  // localStorage.removeItem('app-cache')
  
  // return
  // filter out inf messages to not load them all directly
  let array = []
  for (let key of map.keys()) {
    if (key.startsWith('/messages') && !key.includes('&page=0')) {
      continue // skip all messages except the first page
    }
    else if (!key.startsWith('$inf$/messages')) {
      array.push([key, map.get(key)])
    }
    else {
      let elmt = {...map.get(key)} // {... } for shallow clone to not update the origanl map which could cause scrolling back to bottom when loading old messages 
      elmt.data = [elmt.data[0]] // only keep the first message page
      elmt['_l'] = 1 // set the length to 1 to prevent swr fetching all pages https://github.com/vercel/swr/blob/f521fb7e3ea9cc7b6c02ec32b7329784b4d8e854/src/infinite/types.ts#L154
      array.push([key, elmt])
    }
  }
  // let appCache = JSON.stringify(Array.from(map.entries()))
  // .filter(([key, _]) => !key.includes('/messages') || key.includes('&page=0')))
  localStorage.setItem('app-cache', JSON.stringify(array))
  const latstUpdatedChat = array.find((e) => e[0] === "/chats")?.[1]?.data[0]?.updatedAt
  if (latstUpdatedChat){ // save last updated time of chat, serving as cursor
    localStorage.setItem('lastSync', new Date(latstUpdatedChat).getTime().toString()) // eventually could be more precise using the r.ts of /chats response
  }
}

function localStorageProvider() {
  // localStorage.removeItem('app-cache')
  // When initializing, we restore the data from `localStorage` into a map.
  const map = new Map(JSON.parse(localStorage.getItem('app-cache') || '[]'))
 
  // Before unloading the app, we write back all the data into `localStorage`.
  window.addEventListener('beforeunload', () => {
    saveCache(map)
  })
  
  App.addListener('pause', () => {
    saveCache(map)
  })

 
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


if (Capacitor.getPlatform() === "ios" || Capacitor.getPlatform() === "android") {
  Keyboard.setResizeMode({mode: KeyboardResize.None});
  Keyboard.addListener('keyboardWillShow', info => {
    console.log('keyboard will show with height:', info.keyboardHeight);
    // const app: HTMLElement = document.querySelector('.app');
    // app.style.paddingBottom = info.keyboardHeight - 30 + 'px';
    // const minusPadding = Capacitor.getPlatform() === "ios" ? 30 : 0; // idk why but ios needs a bit less padding to be aligned

    try {
      const wrapper: HTMLElement = document.querySelector('.app');
      wrapper.style.paddingBottom = 'calc(' + info.keyboardHeight + 'px - var(--safe-area-inset-bottom) - var(--android-inset-bottom, 0px) - var(--android-inset-bottom-buttons, 0px) )';
    } 
    catch (e) {
      console.log(e);
    }
    try {

      // const popup: HTMLElement = document.querySelectorAll('.popup-primary-button');
      const popup: HTMLElement = document.querySelectorAll('.adm-popup-body:not(.disable-keyboard-resize)');
      console.log("popup", popup);
      popup.forEach((element) => {
        element.style.marginBottom = `calc(${info.keyboardHeight}px - var(--android-inset-bottom, 0px) - var(--android-inset-bottom-buttons, 0px)`;
        // element.style.paddingTop = info.keyboardHeight < 400 ? (400 - info.keyboardHeight) + 'px' : '0px';
      });
    } catch (e) {
      console.log(e);
    }
    try {

      // const popup: HTMLElement = document.querySelectorAll('.popup-primary-button');
      const popup: HTMLElement = document.querySelectorAll('.adm-modal-body:not(.disable-keyboard-resize)');
      console.log("popup", popup);
      popup.forEach((element) => {
        element.style.marginBottom = `calc(${info.keyboardHeight}px - var(--android-inset-bottom, 0px) - var(--android-inset-bottom-buttons, 0px)`;
        // element.style.paddingTop = info.keyboardHeight < 400 ? (400 - info.keyboardHeight) + 'px' : '0px';
      });
    } catch (e) {
      console.log(e);
    }

    try {

      const popup: HTMLElement = document.querySelectorAll('.popup-primary-button');
      console.log("popup", popup);
      popup.forEach((element) => {
        element.style.marginBottom = `calc(${info.keyboardHeight}px - var(--safe-area-inset-bottom))`;
        element.style.paddingTop = info.keyboardHeight < 360 ? 
        `calc(360px - ${info.keyboardHeight}px + var(--safe-area-inset-bottom))` :
        '0px';
      });
    } catch (e) {
      console.log(e);
    }

  
  });
  
  Keyboard.addListener('keyboardDidShow', info => {
    console.log('keyboard did show with height:', info.keyboardHeight);
  });
  
  Keyboard.addListener('keyboardWillHide', () => {
    const {height, isMobile} = getWindowDimensions()
    console.log('keyboard will hide');
    // const app: HTMLElement = document.querySelector('.app');
    // app.style.paddingBottom = '0px';
    try {
      const wrapper: HTMLElement = document.querySelector('.app');
      wrapper.style.paddingBottom = '0px';
    } 
    catch (e) {
      console.log(e);
    }
    try {

      // const popup: HTMLElement = document.querySelectorAll('.popup-primary-button');
      const popup: HTMLElement = document.querySelectorAll('.adm-popup-body:not(.disable-keyboard-resize)');
      console.log("popup", popup);
      popup.forEach((element) => {
        element.style.marginBottom = `0px`;
        // element.style.paddingTop = `360px`;
      });
    } catch (e) {
      console.log(e);
    }
    try {

      // const popup: HTMLElement = document.querySelectorAll('.popup-primary-button');
      const popup: HTMLElement = document.querySelectorAll('.adm-modal-body:not(.disable-keyboard-resize)');
      console.log("popup", popup);
      popup.forEach((element) => {
        element.style.marginBottom = `0px`;
        // element.style.paddingTop = `360px`;
      });
    } catch (e) {
      console.log(e);
    }
    try {

      const popup: HTMLElement = document.querySelectorAll('.popup-primary-button');
      console.log("popup", popup);
      popup.forEach((element) => {
        element.style.marginBottom = `0px`;
        element.style.paddingTop = (height <= 745 || !isMobile) ? `0px` : `360px`;
      });
    } catch (e) {
      console.log(e);
    }

  
  });
  
  Keyboard.addListener('keyboardDidHide', () => {
    console.log('keyboard did hide');
  });
  }
export default function PopupWrapper({
  children,
  theme,
}: {
  children: ReactNode;
  theme: "light" | "dark";
}) {
  if (Capacitor.getPlatform() === "web") {
    const app = initializeApp(firebaseConfig);
    // const analytics = getAnalytics(app);
  }
  useEffect(() => {
    if (Capacitor.getPlatform() == "ios"){
      document.body.classList.add('ios')
    }
    if (Capacitor.getPlatform() == "android"){
      refreshStatusBarTheme()
    }
    if (Capacitor.getPlatform() == "android" && window?.AndroidSafeArea){
      try {
        window?.AndroidSafeArea.refreshSafeArea();
      } catch (error) {
          console.error(error)        
      }
    }
  }, [])
  
  return (
    <EventProvider>
    <SWRConfig value={{ provider: localStorageProvider }}>
    <div className={`wrapper`}
      >{children}</div></SWRConfig>
      </EventProvider>
  );
}
