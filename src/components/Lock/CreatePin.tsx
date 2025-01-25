import { NumberKeyboard, PasscodeInput, Popup, Toast } from "antd-mobile"
import { useEffect, useRef, useState } from "react"
import { isTouchDevice } from "../../utils/isTouchDevice"
import { authenticate } from "../../utils/biometrics"
import useLocalStorageState from "use-local-storage-state"
import { Capacitor } from "@capacitor/core"
import { setPin as setPinStorage } from "../../utils/storage"
export const CreatePin = ({visible, setVisible, onAuthenticated}) => {
    const ref = useRef()
    const [pin, setPin] = useState("")
    const [pin2, setPin2] = useState("")
    const [step, setStep] = useState(0)
    useEffect(() => {
        if (visible) {
                // ref.current.focus()
                setTimeout(() => {
                    ref.current.focus()
                }, 0)
            }
    }, [visible])

    return (
        <Popup
        bodyStyle={{height: '100%'}}
            visible={visible}
            onClose={() => setVisible(false)}
            closeOnMaskClick
            destroyOnClose
            showCloseButton
        >
            <div className="">
            <div className="text-2xl  text-center  mb-4 mt-10">
                {step === 0 ? "Create PIN" : "Confirm PIN"}
            </div>
            <div 
            style={{color: "var(--adm-color-text-secondary)"}}
            className="text-center text-base mb-6">
                {step === 0 ? "Enter a 6-digit PIN to unlock your wallet" : ""}
            </div>
            <div className="text-center">
            <PasscodeInput
            onFill={async () => {
                if (step === 0) {
                    setStep(1)
                    setPin2(pin)
                    setPin("")
                }
                else if (step === 1) {
                    if (pin === pin2) {
                        await setPinStorage(pin)
                        setVisible(false)
                        setPin("") 
                        onAuthenticated(pin)
                        setStep(0)
                    }
                    else {
                        Toast.show({icon: "fail", content: "PINs do not match" })
                        setStep(0)
                        setPin("")
                    }
                }
            }}
            caret={true}
             value={pin} onChange={setPin}  ref={ref} seperated
            keyboard={isTouchDevice() && visible ? <NumberKeyboard 
                onInput={() => {
                    
                }}
                showCloseButton={false} /> : null}
            
            />
            </div>
            </div>
        </Popup>

    )
}