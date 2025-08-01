// @ts-nocheck
import { useContext, useEffect, useState } from "react";
import "../../styles/app/home.css";
import { networks } from "../../utils/networks";
import Network, { fetchBalance, fetchBalances, ModalReceive, showModalReceive } from "./Network";
import { Badge, Button, Card, CenterPopup, Dialog, DotLoading, FloatingBubble, Image, List, Modal, NavBar, NoticeBar, Popup, PullToRefresh, SafeArea, SideBar, Toast } from "antd-mobile";
import { useLocation, useNavigate } from "react-router-dom";
import useSWR, { useSWRConfig } from "swr";
import { BiCopy, BiPaste, BiPlus } from "react-icons/bi";
import NetworkList from "./NetworksList";
import NetworksSwitch from "./NetworksSwitch";
import { askPermission, getToken } from "../../nano/notifications";
import { CgCreditCard } from "react-icons/cg";
import { GoCreditCard } from "react-icons/go";
import { AiOutlineAccountBook, AiOutlineBank, AiTwotoneContainer } from "react-icons/ai";
import { IoNotificationsOutline } from "react-icons/io5";
import { DownOutline, ScanCodeOutline } from "antd-mobile-icons";
import { MdOutlineCheck, MdOutlineRefresh, MdOutlineUsb } from "react-icons/md";
import { DisconnectLedger, resetLedger } from "../Initialize/Start";
import { LedgerContext, useWallet, WalletContext } from "../Popup";
import useLocalStorageState from "use-local-storage-state";
import { FaExchangeAlt } from "react-icons/fa";
import {SetOutline} from "antd-mobile-icons";
import getSymbolFromCurrency from "currency-symbol-map";
import { cryptoBaseCurrencies, fetchFiatRates, fetchPrices } from "../../nanswap/swap/service";
import { convertAddress, parseURI } from "../../utils/format";
import PasteAction from "./PasteAction";
import { CopyIcon } from "./Icons";
import CopyAddressPopup from "./CopyAddressPopup";
import Confetti from "react-confetti-boom";
import { getAccount } from "../getAccount";
import SelectAccount from "./SelectAccount";
// import Settings, { ManageNetworks } from "../Settings";
import Settings, { ManageNetworks } from "../Settings";
import { SlArrowDownCircle, SlArrowUpCircle } from "react-icons/sl";
import { MenuBar } from ".";
import { useWindowDimensions } from "../../hooks/use-windows-dimensions"
import Messaging from "../messaging/Messaging";
import ReloadPrompt from "./ReloadPrompt/ReloadPrompt";
import { SendReceive } from "./wallet/SendReceive";
import ProfilePicture from "../messaging/components/profile/ProfilePicture";
import RefreshButton from "../RefreshButton";
import { isTouchDevice } from "../../utils/isTouchDevice";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { useWalletBalance } from "../../hooks/use-wallet-balance";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { HapticsImpact } from "../../utils/haptic";
import { LocalNotifications } from "@capacitor/local-notifications";

export const FormatBaseCurrency = ({amountInBaseCurrency, maximumSignificantDigits = undefined, isLoading = false}) => {
  const [selected] = useLocalStorageState("baseCurrency", {defaultValue: "USD"})

  let formatted = null
  try {
    if (selected === "XNO") {
      formatted = "Ӿ" + new Intl.NumberFormat("en-US", {maximumFractionDigits: 7 }).format(amountInBaseCurrency);
    }
    else if (selected.startsWith("X") || cryptoBaseCurrencies.includes(selected)) {
      // without this it would always show 2 decimal places for X.. currencies
      formatted = new Intl.NumberFormat("en-US", {maximumFractionDigits: 7 }).format(amountInBaseCurrency) + " " + selected;
    }
    else if (selected === "NYANO"){
      formatted = new Intl.NumberFormat("en-US", {maximumFractionDigits: 0 }).format(amountInBaseCurrency) + " " + selected;
    }
    else if (maximumSignificantDigits === undefined) {
      formatted = new Intl.NumberFormat("en-US", { 
        style: 'currency', 
        currency: selected,
       }).format(amountInBaseCurrency);
    }
    else {
      formatted = new Intl.NumberFormat("en-US", { 
        style: 'currency', 
        currency: selected,
        maximumSignificantDigits: maximumSignificantDigits,
       }).format(amountInBaseCurrency);
    }

  }
  catch (e) {
    console.log(e);
    if (maximumSignificantDigits === undefined) {
      formatted = new Intl.NumberFormat("en-US", {maximumFractionDigits: 7 }).format(amountInBaseCurrency) + " " + selected;
    }
    else {
      formatted = new Intl.NumberFormat("en-US", {maximumSignificantDigits: maximumSignificantDigits }).format(amountInBaseCurrency) + " " + selected;
    }
    // +amountInBaseCurrency.toPrecision(6) + " " + selected;
  }
  if (isLoading) {
    return <DotLoading />
  }
  return (
    <>
      {formatted}
    </>
  );
}


