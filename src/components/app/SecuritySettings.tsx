
import { Button, Toast, CheckList, Modal, List, Input, Form, NavBar, Divider, Switch, DotLoading } from "antd-mobile";
import { MdOutlineFingerprint, MdOutlinePassword, MdOutlineTimer } from "react-icons/md";
import * as webauthn from '@passwordless-id/webauthn';
import { decrypt, encrypt } from "../../worker/crypto";
import { useNavigate } from "react-router-dom";
import useLocalStorageState from "use-local-storage-state";
import { useContext, useEffect, useState } from "react";
import { getSeed, removeSeed, setSeed } from "../../utils/storage";
import {BiometricAuth} from '@aparajita/capacitor-biometric-auth'
import { authenticate, biometricAuthIfAvailable, webauthnAuthIfAvailable } from "../../utils/biometrics";
import { Capacitor } from "@capacitor/core";
import { CreatePin } from "../Lock/CreatePin";
import { PinAuthPopup } from "../Lock/PinLock";
import { PasswordForm } from "../Initialize/create/Password";
import { WalletContext } from "../Popup";
import PrivacySettings from "./BlockedChats";
import { ChatWrongOutline, DeleteOutline, LeftOutline } from "antd-mobile-icons";
import { deleteAccount, fetcherMessages, setMinReceive } from "../messaging/fetcher";
import useSWR from "swr";
import { useHideNavbarOnMobile } from "../../hooks/use-hide-navbar";
import { isTauri } from "@tauri-apps/api/core";
import { useTranslation } from 'react-i18next';
function SecuritySettings() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [seed, setSeedLocal] = useState(undefined);
    const [hasPassword, setHasPassword] = useState(localStorage.getItem('seed') ? false : true);
    const [lockTimeSeconds, setLockTimeSeconds] = useLocalStorageState("lock-after-inactivity", {defaultValue: 
        60 * 30 // 30 minutes
      });
    const [confirmationMethod, setConfirmationMethod] = useLocalStorageState("confirmation-method", {defaultValue: Capacitor.isNativePlatform() ? "enabled" : "none"});
    const [confirmationMethodToSet, setConfirmationMethodToSet] = useState("")
    const [developerMode, setDeveloperMode] = useLocalStorageState("developer-mode", {defaultValue: false});
    const [createPinVisible, setCreatePinVisible] = useState(false);
    const [pinVisible, setPinVisible] = useState(false);
    const {wallet} = useContext(WalletContext);
    const {data: minReceive, isLoading, mutate} = useSWR("/min-receive", fetcherMessages);
    const isPasswordMandatory = Capacitor.getPlatform() === "web" ? true : false; // Password is only mandatory on web version
      const valuesLock = [
        { value: "-1", label: "Disabled" },
        { value: "60", label: "1 minute" },
        { value: "300", label: "5 minutes" },
        { value: "900", label: "15 minutes" },
        { value: "1800", label: "30 minutes" },
        { value: "3600", label: "1 hour" },
        { value: "21600", label: "6 hours" },
      ]

      useHideNavbarOnMobile(true)
    useEffect(() => { 
        getSeed().then((seed) => {  
          setSeedLocal(seed)
        })
    }
    , [])

    const WhenToAuthenticateSettings = () => {
      const [whenToAuthenticate, setWhenToAuthenticate] = useLocalStorageState("when-to-authenticate", {defaultValue: ["send"]});
      const [pinVisible, setPinVisible] = useState(false);
      const [actionToRemove, setActionToRemove] = useState("")
      const WhenToAuthenticateItem = ({value, children}) => {
          return <List.Item
          extra={<Switch checked={whenToAuthenticate.includes(value)} onChange={(checked) => {
              if (checked) {
                  setWhenToAuthenticate([...whenToAuthenticate, value])
              }
              else if (whenToAuthenticate.length === 1) {
                Toast.show({
                  icon: "fail",
                  content: t('atLeastOneOption'),
                  position: "top"
                })
              }
              else{
                
                setActionToRemove(value)
                setPinVisible(true)
              }
          }} />}
          >
              {children}
          </List.Item>
      }
      return <List mode="card">
        <PinAuthPopup
        location={"change-confirmation-method"}
        visible={pinVisible}
        setVisible={setPinVisible}
        onAuthenticated={() => setWhenToAuthenticate(whenToAuthenticate.filter((v) => v !== actionToRemove))} />
        {!seed?.isPasswordEncrypted && <WhenToAuthenticateItem value={"launch"}>{t('authenticateOnLaunch')}</WhenToAuthenticateItem>}
          <WhenToAuthenticateItem value={"send"}>{t('authenticateOnSend')}</WhenToAuthenticateItem>
          </List>
  }

  
  return (
    <div>
        <NavBar
        className="app-navbar "
        onBack={() => {
          navigate("/me/settings");
        }}
        backArrow={true}>
          <span className="">{t('securitySettings')}</span>
        </NavBar>
        <List mode="card">
            {
                seed?.isPasswordEncrypted &&
        <List.Item
              prefix={<MdOutlinePassword size={24} />}
              onClick={() => {
                let modal = Modal.show({
                  bodyStyle: {maxWidth: 400},
                  closeOnMaskClick: true,
                  title: t('disablePassword'),
                  content: (
                    <div>
                      <div>{t('disablePasswordDesc')}</div>
                      {
                        (Capacitor.getPlatform() === "web" && !isTauri()) && // only stored unencrypted if no password using the web version, else secure storage is used
                      <div>
                        {t('disablePasswordWarning')}
                      </div>
                      }
                      <Form className="form-list high-contrast" mode="card">
                      <Form.Item className="form-list">
                      <Input
                        id="verify-password"
                        type="password"
                        autoComplete="current-password"
                        placeholder={t('enterPassword')}
                        className="mt-2"
                      />
                      </Form.Item></Form>
                      <Button
                      color="primary"
                      shape="rounded"
                      size="large"
                      style={{width: "100%"}}
                        className="mt-4"
                        onClick={async () => {
                          let password = document.getElementById("verify-password") as HTMLInputElement;
                          let isValid = false
                          let result = false
                          try {
                            result = await decrypt(seed.seed, password.value)
                            if (result) {
                              isValid = true
                            }
                          } catch (error) {
                            console.error(error)
                          }
                          if (isValid) {
                            await setSeed(result)
                            setSeedLocal({seed: result, isPasswordEncrypted: false})
                            Toast.show({
                              icon: "success",
                              content: t('passwordDisabled')
                            })
                            setHasPassword(false)
                            modal.close()
                          } else {
                            Toast.show({
                              icon: "fail",
                              content: t('invalidPassword')
                            })
                          }
                        }}
                      >
                        {t('disablePassword')}
                      </Button>
                      {isPasswordMandatory && <div className="text-sm mt-4">
                        <div dangerouslySetInnerHTML={{__html: t('passwordMandatoryWeb')}} />
                      </div>}
                    </div>
                  ),
                });
              }}
            >
              {t('disablePassword')}
            </List.Item>
            }
            {
              seed?.isPasswordEncrypted && 
            
            <List.Item 
            prefix={<MdOutlinePassword size={24} />}
            onClick={() => {
              let modal = Modal.show({
                closeOnMaskClick: true,
                title: t('changePassword'),
                content: (
                  <div>
                    <PasswordForm 
                    buttonText={t('changePassword')}
                    onFinish={async (values) => {
                        let encryptedSeed = await encrypt(wallet.wallets["XNO"].seed, values.password)
                        await setSeed(encryptedSeed, true)
                        modal.close()
                        Toast.show({
                          icon: "success",
                          content: t('passwordUpdated')
                        })
                    }} />
                  </div>
                ),
              });
            }}
            >
              {t('changePassword')}
            </List.Item>}
            {
              !seed?.isPasswordEncrypted &&
            
            <List.Item
              prefix={<MdOutlinePassword size={24} />}
              onClick={async () => {
                let modal = Modal.show({
                  showCloseButton: true,
                  closeOnMaskClick: true,
                  title: t('requirePasswordTitle'),
                  content: (
                    <div>
                      <div className="mb-2 ">{t('requirePasswordDesc')}</div>
                      <div style={{color: "var(--adm-color-warning)"}}>
                        {t('passwordWarning')}
                      </div>
                       <PasswordForm
                                          onFinish={async (values) => {
                                            const password = values.password
                                            let encryptedSeed = await encrypt(seed.seed, password)
                                            await setSeedLocal({seed: encryptedSeed, isPasswordEncrypted: true})
                                            await setSeed(encryptedSeed, true)
                                            
                                            Toast.show({
                                              icon: "success",
                                              content: t('passwordEnabled')
                                            })
                                          setHasPassword(true)
                                            modal.close()
                                          }}
                                          buttonText={t('enablePassword')}
                                      />
                                  
                    </div>
                  ),
                });
              }}
            >
              {t('setPassword')}
            </List.Item>
            }
            <PinAuthPopup 
            location={"change-confirmation-method"}
            visible={pinVisible} setVisible={setPinVisible} onAuthenticated={async () => {
              if (confirmationMethodToSet === "pin") {
                setCreatePinVisible(true)
                // we don't set confirmation method here since pin is not yet created
                // it will be set in onAuthenticated of CreatePin, allowing to cancel the operation withut have pin confirmation method set without a pin
              }
              else if (confirmationMethodToSet === "enabled") { 
                // ensure user has access to biometrics before enabling
                await biometricAuthIfAvailable()
                await webauthnAuthIfAvailable()
                setConfirmationMethod(confirmationMethodToSet)
              }
              else if (confirmationMethodToSet === "none") {
                setConfirmationMethod(confirmationMethodToSet)
              }
            }} description={t('changeConfirmationMethod')} />
            <CreatePin
             visible={createPinVisible} 
             setVisible={setCreatePinVisible} 
             onAuthenticated={(pin) => {
                setConfirmationMethod("pin")
                Modal.clear()
              }} />
             
            {seed?.isPasswordEncrypted &&
            <List.Item
            extra={valuesLock.find((v) => v.value === lockTimeSeconds.toString())?.label}
            onClick={() => {
              
              let modal = Modal.show({
                closeOnMaskClick: true,
                title: t('lockAfterInactivity'),
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
                            {t(v.label.toLowerCase().replace(/ /g, '')) || v.label}
                          </CheckList.Item>
                        ))
                      }
                    </CheckList>
                    <div className="text-gray-300 text-sm mt-4">
                      <div>{t('lockAfterInactivityDesc')}</div>
                    </div>
                  </div>
                ),
              });
            }}
            prefix={<MdOutlineTimer size={24} />}>{t('lockAfterInactivity')}</List.Item>
            }
        </List>
       
          <>
        <List 
        mode="card">
          <List.Item
            extra={confirmationMethod}
              prefix={<MdOutlineFingerprint size={24} />}
              onClick={() => {
                let modal = Modal.show({
                  closeOnMaskClick: true,
                  title: t('authentication'),
                  content: <div>
                    <CheckList
                    value={[confirmationMethod]}
                    defaultValue={localStorage.getItem("webauthn-credential-id") ? ["webauthn"] : ["none"]} 
                    onChange={(val) => {
                      console.log(val)
                    }
                    }>
                      <CheckList.Item
                      value={"enabled"}
                      onClick={async () => {
                        setConfirmationMethodToSet("enabled")
                        setPinVisible(true)
                        modal.close()
                        const challenge = crypto.randomUUID()
                        if (localStorage.getItem("webauthn-credential-id") && localStorage.getItem("webauthn-credential-id") !== "undefined") {
                            // return
                        }
                        else{
                          try {
                          //   await biometricAuthIfAvailable()
                          //   await webauthnAuthIfAvailable()
                          //   // await BiometricAuth.authenticate({
                          //   //   // reason: "Confirm to enable biometric authentication"
                          //   // })
                          // // let r = await webauthn.client.register("Wallet #1", challenge, {
                          // //   "authenticatorType": "auto",
                          // //   "userVerification": "required",
                          // //   "discoverable": "preferred",
                          // //   "timeout": 60000,
                          // //   "attestation": true
                          // // })
                          // // localStorage.setItem("webauthn-credential-id", r.credential.id)
                          // // localStorage.setItem("webauthn-credential-id", " ")
                          // Toast.show({
                          //   icon: "success",
                          //   content: "Authentication enabled"
                          // })
                          // setConfirmationMethodToSet("enabled")
                          // setPinVisible(true)
                        } catch (error) {
                          console.error(error)
                          Toast.show({
                            icon: "fail",
                            content: t('authenticationFailed') || "Failed to authenticate. This method may be not supported on your device.",
                            duration: 5000
                          })
                        }
                      }}}
                      >
                        {t('faceIdFingerprintKey')}
                      </CheckList.Item>
                      <CheckList.Item
                      value={"pin"}
                      onClick={async () => {
                        setPinVisible(true)
                        setConfirmationMethodToSet("pin")
                        }}>
                        {t('pin')}
                      </CheckList.Item>
                      <CheckList.Item 
                      value={"none"}
                      onClick={async () => {
                        setConfirmationMethodToSet("none")
                        setPinVisible(true)
                        modal.close()
                        // try {
                        //   await biometricAuthIfAvailable()
                        //   await webauthnAuthIfAvailable()
                        //     localStorage.removeItem("webauthn-credential-id")
                        //     Toast.show({
                        //         icon: "success",
                        //         content: "Confirmation disabled"
                        //     })
                        //     setConfirmationMethod("none")
                        //     modal.close()
                        // } catch (error) {
                            
                        // }
                        }}>
                        {t('none')}
                        </CheckList.Item>
                        </CheckList>
                        <div className="text-gray-300 text-sm mt-4">
                      <div>
                      {t('authenticationRequiredDesc')}
                      </div>
                      <div className="mt-2">
                      {t('authenticationNote')}
                      </div>
                    </div>
                    </div>
              })}}
            >
              {t('authentication')}
            </List.Item>
            </List>
            {
          confirmationMethod !== "none" && 
          <WhenToAuthenticateSettings t={t} />
      }
        </>
        {
          confirmationMethod !== "none" && 
        <div className="text-sm px-4" style={{color: "var(--adm-color-text-secondary)"}}>
          {t('atLeastOneOption')}
        </div> 
        }
        <Divider />
        <List mode="card">
            <List.Item
            prefix={<ChatWrongOutline fontSize={24} />}
            onClick={() => {
                navigate("/settings/security/blocked")
            }}
            >
                {t('blockedAccounts')}
            </List.Item>
            <List.Item
            extra={
              isLoading ? <DotLoading /> : minReceive + " USD"}
            prefix={<div style={{fontSize: 24}}>≥</div>}
            onClick={() => {
                Modal.show({
                    closeOnMaskClick: true,
                    showCloseButton: true,
                    content: <div>
                        <Form
                        initialValues={{
                            minReceiveAmount: minReceive
                        }}
                        layout="horizontal"
                        footer={
                          <div>
                            
                            <Button block type="submit" color="primary" size="large">
                                {t('save')}
                            </Button>
                          </div>
                        }
                        onFinish={async (values) => {
                            let r = await setMinReceive(values.minReceiveAmount)
                            if (r.error) {
                                Toast.show({
                                    icon: "fail",
                                    content: r.error
                                })
                                return
                            }
                            mutate(r, false)
                            Toast.show({
                                icon: "success",
                            })
                            Modal.clear()
                        }}
                        >
                            <Form.Item
                            layout="vertical"
                            name="minReceiveAmount"
                            label={t('minReceiveAmount')}
                            rules={[]}
                            >
                                <Input
                                autoFocus
                                type="number"
                                placeholder=""
                                defaultValue={minReceive}
                                />
                            </Form.Item>
                        </Form>
                        <div className="text-sm mt-2">
                            <div>{t('filterLowValueDesc')}</div>
                            <div className="mt-2">{t('setToZeroToDisable')}</div>
                            </div>
                            </div>
                })
            }
            }
            >
                {t('minReceiveAmount')}
            </List.Item>
        </List>
        <Divider />
        <List mode="card">
            <List.Item
            extra={developerMode ? t('enabled') : t('disabled')}
            onClick={() => {
                navigate("/settings/security/developer")
            }}
            >
                {t('developerMode')}
            </List.Item>
        </List>
        <Divider />
        <List mode="card">
            <List.Item
            prefix={<DeleteOutline fontSize={24} color="red"/>}
            onClick={() => {
                Modal.show({
                  title: t('deleteAccount'),
                  content: t('deleteAccountConfirm'),
                  closeOnMaskClick: true,
                  actions: [
                    { key: "confirm", text: t('deleteAccount'), style: { color: "var(--adm-color-danger)" }, onClick: async () => {
                      Modal.confirm({
                        title: t('confirmAccountDeletion'),
                        closeOnMaskClick: true,
                        confirmText: t('deleteAccount'),
                        cancelText: t('cancel'),
                        onConfirm: async () => {
                          await deleteAccount()
                          Modal.clear()
                          Toast.show({
                        icon: "success",
                        content: t('accountDeleted')
                      })
                      navigate('/me')
                    }
                      })}},
                    { key: "cancel", text: t('cancel') , onClick: () => {
                        Modal.clear()
                    }}
                  ],

                })
            }}
            >
                {t('deleteAccount')}
            </List.Item>
        </List>
    </div>
  )
}


export default SecuritySettings