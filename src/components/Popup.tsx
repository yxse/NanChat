import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import PopupWrapper from "./Wrapper";
import Lockscreen from "./Lock";
import InitializeScreen from "./Initialize";

import { ClipLoader as HashSpinner } from "react-spinners";
import { SplashScreen } from '@capacitor/splash-screen';

import App from "./app";
import Confetti from "react-confetti-boom";
import { ConfigProvider, Modal, SpinLoading, Toast } from "antd-mobile";
import { Wallet } from "../nano/wallet";
import { initWallet } from "../nano/accounts";
import { networks } from "../utils/networks";
import useSWR, { preload, SWRConfig, useSWRConfig } from "swr";
import useLocalStorageState from "use-local-storage-state";
import { getSeed } from "../utils/storage";
import { Capacitor, PluginListenerHandle } from "@capacitor/core";
import { PinAuthPopup } from "./Lock/PinLock";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { AndroidSettings, IOSSettings, NativeSettings } from "capacitor-native-settings";
import { showLogoutSheet } from "./Settings";
import enUS from 'antd-mobile/es/locales/en-US'
import { defaultContacts, safeSetItem } from "./messaging/utils";
import { fetchPrices } from "../nanswap/swap/service";
import { fetcherChat, fetcherMessages } from "./messaging/fetcher";
import { timestampStorageHandler, useCacheProvider, simpleStorageHandler } from '@benskalz/swr-idb-cache'
import { i18nReady } from "../i18n";
import { WalletApp } from "./app/WalletApp";
import { App as CapacitorApp } from "@capacitor/app";
import { useReduceAnimation } from "../hooks/use-reduce-animation";
import { UpdateRequiredModal } from "./app/UpdateRequiredModal";


// entries not updated by SWR for this long are dropped from IndexedDB on startup
const CACHE_MAX_AGE = 30 * 24 * 3600 * 1000

const blacklistStorageHandler = {
  ...timestampStorageHandler,
  _rateLimitCache: new Map(),
  // last time SWR set real data for each key: saveAllToDb rewrites every entry on pause,
  // so the stored ts keeps this value instead of the save time, else nothing would ever expire
  _lastSet: new Map<string, number>(),

  revive: (key: string, storeObject: any) => {
    const ts = storeObject?.ts
    if (!ts) return undefined
    // chats never expire: they are the base of the incremental sync (lastSyncChat, see fetcherChats),
    // dropping them alone would only show the chats updated since the last sync
    if (!key.startsWith('/chats-') && Date.now() - ts > CACHE_MAX_AGE) return undefined
    blacklistStorageHandler._lastSet.set(key, ts)
    return storeObject.value
  },

  replace: (key: string, value: any, force: Boolean = false) => {

    // Rate limiter - check if key was accessed in last 30 seconds
    const now = Date.now();
    const lastAccess = blacklistStorageHandler._rateLimitCache.get(key);
    // record the update even when the write below is throttled, the forced save on pause will persist it
    if (!force && value?.data !== undefined) blacklistStorageHandler._lastSet.set(key, now)
    const ts = blacklistStorageHandler._lastSet.get(key) ?? now
    
    const isMessages = key.startsWith('$inf$/messages')  
    const isChats = key.startsWith('/chats')  
    // since /chats value can contains lot of data, we trottle max write for performance reasons
    // cache is also saved on App.pause
    // and else data will be sync from server
    const MIN_DELAY_WRITE_CHAT = 30 * 1000 
    const MIN_DELAY_MESSAGE_WRITE = 5 * 1000 
    const MIN_DELAY_OTHER_WRITE = 5 * 1000
    // debugger
    if (!force){

    if (isChats && lastAccess && (now - lastAccess) < MIN_DELAY_WRITE_CHAT) {
        return undefined;
    }
    else if (isMessages && lastAccess && (now - lastAccess) < MIN_DELAY_MESSAGE_WRITE) {
        return undefined;
    }
    else if (lastAccess && (now - lastAccess) < MIN_DELAY_OTHER_WRITE) {
        return undefined;
    }
    }

    // console.log(key, value)
    
    if (value && value?.data){ // set the timer only if contains value
      // Update rate limit cache
      blacklistStorageHandler._rateLimitCache.set(key, now);
    }
    
    // Skip all messages except the first page
    if (key.startsWith('/messages') && !key.includes('&page=0')) {
      return undefined;
    }
    
    // Handle infinite messages - only keep first page
    if (key.startsWith('$inf$/messages')) { 
      if (value.data == undefined) return undefined
      let filteredValue = {...value}; // shallow clone
      filteredValue.data = [filteredValue.data[0]]; // only keep first message page
      filteredValue['_l'] = 1; // set length to 1 to prevent swr fetching all pages

      return { value: filteredValue, ts };
    }

    // For all other keys, same format as timestampStorageHandler, with the last real update as ts
    return { value, ts };
  },
}
preload('/networks', fetcherChat)


