import { Button, Divider, Space, Toast } from "antd-mobile";
import Navbar from "../Lock/Navbar";
import { Dispatch, useContext, useState } from "react";
import { LedgerService, LedgerStatus } from "../../ledger.service";
import { Link, useNavigate } from "react-router-dom";
import { LedgerContext, WalletContext } from "../Popup";

import { mutate, useSWRConfig } from "swr";
import { networks } from "../../utils/networks";
import PWAInstallComponent from "../PWAInstallComponent";
import { MdOutlineUsb } from "react-icons/md";
import { initWallet } from "../../nano/accounts";
// ./icons/icon.png
import icon from "../../../public/icons/icon.png"
export async function resetLedger() {
  global.ledger.resetLedger()
  global.ledger = null
  global.account = null
  mutate((key) => typeof key === 'string' && key.startsWith('balance-'))
}

export function ConnectLedger({onConnect, onDisconnect}) {
  const [isConnected, setIsConnected] = useState(false);
  const {ledger, setLedger} = useContext(LedgerContext);
  const {wallet, dispatch} = useContext(WalletContext);
  const {mutate} = useSWRConfig();
  return <>
    {
      ledger ? (
        <Button 
        size="large"
        shape="rounded"
        className="w-full"
        onClick={async () => {
          Toast.show({
            content: "Ledger disconnected."
          });
          await resetLedger()
          setIsConnected(false)
          setLedger(null)
          if (onDisconnect) {
            onDisconnect()
          }
        }
        }>
          Disconnect Ledger
        </Button>
      ) : (
        <Button 
        size="large"
        shape="rounded"
        className="w-full"
        onClick={async () => {
          Toast.show({
            icon: "loading",
            content: "Connecting to Ledger device..."
          });
          const ledger = new LedgerService();
          let r = await ledger.loadLedger();
          console.log(r)
          console.log(ledger.ledger)
          
          if (ledger.ledger.status === LedgerStatus.NOT_CONNECTED) {
            Toast.show({
              icon: "fail",
              content: "Failed to connect the Ledger device. Make sure the nano app is running on the Ledger.",
              duration: 5000
            });
            return;
          }
          if (ledger.ledger.status === LedgerStatus.LOCKED) {
            Toast.show({
              icon: "fail",
              content: "Unlock your Ledger device and open the nano app to continue.",
              duration: 5000
            });
            return;
          }

          if (ledger.ledger.status === LedgerStatus.READY) {
            Toast.show({
              icon: "success",
              content: "Ledger connected."
            });
            let accountLedger = await ledger.getLedgerAccountWeb(0, false)
            console.log(accountLedger)
            global.account = accountLedger.address
            global.publicKey = accountLedger.publicKey
          }
          if (global.ledger == null) {
            global.ledger = ledger
          }
          setIsConnected(true)
          setLedger(ledger)
          for (let ticker of Object.keys(networks)) {
            let newWallet = initWallet(ticker, "0", mutate, dispatch)
            dispatch({ type: "USE_LEDGER", payload: { wallet: newWallet, ticker: ticker } })
          }
          mutate((key) => typeof key === 'string' && key.startsWith('balance-'))
          if (onConnect) {
            onConnect()
          }
        }
        }>
          <Space align="center">
          <MdOutlineUsb />
          Use Ledger
          </Space>
        </Button>
      )
    }
  </>
}
export default function Start({
  setWalletState,
  setW,
  theme,
}: {
  setWalletState: Dispatch<React.SetStateAction<"unlocked" | "locked" | "no-wallet" | "loading">>;
  setW: Dispatch<React.SetStateAction<number>>;
  theme: "dark" | "light";
}) {
  // const navigate = useNavigate();

  return (
    <div className="min-h-[554px]">
      <Navbar theme={theme} />
      <div
        className={`${theme == "light" && "!bg-white !text-black"
          } flex flex-col justify-between align-center p-[20px] h-full`}
      >
        <div className="init-wrapper">
          <div className="start-content">
            <div className="select-none items-center flex flex-col justify-center align-center w-full">
              <div className="flex flex-col space-y-3 items-center justify-center w-full">
                <img
                src={icon}
                  className="w-auto h-32 mr-2"
                  alt="Cesium Wallet Logo"
                  draggable={false}
                />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-600">
                    Created with 💙 by{" "}
                    <a
                      href="https://github.com/YXSE"
                      onClick={(e) => {
                        e.preventDefault();
                        return chrome.tabs.create({
                          url: "",
                        });
                      }}
                      className="text-blue-500 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      YXSE
                    </a>
                  </span>
                </div>
              </div>
              <p
                className={`${theme == "light" && "!text-slate-700"
                  } start-content-text`}
              >
                To get started, create a new wallet or import one from a seed
                phrase.
              </p>
            </div>
          </div>
          {/* <PWAInstallComponent   /> */}

            <Button 
            shape="rounded"
            onClick={() => setW(1)}
            className="w-full mt-4"
            size="large"
            color="primary">
            Create a new wallet
            </Button>
            <Button 
            shape="rounded"
            onClick={() => setW(4)}
            className="w-full mt-2 mb-2"
            size="large"
            color="default">
            Import Wallet
            </Button>
            {/* <div
              className={`${theme == "light" &&
                "!bg-slate-400 !text-slate-900 hover:!bg-slate-300"
                } button-restore`}
              role="button"
              onClick={connectLedger()}
            >
              Use Ledger
            </div> */}
            <Divider />
            <ConnectLedger
            onConnect={() => {
              // localStorage.setItem("masterSeed", "0")
              setWalletState("unlocked")
            }}
             />
            {/* <Link to="/XNO">XNO</Link> */}

        </div>
      </div>
    </div>
  );
}
