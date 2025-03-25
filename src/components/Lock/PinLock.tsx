import { Modal, NumberKeyboard, PasscodeInput, Popup, Toast } from "antd-mobile"
import { useEffect, useRef, useState } from "react"
import { isTouchDevice } from "../../utils/isTouchDevice"
import { authenticate } from "../../utils/biometrics"
import useLocalStorageState from "use-local-storage-state"
import { Capacitor } from "@capacitor/core"
import { getIsPasswordEncrypted, getPinInfo, verifyPin } from "../../utils/storage"
import { showLogoutSheet } from "../Settings"
import PasscodeKeyboard from "./PasscodeKeyboard"

let isAuthenticating = false

export const ForgotYourPin = ({ type = "PIN" }) => {
    return <div
        onClick={() => {
            Modal.show({
                closeOnMaskClick: true,
                title: "Sign out of your wallet",
                closeOnAction: true,
                content: `If you don't remember your ${type}, you'll need to sign out of your wallet and restore it using your secret recovery phrase.`,
                actions: [
                    { key: "cancel", text: "Cancel" },
                    {
                        danger: true,
                        key: "signout", text: "Delete Secret Phrase and Sign out", onClick: async () => {
                            await showLogoutSheet()
                        }
                    },
                ]
            })
        }}
        className="text-base text-center mt-6" style={{ color: "var(--adm-color-primary)", cursor: "pointer" }}>
        Forgot your {type} ?
    </div>
}

const authCanceled = ({setRetry}) => {
    let modal = Modal.show({
        title: "Biometrics authentication canceled",
        closeOnMaskClick: false,
        closeOnAction: false,
        content: 'You canceled the biometrics authentication. Authentication is required to access the wallet. Do you want to try again or sign out?',
        actions: [
          {
            key: "settings", text: "Try again", onClick: async () => {
                setRetry((r) => r + 1)
                modal.close()
            }
          },
          {
            danger: true,
            key: "signout", text: "Sign out", onClick: async () => {
              await showLogoutSheet()
            }
          },
        ]
      })
}

