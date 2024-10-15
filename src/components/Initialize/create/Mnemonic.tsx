// You know the rules and so do I

import React, { Dispatch, useState, useEffect, useContext } from "react";
import { IoArrowBack } from "react-icons/io5";
import { wallet as walletLib } from "multi-nano-web";

import "../../../styles/mnemonic.css";
import { BsEyeSlashFill } from "react-icons/bs";

import storage from "../../../utils/storage";
import { Button, DotLoading } from "antd-mobile";
import { CopyButton } from "../../app/Icons";
import { saveAs } from 'file-saver';
import { WalletContext } from "../../Popup";
import { networks } from "../../../utils/networks";
import { useSWRConfig } from "swr";
import { initWallet } from "../../../nano/accounts";

export default function Mnemonic({
  setW,
  theme,
}: {
  setW: Dispatch<React.SetStateAction<number>>;
  theme: "light" | "dark";
}) {
  const {mutate,cache}=useSWRConfig()
  const {wallet, dispatch} = useContext(WalletContext);
  const [checked, setChecked] = useState<boolean>(false);
  const [mnemonic, setMnemonic] = useState<string>("");
  useEffect(() => {
    const generatedWallet = walletLib.generateLegacy()
    setMnemonic(generatedWallet.mnemonic);
    for (let ticker of Object.keys(networks)) {
      dispatch({ type: "ADD_WALLET", payload: { ticker, wallet: initWallet(ticker, generatedWallet.seed, mutate, dispatch) } });
    }
  }, []);
  return (
    <>
      <div
        className={`step-p-nav ${
          theme == "light" && "!bg-white !text-black !border-slate-400"
        }`}
      >
        <div
          className="cursor-pointer text-slate-400 hover:text-slate-200"
          role="button"
          onClick={() => setW(0)}
        >
          <IoArrowBack size={20} />
        </div>
        <div className="step-p-steps select-none">
        <div className="step-dot mr-[10px]" />
          <div className="step-dot mr-[10px] !bg-slate-700" />
          <div className="step-dot !bg-slate-700" />
        </div>
      </div>

      <div
        className={`step-m-wrapper `}
      >
        <form
          className="step-m-form"
        >
          <div className="step-m-c select-none">
            <div className="step-m-h">
              <p className={`step-m-hp ${theme == "light" && "!text-black"}`}>
                Secret Recovery Phrase
              </p>
              <p className="step-m-hs">
                This phrase is the ONLY way to recover your wallet. Do NOT share
                it with anyone!
              </p>
            </div>
          </div>
          {
            mnemonic === "" ? <DotLoading /> : 
          <MnemonicWords mnemonic={mnemonic} defaultIsRevealed={true} colorCopy="default" />
          }
          <Button
          shape="rounded"
          onClick={() => setW(2)}
           type="submit" color="primary" size="large" className="mt-4">
            I saved my Secret Recovery Phrase
          </Button>
        </form>
      </div>
    </>
  );

}
export function MnemonicWords({ mnemonic, defaultIsRevealed = false, showHideButton = false, colorCopy}: { mnemonic: string, defaultIsRevealed?: boolean, showHideButton?: boolean, colorCopy?: string }) {
  const [isRevealed, setIsRevealed] = useState<boolean>(defaultIsRevealed);
  const [copied, setCopied] = useState<boolean>(false);
  return <div>
  <div 
  style={{userSelect: isRevealed ? 'all' : 'none'}}
  className="grid grid-cols-3 gap-3 overflow-y-scroll overflow-x-hidden  word-wrapper">
    {mnemonic.split(" ").map((word, index) => (
      <div
        key={index}
        style={copied ? {color: "var(--adm-color-success)"} : {}}
        className={`border p-2 text-xs bg-black/60 p-1 rounded-sm`}
      >
        <span
          className={` text-slate-400 select-none`}
        >
          {index + 1}.{" "}
        </span>
        <span className={``}>
          {
            isRevealed ? word : "********"
          }
        </span>
      </div>
    ))}
      </div>
      {
        showHideButton && 
      <div className="text-gray-400 m-4 cursor-pointer" onClick={() => setIsRevealed(!isRevealed)}>
                    {isRevealed ? "Click to hide" : "Click to reveal"}
                </div>
      }
    <div className="mt-4">
    <CopyButton 
    textToCopy={mnemonic} copiedText={"Copied"} copyText={"Copy"} color={colorCopy}
    onCopy={() => setCopied(true)}
    onAnimationEnd={() => setCopied(false)}
    />
    </div>
  </div>;
}
