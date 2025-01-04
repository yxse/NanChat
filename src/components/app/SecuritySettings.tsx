
import { Button, Toast, CheckList, Modal, List, Input, Form, NavBar, Divider } from "antd-mobile";
import { MdOutlineFingerprint, MdOutlinePassword, MdOutlineTimer } from "react-icons/md";
import * as webauthn from '@passwordless-id/webauthn';
import { decrypt, encrypt } from "../../worker/crypto";
import { useNavigate } from "react-router-dom";
import useLocalStorageState from "use-local-storage-state";
import { useState } from "react";
import { removeSeed, setSeed } from "../../utils/storage";
import {BiometricAuth} from '@aparajita/capacitor-biometric-auth'
import { authenticate, biometricAuthIfAvailable, webauthnAuthIfAvailable } from "../../utils/biometrics";
import { Capacitor } from "@capacitor/core";
function SecuritySettings() {
    const navigate = useNavigate();
    const [hasPassword, setHasPassword] = useState(localStorage.getItem('seed') ? false : true);
    const [lockTimeSeconds, setLockTimeSeconds] = useLocalStorageState("lock-after-inactivity", {defaultValue: 
        60 * 30 // 30 minutes
      });
    const [confirmationMethod, setConfirmationMethod] = useLocalStorageState("confirmation-method", {defaultValue: Capacitor.isNativePlatform() ? "enabled" : "none"});
    const [developerMode, setDeveloperMode] = useLocalStorageState("developer-mode", {defaultValue: false});
      const valuesLock = [
        { value: "-1", label: "Disabled" },
        { value: "60", label: "1 minute" },
        { value: "300", label: "5 minutes" },
        { value: "900", label: "15 minutes" },
        { value: "1800", label: "30 minutes" },
        { value: "3600", label: "1 hour" },
        { value: "21600", label: "6 hours" },
      ]
    return (
    <div>
        <NavBar
        className="text-slate-400 text-xxl app-navbar "
        onBack={() => {
          navigate("/settings");
        }}
        backArrow={true}>
          <span className="">Security Settings</span>
        </NavBar>
        <List>
            {
                hasPassword && 
            
        <List.Item
              prefix={<MdOutlinePassword size={24} />}
              onClick={() => {
                let modal = Modal.show({
                  closeOnMaskClick: true,
                  title: "Disable Password",
                  content: (
                    <div>
                      <div>You will no longer need a password to open Cesium.</div>
                      <div>
                        Your secret phrase will be stored unencrypted on this device. <br/>Make sure your device cannot be accessed by unauthorized users.
                      </div>
                      <Input
                        id="verify-password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        className="mt-2"
                      />
                      <Button
                        className="mt-2"
                        onClick={async () => {
                          let password = document.getElementById("verify-password") as HTMLInputElement;
                          let isValid = false
                          let result = false
                          try {
                            result = await decrypt(localStorage.getItem("encryptedMasterKey") as string, password.value)
                            if (result) {
                              isValid = true
                            }
                          } catch (error) {
                            console.error(error)
                          }
                          if (isValid) {
                            await setSeed(result)
                            Toast.show({
                              icon: "success",
                              content: "Password disabled"
                            })
                            setHasPassword(false)
                            modal.close()
                          } else {
                            Toast.show({
                              icon: "fail",
                              content: "Invalid password"
                            })
                          }
                        }}
                      >
                        Disable Password
                      </Button>
                    </div>
                  ),
                });
              }}
            >
              Disable Password
            </List.Item>
            }
            {
                !hasPassword && 
            
            <List.Item
              prefix={<MdOutlinePassword size={24} />}
              onClick={async () => {
                let modal = Modal.show({
                  closeOnMaskClick: true,
                  title: "Require a password to open Cesium ?",
                  content: (
                    <div>
                      <div className="mb-2">Password will be used to encrypt your secret phrase.</div>
                      <Form>
                      <Input
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
                      </Form>
                      <Button
                        className="mt-2"
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

                          let encryptedMasterKey = await encrypt(localStorage.getItem("seed") as string, password.value)
                          localStorage.setItem("encryptedMasterKey", encryptedMasterKey)
                          await removeSeed()
                          Toast.show({
                            icon: "success",
                            content: "Password enabled"
                          })
                        setHasPassword(true)
                          modal.close()
                        }}
                      >
                        Enable Password
                      </Button>
                    </div>
                  ),
                });
              }}
            >
              Set a Password
            </List.Item>
            }
            <List.Item
            extra={confirmationMethod === "enabled" ? "Enabled" : "None"}
              prefix={<MdOutlineFingerprint size={24} />}
              onClick={() => {
                let modal = Modal.show({
                  closeOnMaskClick: true,
                  title: "Authentication",
                  content: <div>
                    <CheckList
                    value={confirmationMethod}
                    defaultValue={localStorage.getItem("webauthn-credential-id") ? ["webauthn"] : ["none"]} 
                    onChange={(val) => {
                      console.log(val)
                    }
                    }>
                      <CheckList.Item
                      value={"enabled"}
                      onClick={async () => {
                        const challenge = crypto.randomUUID()
                        if (localStorage.getItem("webauthn-credential-id") && localStorage.getItem("webauthn-credential-id") !== "undefined") {
                            return
                        }
                        else{
                          try {
                            await biometricAuthIfAvailable()
                            await webauthnAuthIfAvailable()
                            // await BiometricAuth.authenticate({
                            //   // reason: "Confirm to enable biometric authentication"
                            // })
                          // let r = await webauthn.client.register("Wallet #1", challenge, {
                          //   "authenticatorType": "auto",
                          //   "userVerification": "required",
                          //   "discoverable": "preferred",
                          //   "timeout": 60000,
                          //   "attestation": true
                          // })
                          // localStorage.setItem("webauthn-credential-id", r.credential.id)
                          // localStorage.setItem("webauthn-credential-id", " ")
                          Toast.show({
                            icon: "success",
                            content: "Authentication enabled"
                          })
                          setConfirmationMethod("enabled")
                          modal.close()
                        } catch (error) {
                          console.error(error)
                          Toast.show({
                            icon: "fail",
                            content: "Failed to authenticate. This method may be not supported on your device.",
                            duration: 5000
                          })
                        }
                      }}}
                      >
                        Face ID/Fingerprint/Key
                      </CheckList.Item>
                      <CheckList.Item 
                      value={"none"}
                      onClick={async () => {
                        try {
                          await biometricAuthIfAvailable()
                          await webauthnAuthIfAvailable()
                            localStorage.removeItem("webauthn-credential-id")
                            Toast.show({
                                icon: "success",
                                content: "Confirmation disabled"
                            })
                            setConfirmationMethod("none")
                            modal.close()
                        } catch (error) {
                            
                        }
                        }}>
                        None
                        </CheckList.Item>
                        </CheckList>
                        <div className="text-gray-300 text-sm mt-4">
                      <div>
                      If enabled, confirmation will be required to send transactions.
                      </div>
                      <div className="mt-2">
                      Please note that this does not encrypt your secret key. To encrypt your secret key, always use a password.
                      </div>
                    </div>
                    </div>
              })}}
            >
              Authentication
            </List.Item>
            <List.Item
            extra={valuesLock.find((v) => v.value === lockTimeSeconds.toString())?.label}
            onClick={() => {
              
              let modal = Modal.show({
                closeOnMaskClick: true,
                title: "Lock After Inactivity",
                content: (
                  <div>
                    <CheckList
                    defaultValue={[lockTimeSeconds.toString()]}
                      onChange={(val) => {
                          modal.close()
                          Toast.show({
                            icon: "success",
                          })
                      }}
                    >
                      {
                        valuesLock.map((v) => (
                          <CheckList.Item
                            value={v.value}
                            onClick={() => {
                              localStorage.setItem("lock-after-inactivity", v.value)
                              setLockTimeSeconds(parseInt(v.value))
                            }}
                          >
                            {v.label}
                          </CheckList.Item>
                        ))
                      }
                    </CheckList>
                    <div className="text-gray-300 text-sm mt-4">
                      <div>If enabled, password will be required after a period of inactivity.</div>
                    </div>
                  </div>
                ),
              });
            }}
            prefix={<MdOutlineTimer size={24} />}>Lock After Inactivity</List.Item>
        </List>
        <Divider />
        <List>
            <List.Item
            extra={developerMode ? "Enabled" : "Disabled"}
            onClick={() => {
                navigate("/settings/security/developer")
            }}
            >
                Developer Mode
            </List.Item>
        </List>
    </div>
  )
}

export default SecuritySettings