// You know the rules and so do I

import React, { Dispatch, useState, useEffect, useContext } from "react";
import { IoArrowBack } from "react-icons/io5";
import { wallet as walletLib } from "multi-nano-web";

import "../../../styles/mnemonic.css";
import { BsEyeSlashFill } from "react-icons/bs";

import storage, { setSeed } from "../../../utils/storage";
import { Button, Card, DotLoading, Modal, NavBar, Toast } from "antd-mobile";
import { CopyButton } from "../../app/Icons";
import { saveAs } from 'file-saver';
import { WalletContext } from "../../Popup";
import { networks } from "../../../utils/networks";
import { useSWRConfig } from "swr";
import { initWallet } from "../../../nano/accounts";
import { CopyToClipboard } from "../../Settings";
import { isTauri } from "@tauri-apps/api/core";
import { Capacitor } from "@capacitor/core";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { PinAuthPopup } from "../../Lock/PinLock";
import { CreatePin } from "../../Lock/CreatePin";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import * as webauthn from '@passwordless-id/webauthn'
import { HapticsImpact } from "../../../utils/haptic";
import { copyToClipboard } from "../../../utils/format";
import { EyeFill, EyeOutline } from "antd-mobile-icons";
import { EyeInvisibleFill } from "antd-mobile-icons";

