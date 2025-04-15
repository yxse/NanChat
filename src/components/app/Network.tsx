import { BiReceipt } from "react-icons/bi";
import { networks } from "../../utils/networks";
import { SlArrowDownCircle, SlArrowUp, SlArrowUpCircle } from "react-icons/sl";
import { AiOutlineArrowDown, AiOutlineArrowUp, AiOutlineCreditCard, AiOutlineSwap, AiOutlineSync } from "react-icons/ai";
import {
  Button,
  CapsuleTabs,
  Card,
  CenterPopup,
  Divider,
  DotLoading,
  ErrorBlock,
  Input,
  Modal,
  NavBar,
  Popup,
  PullToRefresh,
  ResultPage,
  Skeleton,
  Space,
  Toast,
} from "antd-mobile";
import { useContext, useEffect, useState } from "react";
import Receive from "./Receive";
import { QRCodeSVG } from "qrcode.react";
import { CopyToClipboard } from "../Settings";
import { getAccount } from "../getAccount";
import Send, { AmountFormItem } from "./Send";
import History from "./History";
import useSWR, { mutate, useSWRConfig } from "swr";
import { getWalletRPC, initWallet, rawToMega } from "../../nano/accounts";
import RPC from "../../nano/rpc";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ConvertToBaseCurrency } from "./Home";
import { GoCreditCard } from "react-icons/go";
import Swap from "./Swap";
import { MdOutlineCheck, MdOutlineCurrencyExchange, MdOutlineRefresh } from "react-icons/md";
import { useLongPress } from "../../hooks/use-long-press";
import { SiExpertsexchange } from "react-icons/si";
import { RiTokenSwapLine } from "react-icons/ri";
import SetAmountModal from "./SetAmountModal";
import { ArrowDownCircleOutline, CloseCircleFill } from "antd-mobile-icons";
import { convertAddress, formatAmountMega, getURI, MIN_USD_SWAP, ShareModal } from "../../utils/format";
import { CopyButton } from "./Icons";
import { LedgerContext, WalletContext } from "../Popup";
import { Wallet } from "../../nano/wallet";
import { useWindowDimensions } from "../../hooks/use-windows-dimensions";
import { fetchPrices } from "../../nanswap/swap/service";
import { isTouchDevice } from "../../utils/isTouchDevice";
import RefreshButton from "../RefreshButton";
import { LedgerStatus } from "../../ledger.service";
import Buy from "./Buy";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import NetworkStatus from "./NetworkStatus";
import { HapticsImpact } from "../../utils/haptic";
import { useWalletBalance } from "../../hooks/use-wallet-balance";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { IWebviewOverlayPlugin, WebviewOverlay } from "@teamhive/capacitor-webview-overlay";
import { useHideNavbarOnMobile } from "../../hooks/use-hide-navbar";
import { ButtonActionCircle } from "./wallet/SendReceive";
// const WebviewOverlayPlugin = registerPlugin<IWebviewOverlayPlugin>('WebviewOverlayPlugin');

