import { BiX } from "react-icons/bi";
import { tools } from 'multi-nano-web'
import { useContext, useEffect, useState } from "react";
import { Button, Result, TextArea, Toast } from "antd-mobile";
import { WalletContext } from "../components/Popup";
import { redirect, useNavigate, useSearchParams } from "react-router-dom";
import { AccountIcon } from "../components/app/Home";
import SelectAccount from "../components/app/SelectAccount";

export const signMessage = (privateKey, message) => {
  let messageToSign = "Signed Message: " + message // Add prefix to message as a security measure to prevent to sign a block by mistake / from an attacker request
  const signed = tools.sign(privateKey, messageToSign)
  return signed
}
export default function Sign() {
  const {wallet} = useContext(WalletContext)
  const [message, setMessage] = useState("")
  const [callback, setCallback] = useState(false)
  const [hostname, setHostname] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState("")
  const activeAccount = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex);
  const proxyWorker = "https://proxy-signature.xno.link" // Cloudflare Worker to protect client's IP
  const [searchParams] = useSearchParams();
  const navigate = useNavigate()
  const submitURL = searchParams.get("url") || ""
  useEffect(() => {
    setMessage(searchParams.get("message"))
    try {
      let submitHost = new URL(submitURL).hostname
      setCallback(searchParams.get("callback"))
      setHostname(submitHost)
    } catch (error) {
      console.log(error)
      navigate("/")
    }
  }, [])
  return (
    <div className="flex flex-col overflow-hidden  w-full h-full">
      <nav className="flex select-none w-full shadow-md items-center rounded-b-lg justify-start p-2 bg-slate-800 text-center">
        <div className="w-full flex flex-row items-center">
          <div className="justify-center flex w-full">
            <p className="text-blue-400">
              <SelectAccount />
              </p>
          </div>
        </div>
      </nav>
<div style={{maxWidth: "550px", marginRight: "auto", marginLeft: "auto"}} className={result ? "hidden" : ""}>
      <div className="flex justify-center h-full p-4">
        <div className="flex flex-col justify-between h-full w-full">
          <div className="flex flex-col w-full justify-start mt-0 items-center mb-4">
            <div className="flex flex-col space-y-1 overflow-hidden justify-center text-center w-full">
              <div className="flex mb-2 items-center justify-center">
                {/** image placeholder */}
               
              </div>
              <p className="text-slate-200 text-lg font-semibold">
              Signature request
              </p>
                <p className="text-slate-500 hover:text-slate-400 cursor-pointer transition-colors text-sm mt-1 justify-end">
                Only confirm this message if you approve the content and trust the requesting site.
                </p>
            </div>
          </div>
          {
            hostname && <><p>Submit to:</p>
          <div className="p-3 bg-slate-800/70 rounded-md ">
          {hostname}
          </div>
            </>
          }
          {
            callback && <><p>Callback:</p>
          <div className="p-3 bg-slate-800/70 rounded-md ">
          {callback.replace("https://", "")}
          </div>
            </>
          }
          <p>Message:</p>
          <TextArea
          autoSize={{ minRows: 3}}
            value={message}
            onChange={(e) => setMessage(e)}
            className="p-3 bg-slate-800/70 rounded-md "
          />
        </div>
      </div>

      <div className="relative select-none justify-end">
        {/** buttons */}
        <div className="flex flex-row items-center justify-center space-x-5 p-3">
          <Button
            onClick={() => navigate("/")}
            className="w-full"
            shape="rounded"
            color="default"
          >
            Cancel
          </Button>
          <Button
          loading={isLoading}
            onClick={async () => {
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
              .then((data) => {
                console.log(data)
                setResult(data)
                window.open(callback, "_blank")
            })
              .catch((error) => {
                Toast.show({content: "An error occurred while signing the message", icon: 'fail'})
                console.log(error)
            }).finally(() => {
              setIsLoading(false)
            })

          }}

            className="w-full"
            shape="rounded"
            color="primary"
          >
            Confirm
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
            onClick={() => navigate("/")}
            className="w-full mt-4"
            shape="rounded"
            color="primary"
          >
            Go Home
          </Button>
                </>
                }
                />
                </>
      }
    </div>
  );
}
