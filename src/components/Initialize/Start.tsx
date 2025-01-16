import { Button, Card, Dialog, Divider, Modal, Space, Toast } from "antd-mobile";
import Navbar from "../Lock/Navbar";
import { Dispatch, useContext, useState } from "react";
import { LedgerService, LedgerStatus } from "../../ledger.service";
import { Link, useNavigate } from "react-router-dom";
import { LedgerContext, WalletContext } from "../Popup";

import { mutate, useSWRConfig } from "swr";
import { networks } from "../../utils/networks";
import PWAInstallComponent from "../PWAInstallComponent";
import { MdOutlineBluetooth, MdOutlineUsb } from "react-icons/md";
import { initWallet } from "../../nano/accounts";
// ./icons/icon.png
import icon from "../../../public/icons/icon.png"
import { Capacitor } from "@capacitor/core";
// export async function resetLedger() {
// }

export function DisconnectLedger({ icon = false }) {
  const { ledger, setLedger, setWalletState } = useContext(LedgerContext);
  const { wallet, dispatch } = useContext(WalletContext);
  
  async function resetLedger() {
    global.ledger.resetLedger()
    global.ledger = null
    global.account = null
    mutate((key) => typeof key === 'string' && key.startsWith('balance-'))
    setLedger(null);
    if (wallet.oldAccounts.length == 0) {
      setWalletState("no-wallet");
      // go back to start if disconnecting ledger and no wallet already setup
    }
    dispatch({ type: "DISCONNECT_LEDGER" });
    Toast.show({
      content: "Ledger disconnected.",
    });
  }
  if (icon) {
    return <MdOutlineUsb
      fontSize={24}
      className="cursor-pointer text-gray-200 mr-3 mt-4 text-green-400"
      onClick={() => {
        Dialog.alert({
          closeOnMaskClick: true,
          content: 'Disconnect Ledger ?',
          confirmText: 'Disconnect',
          onConfirm: async () => {
            await resetLedger();
          }
        });
      }
      }
    />
  }
  return <Button
    size="large"
    shape="rounded"
    className="w-full mb-4"
    onClick={async () => {
      await resetLedger()
    }}>
    Disconnect Ledger
  </Button>
}

export function ConnectLedger({ onConnect, onDisconnect, mode }) {
  const [isConnected, setIsConnected] = useState(false);
  const { ledger, setLedger } = useContext(LedgerContext);
  const { wallet, dispatch } = useContext(WalletContext);
  const { mutate } = useSWRConfig();

  const isDisabled = Capacitor.getPlatform() === "ios" && mode === "usb" // USB is not supported on iOS
  return <>
    <Button
      disabled={isDisabled}
      size="large"
      shape="rounded"
      className="w-full mb-2"
      onClick={async () => {
        Toast.show({
          icon: "loading",
          content: "Connecting to Ledger device...",
          duration: 0
        });
        const ledger = new LedgerService();
        if (mode === "bluetooth") {
          await ledger.enableBluetoothMode(true)
        }
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
      <Space align="baseline">

        {
          mode === "bluetooth" ? (
            <MdOutlineBluetooth />
          ) : (
            <MdOutlineUsb />
          )
        }
        {
          mode === "bluetooth" ? (
            "Nano X"
          ) : (
            "Nano S / Nano X"
          )
        }
      </Space>
      {/* <Space align="center">
          <MdOutlineBluetooth />
          Use Ledger (Bluetooth)
          </Space> */}
    </Button>
    {
      isDisabled && (
        <div className="text-center text-xs text-gray-500 mb-2">
          USB is not supported on iOS. Please use Bluetooth.
        </div>
      )
    }
  </>
}

export const LedgerSelect = ({ onConnect, onDisconnect, setWalletState }) => {
  const [visible, setVisible] = useState(false);
  const { ledger, setLedger } = useContext(LedgerContext);

  if (ledger) {
    return <DisconnectLedger />
  }
  return <>
    <Button onClick={() => setVisible(true)} className="w-full mt-2 mb-4 " size="large" shape="rounded">
      <Space align="center">
        {
          Capacitor.getPlatform() === "ios" ? (
            <MdOutlineBluetooth />
          ) : (
            <MdOutlineUsb />
          )
        }
      Use Ledger
      </Space>
    </Button>
    <Modal
      onClose={() => setVisible(false)}
      closeOnMaskClick={true}
      showCloseButton={true}
      title="Use a Ledger"
      visible={visible}
      content={
        <>
          <ConnectLedger
            mode="usb"
            onDisconnect={() => {
              if (onDisconnect) {
                onDisconnect()
              }
              // setWalletState("no-wallet")
            }}
            onConnect={() => {
              if (onConnect) {
                onConnect()
              }
              // localStorage.setItem("masterSeed", "0")
              setWalletState("unlocked")
            }}
          />
          <ConnectLedger
            mode="bluetooth"
            onDisconnect={() => {
              if (onDisconnect) {
                onDisconnect()
              }
              // setWalletState("no-wallet")
            }}
            onConnect={() => {
              if (onConnect) {
                onConnect()
              }
              // localStorage.setItem("masterSeed", "0")
              setWalletState("unlocked")
            }}
          />
          <div className="text-center mt-2 text-sm">
            Ledger is an offline device that store your private keys in a Secure Element chip, providing additional layers of security. <br />
            <br />
            <a href="https://shop.ledger.com/?r=df3382d62bbf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Shop a Ledger
            </a>
          </div>
        </>
      }
    />

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
      <Card
      style={{maxWidth: 500, margin: "auto", borderRadius: 10, marginTop: 20}}
        className={`${theme == "light" && "!bg-white !text-black"
          } flex flex-col justify-between align-center p-4 h-full`}
      >
        <div style={{maxWidth: 500, margin: "auto"}} >
        <div className="init-wrapper">
          <div className="start-content">
            <div className="select-none items-center flex flex-col justify-center align-center w-full">
              <div className="flex flex-col space-y-3 items-center justify-center w-full">
                <img
                  src={icon}
                  className="w-auto h-32 mr-2"
                  alt="NanWallet Logo"
                  draggable={false}
                />
               
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
          <LedgerSelect setWalletState={setWalletState} />
          {/* <Link to="/XNO">XNO</Link> */}

        </div>
          </div>
          <div className="text-center mt-4">
          <div className="flex flex-col">
                  <span className="text-sm text-gray-600">
                    Created with 💙 by{" "}
                    <a
                      href="https://github.com/YXSE"
                      className="text-blue-500 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      YXSE
                    </a>
                  </span>
                </div>
          </div>
      </Card>
    </div>
  );
}