export const fetchBalance = async (ticker: string, account: string) => {
  let hidden = localStorage.getItem("hiddenNetworks") || [];
  if (hidden.includes(ticker)) { // don't need to fetch balance if network is hidden
    return null;
  }
  // const account = await getAccount(ticker);
  let balance = 0
  try {
    balance = await new RPC(ticker).account_balance(account);
  } catch (error) {
    console.error(`Error fetching balance for ${ticker}`, error);
    return 0;
  }
  if (balance.error) {
    return 0;
  } else {
    let balanceTotal =
      +rawToMega(ticker, balance.balance) + +rawToMega(ticker, balance.pending);
    return balanceTotal;
  }
};
export const fetchAccountInfo = async (ticker: string, account: string) => {
  const accountInfo = await new RPC(ticker).account_info(account);
  if (accountInfo.error) {
    return null;
  }
  return accountInfo;
};
export const fetchBlock = async (ticker: string, hash: string) => {
  const block = await new RPC(ticker).blocks_info([hash]);
  if (block.error) {
    return null;
  }
  return block.blocks[hash];
}
export const ModalReceive = ({ ticker, modalVisible, setModalVisible, action, setAction, onClose = () => {}, defaultScannerOpen = false }) => {
  // const [address, setAddress] = useState<string>(null);
  const [sizeQR, setSizeQR] = useState("small");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [enterAmountVisible, setEnterAmountVisible] = useState(false);
  const [receiveAmount, setReceiveAmount] = useState(undefined);
  // useEffect(() => {
  //   getAccount(ticker).then((address) => {
  //     setAddress(address);
  //   });
  // }, [ticker]);
  const { wallet } = useContext(WalletContext);
  const {ledger} = useContext(LedgerContext);
  // console.log("wallets", wallet);
  const address = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, ticker);
  const {isMobile} = useWindowDimensions()
  const ResponsivePopup = isMobile ? Popup : CenterPopup;
  if (ticker == null) ticker = "XNO";
  return (

    <ResponsivePopup
    bodyClassName={action === "send" ? "disable-keyboard-resize": ""}
    position={isMobile ? "bottom" : "right" }
    destroyOnClose={action === 'send' ? true : false} // destroy send modal on close e
    showCloseButton={true}
    visible={modalVisible}
    // closeOnSwipe={true}
    closeOnMaskClick={true}
    onClose={() => {
      setAction('')
      setModalVisible(false)
      if (action === 'send' && pathname !== `/` && !pathname.startsWith(`/chat`)) {
        // navigate(`/${ticker}`, {replace: true}) // to reset url params
        navigate(location.pathname, {replace: true}); // reset send url params on close
      }
      onClose()
    }}
    className="action-popup"
    
><div style={{minWidth: "350px"}}>
  { action === 'send' && <Send ticker={ticker}
  onSent={() => {
    // WebviewOverlayPlugin.show();
    WebviewOverlay.toggleSnapshot(false);
  }}
   onClose={() => {
    setModalVisible(false);
    onClose();
    // scroll to top
    window.scrollTo(0, 0);
  }} defaultScannerOpen={defaultScannerOpen}/>}
  { action === 'receive' && <>
  <div className="text-center text-xl m-4">
        Receive {networks[ticker].name}
  </div>
              <SetAmountModal
              visible={enterAmountVisible}
              setVisible={setEnterAmountVisible}
              ticker={ticker}
              onOk={(amount) => {
                setReceiveAmount(amount);
              }}
              />
        <div className="flex flex-col items-center mb-2 space-y-3 mx-4 mb-6">
            <QRCodeSVG 
            onClick={() => {
              if (sizeQR === "small") {
                setSizeQR("medium");
              }
              else if (sizeQR === "medium") {
                setSizeQR("large");
              }
              else {
                setSizeQR("small");
              }
            }}
            imageSettings={{
              src: networks[ticker].logo,
              height: 24,
              width: 24,
              excavate: false,
            }}
            includeMargin 
            value={getURI(ticker, address, receiveAmount)} className="rounded-md" size={
              sizeQR === "small" ? 128 : sizeQR === "medium" ? 256 : Math.min(window.innerWidth, window.innerHeight-300)
            } />
            <div>
              {receiveAmount ? 
              <div className="flex items-center space-x-2 mt-2">

              <div className="text-lg">{receiveAmount} {ticker}</div> 
              <div className="text-lg text-gray-400">
              ≈ <ConvertToBaseCurrency amount={receiveAmount} ticker={ticker} />
              </div>
              <div className="text-lg text-gray-400" onClick={() => {
                setReceiveAmount(undefined);
              }}>
              <CloseCircleFill />
              </div>
              </div>
              : null}
            </div>
          <div style={{ maxWidth: "200px" }} >
            <CopyToClipboard text={address} hideCopyIcon />
          </div>
        <CopyButton textToCopy={address} copyText="Copy Address" copiedText="Address Copied!" />
        {
          ledger && <Button
          style={{width: "100%"}}
          shape="rounded"
          size="large"
            color="default"
            onClick={async () => {
              HapticsImpact({
                style: ImpactStyle.Medium
              });
              if (ledger.ledger.status !== LedgerStatus.READY) {
                Toast.show({icon: 'fail', content: "Ledger is not yet ready. Please try again."})
                return;
              }
              if (ticker === "XNO"){
                Toast.show({icon: 'loading', content: "Confirm address on Ledger...", duration: 3000})
              }
              else {
                Toast.show({icon: 'loading', content: "Confirm address on Ledger. It should show the Nano prefix (nano_) ...", duration: 5000})
              }
              try {
                await ledger.getLedgerAccount(wallet.activeIndex, true);
                Toast.show({icon: 'success', content: "Address confirmed"})
              } catch (error) {
                console.log("Error confirming address on Ledger", error)
                if (error.message === "An action was already pending on the Ledger device. Please deny or reconnect.") {
                  Toast.show({icon: 'fail', content: "Ledger is busy. Please try again."})
                }
                else{
                  Toast.show({icon: 'fail', content: "Address rejected. Do not use wallet if address does not match.", duration: 5000})
                }
              }
            }}
            className="w-1/2"
          >
            Confirm on Ledger
          </Button>
        }
                  <div className="flex w-full space-x-2">

        {/* share address button */}
        <Button
        shape="rounded"
        size="large"
          color="default"
          onClick={() => {
            HapticsImpact({
              style: ImpactStyle.Medium
            });
            ShareModal({
              title: address,
            });
          }}
          className="w-1/2"
        >
          Share Address
        </Button>
      
        <Button
        shape="rounded"
        size="large"
          color="default"
          onClick={() => {
            HapticsImpact({
                  style: ImpactStyle.Medium
                });
            setEnterAmountVisible(true);
              // Modal.confirm({
              //   content: <Input type="number" placeholder="Amount" autoFocus/>,
              //   closeOnMaskClick: true,
              // });
              // window.prompt("Enter amount to receive", "0");
          }}
          className="w-1/2"
        >
          Set Amount
        </Button>
        </div>
        </div></>
  }
  { (action === 'swap' || action === 'buy') && <Swap 
  defaultAction={action}
  onSuccess={() => {
    Toast.show({icon: 'success'})
    setModalVisible(false);
    onClose();
    console.log("success swap")
    console.log({modalVisible})
    window.scrollTo(0, 0);
  }}
  hideHistory={true} 
  fiatDefaultTo={ticker}
  defaultTo={ticker === "XNO" ? "BAN" : ticker}
  defaultFrom={"XNO"} />}
  </div>
</ResponsivePopup>    
  );
};
export default function Network({ defaultReceiveVisible = false, defaultAction = '', defaultTicker = false }) {
  let { ticker } = useParams();
  if (defaultTicker) {
    ticker = defaultTicker;
  }

  const {wallet, dispatch} = useContext(WalletContext);
  let account = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, ticker);

  const { data: balance, isLoading: balanceLoading } = useSWR(
    "balance-" + ticker + "-" + account,
    () => fetchBalance(ticker, account),
    {
      keepPreviousData: true,
    },
  );
  const { data: prices } = useSWR("prices", fetchPrices);
  const navigate = useNavigate();
  const [modalVisible, setModalVisible] = useState(defaultReceiveVisible);
  const [action, setAction] = useState(defaultAction);
  const [defaultScannerOpen, setDefaultScannerOpen] = useState(false);
  useHideNavbarOnMobile(true)
  const onLongPress = useLongPress(() => {
    setAction('send');
    setModalVisible(true);
    setDefaultScannerOpen(true);    
    // navigator.vibrate(100);
    HapticsImpact({
      style: ImpactStyle.Heavy
    });
    }, 400);

  useEffect(() => {
    // if (wallet.wallets[ticker] == null){
    //     dispatch("ADD_WALLET", {ticker: ticker, wallet: initWallet(ticker, wallet.seed)})
    // }
    console.log("wallets", wallet)
    // getWalletRPC(ticker, wallet.seed).then((wallet) => {
    //   wallet.wsOnMessage = (msg) => {
    //     console.log("ws message in Network", msg);
    //     if (msg == "receive") {
    //       mutate("history-" + ticker);
    //       mutate("balance-" + ticker);
    //     }
    //   }
    // });
    // fetchData();
  }, []);

    // useEffect(() => {
    //   async function updateBalanceOnWsMessage() {
    //     let wallet = await getWalletRPC(ticker)
    //     wallet.wsOnMessage = (msg) => {
    //       console.log("ws message in Network", msg)
    //       mutate()
    //     }
    //   }
    //   updateBalanceOnWsMessage()
    //   }, [])
  const onRefresh = async () => {
    HapticsImpact({
      style: ImpactStyle.Medium
    });
    await mutate((key) => key.startsWith("history-" + ticker) || key.startsWith("balance-" + ticker));
    await wallet.wallets[ticker].receiveAll(account); // fallback to receive new block if ws is not working
  }
  const {lowBalanceUsd} = useWalletBalance();
  return (
    <div className="transition-opacity">
      <NavBar
      // right={
          
      //     <Button 
      //     size="mini"
      //     onClick={() => {
      //       setModalVisible(true);
      //       setAction('swap');
      //     }}
      //     >
      //     <div className="flex text-xs items-center -mr-0"><AiOutlineSwap 
          
      //      size={18} className="mr-1" /> Buy</div></Button>
      // }
          className="app-navbar "
          onBack={() => {
          navigate("/wallet");
        }}
        backArrow={true}>
          <span className="">{networks[ticker]?.name}</span>
        </NavBar>
     
      <div className="container  relative mx-auto ">
        <Card
         className="text-center text-2xl flex-col m-3 mt-4">
        
          <ModalReceive ticker={ticker} modalVisible={modalVisible} setModalVisible={setModalVisible} action={action} setAction={setAction} defaultScannerOpen={defaultScannerOpen} onClose={() => {
            setDefaultScannerOpen(false);
            navigate(location.pathname, {replace: true}); // reset send url params on close
          }}/>
          <div className="flex justify-center m-2">
            <img
              src={networks[ticker]?.logo}
              alt={`${ticker} logo`}
              width={48}
            />
          </div>
          <div className="mt-1">
            {balanceLoading ? (
              <div className="flex justify-center items-center">
                <Skeleton.Title animated />
                <span className="ml-2">{ticker}</span>
              </div>
            ) : (
              formatAmountMega(balance, ticker) + " " + ticker
            )} <RefreshButton onRefresh={onRefresh} />
          </div>
          <div className="text-sm text-gray-400">
            ~ <ConvertToBaseCurrency amount={balance} ticker={ticker} /> 
          </div>
        </Card>
        <div className="flex justify-center mt-4" style={{gap: 24}}>
          <ButtonActionCircle
          title="Receive"
          icon={<AiOutlineArrowDown size={22} />}
          onClick={() => {
            setAction('receive');
            setModalVisible(true);
          }}
          />
          <ButtonActionCircle
          title="Send"
          icon={<AiOutlineArrowUp size={22} />}
          onClick={() => {
            setAction('send');
            setModalVisible(true);
          }}
          />
        {
          (Capacitor.getPlatform() === "web" || !lowBalanceUsd) && 
          <ButtonActionCircle
          title="Swap"
          icon={<AiOutlineSwap size={22} />}
          onClick={() => {
            setAction('swap');
            setModalVisible(true);
          }}
          />
            }
          <ButtonActionCircle
          title="Buy"
          icon={<GoCreditCard size={22} className="" />}
          onClick={() => {
            setAction('buy');
            setModalVisible(true);
          }}
          />

        </div>
        {/* <Divider /> */}
      </div>
      {/* center  */}
      {/* <div
      style={{
        userSelect: "none",
        "WebkitUserSelect": "none",
        "MozUserSelect": "none",
        "msUserSelect": "none",
      }} 
      className="flex justify-center mt-4 space-x-4 bottom-btn">
      <Button
      style={{
        userSelect: "none",
        "WebkitUserSelect": "none",
        "MozUserSelect": "none",
        "msUserSelect": "none",
      }}
       color="primary" shape="rounded" size="large" className="w-full" onClick={() => {
        HapticsImpact({
          style: ImpactStyle.Medium
        });
        setModalVisible(true);
        setAction('receive');
      }}>
            Receive
          </Button>
      <Button
      {...onLongPress}
      style={{
        userSelect: "none",
        "WebkitUserSelect": "none",
        "MozUserSelect": "none",
        "msUserSelect": "none",
        
      }}
      disabled={balance === 0}
       color="primary" shape="rounded" size="large" className="w-full select-none" onClick={() => {
        HapticsImpact({
          style: ImpactStyle.Medium
        });
        setModalVisible(true);
        setAction('send');
      }}>Send
          </Button></div> */}
    
      <NetworkStatus ticker={ticker} />
      <div className="mt-4">
      <PullToRefresh
      disabled={isTouchDevice() ? false : true}
      // pullingText={<MdOutlineRefresh />}
      completeText={<>Updated <MdOutlineCheck /></>}
      // canReleaseText={<DotLoading />}
      refreshingText={<DotLoading />}
      onRefresh={onRefresh}>
        <History ticker={ticker} onSendClick={() => {
          setModalVisible(true);
          setAction('send');
        }} />
        </PullToRefresh>
      </div>
    </div>
  );
}
