import { BiReceipt } from "react-icons/bi";
import { networks } from "../../utils/networks";
import { SlArrowDownCircle, SlArrowUp, SlArrowUpCircle } from "react-icons/sl";
import { AiOutlineSwap } from "react-icons/ai";
import {
  Button,
  ErrorBlock,
  Input,
  Modal,
  NavBar,
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
import useSWR from "swr";
import { getWalletRPC, rawToMega } from "../../nano/accounts";
import RPC from "../../nano/rpc";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchPrices } from "./Home";
import { GoCreditCard } from "react-icons/go";

export const fetchBalance = async (ticker: string) => {
  const account = await getAccount(ticker);
  const balance = await new RPC(ticker).account_balance(account);
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
export const ModalReceive = ({ ticker, modalVisible, setModalVisible }) => {
  const [address, setAddress] = useState<string>(null);
  useEffect(() => {
    getAccount(ticker).then((address) => {
      setAddress(address);
    });
  }, []);
  return (
    <Modal
      visible={modalVisible}
      closeOnMaskClick={true}
      onClose={() => setModalVisible(false)}
      title={`Receive ${networks[ticker].name}`}
      content={
        <div className="flex flex-col items-center mb-2">
          <QRCodeSVG includeMargin value={address} className="rounded-md" />
          <div style={{ maxWidth: "200px" }} className="break-words">
            <CopyToClipboard text={address} />
          </div>
        </div>
      }
    />
  );
};
export default function Network({ defaultReceiveVisible = false }) {
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

  useEffect(() => {
    getWalletRPC(ticker); // initialize wallet ws
    // fetchData();
  }, []);
  return (
    <div className="divide-y divide-solid divide-gray-700 space-y-6">
      <div className="container  relative mx-auto">
        <div className="text-center text-2xl flex-col">
          <NavBar onBack={() => navigate("/")}>{networks[ticker].name}</NavBar>
          <ModalReceive ticker={ticker} modalVisible={modalVisible} setModalVisible={setModalVisible} />
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
        <div className="flex justify-center mt-4 space-x-4">
          <div className="flex flex-col items-center">
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
          </div>
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
      </div>
      {/* center  */}
      <div className="container relative mx-auto flex justify-center mt-4">
        <History ticker={ticker} />
      </div>
    </div>
  );
}
