// @ts-nocheck
import { useContext, useEffect, useState } from "react";
import "../../styles/app/home.css";
import { networks } from "../../utils/networks";
import Network, { fetchBalance, fetchBalances, showModalReceive } from "./Network";
import { Button, Card, Dialog, DotLoading, FloatingBubble, List, Modal, NavBar, Popup, PullToRefresh, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import useSWR, { mutate } from "swr";
import { BiCopy, BiPaste, BiPlus } from "react-icons/bi";
import NetworkList from "./NetworksList";
import NetworksSwitch from "./NetworksSwitch";
import { askPermission } from "../../nano/notifications";
import { CgCreditCard } from "react-icons/cg";
import { GoCreditCard } from "react-icons/go";
import { AiOutlineAccountBook, AiOutlineBank, AiTwotoneContainer } from "react-icons/ai";
import { IoNotificationsOutline } from "react-icons/io5";
import { ScanCodeOutline } from "antd-mobile-icons";
import { Scanner } from "@yudiel/react-qr-scanner";
import { MdOutlineUsb } from "react-icons/md";
import { resetLedger } from "../Initialize/Start";
import { LedgerContext } from "../Popup";
import useLocalStorageState from "use-local-storage-state";
import { FaExchangeAlt } from "react-icons/fa";
import {SetOutline} from "antd-mobile-icons";
export const fetchPrices = async () => {
  const response = await fetch("https://api.nanexplorer.com/prices");
  return response.json();
};

const WalletSummary = ({}) => {
  const { data: prices, isLoading: isLoadingPrices } = useSWR(
    "prices",
    fetchPrices,
  );
  const balances = {};
  for (const ticker of Object.keys(networks)) {
    // fetch balance for each network
    balances[ticker] = useSWR("balance-" + ticker, () => fetchBalance(ticker));
  }

  console.log({balances});
  // if (isLoadingBalances) return <DotLoading />;
  const isLoadingBalances = Object.keys(balances).some((ticker) => balances[ticker]?.isLoading);
  if (isLoadingPrices) return <DotLoading />;

return   <div className="m-3 mb-5 mt-5">
  <div className="text-sm text-gray-200 mb-1">
    Main Wallet
  </div>
  <div className="">
    
    <div className="text-2xl">$ 
    {
      (isLoadingPrices || isLoadingBalances) ? <DotLoading /> : (Object.keys(balances)?.reduce((acc, ticker) => acc + (
        +balances[ticker]?.data * +prices?.[ticker]?.usd
        || 0), 0))?.toFixed(2)} USD
    </div>
  </div>
</div>
}

export default function Home({ }) {
  const [selectedTicker, setSelectedTicker] = useState<string>(null);
  const [networksSwitchVisible, setNetworksSwitchVisible] = useState<boolean>(false);
  const [hiddenNetworks, setHiddenNetworks] = useLocalStorageState("hiddenNetworks", []);

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
  async function getClipboardContents() {
    try {
      const text = await navigator.clipboard.readText();
      console.log('Pasted content: ', text);
      Toast.show({
        content: "Pasted: " + text,
      });
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
    }
  }
  const {ledger, setLedger} = useContext(LedgerContext);
  return (
    <div className="container  relative mx-auto" style={{ maxWidth: 600 }}>
        <NavBar
        className="text-slate-400 text-xxl app-navbar "
         back={
          <SetOutline fontSize={20} />
        } 
        onBack={() => {
          navigate("/settings");
        }}
        backArrow={false}>
          <span className="text-xl">cesium</span>
        </NavBar>
      <PullToRefresh
      pullingText="Pull to refresh"
      completeText="Refreshed"
      canReleaseText="Release to refresh"
      refreshingText="Refreshing..."
      onRefresh={async () => {
        await mutate((key) => key.startsWith("balance-") || key === "prices");
      }}>
      <div className="flex items-center justify-between">
        <WalletSummary />
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
<BiCopy fontSize={24} className="cursor-pointer text-gray-200 mr-3 mt-4"
  onClick={() => {
    Toast.show({
      content: "Copied!",
    });
  }
}
/>
          <ScanCodeOutline
            fontSize={24}
            className="cursor-pointer text-gray-200 mr-3 mt-4"
            onClick={() => {
              Modal.show({
                // style: { width: "100%", height: "268px" },
                // bodyStyle: { height: "268px" },
                closeOnMaskClick: true,
                title: "Scan QR Code",
                content: (
                  <div>
                    <div style={{ height: 256 }}>
                      <Scanner
                        //   styles={
                        onScan={(result) => {
                          console.log(result);
                          form.setFieldValue("address", result[0].rawValue);
                          Modal.clear();
                        }}
                      />
                    </div>
                    <div className="text-gray-400 m-4 text-sm">
                      Scan Address to send funds to or scan a message to sign
                    </div>
                  </div>
                ),
              });
            }}
          />
          <BiPaste fontSize={24} className="cursor-pointer text-gray-200 mr-4 mt-4"
            onClick={() => {
              navigator.clipboard.readText().then((text) => {
                Toast.show({
                  content: "Pasted: " + text,
                });
              })}}
          />
        </div>
      </div>
      <div className="overflow-y-auto pb-10" style={{ height: "70vh" }}>
        <NetworkList
          onClick={(ticker) => navigate(`/${ticker}`)}
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
        <div className="text-center mt-8 text-sm text-gray-400 cursor-pointer" onClick={() => setNetworksSwitchVisible(true)}>
          Manage crypto
        </div>
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
      <Popup
        visible={networksSwitchVisible}
        onClose={() => setNetworksSwitchVisible(false)}
        closeOnMaskClick={true}
      >
        <NetworksSwitch

          
         />
      </Popup>
      </PullToRefresh>
    </div>
  );
}
