import React, { useEffect, useReducer, useState } from 'react'
import InitializeScreen from '../Initialize';
import Lockscreen from '../Lock';
import useSWR, { useSWRConfig } from 'swr';
import { fetchPrices } from '../../nanswap/swap/service';
import useLocalStorageState from 'use-local-storage-state';
import { Capacitor } from '@capacitor/core';
import { fetcherMessages } from '../messaging/fetcher';
import { Modal, Toast } from 'antd-mobile';
import { showLogoutSheet } from '../Settings';
import { AndroidSettings, IOSSettings, NativeSettings } from 'capacitor-native-settings';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { LedgerContext, WalletContext } from '../Popup';
import { PinAuthPopup } from '../Lock/PinLock';
import { SplashScreen } from '@capacitor/splash-screen';
import { getSeed } from '../../utils/storage';
import { networks } from '../../utils/networks';
import { initWallet } from '../../nano/accounts';
import App from '.';
import { ClipLoader as HashSpinner } from "react-spinners";




function walletsReducer(state, action) {
  // console.log("walletsReducer", action);
  switch (action.type) {
    case "ADD_WALLET":
      // if (state.wallets[action.payload.ticker]) return state;
      if (action.payload.ticker === "XNO") {
        localStorage.setItem('activeAddress', action.payload.wallet.getActiveAccount());
      }
      return { ...state, wallets: { ...state.wallets, [action.payload.ticker]: action.payload.wallet } };
    case "USE_LEDGER":
      return {
        ...state,
        oldWallets: { ...state.oldWallets, [action.payload.ticker]: state.wallets[action.payload.ticker] },
        oldAccounts: state.accounts,
        wallets: { ...state.wallets, [action.payload.ticker]: action.payload.wallet }
      };
    case "DISCONNECT_LEDGER":
      return { ...state, wallets: { ...state.oldWallets }, oldWallets: {}, accounts: state.oldAccounts, oldAccounts: [] };
    case "SET_ACTIVE_INDEX":
      for (let ticker of Object.keys(state.wallets)) {
        state.wallets[ticker].setActiveIndex(action.payload);
        state.wallets[ticker].receiveAllActiveAccount();
      }
      localStorage.setItem('activeIndex', action.payload);
      localStorage.setItem('activeAddress', state.wallets['XNO'].getActiveAccount());
      return { ...state, activeIndex: action.payload };
    case "SYNC_WALLET":
      return { ...state, wallets: { ...state.wallets, [action.payload.ticker]: action.payload.wallet } };
    case "REMOVE_ACCOUNT":
      let hiddenIndexesSorted = [...state.hiddenIndexes, action.payload].sort((a, b) => a - b);
      localStorage.setItem('hiddenIndexes', JSON.stringify(hiddenIndexesSorted));
      return { ...state, accounts: state.accounts.filter((account) => account.accountIndex !== action.payload), hiddenIndexes: [...state.hiddenIndexes, action.payload].sort((a, b) => a - b) };
    case "ADD_ACCOUNTS":
      localStorage.setItem('activeAddresses', JSON.stringify(action.payload.map((account) => account.address)));
      return { ...state, accounts: action.payload };
    // , lastAccountIndex: +localStorage.getItem('lastAccountIndex') };
    case "ADD_ACCOUNT":
      return state
      let indexToAdd = state.lastAccountIndex + 1;
      if (state.hiddenIndexes.length > 0) {
        indexToAdd = state.hiddenIndexes[0];
        localStorage.setItem('hiddenIndexes', JSON.stringify(state.hiddenIndexes.slice(1)));
      }
      else {
        localStorage.setItem('lastAccountIndex', indexToAdd);
      }

      for (let ticker of Object.keys(state.wallets)) {
        state.wallets[ticker].createAccounts(indexToAdd - 1, 1);
      }
      return { ...state, lastAccountIndex: indexToAdd, hiddenIndexes: state.hiddenIndexes.filter((i) => i !== indexToAdd) };
    case "HIDE_INDEX":
      hiddenIndexesSorted = [...state.hiddenIndexes, action.payload].sort((a, b) => a - b);
      localStorage.setItem('hiddenIndexes', JSON.stringify(hiddenIndexesSorted));
      return { ...state, hiddenIndexes: hiddenIndexesSorted };
    case "ADD_MESSAGE":
      return { ...state, messages: { ...state.messages, [action.payload._id]: action.payload.content } };
    default:
      return state;
  }
}
let appListener: PluginListenerHandle;


