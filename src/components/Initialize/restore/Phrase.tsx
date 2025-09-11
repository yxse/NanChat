// You know the rules and so do I

import React, { Dispatch, useContext, useState } from "react";
import { IoArrowBack } from "react-icons/io5";
import words from "../../../utils/words";
import { tools, wallet as walletLib } from "multi-nano-web";

import storage, { setSeed } from "../../../utils/storage";

import { Bounce, ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import "../../../styles/restore.css";
import { Button, Card, Divider, Form, Input, List, Modal, NavBar, Space, TextArea, Toast } from "antd-mobile";
import { networks } from "../../../utils/networks";
import { initWallet } from "../../../nano/accounts";
import { useSWRConfig } from "swr";
import { WalletContext } from "../../useWallet";
import * as bip39 from 'bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { isTauri } from "@tauri-apps/api/core";
import { Capacitor } from "@capacitor/core";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { PinAuthPopup } from "../../Lock/PinLock";
import { CreatePin } from "../../Lock/CreatePin";
import * as webauthn from '@passwordless-id/webauthn'
import { decrypt } from "../../../worker/crypto";
import { ResponsivePopup } from "../../Settings";
import { ImportFromFile } from "./ImportFromFile";
import { ImportFromGoogleDrive } from "./ImportFromGoogleDrive";
import { ImportFromICloud } from "./ImportFromICloud";
import { MnemonicInput } from "./MnemonicInput";
import { PasswordImport } from "./PasswordImport";
import { LedgerSelect } from "../Start";
import { useWindowDimensions } from "../../../hooks/use-windows-dimensions";
import { ImportFromQRcode } from "./ImportFromQRcode";
import PasswordInputExportNewDevice from "../../app/backup/PasswordInputExportNewDevice";
import { useTranslation } from 'react-i18next';
import { authRegisterCanceled } from "../../messaging/components/Register";

export default function ImportPhrase({
  setW,
  setWalletState,
  onCreated,
}: {
  setW: Dispatch<React.SetStateAction<number>>;
  setWalletState: React.Dispatch<React.SetStateAction<"locked" | "unlocked" | "no-wallet" | "loading">>;
  onCreated: () => any;
}) {

  const { mutate } = useSWRConfig()
  // @ts-ignore - Ignoring TypeScript errors as requested
  const { wallet, dispatch } = useContext(WalletContext);
  const { t } = useTranslation();

  const [pinVisible, setPinVisible] = useState<boolean>(false);
  const [createPinVisible, setCreatePinVisible] = useState<boolean>(false);
  const [importFileVisible, setImportFileVisible] = useState<boolean>(false)
  const [passwordMode, setPasswordMode] = useState<string>("import")
  const [encryptedSeed, setEncryptedSeed] = useState<string>("")
  const {isMobile} = useWindowDimensions()

  const initializeWalletsAndAuth = async (seed: string) => {
    for (let ticker of Object.keys(networks)) {
      dispatch({ type: "ADD_WALLET", payload: { ticker, wallet: initWallet(ticker, seed, mutate, dispatch) } });
    }

    if (isTauri() || Capacitor.isNativePlatform()) { // on native version, we skip password encryption since secure storage is already used
      let biometricAuth = await BiometricAuth.checkBiometry();
      let webauthnAuth = webauthn.client.isAvailable();
      const hasStrongAuth = biometricAuth.strongBiometryIsAvailable || webauthnAuth;
      if (hasStrongAuth) {
        localStorage.setItem('confirmation-method', '"enabled"');
        setPinVisible(true);
      } else {
        localStorage.setItem('confirmation-method', '"pin"');
        setCreatePinVisible(true);
      }
    } else {
      setW(2);
    }
  };

  const handleWalletSelected = (encryptedSeed: string) => {
    setEncryptedSeed(encryptedSeed);
    setImportFileVisible(true);
  };

  return (
    <>
       <NavBar
                                  onBack={() => setW(0)}
                                  // onBack={() => navigate('/me')}
                          className="app-navbar "
                          backArrow={true}>
                            {t('importAccountTitle')}
                          </NavBar>
<div
      style={{width: isMobile ? "100%" : 500, margin: "auto", borderRadius: 10, marginTop: 20, overflow: "auto"}}
        
      >
      <div className="">
        <div className="justify-end items-center m-3 align-center">
          
        <MnemonicInput
                mode="import"
                onImport={async (mnemonicInputs: string[]) => {
                  let seed;
                  if (mnemonicInputs[0].length === 64 || mnemonicInputs[0].length === 128) {
                    seed = mnemonicInputs[0];
                    console.log(seed);
                  } else if (tools.validateMnemonic(mnemonicInputs.join(" "))) {
                    seed = walletLib.fromLegacyMnemonic(mnemonicInputs.join(" ")).seed;
                  } else {
                    toast.error(t('invalidMnemonic'));
                    return;
                  }
    
                  await initializeWalletsAndAuth(seed);
                }}
              />
          <Divider>
            {t('or')}
          </Divider>
          <div className="flex flex-col gap-2">
          <ImportFromQRcode onWalletSelected={(encryptedSeed) => {
            handleWalletSelected(encryptedSeed)
            setPasswordMode("import-qr")
          }} />
          <ImportFromFile onWalletSelected={handleWalletSelected} />
          <ImportFromGoogleDrive onWalletSelected={handleWalletSelected} />
          <ImportFromICloud onWalletSelected={handleWalletSelected} />
          </div>
          <Divider>
            {t('or')}
          </Divider>
          <LedgerSelect
          onConnect={() => {
            onCreated({callback: "/wallet"})
            setWalletState("unlocked");
          }}
           setWalletState={setWalletState} /> 
          
          <PasswordImport
            mode={passwordMode}
            visible={importFileVisible}
            onClose={() => setImportFileVisible(false)}
            encryptedSeed={encryptedSeed}
            onImportSuccess={async (seed) => {
              await initializeWalletsAndAuth(seed)
            }}
          />
        </div>
        <PinAuthPopup
              // @ts-ignore - Ignoring TypeScript errors as requested
              location={"create-wallet"}
              visible={pinVisible}
              setVisible={setPinVisible}
              onCancel={() => {
                authRegisterCanceled({t, setCreatePinVisible, setPinVisible})
              }}
              // description="Enter your PIN to secure your wallet"
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
           
      
      </div>
      </div>
      
      <ToastContainer
        position="top-center"
        autoClose={1000}
        className="select-none"
        hideProgressBar={false}
        transition={Bounce}
        theme="dark"
        pauseOnHover={false}
      />
    </>
  );
}