export default function InitialPopup() {
  const [walletState, setWalletState] = useState<"locked" | "pin-locked" | "unlocked" | "no-wallet" | "loading">("loading");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [callback, setCallback] = useState(null);
     const cacheProvider = useCacheProvider({
    dbName: 'my-app',
    storeName: 'swr-cache',
    storageHandler: blacklistStorageHandler,
  })
  // the language of the user is loaded on demand (see i18n.js): render once it is there, no flash of English
  const [languageReady, setLanguageReady] = useState(false)
  useEffect(() => {
    i18nReady.then(() => setLanguageReady(true))
  }, [])
  const initializing = cacheProvider == null || !languageReady
  console.log("InitialPopup")
  // const [wallet, setWallet] = useState({seed: null, accounts: [], wallets: {}});
  useReduceAnimation();
  // Store reference to the cache instance
  const cacheRef = useRef<any>(null)

  // Update cache reference when provider is ready
  useEffect(() => {
    if (cacheProvider) {
      // Get the cache instance
      cacheRef.current = cacheProvider(new Map())
    }
  }, [cacheProvider])

function saveChatsLastSync(){
  if (!cacheRef.current) return
  const keysChats = Array.from(cacheRef.current.keys()).filter((key) => key.startsWith('/chats-'))
  for (let key of keysChats) {
    const value = cacheRef.current.get(key)
      const account = key.split('-')[1]
      // debugger
      if (value && value?.data && value?.data[0]?.updatedAt != undefined){
        const latstUpdatedChat = value?.data[0]?.updatedAt
        safeSetItem('lastSyncChat-' + account, new Date(latstUpdatedChat).getTime().toString()) // need to put this after the db put to ensure it is saves after
      }
  }
}
    useEffect(() => {

      async function saveCache(){
        if (cacheRef.current && cacheRef.current.saveAllToDb) {
        try {
          console.time('save-swr-cache')
          await cacheRef.current.saveAllToDb()
          console.timeEnd('save-swr-cache')
          console.log('Auto-save completed')
          saveChatsLastSync()
        } catch (error) {
          console.error('Auto-save failed:', error)
        }
      }
      }

      let appStateListener
  CapacitorApp.addListener('pause', saveCache).then(listener => {
          appStateListener = listener
        })

      if (Capacitor.getPlatform() === 'web') {
        // save cache on 
          window.addEventListener('beforeunload', saveCache)
      }
  return () => {
    if (appStateListener) {
        appStateListener.remove()
      }
    if (Capacitor.getPlatform() === 'web') {
        window.removeEventListener('beforeunload', saveCache)
      }
  }
  }, [])


useEffect(() => {
  if (initializing) {
    console.time('Initialization Duration');
  } else {
    console.timeEnd('Initialization Duration');
  }
}, [initializing]);
  //   if (initializing) {
  //   return null
  // }
  // if (!newNetworks) return <div style={{
  //   display: 'flex',
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   height: 'calc(100vh - var(--safe-area-inset-bottom) - var(--safe-area-inset-top))',
  //   width: '100%'
  // }}>
  //  <div style={{display: "flex", flexDirection: "column", alignItems: "center"}}>
  //     <SpinLoading style={{"--size": "48px", marginBottom: 16}} />
  //     <span className="text-sm">Loading networks</span>
  //  </div>
  // </div>
  //  if (initializing) return <div style={{
  //    display: 'flex',
  //    justifyContent: 'center',
  //    alignItems: 'center',
  //    height: 'calc(100vh - var(--safe-area-inset-bottom) - var(--safe-area-inset-top))',
  //    width: '100%'
  //  }}>
  //   <div style={{display: "flex", flexDirection: "column", alignItems: "center"}}>
  //      <SpinLoading style={{"--size": "48px", marginBottom: 16}} />
  //      <span className="text-sm">Loading cache</span>
  //   </div>
  //  </div>
  if (initializing) return null
  return (
    <ConfigProvider locale={enUS}>
    {/* <LedgerContext.Provider value={{ ledger, setLedger, setWalletState }}> */}
    <SWRConfig value={{ provider: cacheProvider }}>

      <PopupWrapper theme={theme}>
        <WalletApp initializing={initializing} />
        <UpdateRequiredModal />
      </PopupWrapper>
      </SWRConfig>
    {/* </LedgerContext.Provider> */}
    </ConfigProvider>
  );
}