export const PinAuthPopup = ({ visible, setVisible, onAuthenticated, description, title = "Enter your PIN", location }) => {
    // const [confirmationMethod, setConfirmationMethod] = useLocalStorageState("confirmation-method", { defaultValue: Capacitor.isNativePlatform() ? "enabled" : "none" });
    const confirmationMethod = localStorage.getItem("confirmation-method")
    const [locked, setLocked] = useState(false)
    const [nextAttemptDate, setNextAttemptDate] = useState(0)
    const [attemptRemaining, setAttemptRemaining] = useState(10)
    const [whenToAuthenticate, setWhenToAuthenticate] = useLocalStorageState("when-to-authenticate", { defaultValue: ["send"] })
    const alwaysAuthenticate = ["backup-secret-phrase", "change-confirmation-method", "create-wallet" ]
    const [error, setError] = useState("")
    const [retry, setRetry] = useState(0)
    const showCloseButton = location === "launch" ? false : true
    const ref = useRef()
    const byPassAuthentication = !whenToAuthenticate.includes(location) && !alwaysAuthenticate.includes(location)
    useEffect(() => {
        async function authenticateByConfirmationMethod() {
            // onAuthenticated()
            //         setVisible(false)
            //         return 
            if (location === "launch") {
                let isPasswordEncrypted = await getIsPasswordEncrypted()
                if (isPasswordEncrypted) { // no need to authenticate on launch if the wallet is already password protected
                    onAuthenticated()
                    setVisible(false)
                    return
                }
            }
            if (confirmationMethod !== '"pin"') {
                try {
                    if (isAuthenticating) return
                    isAuthenticating = true
                    await authenticate()
                    setVisible(false)
                    onAuthenticated()
                    return
                } catch (error) {
                    console.error(error)
                    setVisible(false)
                    Toast.show({ icon: "fail", content: error.message })
                    if (location === "launch") {
                        authCanceled({setRetry: setRetry})
                        setVisible(true)
                    }
                    return
                }
                finally {
                    isAuthenticating = false
                }
            }
            else {
                getPinInfo().then(({ nextAttempt, attemptsRemaining }) => {
                    if (nextAttempt !== 0 && nextAttempt > Date.now()) {
                        setLocked(true)
                        setNextAttemptDate(nextAttempt)
                    }
                    setAttemptRemaining(attemptsRemaining)
                })
            }
        }
        if (visible) {

            if (byPassAuthentication) {
                // bypass authentication if disabled in settings
                onAuthenticated()
                setVisible(false)
                return
            }
            // authenticate using biometrics or pin depending on the setting
            authenticateByConfirmationMethod()
        }
    }, [visible, retry])

    const PinPopup = () => {
        const [pin, setPin] = useState("")
        useEffect(() => {
            setTimeout(() => {
                if (visible && !isTouchDevice()) {  // only focus if not on touch device, so the user can directly use the keyboard
                    ref.current?.focus()
                }
            }
                , 0)
        }
            , [visible, attemptRemaining])

        return <Popup
            bodyStyle={{ height: 'calc(100dvh - env(safe-area-inset-top))' }}
            visible={visible}
            onClose={() => setVisible(false)}
            closeOnMaskClick
            destroyOnClose
            showCloseButton={showCloseButton}
        >
            <div className="">
                <div className="text-2xl  text-center  mb-4 mt-10">
                    {description}
                </div>

                <div
                    style={{ color: "var(--adm-color-text-secondary)" }}
                    className="text-center text-base mb-6">
                    {title}
                </div>
                <div className="text-center">

                    <PasscodeInput
                        className="passcode-input"
                        onFill={async () => {
                            try {
                                
                            
                            let result = await verifyPin(pin)
                            if (result?.error) {
                                setPin("")
                                if (result.nextAttempt > 0) {
                                    setNextAttemptDate(result.nextAttempt)
                                    setLocked(true)
                                }
                                setAttemptRemaining(result.attemptsRemaining)
                                setError(result.error)
                                return
                            }
                            if (result?.valid) {
                                onAuthenticated()
                                setVisible(false)
                                setPin("")
                            }
                        } catch (error) {
                            // if pin enabled but not set
                            // should not happen but fallback to allow reset wallet
                                Modal.show({
                                    title: "Error verifying PIN",
                                    content: error.message,
                                    closeOnAction: true,
                                    actions: [
                                        { key: "signout", text: "Sign out", onClick: async () => {
                                            await showLogoutSheet()
                                        } },
                                        { key: "cancel", text: "Cancel" }
                                    ]
                                })
                        }
                        }}

                        caret={false}
                        value={pin} onChange={
                            setPin} ref={ref} seperated
                        keyboard={<div></div>}

                    />
                </div>

                {error !== "" && <div className="text-center mt-6">{error}</div>}
                {
                    attemptRemaining <= 7 && <div className="text-center text-base mt-6" style={{ color: "var(--adm-color-warning)" }}>
                        {attemptRemaining} attempts left before the wallet is erased
                    </div>
                }
                {attemptRemaining <= 7 && <ForgotYourPin />}
                <div className="text-center mt-6">
                    <PasscodeKeyboard passcode={pin} setPasscode={setPin} />
                </div>
            </div>
        </Popup>
    }


    const PinPopupLocked = () => {
        const [time, setTime] = useState(new Date())

        useEffect(() => {
            setError("")
            let interval = setInterval(() => {
                setTime(new Date())
                if (nextAttemptDate < Date.now()) {
                    setLocked(false)
                    clearInterval(interval)
                }
            }, 1000)
            return () => {
                clearInterval(interval)
            }
        }
            , [])
        return <Popup
            bodyStyle={{ height: '100%' }}
            visible={visible}
            onClose={() => setVisible(false)}
            closeOnMaskClick
            destroyOnClose
            showCloseButton={showCloseButton}
        >
            <div className="h-full flex flex-col justify-center">
                <div className="text-2xl  text-center  mb-4 mt-10">
                    PIN Locked
                </div>
                <div
                    style={{ color: "var(--adm-color-text-secondary)" }}
                    className="text-center text-base mb-6">
                    try again in {Math.ceil((nextAttemptDate - time) / 1000)} seconds
                </div>
                <ForgotYourPin />
            </div>
        </Popup>
    }
    if (byPassAuthentication) return null
    if (confirmationMethod !== '"pin"') return null
    if (locked) return <PinPopupLocked />
    return <PinPopup />
}