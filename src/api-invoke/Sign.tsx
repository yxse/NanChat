import { BiX } from "react-icons/bi";
import { ExclamationCircleFill } from "antd-mobile-icons";
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
import { Trans, useTranslation } from "react-i18next";
import type { UriOrigin } from "../components/app/AppUrlListener";


export const SignPopup = ({visible, setVisible, uri, setUri, origin}: {visible: boolean, setVisible: (visible: boolean) => void, uri: string, setUri?: (uri: string) => void, origin?: UriOrigin, onSign?: (result: string) => void}) => {
  const { t } = useTranslation()
  return (
    <ResponsivePopup
    destroyOnClose
    visible={visible}
    setVisible={setVisible}
    title={t("signMessageTitle")}
    >
      <Sign uri={uri} origin={origin} onClose={() => {
        setVisible(false)
        if (setUri){
          setUri("")
        }
      }} />
    </ResponsivePopup>
  )
}


// The hostname referenced in the message must match the submit hostname to prevent phishing
const hostnamesMatch = (a: string, b: string) => {
  if (!a || !b) return false
  a = a.toLowerCase().replace(/^www\./, "")
  b = b.toLowerCase().replace(/^www\./, "")
  return a === b || a.endsWith("." + b) || b.endsWith("." + a)
}

// `origin` says where the request came from. Without it (e.g. the /sign route),
// it is treated as coming from outside the app.
export default function Sign({uri, onClose, origin}: {uri?: string, onClose?: () => void, origin?: UriOrigin}) {
  const { t } = useTranslation()
  const {wallet} = useContext(WalletContext)
  const [message, setMessage] = useState("")
  const [callback, setCallback] = useState<string | null>(null)
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
        const callbackParam = searchParams.get("callback") // optional, login links usually have none
        setCallback(callbackParam)
        setSubmitURL(searchParams.get("url"))
        setHostname(new URL(searchParams.get("url")).hostname)
        if (callbackParam) {
          setHostnameCallback(new URL(callbackParam).hostname)
        }
      } catch (error) {
        console.log(error)
        Toast.show({content: String(error), icon: 'fail'})
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

  const hostnameMismatch = isLogin && !!hostname && !hostnamesMatch(loginService, hostname)

  // A request is only trusted as user-initiated when it was triggered by the page
  // open in the in-app browser, on the same site it submits to. Anything else
  // (outside deep link, QR code, paste, other site) may be a relayed request:
  // an attacker starts a login on the real site and sends the link/QR code to
  // the victim, whose signature would then log the attacker's session in.
  const pageHost = useMemo(() => {
    try {
      return new URL(origin?.pageUrl || "").hostname
    } catch {
      return ""
    }
  }, [origin])
  const fromCurrentSite = origin?.source === "in-app" && hostnamesMatch(pageHost, hostname)
  const showOriginWarning = !!hostname && !hostnameMismatch && !fromCurrentSite

  const handleSign = async () => {
    if (hostnameMismatch) {
      Toast.show({
        content: t("signHostnameMismatchToast"),
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
          // callback comes from the request: only open web links, never javascript: etc.
          if (callback && /^https?:\/\//i.test(callback)) {
            window.open(callback, "_blank", "noopener,noreferrer")
          }
        }
      })
      .catch((error) => {
        Toast.show({
          content: t("signError", { error: String(error) }),
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
              {isLogin ? t("signLoginTo", { service: serviceLabel }) : t("signSignatureRequest")}
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
                  ? t("signAddressShared", { service: serviceLabel })
                  : t("signConfirmIfApprove")}
                </p>
            </div>
          </div>
          {
            hostnameMismatch &&
            <div
              className="p-3 rounded-md mb-2 text-sm"
              style={{ backgroundColor: "var(--main-background-color)", color: "var(--adm-color-text-secondary)" }}
            >
              <Trans
                i18nKey="signHostnameMismatch"
                values={{ loginService, hostname, service: serviceLabel }}
                components={{ b: <b /> }}
              />
            </div>
          }
          {
           !isLogin && hostname && <><p>{t("signSubmitTo")}</p>
          <div className="p-3  rounded-md " style={{backgroundColor: "var(--main-background-color)"}}>
          {hostname}
          </div>
            </>
          }
          {
           !isLogin && callback && <><p>{t("signCallback")}</p>
          <div className="p-3  rounded-md " style={{backgroundColor: "var(--main-background-color)"}}>
          {hostnameCallback}
          </div>
            </>
          }
          {
            !isLogin && <>
            
          <p>{t("signMessageLabel")}</p>
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

      {
        showOriginWarning &&
        <div
          className="mx-4 p-3 rounded-md text-sm flex items-start gap-2"
          style={{ backgroundColor: "var(--main-background-color)", color: "var(--adm-color-warning)" }}
        >
          <ExclamationCircleFill style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            {isLogin
              ? t("signLoginOriginWarning", { service: serviceLabel })
              : t("signRequestOriginWarning", { hostname })}
          </div>
        </div>
      }

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
            {t("cancel")}
          </Button>
          <Button
          loading={isLoading}
          disabled={hostnameMismatch}
            onClick={handleSign}

            className="w-full"
            shape="rounded"
            color="primary"
          >
            {isLogin ? t("signLoginButton") : t("signSignButton")}
          </Button>
        </div>
      </div>
    </div >
      {
        result && <>
      <Result
      className="text-xl"
                status="success"
                title={<div className="text-2xl text-gray-100">{t("success")}</div>}
                description={<>
                  <div className="text-lg">
                  {t("signResponseFrom", { hostname })}
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
            {t("close")}
          </Button>
                </>
                }
                />
                </>
      }
    </div>
  );
}
