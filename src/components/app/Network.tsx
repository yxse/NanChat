import { BiReceipt } from "react-icons/bi";
import { networks } from "../../utils/networks";
import { SlArrowDownCircle, SlArrowUp, SlArrowUpCircle } from "react-icons/sl";
import { AiOutlineSwap } from "react-icons/ai";
import {
  Button,
  CapsuleTabs,
  Divider,
  ErrorBlock,
  Input,
  Modal,
  NavBar,
  Popup,
  ResultPage,
  Skeleton,
  Space,
  Toast,
} from "antd-mobile";
import { useEffect, useState } from "react";
import Receive from "./Receive";
import { QRCodeSVG } from "qrcode.react";
import { CopyToClipboard, getAccount } from "../Settings";
import Send from "./Send";
import History from "./History";
import useSWR, { mutate } from "swr";
import { getWalletRPC, rawToMega } from "../../nano/accounts";
import RPC from "../../nano/rpc";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchPrices } from "./Home";
import { GoCreditCard } from "react-icons/go";
import Swap from "./Swap";

export const fetchBalance = async (ticker: string) => {
  let hidden = localStorage.getItem("hiddenNetworks") || [];
  if (hidden.includes(ticker)) { // don't need to fetch balance if network is hidden
    return null;
  }
  const account = await getAccount(ticker);
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
export const fetchAccountInfo = async (ticker: string) => {
  const account = await getAccount(ticker);
  const accountInfo = await new RPC(ticker).account_info(account);
  if (accountInfo.error) {
    return null;
  }
  return accountInfo;
};
export const ModalReceive = ({ ticker, modalVisible, setModalVisible, action, setAction }) => {
  const [address, setAddress] = useState<string>(null);
  useEffect(() => {
    getAccount(ticker).then((address) => {
      setAddress(address);
    });
  }, []);
  return (

    <Popup
    visible={modalVisible}
    closeOnSwipe={true}
    closeOnMaskClick={true}
    onClose={() => {
      setAction('')
      setModalVisible(false)
    }}
    
>
  { action === 'send' && <Send /> }
  { action === 'receive' && <>
  <div className="text-center text-xl m-4">

        Receive {networks[ticker].name}
  </div>
        <div className="flex flex-col items-center mb-2">
          <QRCodeSVG includeMargin value={address} className="rounded-md" />
          <div style={{ maxWidth: "200px" }} className="break-words">
            <CopyToClipboard text={address} />
          </div>
        </div></>
  }
  { action === 'swap' && <Swap hideHistory={true}/> }
</Popup>    
  );
};
export default function Network({ defaultReceiveVisible = false, defaultAction = '' }) {
  const { ticker } = useParams();
  const { data: balance, isLoading: balanceLoading } = useSWR(
    "balance-" + ticker,
    () => fetchBalance(ticker),
    {
      keepPreviousData: true,
    },
  );
  const { data: prices } = useSWR("prices", fetchPrices);
  const navigate = useNavigate();
  const [modalVisible, setModalVisible] = useState(defaultReceiveVisible);
  const [action, setAction] = useState(defaultAction);

  useEffect(() => {
    getWalletRPC(ticker); // initialize wallet ws
    // fetchData();
  }, []);
  return (
    <div className="">
          <NavBar 
          className="sticky top-0 z-10 bg-black pb-5"
          onBack={() => navigate("/")}>{networks[ticker].name}</NavBar>
      <div className="container  relative mx-auto">
        <div className="text-center text-2xl flex-col">
          <ModalReceive ticker={ticker} modalVisible={modalVisible} setModalVisible={setModalVisible} action={action} setAction={setAction} />
          <div className="flex justify-center m-2">
            <img
              src={networks[ticker].logo}
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
              balance + " " + ticker
            )}
          </div>
          <div className="text-sm text-gray-400">
            ~ {+(prices?.[ticker]?.usd * balance).toFixed(2)} USD
          </div>
        </div>
        <div className="flex justify-center mt-4 space-x-4 hidden">
          {/* <div className="flex flex-col items-center">
            <button
              className="py-2 px-2 rounded-full bg-gray-800 hover:bg-gray-900 text-white"
              onClick={async () => {
                // window.history.pushState({}, "", "/receive");
                setModalVisible(true);
              }}
            >
              <SlArrowDownCircle size={32} />
            </button>
            <span className="text-xs mt-1">Receive</span>
          </div>
          <div className="flex flex-col items-center">
            <button
              className="py-2 px-2 rounded-full bg-gray-800 hover:bg-gray-900 text-white"
              onClick={() => {
                // window.history.pushState({}, "", "/receive");
                navigate(`/${ticker}/send`);
              }}
            >
              <SlArrowUpCircle size={32} />
            </button>
            <span className="text-xs mt-1">Send</span>
          </div> */}
          <div className="flex flex-col items-center cursor-pointer" onClick={() => {
            navigate("/swap?from=" + ticker);
          }}
          >
            <button className="py-2 px-2 rounded-full bg-gray-800 hover:bg-gray-900 text-white">
              <AiOutlineSwap size={32} />
            </button>
            <span className="text-xs mt-1">Swap</span>
          </div>
          {
            ticker === "XNO" && <div className="flex flex-col items-center cursor-pointer" onClick={() => {
              navigate("/fiat?from=" + ticker);
            }}
            >
              <button className="py-2 px-2 rounded-full bg-gray-800 hover:bg-gray-900 text-white">
                <GoCreditCard size={32} className="" />
              </button>
              <span className="text-xs mt-1">Buy/Sell</span>
            </div>
          }
        </div>
        <Divider />
      </div>
      {/* center  */}
      <CapsuleTabs defaultActiveKey={""} activeKey={action}
      className=""
      onChange={(key) => {
          setModalVisible(true);
          setAction(key);
      }}>
        <CapsuleTabs.Tab
          title="Receive"
          key={"receive"}
        />
        <CapsuleTabs.Tab
          title="Send"
          key={"send"}
        />
        <CapsuleTabs.Tab
          title="Swap"
          key={"swap"}
        />
        {/* {
          ticker === "XNO" && <CapsuleTabs.Tab
            title="Buy/Sell"
            key={"swap"}
          />
        } */}
      </CapsuleTabs>
      <div className="container relative mx-auto flex justify-center mt-4">
        <History ticker={ticker} />
      </div>
    </div>
  );
}
