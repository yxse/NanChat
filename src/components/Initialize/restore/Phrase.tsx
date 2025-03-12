// You know the rules and so do I

import React, { Dispatch, useContext, useState } from "react";
import { IoArrowBack } from "react-icons/io5";
import words from "../../../utils/words";
import { tools, wallet as walletLib } from "multi-nano-web";

import storage, { setSeed } from "../../../utils/storage";

import { Bounce, ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import "../../../styles/restore.css";
import { Button, Card, Form, Input, List, Modal, TextArea, Toast } from "antd-mobile";
import { networks } from "../../../utils/networks";
import { initWallet } from "../../../nano/accounts";
import { useSWRConfig } from "swr";
import { WalletContext } from "../../Popup";
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
import { loadWalletsFromGoogleDrive, loadWalletFromGoogleDrive, loadWalletsFromICloud, loadWalletFromICloud } from "../../../services/capacitor-chunked-file-writer";
export default function ImportPhrase({
  setW,
  setWalletState,
  onCreated,
}: {
  setW: Dispatch<React.SetStateAction<number>>;
  setWalletState: React.Dispatch<React.SetStateAction<"locked" | "unlocked" | "no-wallet" | "loading">>;
  onCreated: () => any;
}) {
  const [mnemonicInputs, setMnemonicInputs] = useState<string[]>(
    new Array(0).fill(""),
  );
  const { mutate } = useSWRConfig()
  const { wallet, dispatch } = useContext(WalletContext);
  const [activeInputs, setActiveInputs] = useState<number | null>(null);
  const [errorInputs, setErrorInputs] = useState<boolean[]>(
    new Array(24).fill(false),
  );
  const [canContinue, setCanContinue] = useState<boolean>(false);
  const [pinVisible, setPinVisible] = useState<boolean>(false);
  const [createPinVisible, setCreatePinVisible] = useState<boolean>(false);
  const [passwordImport, setPasswordImport] = useState<string>("")
  const [importFileVisible, setImportFileVisible] = useState<boolean>(false)
  const [encryptedSeed, setEncryptedSeed] = useState<string>("")
  const [wallets, setWallets] = useState<any[]>([])
  const [token, setToken] = useState<string>("")
  const [walletsVisible, setWalletsVisible] = useState<boolean>(false)
  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...mnemonicInputs];
    newInputs[index] = value;
    setMnemonicInputs(newInputs);
    validateMnemonic(newInputs);
  };

  const handleInputKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (event.key === " ") {
      event.preventDefault();
      const nextIndex = index === 23 ? 0 : index + 1;
      document.getElementById(`mnemonic-input-${nextIndex}`)?.focus();
    }
  };

  const validateMnemonic = (inputs: string[]) => {
    if (inputs[0].length === 64 || inputs[0].length === 128) {
      setCanContinue(true);
      setErrorInputs(new Array(24).fill(false));
      return
    }
    const isValid = inputs.every((word) => words.includes(word.trim())) && inputs.length === 24;
    setCanContinue(isValid);
    setErrorInputs(inputs.map((word) => !words.includes(word.trim())));
  };

  const handleInputBlur = (index: number) => {
    console.log(index);
    validateMnemonic(mnemonicInputs);
    setActiveInputs(null);
  };

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

  return (
    <>
      <div className="step-p-nav relative">
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
        
      >
      <div className="w-full h-full flex flex-col justify-between">
        <div className="flex flex-col justify-start w-full align-center mt-10">
          <p className="step-r-p-h select-none">Secret Recovery Phrase</p>
          <p className="step-r-p-p select-none">
            Import an existing wallet with your 24-word secret recovery phrase.
          </p>
        </div>

<Form.Item
          label="Recovery Phrase">
        <TextArea
        style={{backgroundColor: "var(--main-background-color)", padding: 8, borderRadius: 6}}
        autoFocus
          className="mt-4"
          autoSize
          value={mnemonicInputs.join(" ")}
          onChange={(v) => {
            setMnemonicInputs(v.split(" "));
            validateMnemonic(v.split(" "));
          }}
          placeholder="Enter your 24 word recovery phrase or a 64/128 hex characters seed" />
          </Form.Item>
        <div className="justify-end items-center m-3 align-center">
          <Button
          size="large"
          color={"primary"}
          disabled={!canContinue}
          style={{width: "100%"}}
          shape="rounded"
            // className={`step-r-p-import ${canContinue
            //     ? "!cursor-pointer !bg-blue-600 hover:!bg-blue-500"
            //     : "opacity-60 !cursor-not-allowed"
            //   }`}
              
            onClick={async (e) => {
              let seed;
              if (mnemonicInputs[0].length === 64 || mnemonicInputs[0].length === 128) {
                seed = mnemonicInputs[0];
                console.log(seed);
              } else if (tools.validateMnemonic(mnemonicInputs.join(" "))) {
                seed = walletLib.fromLegacyMnemonic(mnemonicInputs.join(" ")).seed;
              } else {
                toast.error("Invalid Mnemonic!");
                return;
              }

              await initializeWalletsAndAuth(seed);
            }}
          >
            Import Wallet
          </Button>
          <ResponsivePopup
          visible={importFileVisible}
          onClose={() => {
            setImportFileVisible(false)
          }}
          >
            <div className="p-4">
              <div className="text-lg font-bold">Enter backup password</div>
                      <Input
                        type="password"
                        placeholder="Enter password"
                        onChange={(v) => {
                          setPasswordImport(v)
                          console.log(v)
                          console.log(passwordImport)
                        }}
                      />
                    <Button
                      onClick={async () => {
                        console.log(passwordImport)
                        try {
                          let seed = await decrypt(encryptedSeed, passwordImport)
                          console.log(seed)
                          await initializeWalletsAndAuth(seed)
                          
                        } catch (error) {
                          toast.error("Invalid password!")
                        }
                      }}
                    >
                      Import
                    </Button>
                    </div>
          </ResponsivePopup>
          <Button
            onClick={async () => {
              let file = document.createElement('input')
              file.type = 'file'
              file.accept = '.txt'
              file.onchange = async (e) => {
                let file = e.target.files[0]
                let reader = new FileReader()
                reader.onload = (e) => {
                  
                  let encryptedSeed = e.target?.result
                  console.log(encryptedSeed)
                  setEncryptedSeed(encryptedSeed)
                  setImportFileVisible(true)
                  

                }
                reader.readAsText(file)
              }
              file.click()
            }}
            shape="rounded"
            color="primary"
            size="large"
          >
            Load backup file
          </Button>
          <Button
            onClick={async () => {
              let wallets = await loadWalletsFromGoogleDrive()
              console.log(wallets)
              setWallets(wallets.files)
              setToken(wallets.token)
              setWalletsVisible(true)
            }}
          >
            Load from Google Drive
          </Button>
          <ResponsivePopup
          visible={walletsVisible}
          onClose={() => {
            setWalletsVisible(false)
          }}
          >
            <div className="p-4">
              <div className="text-lg font-bold">Select a backup</div>
              <List>
                {wallets.map((walletDrive) => (
                  <List.Item
                  onClick={async () => {
                    if (Capacitor.getPlatform() === "ios") {  
                      let text = await loadWalletFromICloud(walletDrive.name)
                      console.log(text)
                      setEncryptedSeed(text)
                      setImportFileVisible(true)
                    } else {
                      let text = await loadWalletFromGoogleDrive(walletDrive.id, token)
                      console.log(text)
                      setEncryptedSeed(text)
                      setImportFileVisible(true)
                    }
                  }}
                   key={walletDrive.name} title={walletDrive.name} />
                ))}
              </List>
            </div>
          </ResponsivePopup>
          <Button
            onClick={async () => {
              let wallets = await loadWalletsFromICloud()
              console.log(wallets)
              setWallets(wallets)
              setWalletsVisible(true)
            }}
          >
            Load from iCloud
          </Button>
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
        <div className="justify-center h-full items-center m-3">
          <div className="bg-transparent w-full  scroll-auto overflow-y-auto rounded-md">
            <div className="w-full h-full grid grid-cols-3 gap-3">
              {mnemonicInputs.map((input, index) => (
                <div
                  className={`grid-input-r border-2 ${activeInputs === index && "!border-blue-500"
                    } ${errorInputs[index] && "!border-red-500"}`}
                  key={index}
                >
                  <p className="grid-input-r-p">{index + 1}.</p>
                  <input
                    style={{padding: 0}}
                    id={`mnemonic-input-${index}`}
                    pattern="[A-Za-z\s]+"
                    autoCorrect="false"
                    spellCheck="false"
                    className={`grid-input-r-i ${input.trim() && !words.includes(input.trim())
                        ? "invalid-input"
                        : ""
                      }`}
                    value={input}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleInputKeyDown(e, index)}
                    onBlur={() => handleInputBlur(index)}
                    onFocus={() => setActiveInputs(index)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </Card>

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
