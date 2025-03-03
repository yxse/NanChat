// You know the rules and so do I

import React, { Dispatch, useState, useEffect, useContext } from "react";
import { IoArrowBack } from "react-icons/io5";

import storage, { setSeed } from "../../../utils/storage";
import { Button, Card, Form, Input, List, Modal, Toast } from "antd-mobile";
import { encrypt } from "../../../worker/crypto";
import { WalletContext } from "../../Popup";
import { LockOutline } from "antd-mobile-icons";

export const PasswordForm = ({onFinish, seed, buttonText = "Create Wallet"}) => {
  return <Form 
        onFinish={async (values) => {
            let encryptedSeed = await encrypt(seed, values.password)
            setSeed(encryptedSeed, true)
            // setModalPasswordVisible(false)
            onFinish()
            // setW(3)
          }}
        className="form-list high-contrast"
        footer={<Button
          type='submit' 
          size="large"
          color="primary"
          shape="rounded"
          className="mt-4 w-full"
          >
            {buttonText}
          </Button>}
        mode="card" style={{}}>
          <Form.Item className="form-list" style={{}} rules={[{ required: true, message: "Password cannot be empty" }]} name={"password"} label="">
                      <Input
                      autoFocus
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Password"
                        className="mt-2"
                      />
                      </Form.Item>
                      <Form.Item 
                      className="form-list"
                      validateFirst
                      rules={
                        [
                          { required: true, message: "Please confirm your password" },
                          { validator: async (rule, value) => {
                            if (value !== document.getElementById("password")?.value) {
                              return Promise.reject("Passwords do not match")
                            }
                            return Promise.resolve()
                          } }

                        ]
                      }
                      name={"verify-password"} label=""
                      >
                      <Input
                        id="verify-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Confirm Password"
                        className="mt-2"
                      />
                      </Form.Item>
                      </Form>
}

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
       <Card
       
            style={{maxWidth: 500, margin: "auto", borderRadius: 10, marginTop: 20}}
              className={`pb-4 px-4`}
            >
      <div
        className={` `}
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
            Set a password to open NanWallet
          <p className="text-sm mt-2 flex items-center gap-2" style={{color: "var(--adm-color-text-secondary)"}}>
            <LockOutline />
           Password will be used to encrypt your secret phrase
          </p>
          </p>
        </div>
        <div>
        {/* <List mode="card">
        <List.Item style={{backgroundColor: "var(--active-background-color)"}}> */}
        
                        <PasswordForm 
                        seed={wallet.wallets["XNO"]?.seed}
                        onFinish={() => {
                          setWalletState("unlocked")
                          onCreated()
                        }}
                        />
                      </div>
        {/* <div className="w-full">
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
                await setSeed(wallet.wallets["XNO"].seed, false)
                // setW(3)
                setWalletState("unlocked");
                onCreated()
              }}
            >
              No, Skip
            </Button>
        </div> */}
      </div>
      </Card>
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
