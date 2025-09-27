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
import { WalletApp } from "./app/WalletApp";
import { App as CapacitorApp } from "@capacitor/app";


const blacklistStorageHandler = {
  ...timestampStorageHandler,
  _rateLimitCache: new Map(),
  
  replace: (key, value, force = false) => {
    
    // Rate limiter - check if key was accessed in last 30 seconds
    const now = Date.now();
    const lastAccess = blacklistStorageHandler._rateLimitCache.get(key);
    
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

      return timestampStorageHandler.replace(key, filteredValue);
    }
    
    if (key.startsWith('/chats-')){
      const account = key.split('-')[1]
      // debugger
      if (value && value?.data && value?.data[0]?.updatedAt != undefined){
        const latstUpdatedChat = value?.data[0]?.updatedAt
        safeSetItem('lastSyncChat-' + account, new Date(latstUpdatedChat).getTime().toString()) // need to put this after the db put to ensure it is saves after
      }
    }
    // For all other keys, use the wrapped handler
    return timestampStorageHandler.replace(key, value);
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
  const initializing = cacheProvider == null
  console.log("InitialPopup")
  // const [wallet, setWallet] = useState({seed: null, accounts: [], wallets: {}});
  
  // Store reference to the cache instance
  const cacheRef = useRef<any>(null)

  // Update cache reference when provider is ready
  useEffect(() => {
    if (cacheProvider) {
      // Get the cache instance
      cacheRef.current = cacheProvider(new Map())
    }
  }, [cacheProvider])

    useEffect(() => {

      async function saveCache(){
        if (cacheRef.current && cacheRef.current.saveAllToDb) {
        try {
          console.time('save-swr-cache')
          await cacheRef.current.saveAllToDb()
          console.timeEnd('save-swr-cache')
          console.log('Auto-save completed')
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
      </PopupWrapper>
      </SWRConfig>
    {/* </LedgerContext.Provider> */}
    </ConfigProvider>
  );
}