export const ConvertToBaseCurrency = ({ ticker, amount, maximumSignificantDigits = undefined }) => {
  const [selected] = useLocalStorageState("baseCurrency", {defaultValue: "USD"})
  const {data, isLoading, error} = useSWR('fiat', fetchFiatRates)
  const { data: prices, isLoading: isLoadingPrices } = useSWR(
    "prices",
    fetchPrices,
  );

  if (isLoadingPrices) return <DotLoading />;
  if (prices?.[ticker] === undefined) {
    return "--"
  }
  let converted = 0
  if (selected === ticker) {
    converted = amount;
  }
  else{
    converted = amount * (+prices?.[ticker]?.usd * +data?.[selected] ) ;
  }
  return (
    <FormatBaseCurrency amountInBaseCurrency={converted} maximumSignificantDigits={maximumSignificantDigits} />
  );
}

export const accountIconUrl = (account) => {
  if (!account?.startsWith("nano_")){
    account = "nano_" + account?.split("_")[1];
  }
  return "https://i.nanwallet.com/u/plain/https%3A%2F%2Fnatricon.com%2Fapi%2Fv1%2Fnano%3Faddress%3D" + account + "%26outline%3Dtrue";
}
export const AccountIcon = ({ account, width=32 }) => {
  return <ProfilePicture address={account} width={width} fallback={accountIconUrl(account)} />
  return (
    <img
      src={"https://i.nanwallet.com/u/plain/https%3A%2F%2Fnatricon.com%2Fapi%2Fv1%2Fnano%3Faddress%3D" + account}
      alt="nantricon"
      width={width}
    />
  );
}
export const AccountName = ({ }) => {
  const [accountsLabels, setAccountsLabels] = useLocalStorageState("accountsLabels", {defaultValue: {}});
  const {wallet} = useContext(WalletContext);
  const activeAccount = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address;

  return (
    <>
      {accountsLabels[activeAccount] || `Account ${wallet.activeIndex + 1}`}
    </>
  );
}

