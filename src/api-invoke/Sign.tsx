import { BiX } from "react-icons/bi";
import { tools } from 'multi-nano-web'
import { useContext, useEffect, useMemo, useState } from "react";
import { Button, Result, TextArea, Toast } from "antd-mobile";
import { WalletContext } from "../components/useWallet";
import { redirect, useNavigate, useSearchParams } from "react-router-dom";
import { AccountIcon } from "../components/app/Home";
import ProfileName from "../components/messaging/components/profile/ProfileName";
import SelectAccount from "../components/app/SelectAccount";
import { Capacitor } from "@capacitor/core";
import { DefaultSystemBrowserOptions, InAppBrowser } from "@capacitor/inappbrowser";
import { useEmit, useEvent } from "../components/messaging/components/EventContext";
import { ResponsivePopup } from "../components/Settings";
import { WebviewOverlay } from "@teamhive/capacitor-webview-overlay";
import { signMessage } from "../components/messaging/fetcher";
import { fetcherMessagesNoAuth } from "../components/messaging/fetcher";
import { focusLastBrowserWindow } from "../components/messaging/utils";
import { isTauri } from "@tauri-apps/api/core";
import useSWR from "swr";


export const SignPopup = ({visible, setVisible, uri, setUri}) => {

  return (
    <ResponsivePopup
    destroyOnClose
    visible={visible}
    setVisible={setVisible}
    title="Sign Message"
    >
      <Sign uri={uri} onClose={() => {
        setVisible(false)
        if (setUri){
          setUri("")
        }
      }} />
    </ResponsivePopup>
  )
}