export default function Mnemonic({
  setW,
  theme,
  setWalletState,
  onCreated,
}: {
  setW: Dispatch<React.SetStateAction<number>>;
  theme: "light" | "dark";
}) {
  const {mutate,cache}=useSWRConfig()
  const {wallet, dispatch} = useContext(WalletContext);
  const [checked, setChecked] = useState<boolean>(false);
  const [mnemonic, setMnemonic] = useState<string>("");
  const [createPinVisible, setCreatePinVisible] = useState<boolean>(false);
  const [pinVisible, setPinVisible] = useState<boolean>(false);
  useEffect(() => {
    const generatedWallet = walletLib.generateLegacy()
    setMnemonic(generatedWallet.mnemonic);
    for (let ticker of Object.keys(networks)) {
      dispatch({ type: "ADD_WALLET", payload: { ticker, wallet: initWallet(ticker, generatedWallet.seed, mutate, dispatch) } });
    }
    setSeed(generatedWallet.seed, false)
        setWalletState("unlocked");
        onCreated()
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
      <Card
      style={{maxWidth: 500, margin: "auto", borderRadius: 10, marginTop: 20}}
        className={`pb-4 px-4`}
      >
      <div
        className={``}
      >
        <form
          className=""
        >
          <div className="step-m-c select-none">
            <div className="step-m-h">
              <p className={`text-3xl`}>
                Secret Recovery Phrase
              </p>
              <p className="mb-2 mt-4" style={{color: "var(--adm-color-warning)"}}>
                This phrase is the ONLY way to recover your wallet. Do NOT share
                it with anyone!
              </p>
              <p style={{color: "var(--adm-color-text-secondary)"}} className="mb-4 w-full">
            You will be able to backup it later in: Settings {">"} Backup Wallet
          </p>
            </div>
          </div>
          {
            mnemonic === "" ? <DotLoading /> : 
          <MnemonicWords mnemonic={mnemonic} defaultIsRevealed={false} colorCopy={false} showWarning={false} showHideButton/>
          }

          <Button
          shape="rounded"
          onClick={async () => {
            HapticsImpact({
              style:ImpactStyle.Medium
            });
            if (
              true ||
              isTauri() || Capacitor.isNativePlatform()) { // on native version, we skip password encryption since secure storage is already used
              let biometricAuth = await BiometricAuth.checkBiometry()
              let webauthnAuth = webauthn.client.isAvailable()
              
              Toast.show({icon: "success", content: biometricAuth.strongBiometryIsAvailable})
              const hasStrongAuth = biometricAuth.strongBiometryIsAvailable || webauthnAuth
              if (hasStrongAuth){
                localStorage.setItem('confirmation-method', '"enabled"')
                setPinVisible(true)
              }
              else{
                localStorage.setItem('confirmation-method', '"pin"')
                setCreatePinVisible(true)
              }
            }
            else{
              setW(2)
            }
          }}
           color="primary" size="large" className="mt-4 w-full">
            Next
          </Button>
        </form>
      </div>
      <PinAuthPopup
      location={"create-wallet"}
      visible={pinVisible}
      setVisible={setPinVisible}
      onAuthenticated={async () => {
        await setSeed(wallet.wallets["XNO"].seed, false)
        setWalletState("unlocked");
        onCreated()
      }
      } />
      <CreatePin visible={createPinVisible} setVisible={setCreatePinVisible} onAuthenticated={async () => {
        await setSeed(wallet.wallets["XNO"].seed, false)
        setWalletState("unlocked");
        onCreated()
      }
      } />
      </Card>
    </>
  );

}
export function MnemonicWords({ mnemonic, defaultIsRevealed = false, showHideButton = false, colorCopy}: { mnemonic: string, defaultIsRevealed?: boolean, showHideButton?: boolean, colorCopy?: string }) {
  const [isRevealed, setIsRevealed] = useState<boolean>(defaultIsRevealed);
  const [copied, setCopied] = useState<boolean>(false);
  const [warningShown, setWarningShown] = useState<boolean>(defaultIsRevealed); // don't show warning when init wallet
  const warningModal = () => {
    return
    Modal.confirm({
      title: "Do not share your Secret Recovery Phrase",
      content: "Support will never ask for your Secret Recovery Phrase. Do not share it with anyone and store it securely.",
      confirmText: "I understand",
      cancelText: "I don't understand",
      onCancel: () => {
        copyToClipboard("") // clear clipboard
        setIsRevealed(false)
        setWarningShown(false)
      }
    })
  }
  const triggerReveal = () => {
    if (!isRevealed && !warningShown) {
      warningModal()
      setWarningShown(true)
    }
    setIsRevealed(!isRevealed)
  }
  return <div>
  <div 
  onClick={triggerReveal}
  style={{userSelect: 'none'}}
  className="grid grid-cols-3 gap-3 overflow-y-scroll overflow-x-hidden  word-wrapper">
    {mnemonic.split(" ").map((word, index) => (
      <div
        key={index}
        style={copied ? {
          color: "var(--adm-color-success)",
          backgroundColor: "var(--main-background-color)",
          borderRadius: 6,
        } : {
          backgroundColor: "var(--main-background-color)",
          borderRadius: 6,
        }}
        className={`border p-2 text-sm`}
      >
        <span
        style={{color: "var(--adm-color-text-secondary)"}}
          className={`select-none`} 
        >
          {index + 1}.{" "}
        </span>
        <span className={`select-none`} style={{wordBreak: "break-word"}}>
          {
            isRevealed ? word : "********"
          }
        </span>
      </div>
    ))}
      </div>
      {
        showHideButton && 
      <div className="mt-4 mb-0 cursor-pointer text-base text-center w-full" onClick={() => triggerReveal()}>
                    {isRevealed ? 
                    <div className="flex items-center gap-2 justify-center">
                      <EyeInvisibleFill /> 
                      Click to hide
                    </div>
                    :
                    <div className="flex items-center gap-2 justify-center">
                      <EyeFill /> 
                      Click to reveal
                    </div>
                    }
                     
                </div>
      }
    <div className="mt-4">
      {
        !colorCopy && 
    <CopyButton 
    textToCopy={mnemonic} copiedText={"Copied for 1 minute"} copyText={"Copy to clipboard"} color={colorCopy}
    onCopy={() => {
      setCopied(true)
      if (!warningShown){
        warningModal()
        setWarningShown(true)
      }
      setTimeout(() => {
        copyToClipboard("empty", "Failed to clear secret phrase from clipboard") // clear clipboard
        setCopied(false)
      }
      , 60000)
      
    }}
    onAnimationEnd={() => setCopied(false)}
    />
  }
    </div>
  </div>;
}
