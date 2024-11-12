// You know the rules and so do I

import React, { Dispatch, useState, useEffect, useContext } from "react";
import { IoArrowBack } from "react-icons/io5";

import storage, { setSeed } from "../../../utils/storage";
import { Button, Card, Form, Input, Modal, Toast } from "antd-mobile";
import { encrypt } from "../../../worker/crypto";
import { WalletContext } from "../../Popup";

export default function Password({
  setW,
  theme,
  setWalletState,
  onCreated,
}: {
  setW: Dispatch<React.SetStateAction<number>>;
  theme: "light" | "dark";
  setWalletState: React.Dispatch<React.SetStateAction<"locked" | "unlocked" | "no-wallet" | "loading">>;
  onCreated: () => any;
}) {
  const {wallet} = useContext(WalletContext);
  const [passLen, setPassLen] = useState<number>(0);
  const [passwordStrength, setPasswordStrength] = useState<string>("");
  const [showStrength, setShowStrength] = useState<boolean>(false);
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [passwordMatch, setPasswordMatch] = useState<boolean>(true);
  const [modalPasswordVisible, setModalPasswordVisible] = useState<boolean>(false);

  useEffect(() => {
    if (passLen > 0) {
      setShowStrength(true);
      calculatePasswordStrength(passLen);
    } else {
      setShowStrength(false);
    }
  }, [passLen]);

  useEffect(() => {
    if (confirmPassword !== password) {
      setPasswordMatch(false);
    } else {
      setPasswordMatch(true);
    }
  }, [confirmPassword, password]);

  const calculatePasswordStrength = (length: number) => {
    if (length < 6) {
      setPasswordStrength("WEAK");
    } else if (length < 10) {
      setPasswordStrength("MEDIUM");
    } else {
      setPasswordStrength("STRONG");
    }
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    setPassLen(value.length);
  };

  const handleConfirmPasswordChange = (
    value
  ) => {
    setConfirmPassword(value);
  };

  const isMobile = () => {
    return (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
  }
  return (
    <div className={``}>
      <div
        className={`${theme == "light" && "!bg-white !text-black !border-slate-400"
          } step-p-nav`}
      >
        <div
          className="cursor-pointer text-slate-400 hover:text-slate-200"
          role="button"
          onClick={() => {
            setW(1)
          }}
        >
          <IoArrowBack size={20} />
        </div>
        <div className="step-p-steps select-none">
          <div className="step-dot mr-[10px]" />
          <div className="step-dot mr-[10px]" />
          <div className="step-dot !bg-slate-700" />
        </div>
      </div>
      <div
        className={`step-m-wrapper `}
      >
        {/* <form
          className=""
          onSubmit={(e) => {
            e.preventDefault();
            if (passwordMatch) {
              storage.set("password", password, "session");
              window.history.pushState({}, "", "/success")
              return setW(3);
            }
            return;
          }}
          method="post"
          action=""
        > */}
        <div className="step-m-h">
          <p className={`step-m-hp`}>
            Require a password to open Cesium ?
          <p className="text-sm text-gray-400 mt-2">
           Password will be used to encrypt your secret phrase.
          </p>
          </p>
        </div>
        <Modal
          visible={modalPasswordVisible}
          closeOnMaskClick={true}
          onClose={() => setModalPasswordVisible(false)}
          title=""
          content={
<Form>
                      <Input
                      autoFocus
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Password"
                        className="mt-2"
                      />
                      <Input
                        id="verify-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Verify Password"
                        className="mt-2"
                      />
                      <Button
                      color="primary"
                      shape="rounded"
                        className="mt-4 w-full"
                        onClick={async () => {
                          let password = document.getElementById("password") as HTMLInputElement;
                          let verifyPassword = document.getElementById("verify-password") as HTMLInputElement;
                          if (password.value !== verifyPassword.value) {
                            Toast.show({
                              icon: "fail",
                              content: "Passwords do not match"
                            })
                            return
                          }

                          let encryptedMasterKey = await encrypt(wallet.wallets["XNO"].seed, password.value)
                          localStorage.setItem("encryptedMasterKey", encryptedMasterKey)
                          setModalPasswordVisible(false)
                          setWalletState("unlocked")
                          onCreated()
                          // setW(3)
                        }}
                      >
                        Enable Password
                      </Button>
                      <Button
                      color="default"
                      shape="rounded"
                        className="mt-4 w-full"
                        onClick={() => {setModalPasswordVisible(false)}
                        }
                      >
                        Cancel
                      </Button>
                      </Form>
          }
        />
        <div className="w-full">
            <div
            className="m-4"
          >

            <Button
            shape="rounded"
              size="large"
              className="w-full mb-4 mt-4"
              color={isMobile() ? "default" : "primary"}
              type="submit"
              onClick={() => {
                setModalPasswordVisible(true)  
              }}
              
            >
              Yes
            </Button>
            <Button
            shape="rounded"
              size="large"
              className="w-full  "
              color={isMobile() ? "primary" : "default"}
              type="submit"
              onClick={async () => {
                await setSeed(wallet.wallets["XNO"].seed)
                // setW(3)
                setWalletState("unlocked");
                onCreated()
              }}
            >
              No, Skip
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getColorClass(strength: string): string {
  switch (strength) {
    case "WEAK":
      return "!text-red-500";
    case "MEDIUM":
      return "!text-yellow-500";
    case "STRONG":
      return "!text-green-500";
    default:
      return "";
  }
}
