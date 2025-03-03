import { Button, Card, Input, List, Toast } from "antd-mobile";
import { Dispatch, SetStateAction, useRef, useEffect, useState, useContext } from "react";
import { decrypt } from "../../worker/crypto";
import { wallet as walletLib} from "multi-nano-web";
import { ClipLoader as HashSpinner } from "react-spinners";
import { networks } from "../../utils/networks";
import { WalletContext } from "../Popup";
import { useSWRConfig } from "swr";
import { initWallet } from "../../nano/accounts";
import { getSeed } from "../../utils/storage";
import icon from "../../../public/icons/icon.png"
import { LockOutline } from "antd-mobile-icons";
import { ForgotYourPin } from "./PinLock";

// theme added I guess?
export default function Form({
  goForth,
  handleSubmit,
  invalidPass,
  setInvalidPass,
  theme,
  setWalletState,
}: {
  goForth: Dispatch<SetStateAction<boolean>>;
  handleSubmit: () => any;
  invalidPass: boolean;
  setInvalidPass: React.Dispatch<React.SetStateAction<boolean>>;
  theme: "dark" | "light";
  setWalletState: React.Dispatch<React.SetStateAction<"locked" | "unlocked" | "no-wallet" | "loading">>;
}) {
  const {mutate,cache}=useSWRConfig()
  const { dispatch } = useContext(WalletContext);
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // useEffect(() => {
  //   const handleClickOutside = (event: any) => {
  //     if (inputRef.current && !inputRef.current.contains(event.target)) {
  //       setInvalidPass(false);
  //     }
  //   };

  //   document.addEventListener("mousedown", handleClickOutside);
  //   return () => {
  //     document.removeEventListener("mousedown", handleClickOutside);
  //   };
  // }, [setInvalidPass]);

  const handleUnlock = async () => {
    setLoading(true);
        try {
          let seed = await getSeed();
          let result = await decrypt(seed.seed, password);
          const res = result.length === 128 ? walletLib.fromSeed(result) : walletLib.fromLegacySeed(result);
          setInvalidPass(false);
          for (let ticker of Object.keys(networks)) {
            dispatch({ type: "ADD_WALLET", payload: { ticker, wallet: initWallet(ticker, res.seed, mutate, dispatch) } });
          }
          setWalletState("unlocked");
          // setLoggedIn(true);
        } catch (error) {
          console.log(error)
          // setLoading(false);
          setInvalidPass(true);
        }
        finally {
          setLoading(false);
        }
    }


  return (
    <div
      className={` ${theme == "light" && "!bg-white !text-black"
        }`}
    >
      <Card
      style={{maxWidth: 500, margin: "auto", borderRadius: 10, marginTop: 20}}>
      <form
        id="unlock"
        className=""
        onSubmit={async (e) => {
          e.preventDefault();
          handleUnlock();
          return
          // return handleSubmit();
        }}

      >
        <div className="unlock-form">
          <div className=" ">
            <div className="flex items-center justify-center w-screen mt-8">
              {/* <img
              style={{borderRadius: 24}}
                src={icon}
                className="unlock-form-image"
                draggable={false}
              /> */}
              <LockOutline fontSize={64} />
            </div>
            <div className="unlock-form-blank" />
          </div>

          <p
            className={` text-2xl mb-6 mt-4`}
          >
            Wallet Locked 
          </p>
          <div style={{ textAlign: "center", width: "300px" }}>
              {/* <List mode="card"> */}
                {/* <List.Item style={{backgroundColor: "var(--active-background-color)"}}> */}
              <Input
              
                autoFocus
                autoComplete="current-password"
                className={` ${invalidPass && "invalid-password"} high-contrast`}
                type="password"
                id="unlock-pass"
                placeholder="Enter your password"
                // ref={inputRef}
                maxLength={48}
                onChange={(e) => setPassword(e)}
              />
              {/* </List.Item>
              </List> */}
            {invalidPass &&  <div className="text-center text-sm mt-2" style={{color: "var(--adm-color-danger)"}}>Invalid password</div> }
            { invalidPass &&  <ForgotYourPin type="password" />   }
           
            </div>
          <Button
          shape="rounded"
          color="primary"
          size="large"
          type="submit"
          style={{marginTop: 64, marginBottom: 64, width: "350px"}}
          className="mt-4"
          >
            Unlock
          </Button>
        </div>
      </form>
      {loading && (
        <div className="absolute inset-0 !z-50 flex !h-screen !w-screen items-center justify-center bg-black/90">
          <HashSpinner size={80} color="#0096FF" loading={loading} />
        </div>
      )}
      </Card>
    </div>
  );
}
