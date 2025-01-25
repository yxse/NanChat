import { createContext, useContext, useEffect, useReducer, useState } from "react";

import PopupWrapper from "./Wrapper";
import Lockscreen from "./Lock";
import InitializeScreen from "./Initialize";

import { ClipLoader as HashSpinner } from "react-spinners";
import { SplashScreen } from '@capacitor/splash-screen';

import App from "./app";
import Confetti from "react-confetti-boom";
import { Toast } from "antd-mobile";
import { Wallet } from "../nano/wallet";
import { initWallet } from "../nano/accounts";
import { networks } from "../utils/networks";
import { useSWRConfig } from "swr";
import useLocalStorageState from "use-local-storage-state";
import { getSeed } from "../utils/storage";
import { Capacitor } from "@capacitor/core";
import { convertAddress } from "../utils/format";
import { PinAuthPopup } from "./Lock/PinLock";
export const LedgerContext = createContext(null);
export const WalletContext = createContext(null);

function walletsReducer(state, action) {
  console.log("walletsReducer", action);
  switch (action.type) {
    case "ADD_WALLET":
      // if (state.wallets[action.payload.ticker]) return state;
      if (action.payload.ticker === "XNO") localStorage.setItem('activeAddress', action.payload.wallet.getActiveAccount());
      return { ...state, wallets: { ...state.wallets, [action.payload.ticker]: action.payload.wallet } };
    case "USE_LEDGER":
      return { 
        ...state, 
        oldWallets: { ...state.oldWallets, [action.payload.ticker]: state.wallets[action.payload.ticker] },
        oldAccounts: state.accounts,
        wallets: { ...state.wallets, [action.payload.ticker]: action.payload.wallet }
       };
    case "DISCONNECT_LEDGER":
      return { ...state, wallets: {...state.oldWallets}, oldWallets: {}, accounts: state.oldAccounts, oldAccounts: [] };
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
      return { ...state, accounts:  action.payload };
        // , lastAccountIndex: +localStorage.getItem('lastAccountIndex') };
    case "ADD_ACCOUNT":
      return state
      let indexToAdd = state.lastAccountIndex + 1;
      if (state.hiddenIndexes.length > 0) {
        indexToAdd = state.hiddenIndexes[0];
        localStorage.setItem('hiddenIndexes', JSON.stringify(state.hiddenIndexes.slice(1)));
      }
      else{
        localStorage.setItem('lastAccountIndex', indexToAdd);
      }

      for (let ticker of Object.keys(state.wallets)) {
        state.wallets[ticker].createAccounts(indexToAdd-1, 1);
      }
      return { ...state, lastAccountIndex: indexToAdd, hiddenIndexes: state.hiddenIndexes.filter((i) => i !== indexToAdd) };
    case "HIDE_INDEX":
      hiddenIndexesSorted = [...state.hiddenIndexes, action.payload].sort((a, b) => a - b);
      localStorage.setItem('hiddenIndexes', JSON.stringify(hiddenIndexesSorted));
      return { ...state, hiddenIndexes: hiddenIndexesSorted };
    case "ADD_MESSAGE":
      return { ...state, messages:{...state.messages, [action.payload._id]: action.payload.content} };
    default:
      return state;
  }
}
export const useWallet = () => {
  const {wallet} = useContext(WalletContext)
  const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
  return {wallet, activeAccount}
}

const WalletProvider = ({ children, setWalletState }) => {
  const {mutate,cache}=useSWRConfig()
  const [wallet, dispatch] = useReducer(walletsReducer, initialState);
  const [accountsIndexes, setAccountsIndexes] = useLocalStorageState("accountsIndexes", {defaultValue: [0]});
  const [authVisible, setAuthVisible] = useState(true);  
  useEffect(() => {
    // SplashScreen.show({autoHide: false});
    // getSeed().then((seed) => {
    //   if (seed?.seed && !seed?.isPasswordEncrypted) {
    //     setWalletState("unlocked");
    //   }
    //   else if (seed?.seed && seed?.isPasswordEncrypted) {
    //     setWalletState("locked");
    //   }
    //   else {
    //     setWalletState("no-wallet");
    //   }
    //   SplashScreen.hide();
    //   // setWalletState("unlocked");
    //   // setSeed(localStorage.getItem('seed'));
    //   // setWallet({seed: localStorage.getItem('seed'), accounts: [], wallets: {}});
      
    //   for (let ticker of Object.keys(networks)) {
    //     if (wallet.wallets[ticker]) continue;
    //     // let newWallet = initWallet("XNO", "0", mutate, dispatch)
    //     dispatch({ type: "ADD_WALLET", payload: { ticker, wallet: initWallet(ticker, seed.seed, mutate, dispatch) } });
    //     // dispatch({ type: "ADD_WALLET", payload: { ticker: ticker, seed: localStorage.getItem('seed'), mutate: mutate } });
    //   }
    // }).finally(() => {
    //   SplashScreen.hide();
    // });

  }, []);
  return (
    <WalletContext.Provider value={{ wallet, dispatch }}>
      <PinAuthPopup
      location={"launch"}
       description={"Unlock your wallet"} visible={authVisible} setVisible={setAuthVisible} onAuthenticated={async () => getSeed().then((seed) => {
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
      for (let ticker of Object.keys(networks)) {
        if (wallet.wallets[ticker]) continue;
        // let newWallet = initWallet("XNO", "0", mutate, dispatch)
        dispatch({ type: "ADD_WALLET", payload: { ticker, wallet: initWallet(ticker, seed.seed, mutate, dispatch) } });
        // dispatch({ type: "ADD_WALLET", payload: { ticker: ticker, seed: localStorage.getItem('seed'), mutate: mutate } });
      }
    })} />
      {children}
    </WalletContext.Provider>
  );
}

export default function InitialPopup() {
  const [walletState, setWalletState] = useState<"locked" | "pin-locked" | "unlocked" | "no-wallet" | "loading">("loading");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [confettiCount, setConfettiCount] = useState<number>(50);

  const [ledger, setLedger] = useState(null);
  // const [wallet, setWallet] = useState({seed: null, accounts: [], wallets: {}});
  return (
    <LedgerContext.Provider value={{ ledger, setLedger, setWalletState }}>
      <PopupWrapper theme={theme}>
        <WalletProvider setWalletState={setWalletState}>
          
        {
          walletState === "locked" && <Lockscreen setWalletState={setWalletState} theme={theme} />
        }
        {
          walletState === "unlocked" && <App />
        }
        {
          walletState === "no-wallet" && <InitializeScreen
          theme={theme}
            onCreated={() => {
              Toast.show({
                icon: "success",
                content: <div className="text-center">
                  Wallet created with success!
                </div>,
                duration: 3000,
              })
              setShowConfetti(true);
              setTimeout(() => {
                setConfettiCount(0);
              }, 5000);
            }}
            setWalletState={setWalletState} />
        }
        {
          walletState === "loading" && !Capacitor.isNativePlatform() && <div className="absolute inset-0 !z-50 flex !h-screen !w-screen items-center justify-center ">
            <HashSpinner size={80} color="#0096FF" loading={true} />
          </div>
        }
        {
          showConfetti &&
          <Confetti
            particleCount={confettiCount}
            shapeSize={8}
            mode="fall"
            colors={["#0096FF", "#0047AB", "#FFFF8F", "#301934", "#FFE5B4"]}
          />
        }
    </WalletProvider>
      </PopupWrapper>
    </LedgerContext.Provider>
  );
}

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