const WalletProvider = ({ children, setWalletState, walletState }) => {
  const { mutate, cache } = useSWRConfig()
  const [wallet, dispatch] = useReducer(walletsReducer, initialState);
  const [accountsIndexes, setAccountsIndexes] = useLocalStorageState("accountsIndexes", { defaultValue: [0] });
  const [authVisible, setAuthVisible] = useState(true);
  const [hasWallet, setHasWallet] = useState(localStorage.getItem('hasWallet') === 'true');
  const { mutate: mutatePrice } = useSWR("prices", fetchPrices);
  const {mutate: mutateMinReceive} = useSWR("/min-receive", fetcherMessages);
  useEffect(() => {
    function updateBiometryInfo(info: CheckBiometryResult): void {
      if (info.isAvailable) {
        // Biometry is available, info.biometryType will tell you the primary type.

      } else if (localStorage.getItem('confirmation-method') === '"enabled"' && Capacitor.isNativePlatform()) {
        // Biometry is not available, info.reason and info.code will tell you why.
      
        setWalletState("loading");
        Modal.show({
          title: "Biometry changed",
          closeOnMaskClick: false,
          closeOnAction: false,
          content: 'It seems that biometry settings have changed. Please re-enable biometry in your device settings or sign out of your wallet and restore it using your secret recovery phrase.',
          actions: [
            {
              key: "settings", text: "Open settings", onClick: async () => {
                NativeSettings.open({
                  optionAndroid: AndroidSettings.ApplicationDetails,
                  optionIOS: IOSSettings.App
                })
              }
            },
            {
              danger: true,
              key: "signout", text: "Sign out", onClick: async () => {
                await showLogoutSheet()
              }
            },
          ]
        })
      }
    }

    async function updateBiometry() {
      updateBiometryInfo(await BiometricAuth.checkBiometry())

      try {
        appListener = await BiometricAuth.addResumeListener(updateBiometryInfo)
      } catch (error) {
        if (error instanceof Error) {
          console.error(error.message)
        }
      }
    }
    updateBiometry();
    if (!hasWallet) {
      setWalletState("no-wallet");
    }

  }, []);
  return (
    <WalletContext.Provider value={{ wallet, dispatch }}>
      { hasWallet && 
      <PinAuthPopup
        location={"launch"}
        description={"Unlock your wallet"} visible={authVisible} setVisible={setAuthVisible} onAuthenticated={async () => {
          const seed = await getSeed()
          if (seed?.seed && !seed?.isPasswordEncrypted) {
            setWalletState("unlocked");
          }
          else if (seed?.seed && seed?.isPasswordEncrypted) {
            setWalletState("locked");
          }
          else {
            setWalletState("no-wallet");
          }
          SplashScreen.hide();
          // setWalletState("unlocked");
          // setSeed(localStorage.getItem('seed'));
          // setWallet({seed: localStorage.getItem('seed'), accounts: [], wallets: {}});
          let [prices, minReceive] = 
          await Promise.all([
            mutatePrice(),
            mutateMinReceive()
          ]);
          console.log({prices})
          console.log({minReceive})
          for (let ticker of Object.keys(networks)) {
            if (wallet.wallets[ticker]) continue;
            // let newWallet = initWallet("XNO", "0", mutate, dispatch)
            // console.log({})
            let minAmountMega = 0;
            if (minReceive > 0) {
              if (!prices[ticker]?.usd) {
                console.log("no price for ticker", ticker);
                Toast.show({
                  icon: "fail",
                  content: <div className="text-center">
                    Cannot initialize wallet for {ticker}.
                    <br />
                    No price for {ticker} found but minimum receive is set.
                  </div>,
                  duration: 3000,
                })
                return;
              }
              minAmountMega = minReceive / prices[ticker]?.usd;
              console.log("minAmountMega", minAmountMega, ticker)
            }
            
            dispatch({ type: "ADD_WALLET", payload: { ticker, wallet: initWallet(ticker, seed.seed, mutate, dispatch, minAmountMega) } });
            // dispatch({ type: "ADD_WALLET", payload: { ticker: ticker, seed: localStorage.getItem('seed'), mutate: mutate } });
          }
        }} />}
      {children}
    </WalletContext.Provider>
  );
}

function WalletApp({}) {
      const [walletState, setWalletState] = useState<"locked" | "pin-locked" | "unlocked" | "no-wallet" | "loading">("loading");
      const [callback, setCallback] = useState(null);
      const [ledger, setLedger] = useState(null);

     
  return (
    <LedgerContext.Provider value={{ ledger, setLedger, setWalletState }}>
    <WalletProvider setWalletState={setWalletState} walletState={walletState}>

          {
            walletState === "locked" && <Lockscreen setWalletState={setWalletState} theme={"theme"} />
          }
          {
            walletState === "unlocked" && <App callback={callback} />
          }
          {
            walletState === "no-wallet" && <InitializeScreen
              theme={"theme"}
              onCreated={(callback) => {
                setCallback(callback);
                localStorage.setItem('contacts', JSON.stringify(defaultContacts));
                localStorage.setItem('hasWallet', 'true');
                // Toast.show({
                //   icon: "success",
                //   content: <div className="text-center">
                //     Wallet created with success!
                //   </div>,
                //   duration: 3000,
                // })
                // setShowConfetti(true);
                // setTimeout(() => {
                //   setConfettiCount(0);
                // }, 5000);
              }}
              setWalletState={setWalletState} />
          }
        </WalletProvider>
        </LedgerContext.Provider>
  )
}

export default WalletApp

const initialState = {
  seed: null,
  wallets: {},
  oldWallets: {},
  activeIndex: localStorage.getItem('activeIndex') ? parseInt(localStorage.getItem('activeIndex')) : 0,
  lastAccountIndex: localStorage.getItem('lastAccountIndex') ? parseInt(localStorage.getItem('lastAccountIndex')) : 1,
  hiddenIndexes: localStorage.getItem('hiddenIndexes') ? JSON.parse(localStorage.getItem('hiddenIndexes')) : [],
  accounts: [],
  messages: [],
};