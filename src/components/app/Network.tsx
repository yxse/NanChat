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

export default function Network() {
  const [balance, setBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState<boolean>(false);
  const {ticker} = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    getWalletRPC(ticker); // initialize wallet ws
    const fetchData = async () => {
      try {
        setBalanceLoading(true);
        let balance = await fetchBalance(ticker);
        setBalance(balance);
      } catch (error) {
        console.error("Error fetching balance:", error);
      } finally {
        setBalanceLoading(false);
      }
    };
    fetchData();
  }, []);
  return (
    <div className="divide-y divide-solid divide-gray-700 space-y-6">
      <div className="container  relative mx-auto">
        <div className="text-center text-2xl flex-col">
          <NavBar onBack={() => navigate("/")}>{networks[ticker].name}</NavBar>

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
          <div className="text-sm text-gray-400">~0.00 $</div>
        </div>
        <div className="flex justify-center mt-4 space-x-4">
          <div className="flex flex-col items-center">
            <button
              className="py-2 px-2 rounded-full bg-gray-800 hover:bg-gray-900 text-white"
              onClick={async () => {
                // window.history.pushState({}, "", "/receive");
                let address = await getAccount(ticker);
                Modal.show({
                  closeOnMaskClick: true,
                  title: `Receive ${networks[ticker].name}`,
                  content: (
                    <div className="flex flex-col items-center mb-2">
                      <QRCodeSVG
                        includeMargin
                        value={address}
                        className="rounded-md"
                      />
                      <div
                        style={{ maxWidth: "200px" }}
                        className="break-words"
                      >
                        <CopyToClipboard text={address} />
                      </div>
                    </div>
                  ),
                });
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
          <div className="flex flex-col items-center">
            <button className="py-2 px-2 rounded-full bg-gray-800 hover:bg-gray-900 text-white">
              <AiOutlineSwap size={32} />
            </button>
            <span className="text-xs mt-1">Swap</span>
          </div>
        </div>
      </div>
      {/* center  */}
      <div className="container relative mx-auto flex justify-center mt-4">
        <History ticker={ticker} />
      </div>
    </div>
  );
}