const WalletSummary = ({}) => {
  // const [selected] = useLocalStorageState("baseCurrency", {defaultValue: "USD"})
  // const {data, isLoading, error} = useSWR('fiat', fetchFiatRates)
  const { wallet, dispatch } = useContext(WalletContext);
  const {mutate,cache}=useSWRConfig()
  const {
    totalBalance,
    isLoading: isLoadingBalancesA,
    refreshBalances,
  } = useWalletBalance();

  // const { data: prices, isLoading: isLoadingPrices } = useSWR(
  //   "prices",
  //   fetchPrices,
  // );
  // const balances = {};
  // for (const ticker of Object.keys(networks)) {
  //   let account = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, ticker);

  //   // fetch balance for each network
  //   balances[ticker] = useSWR("balance-" + ticker + "-" + account, () => fetchBalance(ticker, account));
  // }

  // console.log({balances});
  // if (isLoadingBalances) return <DotLoading />;
  // const isLoadingBalances = Object.keys(balances).some((ticker) => balances[ticker]?.isLoading);
  // if (isLoadingPrices) return <DotLoading />;

  // const sum = Object.keys(balances)?.reduce((acc, ticker) => acc + (
  //   +balances[ticker]?.data * +prices?.[ticker]?.usd * +data?.[selected] 
  //   || 0), 0);
  
// console.log("balances", sum);
console.log("balance 2", totalBalance);
    // Toast.show({content: "sum: " + sum});
  // const addressPfp = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address

  const onRefresh = async () => {
    await mutate((key) => key.startsWith("balance-") || key === "prices");
  }

  return   <div className="m-3 mb-5">
    <SelectAccount />
  <div className="mt-2">
    
    <div className="text-2xl">
    {
      isLoadingBalancesA ? <DotLoading /> : <>
      <FormatBaseCurrency amountInBaseCurrency={totalBalance} /> <RefreshButton onRefresh={onRefresh} />
      
      </>
    }

    </div>
  </div>
</div>
}
export default function Home({ }) {
  const [selectedTicker, setSelectedTicker] = useState<string>(null);
  const [hiddenNetworks, setHiddenNetworks] = useLocalStorageState("hiddenNetworks", []);
  const {mutate,cache}=useSWRConfig()

  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    // todo add modal
    askPermission();
  
  }, [])
  const nanftsImage = [
    "https://i.nanwallet.com/unsafe/plain/https://images.nanswap.com/fb1f98ba-2d7d-49e3-8e85-a8f76bffb74b@webp", // nyano
    "https://i.nanwallet.com/unsafe/plain/https://images.nanswap.com/4850f8da-6458-4e47-bc80-3765e7df3a92@webp", //brocco
    "https://i.nanwallet.com/unsafe/plain/https://images.nanswap.com/628a9d75-28fb-414b-80d7-ff8896cced20@webp", // raistone
  ]
  const {ledger, setLedger, setWalletState} = useContext(LedgerContext);
  const { wallet, dispatch } = useContext(WalletContext);
  const [seedVerified, setSeedVerified] = useLocalStorageState('seedVerified', { defaultValue: false })
  const icon = seedVerified || ledger ? <SetOutline fontSize={20} /> : <Badge content={Badge.dot}><SetOutline fontSize={20} /></Badge>
  const {isMobile} = useWindowDimensions()
  const onRefresh = async () => {
    HapticsImpact({
      style: ImpactStyle.Medium
    });
    await mutate((key) => key.startsWith("balance-") || key === "prices");
  }
 
  return (
    <div className="w-full  " style={{  }}>
        <Popup
        destroyOnClose // else issue with history infinite scroll
          visible={selectedTicker !== null}
          onClose={() => {
            setSelectedTicker(null)
            navigate(location.pathname, {replace: true}) // reset send url params
          }}
          closeOnMaskClick
          position="right"
          maskClosable
          >{
            selectedTicker && <div style={{maxHeight: "100vh", overflowY: "auto"}}>
              <Network defaultTicker={selectedTicker} />
              </div>
          }
          </Popup>
        {/* <NavBar
        className="text-xxl app-navbar "
        //  back={
        //   icon
        // } 
        onBack={() => {
          if (isMobile){
            navigate("/settings");
          }
          else{
            setModalSettingsVisible(true);
          }
        }}
        backArrow={false}>
          <span className="text-xl">Home </span>
        </NavBar> */}
        <div className="flex">
        <div style={{width: "100%"}}>
      <PullToRefresh
      disabled={
         isTouchDevice() ? false : true
      }
      //  pullingText={<MdOutlineRefresh />}
       completeText={<>Updated <MdOutlineCheck /></>}
      //  canReleaseText={<DotLoading />}
       refreshingText={<DotLoading />}
      onRefresh={onRefresh}>

      <div className="flex items-center justify-between" >
        <WalletSummary />
{/* <MenuBar mode="large-screen"/> */}

        <div className="flex items-center justify-center">
          { ledger && <DisconnectLedger icon={true} /> }
          <CopyAddressPopup />
          <span className="mt-4 mr-4">
            <PasteAction mode="paste"/>
          </span>
          <span className="mt-4 mr-4">
            <PasteAction mode="scan"/>
          </span>
       
        </div>
      </div>
      {/* 211px is the height of navbar + wallet summary + menu bar */}
      <div className="pb-10" style={{ height: "calc(100vh - 211px + 46px - var(--safe-area-inset-bottom) - var(--safe-area-inset-top))", overflowY: "auto" }}>
     <SendReceive />
        <NetworkList
        noPadding
        hideActions={false}
        selectedTicker={selectedTicker}
          // onClick={(ticker) => navigate(`/${ticker}`)}
          onClick={(ticker) => {
            if (isMobile) {
              // navigate(`/${ticker}`)
              // document.startViewTransition(() => {
                navigate(`/${ticker}`, {viewTransition: true})
            // })
            }
            else {
              setSelectedTicker(ticker)
            }
          }}
        />
        <List>
          <List.Item
            clickable={false}
            onClick={() => navigate("/art")}
            extra={
              <div className="flex items-center m-2">
                {
                  nanftsImage.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      className="rounded-full w-10 h-10 -mr-3"
                    />
                  ))
                }
              </div>
            }
          >
            NaNFT
          </List.Item>
        </List>
        <ManageNetworks />
      </div>
      {/* <FloatingBubble
        style={{
          '--initial-position-bottom': '92px',
          '--initial-position-right': '24px',
          '--edge-distance': '24px',
        }}
        onClick={() => navigate("/swap")}
      >
    
        <FaExchangeAlt size={22} />

      </FloatingBubble> */}
      </PullToRefresh>
      </div>
      </div>
    </div>
  );
}
