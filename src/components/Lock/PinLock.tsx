import { Modal, NumberKeyboard, PasscodeInput, Popup, Toast } from "antd-mobile"
import { useEffect, useRef, useState } from "react"
import { isTouchDevice } from "../../utils/isTouchDevice"
import { authenticate } from "../../utils/biometrics"
import useLocalStorageState from "use-local-storage-state"
import { Capacitor } from "@capacitor/core"
import { getIsPasswordEncrypted, getPinInfo, verifyPin } from "../../utils/storage"
import { showLogoutSheet } from "../Settings"



export const PinAuthPopup = ({ visible, setVisible, onAuthenticated, description, title = "Enter PIN", location }) => {
    const [confirmationMethod, setConfirmationMethod] = useLocalStorageState("confirmation-method", { defaultValue: Capacitor.isNativePlatform() ? "enabled" : "none" });
    const [locked, setLocked] = useState(false)
    const [nextAttemptDate, setNextAttemptDate] = useState(0)
    const [attemptRemaining, setAttemptRemaining] = useState(10)
    const [whenToAuthenticate, setWhenToAuthenticate] = useLocalStorageState("when-to-authenticate", { defaultValue: ["launch"] })
    const alwaysAuthenticate = ["backup-secret-phrase", "change-confirmation-method"]
    const [error, setError] = useState("")
    const showCloseButton = location === "launch" ? false : true
    const ref = useRef()
    useEffect(() => {
        if (visible) {
            if (location === "launch"){
                getIsPasswordEncrypted().then((isPasswordEncrypted) => {
                    if (isPasswordEncrypted) { // no need to authenticate on launch if the wallet is already password protected
                        onAuthenticated()
                        setVisible(false)
                    }
                })
            }
            if (!whenToAuthenticate.includes(location) && !alwaysAuthenticate.includes(location)) {
                onAuthenticated()
                setVisible(false)
                return
            }
            if (confirmationMethod !== "pin") {

                authenticate().then(() => {
                    setVisible(false)
                    onAuthenticated()
                }).catch(() => {
                    Toast.show({ icon: "fail", content: "Authentication failed" })
                    setVisible(false)
                })
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
    }, [visible])
   
    const PinPopup = () => {
        const [pin, setPin] = useState("")
        useEffect(() => {
            setTimeout(() => {
                if (visible) {
                    ref.current?.focus()
                }
            }
                , 0)
        }
        , [visible, attemptRemaining])

        return <Popup
            bodyStyle={{ height: '100%' }}
            visible={visible}
            onClose={() => setVisible(false)}
            closeOnMaskClick
            destroyOnClose
            showCloseButton={showCloseButton}
        >
            <div className="">
                <div className="text-2xl  text-center  mb-4 mt-10">
                    {title}
                </div>
               
                <div
                    style={{ color: "var(--adm-color-text-secondary)" }}
                    className="text-center text-base mb-6">
                    {description}
                </div>
                <div className="text-center">

                    <PasscodeInput
                        onFill={async () => {
                            let result = await verifyPin(pin)
                            if (result?.error) {
                                setPin("")
                                if(result.nextAttempt > 0){
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
                        }}

                        
                        value={pin} onChange={
                            setPin} ref={ref} seperated
                        keyboard={isTouchDevice() && visible ? <NumberKeyboard
                            showCloseButton={false} /> : null}

                    />
                </div>
                {error !== "" && <div className="text-center mt-6">{error}</div>}
                {
                    attemptRemaining <= 7 && <div className="text-center text-base mt-6" style={{ color: "var(--adm-color-warning)" }}>
                        {attemptRemaining} attempts left before the wallet is erased
                    </div>
                }	
                {attemptRemaining <= 7 && <ForgotYourPin />}
            </div>
        </Popup>
    }
    const ForgotYourPin = () => {
        return <div 
        onClick={() => {
            Modal.show({
                closeOnMaskClick: true,
                title: "Sign out of your wallet",
                closeOnAction: true,
                content: "If you don't remember your PIN, you'll need to sign out of your wallet and restore it using your secret recovery phrase.",
                actions: [
                    { key: "cancel", text: "Cancel" },
                    {
                        danger: true, 
                        key: "signout", text: "Delete Secret Phrase and Sign out", onClick: async () => {
                        await showLogoutSheet()
                    }},
                ]
            })
        }}
        className="text-center text-base mt-6" style={{ color: "var(--adm-color-primary)", cursor: "pointer" }}>
            Forgot your PIN? 
        </div>
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

    if (confirmationMethod !== "pin") return null
    if (locked) return <PinPopupLocked />
    return <PinPopup />
}