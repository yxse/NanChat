// @ts-nocheck
import { useContext, useEffect, useState } from "react";
import "../../styles/app/home.css";
import { networks } from "../../utils/networks";
import Network, { fetchBalance, fetchBalances, ModalReceive, showModalReceive } from "./Network";
import { Badge, Button, Card, CenterPopup, Dialog, DotLoading, FloatingBubble, Image, List, Modal, NavBar, NoticeBar, Popup, PullToRefresh, SideBar, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import useSWR, { useSWRConfig } from "swr";
import { BiCopy, BiPaste, BiPlus } from "react-icons/bi";
import NetworkList from "./NetworksList";
import NetworksSwitch from "./NetworksSwitch";
import { askPermission } from "../../nano/notifications";
import { CgCreditCard } from "react-icons/cg";
import { GoCreditCard } from "react-icons/go";
import { AiOutlineAccountBook, AiOutlineBank, AiTwotoneContainer } from "react-icons/ai";
import { IoNotificationsOutline } from "react-icons/io5";
import { DownOutline, ScanCodeOutline } from "antd-mobile-icons";
import { Scanner } from "@yudiel/react-qr-scanner";
import { MdOutlineCheck, MdOutlineRefresh, MdOutlineUsb } from "react-icons/md";
import { resetLedger } from "../Initialize/Start";
import { LedgerContext, WalletContext } from "../Popup";
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
import localForage from "localforage";
import ReloadPrompt from "./ReloadPrompt/ReloadPrompt";
import { SendReceive } from "./wallet/SendReceive";
import ProfilePicture from "../messaging/components/profile/ProfilePicture";
import RefreshButton from "../RefreshButton";
import { isTouchDevice } from "../../utils/isTouchDevice";

export const FormatBaseCurrency = ({amountInBaseCurrency, maximumSignificantDigits = undefined}) => {
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
  return "https://i.nanswap.com/u/plain/https%3A%2F%2Fnatricon.com%2Fapi%2Fv1%2Fnano%3Faddress%3D" + account;
}
export const AccountIcon = ({ account, width=32 }) => {
  return <ProfilePicture address={account} width={width} fallback={accountIconUrl(account)} />
  return (
    <img
      src={"https://i.nanswap.com/u/plain/https%3A%2F%2Fnatricon.com%2Fapi%2Fv1%2Fnano%3Faddress%3D" + account}
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
  const [selected] = useLocalStorageState("baseCurrency", {defaultValue: "USD"})
  const {data, isLoading, error} = useSWR('fiat', fetchFiatRates)
  const { wallet, dispatch } = useContext(WalletContext);
  const {mutate,cache}=useSWRConfig()

  const { data: prices, isLoading: isLoadingPrices } = useSWR(
    "prices",
    fetchPrices,
  );
  const balances = {};
  for (const ticker of Object.keys(networks)) {
    let account = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, ticker);

    // fetch balance for each network
    balances[ticker] = useSWR("balance-" + ticker + "-" + account, () => fetchBalance(ticker, account));
  }

  console.log({balances});
  // if (isLoadingBalances) return <DotLoading />;
  const isLoadingBalances = Object.keys(balances).some((ticker) => balances[ticker]?.isLoading);
  if (isLoadingPrices) return <DotLoading />;

  const sum = Object.keys(balances)?.reduce((acc, ticker) => acc + (
    +balances[ticker]?.data * +prices?.[ticker]?.usd * +data?.[selected] 
    || 0), 0);
  

  const addressPfp = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address

  const onRefresh = async () => {
    await mutate((key) => key.startsWith("balance-") || key === "prices");
  }

  return   <div className="m-3 mb-5">
    <SelectAccount />
  <div className="">
    
    <div className="text-2xl">
    {
      (isLoadingPrices || isLoadingBalances) ? <DotLoading /> : <>
      <FormatBaseCurrency amountInBaseCurrency={sum} /> <RefreshButton onRefresh={onRefresh} />
      
      </>
    }

    </div>
  </div>
</div>
}

export default function Home({ }) {
  const [selectedTicker, setSelectedTicker] = useState<string>(null);
  const [hiddenNetworks, setHiddenNetworks] = useLocalStorageState("hiddenNetworks", []);
  const [modalSettingsVisible, setModalSettingsVisible] = useState(false);
  const {mutate,cache}=useSWRConfig()

  const navigate = useNavigate();

  useEffect(() => {
    // todo add modal
    askPermission();
  }, [])

  const nanftsImage = [
    "https://i.nanswap.com/unsafe/plain/https://images.nanswap.com/fb1f98ba-2d7d-49e3-8e85-a8f76bffb74b@webp", // nyano
    "https://i.nanswap.com/unsafe/plain/https://images.nanswap.com/4850f8da-6458-4e47-bc80-3765e7df3a92@webp", //brocco
    "https://i.nanswap.com/unsafe/plain/https://images.nanswap.com/628a9d75-28fb-414b-80d7-ff8896cced20@webp", // raistone
  ]
  const {ledger, setLedger} = useContext(LedgerContext);
  const [seedVerified, setSeedVerified] = useLocalStorageState('seedVerified', { defaultValue: false })
  const icon = seedVerified || ledger ? <SetOutline fontSize={20} /> : <Badge content={Badge.dot}><SetOutline fontSize={20} /></Badge>
  const {isMobile} = useWindowDimensions()
  const onRefresh = async () => {
    await mutate((key) => key.startsWith("balance-") || key === "prices");
  }
 
  
  return (
    <div className="w-full  relative mx-auto" style={{  }}>
        <Popup
        destroyOnClose // else issue with history infinite scroll
          visible={selectedTicker !== null}
          onClose={() => setSelectedTicker(null)}
          closeOnMaskClick
          position="right"
          maskClosable
          >{
            selectedTicker && <div style={{maxHeight: "100vh", overflowY: "auto"}}>
              <Network defaultTicker={selectedTicker} />
              </div>
          }
          </Popup>
        <NavBar
        className="text-slate-400 text-xxl app-navbar "
         back={
          icon
        } 
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
        </NavBar>
        <div className="flex">
        <div style={{width: "100%"}}>
      <PullToRefresh
      disabled={
         isTouchDevice() ? false : true
      }
       pullingText={<MdOutlineRefresh />}
       completeText={<>Updated <MdOutlineCheck /></>}
       canReleaseText={<DotLoading />}
       refreshingText={<DotLoading />}
      onRefresh={onRefresh}>
      <div className="flex items-center justify-between" >
        <WalletSummary />
{/* <MenuBar mode="large-screen"/> */}

        <div className="flex items-center justify-center">
          {
            ledger && 
          <MdOutlineUsb 
        fontSize={24}
            className="cursor-pointer text-gray-200 mr-3 mt-4 text-green-400"
          onClick={() => {
            Dialog.alert({
              closeOnMaskClick: true,
            content: 'Disconnect Ledger ?',
          confirmText: 'Disconnect',
        onConfirm: async () => {
          await resetLedger();
          setLedger(null);
          Toast.show({
            content: "Ledger disconnected.",
          });
        }
      });
    }
  }
/>
}
<CopyAddressPopup />
          
          <PasteAction mode="paste"/>
          <PasteAction mode="scan" />
       
        </div>
      </div>
      <div className="overflow-y-auto pb-10" style={{ height: "65dvh" }}>
     <SendReceive />
        <NetworkList
        selectedTicker={selectedTicker}
          // onClick={(ticker) => navigate(`/${ticker}`)}
          onClick={(ticker) => {
            if (isMobile) {
              navigate(`/${ticker}`)
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
        <Modal
        bodyStyle={{height: "100vh", width: "500px"}}
        style={{height: "100vh"}}
        closeOnMaskClick
        onClose={() => setModalSettingsVisible(false)}
        visible={modalSettingsVisible} 
        // visible={true}
        content={
        //  <Settings isNavOpen={true} setNavOpen={() => {}} />
         <iframe src="/settings" className="w-full h-full" /> // only temporary, a bit hacky settings in modal is nice for pc users
         } />
      </div>
      </div>
    </div>
  );
}
