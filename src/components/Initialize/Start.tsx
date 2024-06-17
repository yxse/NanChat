import { Button, Toast } from "antd-mobile";
import Navbar from "../Lock/Navbar";
import { Dispatch, useContext, useState } from "react";
import { LedgerService, LedgerStatus } from "../../ledger.service";
import { Link, useNavigate } from "react-router-dom";
import { LedgerContext } from "../Popup";

import { mutate } from "swr";
import { networks } from "../../utils/networks";

export async function resetLedger() {
  global.ledger.resetLedger()
  global.ledger = null
  global.account = null
  mutate((key) => typeof key === 'string' && key.startsWith('balance-'))
}

export function ConnectLedger({onConnect, onDisconnect}) {
  const [isConnected, setIsConnected] = useState(false);
  const {ledger, setLedger} = useContext(LedgerContext);

  return <>
    {
      ledger ? (
        <Button onClick={async () => {
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
        <Button onClick={async () => {
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
          mutate((key) => typeof key === 'string' && key.startsWith('balance-'))
          if (onConnect) {
            onConnect()
          }
        }
        }>
          Connect Ledger
        </Button>
      )
    }
  </>
}
export default function Start({
  setW,
  theme,
  setAppLoggedIn
}: {
  setW: Dispatch<React.SetStateAction<number>>;
  theme: "dark" | "light";
  setAppLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
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
                  src="img/logo.svg"
                  className="w-auto h-32 mr-2"
                  alt="Cesium Wallet Logo"
                  draggable={false}
                />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-600">
                    Created with ❤️ by{" "}
                    <a
                      href="https://nano.gift/"
                      onClick={(e) => {
                        e.preventDefault();
                        return chrome.tabs.create({
                          url: "https://nano.gift/?referrer=caesium",
                        });
                      }}
                      className="text-blue-500 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Nano Gift
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

          <div className="buttons-wrapper">
            <div
              className={`${theme == "light" && "!text-slate-200"
                } button-create`}
              role="button"
              onClick={() => setW(1)}
            >
              Create a new wallet
            </div>

            <div
              className={`${theme == "light" &&
                "!bg-slate-400 !text-slate-900 hover:!bg-slate-300"
                } button-restore`}
              role="button"
              onClick={() => setW(4)}
            >
              I already have a wallet
            </div>

            {/* <div
              className={`${theme == "light" &&
                "!bg-slate-400 !text-slate-900 hover:!bg-slate-300"
                } button-restore`}
              role="button"
              onClick={connectLedger()}
            >
              Use Ledger
            </div> */}
            <ConnectLedger />
            {/* <Link to="/XNO">XNO</Link> */}

          </div>
        </div>
      </div>
    </div>
  );
}
