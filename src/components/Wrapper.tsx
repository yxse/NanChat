import { useEffect, type ReactNode } from "react";
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { Capacitor } from "@capacitor/core";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";
import { EventProvider } from "./messaging/components/EventContext";
import '../i18n';
import { getWindowDimensions } from "../hooks/use-windows-dimensions";
import { refreshStatusBarTheme } from "./messaging/utils";

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
    try {
      if (location.pathname.startsWith('/discover')) {
        if (document.getElementById('webview-overlay')?.style.zIndex === "-1"){
        // we skip resize on /discover to prevent the menu bar jumping up and down
        // skip only if webview not open to still allow resizing on wallet sending etc within the opened webview
          return
      }
    }
      } catch (error) {
        
      }
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
  console.log("popup wrapper render")

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
  
    // Cache Provider is being initialized - render fallback component in the meantime

  return (
    <EventProvider>
    <div className={`wrapper`}
      >{children}</div>
      </EventProvider>
  );
}
