// You know the rules and so do I

import React, { Dispatch, useState, useEffect, useContext, useDeferredValue, useRef, useCallback} from "react";
import { IoArrowBack } from "react-icons/io5";

import storage, { setSeed } from "../../../utils/storage";
import { Button, Card, Form, Input, List, Modal, NavBar, ProgressBar, Toast } from "antd-mobile";
import { encrypt } from "../../../worker/crypto";
import { WalletContext } from "../../useWallet";
import { LockOutline } from "antd-mobile-icons";

import { zxcvbnOptions, zxcvbnAsync } from '@zxcvbn-ts/core'
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common'
import * as zxcvbnEnPackage from '@zxcvbn-ts/language-en'

const options = {
  // recommended
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
  },
  // recommended
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  // recommended
  useLevenshteinDistance: true,
  // optional
  translations: zxcvbnEnPackage.translations,
}
zxcvbnOptions.setOptions(options)

const usePasswordStrength = (password: string) => {
  const [result, setResult] = useState("")
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const deferredPassword = useDeferredValue(password)

  const debouncedZxcvbn = useCallback((password: string) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Set new timeout for 500ms
    timeoutRef.current = setTimeout(() => {
      zxcvbnAsync(password).then((response) => setResult(response))
    }, 300)
  }, [])

  useEffect(() => {
    if (!deferredPassword) {
      setResult("")
      // Clear timeout if password is empty
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      return
    }
    
    debouncedZxcvbn(deferredPassword)
    
    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [deferredPassword, debouncedZxcvbn])

  return result
}

export const PasswordForm = ({onFinish,  buttonText = "Next"}) => {
  const [form] = Form.useForm();
  const password = Form.useWatch('password', form);
  console.log(password)
  const result = usePasswordStrength(password)


  return <div>
  <Form 
  form={form}
        onFinish={onFinish}
        className="form-list high-contrast"
        footer={
          <>
        <Button
          type='submit' 
          size="large"
          color="primary"
          shape="rounded"
          className="mt-4 w-full"
          >
            {buttonText}
          </Button>
            </>
          }
        mode="card" style={{}}>
          <Form.Item className="form-list" style={{}} rules={[
            { required: true, message: "Password cannot be empty" },
            // { min: 8, message: "Password must be at least 8 characters" }
            ]} name={"password"} label="">
                      <Input
                      autoFocus
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Password"
                        className="mt-2"
                      />
                      </Form.Item>
                        <div className="text-sm pl-4 pr-4 mr-2 mb-4" style={{textAlign: "start"}}>
                          <ProgressBar
                           text={password?.length > 0 ? <p style={{color: getColorClass(result.score)}}>{getStrengthText(result.score)}</p> : null}
            percent={result ? result?.score * 25 : 0}
            style={{
              '--fill-color':  getColorClass(result?.score),
            }}
          />
          
                        </div>
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
                    
                      </div>
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
      <NavBar
                                  onBack={() => setW(6)}
                                  // onBack={() => navigate('/me')}
                          className="app-navbar "
                          backArrow={true}>
                           
                          </NavBar>
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
          <p className={`text-3xl text-center`}>
          <LockOutline style={{display: "inline", marginRight: 4}} /> Set a password
            </p>
          <p className="mb-2 mt-4" style={{color: "var(--adm-color-text-secondary)", textAlign: "center"}}>
           
           Password will be used to encrypt your secret phrase and will be required to unlock NanChat.
          </p>
        </div>
        <div>
        {/* <List mode="card">
        <List.Item style={{backgroundColor: "var(--active-background-color)"}}> */}
        
                        <PasswordForm 
                        seed={wallet.wallets["XNO"]?.seed}
                        onFinish={async (values) => {
                          let encryptedSeed = await encrypt(wallet.wallets["XNO"].seed, values.password)
                          await setSeed(encryptedSeed, true)
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

function getStrengthText(score: number) {
  if (score === 0 || score === 1) {
    return "Weak"
  }
  if (score === 2) {
    return "Weak"
  }
  if (score === 3) {
    return "Good"
  }
  return "Strong"
}
function getColorClass(score: number) {
  if (score === 0 || score === 1) {
    return "var(--adm-color-warning)"
  }
  if (score === 2) {
    return "var(--adm-color-warning)"
  }
  if (score === 3) {
    return "var(--adm-color-primary)"
  }
  return "var(--adm-color-success)"
}