import { BiometricAuth } from "@aparajita/capacitor-biometric-auth"
import { Capacitor } from "@capacitor/core"
import * as webauthn from '@passwordless-id/webauthn'
import { Toast } from "antd-mobile"


export async function authenticate() {
    let confirmationMethod = localStorage.getItem("confirmation-method");
    if (confirmationMethod == null){
        if (Capacitor.isNativePlatform()){
            confirmationMethod = "enabled"
        }
        else {
            confirmationMethod = "none"
        }
    }
    else {
        confirmationMethod = JSON.parse(confirmationMethod)
    }
    if (
        (confirmationMethod === "enabled")
    ) {
        await biometricAuthIfAvailable()
        await webauthnAuthIfAvailable()
    }
    else if (confirmationMethod === "none") {
        return
    }
    else  {
        throw new Error("Confirmation method not set")
    }
}

export async function biometricAuthIfAvailable() {
    let r = await BiometricAuth.checkBiometry()
    if (r.isAvailable){
        await BiometricAuth.authenticate({
            allowDeviceCredential: true,
            iosFallbackTitle: "Use Passcode",
            // reason: "Confirm to enable biometric authentication"
        })
    }
}

export async function webauthnAuthIfAvailable(){
    let isAvailable = webauthn.client.isAvailable()
    if (isAvailable && Capacitor.isNativePlatform() === false){
        const challenge = crypto.randomUUID()
        Toast.show({content: localStorage.getItem("webauthn-credential-id")})
        if (localStorage.getItem("webauthn-credential-id") && localStorage.getItem("webauthn-credential-id") !== "undefined") { 
            let r = await webauthn.client.authenticate([localStorage.getItem("webauthn-credential-id")], challenge, {
                                // "authenticatorType": "auto",
                                // "userVerification": "required",
                                // "discoverable": "preferred",
                                // "timeout": 60000,
                            })
        }
        else{
            let r = await webauthn.client.register("NanWallet", challenge, {
                                // "authenticatorType": "auto",
                                // "userVerification": "required",
                                // "discoverable": "preferred",
                                // "timeout": 60000,
                            })
            localStorage.setItem("webauthn-credential-id", r.credential.id)

        }
    }
}