export default function Sign({uri, onClose}) {
  const {wallet} = useContext(WalletContext)
  const [message, setMessage] = useState("")
  const [callback, setCallback] = useState(false)
  const [hostname, setHostname] = useState("")
  const [hostnameCallback, setHostnameCallback] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState("")
  const activeAccount = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex);
  const proxyWorker = "https://proxy-signature.xno.link" // Cloudflare Worker to protect client's IP
  const [searchParams] = useSearchParams();
  const navigate = useNavigate()
  const [submitURL, setSubmitURL] = useState(searchParams.get("url") || "")
  useEffect(() => {
    if (uri){
      let url = new URL(uri)
      let searchParams = new URLSearchParams(url.search)
      
      setMessage(searchParams.get("message"))
      try {
        setCallback(searchParams.get("callback"))
        setSubmitURL(searchParams.get("url"))
        setHostname(new URL(searchParams.get("url")).hostname)
        setHostnameCallback(new URL(searchParams.get("callback")).hostname)
      } catch (error) {
        console.log(error)
        Toast.show({content: error, icon: 'fail'})
      }
    }
    else{

    setMessage(searchParams.get("message"))
    try {
      let submitHost = new URL(submitURL).hostname
      setCallback(searchParams.get("callback"))
      setHostname(submitHost)
    } catch (error) {
      console.log(error)
      navigate("/")
    }
  }

  }, [])

  // Detect a "login to <service>" message and extract the service name
  const loginService = useMemo(() => {
    if (!message) return null
    // Capture only valid hostname characters (letters, digits, dots, hyphens),
    // so trailing text/JSON after the hostname is ignored.
    const match = message.match(/login to\s+([a-z0-9.-]+)/i)
    if (!match) return null
    return match[1].replace(/[.-]+$/, "") // strip trailing dots/hyphens
  }, [message])
  
  const isLogin = !!loginService

  // Resolve the hostname to a known service (friendly name + favicon) from /services
  const { data: services } = useSWR('/services?platform=' + Capacitor.getPlatform(), fetcherMessagesNoAuth)
  const resolvedService = useMemo(() => {
    if (!loginService || !Array.isArray(services)) return null
    return services.find((service) => {
      try {
        return new URL(service.link).hostname.replace(/^www\./, "") === loginService.replace(/^www\./, "")
      } catch {
        return false
      }
    }) || null
  }, [services, loginService])
  const serviceLabel = resolvedService?.name || loginService

  // The hostname referenced in the message must match the submit hostname to prevent phishing
  const hostnamesMatch = (a, b) => {
    if (!a || !b) return false
    a = a.toLowerCase().replace(/^www\./, "")
    b = b.toLowerCase().replace(/^www\./, "")
    return a === b || a.endsWith("." + b) || b.endsWith("." + a)
  }
  const hostnameMismatch = isLogin && !!hostname && !hostnamesMatch(loginService, hostname)

  const handleSign = async () => {
    if (hostnameMismatch) {
      Toast.show({
        content: "The hostname in the message does not match the submit hostname. Aborting to prevent phishing.",
        icon: 'fail',
      })
      return
    }
    const signed = signMessage(activeAccount.privateKey, message)
    console.log(signed)
    setIsLoading(true)
    fetch(proxyWorker, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        'X-Target-URL': submitURL
      },
      body: JSON.stringify({
        "message": "Signed Message: " + message,
        "signature": signed,
        "account": activeAccount.address,
        "signatureType": "nanocurrency-web",
      }),
    })
      .then((response) => response.text())
      .then(async (data) => {
        console.log(data)
        setResult(data)
        if (isTauri()) {
          await focusLastBrowserWindow();
          if (onClose) onClose()
        }
        else if (Capacitor.isNativePlatform()) {
          // InAppBrowser.openInSystemBrowser({url: callback, options: DefaultSystemBrowserOptions})
          // InAppBrowser.openWebView({url: callback, isPresentAfterPageLoad: true});
          WebviewOverlay.toggleSnapshot(false);
          if (onClose) onClose()
        }
        else {
          window.open(callback, "_blank")
        }
      })
      .catch((error) => {
        Toast.show({
          content: "An error occurred while signing the message: " + error,
          icon: 'fail'
        })
        console.log(error)
      }).finally(() => {
        setIsLoading(false)
      })
  }

  return (
    <div className="flex flex-col   w-full ">
      {/* <nav className="flex select-none w-full shadow-md items-center rounded-b-lg justify-start p-2 bg-slate-800 text-center">
        <div className="w-full flex flex-row items-center">
          <div className="justify-center flex w-full">
            <p className="text-blue-400">
              <SelectAccount />
              </p>
          </div>
        </div>
      </nav> */}
<div style={{maxWidth: "550px"}} className={result ? "hidden" : ""}>
      <div className="flex justify-center  p-4">
        <div className="flex flex-col justify-between  w-full text-sm">
          <div
          className="flex flex-col w-full justify-start mt-0 items-center mb-4">
            <div className="flex flex-col space-y-1  justify-center text-center w-full">
              <div className="flex mb-2 items-center justify-center">
                {/** image placeholder */}
               
              </div>
              <p className="text-lg font-semibold">
              {isLogin ? `Login to ${serviceLabel}` : "Signature request"}
              </p>
              {
                isLogin &&
                <div className="flex items-center justify-center space-x-1" style={{marginTop: 36}}>
                  <span className="mr-2">
                  <AccountIcon account={activeAccount?.address} width={42}/>
                </span>
                <div className="text-xl	">
                  <ProfileName address={activeAccount?.address} fallback={`Account ${wallet.activeIndex + 1}`} />
                </div>
                </div>
              }
                <p style={{color: "var(--adm-color-text-secondary)", marginTop: 32}} className="text-sm">
                {isLogin
                  ? `Your public address will be shared with ${serviceLabel}.`
                  : "Only confirm this message if you approve the content."}
                </p>
            </div>
          </div>
          {
            hostnameMismatch &&
            <div
              className="p-3 rounded-md mb-2 text-sm"
              style={{ backgroundColor: "var(--main-background-color)", color: "var(--adm-color-text-secondary)" }}
            >
              Invalid login request. The hostname in the message (<b>{loginService}</b>) does not match the
              submit hostname (<b>{hostname}</b>). If you are the developer of <b>{serviceLabel}</b>, please update your login message to include the correct hostname. 
            </div>
          }
          {
           !isLogin && hostname && <><p>Submit to:</p>
          <div className="p-3  rounded-md " style={{backgroundColor: "var(--main-background-color)"}}>
          {hostname}
          </div>
            </>
          }
          {
           !isLogin && callback && <><p>Callback:</p>
          <div className="p-3  rounded-md " style={{backgroundColor: "var(--main-background-color)"}}>
          {hostnameCallback}
          </div>
            </>
          }
          {
            !isLogin && <>
            
          <p>Message:</p>
          <div
          // autoSize={{ minRows: 3}}
            // value={message}
            // onChange={(e) => setMessage(e)}
            style={{backgroundColor: "var(--main-background-color)"}}
            className="p-3 rounded-md "
            >
            {message}
          </div>
            </>
          }
        </div>
      </div>

      <div className="relative select-none justify-end">
        {/** buttons */}
        <div
        style={{paddingBottom: "calc(var(--safe-area-inset-bottom) + 16px)"}}
        className="flex flex-row items-center justify-center space-x-5 p-3">
          <Button
            onClick={() => {
              if (Capacitor.isNativePlatform()) {
                WebviewOverlay.toggleSnapshot(false);
              }
              if (isTauri()) {
                focusLastBrowserWindow();
              }
              if (onClose) onClose()
            }}
            className="w-full"
            shape="rounded"
            color="default"
          >
            Cancel
          </Button>
          <Button
          loading={isLoading}
          disabled={hostnameMismatch}
            onClick={handleSign}

            className="w-full"
            shape="rounded"
            color="primary"
          >
            {isLogin ? "Login" : "Sign"}
          </Button>
        </div>
      </div>
    </div >
      {
        result && <>
      <Result
      className="text-xl"
                status="success"
                title={<div className="text-2xl text-gray-100">Success</div>}
                description={<>
                  <div className="text-lg">
                  Response from {hostname}: 
                  </div>
                  <div className="text-base mt-2 flex justify-center space-x-2 items-baseline">
                    <div className="text-gray-400">
                      {result}
                    </div>
                    
                    </div>
                <Button
            onClick={() => {
              // navigate("/")
              if (onClose){
                onClose()
              }
            }}
            className="w-full mt-4"
            shape="rounded"
            color="primary"
          >
            Close
          </Button>
                </>
                }
                />
                </>
      }
    </div>
  );
}
