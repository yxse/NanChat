import { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";

import PopupWrapper from "./Wrapper";
import Lockscreen from "./Lock";
import InitializeScreen from "./Initialize";

import { ClipLoader as HashSpinner } from "react-spinners";
import { SplashScreen } from '@capacitor/splash-screen';

import App from "./app";
import Confetti from "react-confetti-boom";
import { ConfigProvider, Modal, Toast } from "antd-mobile";
import { Wallet } from "../nano/wallet";
import { initWallet } from "../nano/accounts";
import { networks } from "../utils/networks";
import useSWR, { preload, SWRConfig, useSWRConfig } from "swr";
import useLocalStorageState from "use-local-storage-state";
import { getSeed } from "../utils/storage";
import { Capacitor, PluginListenerHandle } from "@capacitor/core";
import { convertAddress } from "../utils/format";
import { PinAuthPopup } from "./Lock/PinLock";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { AndroidSettings, IOSSettings, NativeSettings } from "capacitor-native-settings";
import { showLogoutSheet } from "./Settings";
import enUS from 'antd-mobile/es/locales/en-US'
import { defaultContacts } from "./messaging/utils";
import { fetchPrices } from "../nanswap/swap/service";
import { fetcherChat, fetcherMessages } from "./messaging/fetcher";
import WalletApp from "./app/WalletProvider";
import { timestampStorageHandler, useCacheProvider, simpleStorageHandler } from '@piotr-cz/swr-idb-cache'


const blacklistStorageHandler = {
  ...timestampStorageHandler,
  _rateLimitCache: new Map(),
  
  replace: (key, value) => {
    
    // Rate limiter - check if key was accessed in last 30 seconds
    const now = Date.now();
    const lastAccess = blacklistStorageHandler._rateLimitCache.get(key);
    
    if (lastAccess && (now - lastAccess) < 10000) {
      return undefined;
    }
    console.log(key)
    
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
        localStorage.setItem('lastSyncChat-' + account, new Date(latstUpdatedChat).getTime().toString()) 
      }
    }
    // For all other keys, use the wrapped handler
    return timestampStorageHandler.replace(key, value);
  },
}
export const LedgerContext = createContext(null);
export const WalletContext = createContext(null);

export const useWallet = () => {
  const { wallet, dispatch } = useContext(WalletContext)
  const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
  const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
  return { wallet, activeAccount, activeAccountPk, dispatch };
}


preload('/networks', fetcherChat)

export default function InitialPopup() {
  const [walletState, setWalletState] = useState<"locked" | "pin-locked" | "unlocked" | "no-wallet" | "loading">("loading");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [callback, setCallback] = useState(null);
     const cacheProvider = useCacheProvider({
    dbName: 'my-app',
    storeName: 'swr-cache',
    storageHandler: blacklistStorageHandler
  })
  const initializing = cacheProvider == null
  console.log("InitialPopup")
  // const [wallet, setWallet] = useState({seed: null, accounts: [], wallets: {}});
  const {data: newNetworks} = useSWR("/networks", fetcherChat); // dynamic add networks
    if (newNetworks) {
      for (let ticker in newNetworks) {
        if (!networks[ticker]) {
          networks[ticker] = newNetworks[ticker]
        }
      }
    }
  //   if (initializing) {
  //   return null
  // }
   if (initializing) return <div className="absolute inset-0 !z-50 flex !h-screen !w-screen items-center justify-center ">
                <HashSpinner size={80} color="#0096FF" loading={true} />
              </div>
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

