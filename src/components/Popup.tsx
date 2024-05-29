import { useEffect, useState } from "react";

import PopupWrapper from "./Wrapper";
import Lockscreen from "./Lock";
import InitializeScreen from "./Initialize";

import { ClipLoader as HashSpinner } from "react-spinners";

import storage from "../utils/storage";

import App from "./app";

export default function Popup() {
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [isAppLoggedIn, setAppLoggedIn] = useState<boolean>(false);
  const [sessionMasterKey, setSessionMasterKey] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    if (isAppLoggedIn) {
      (async () => {
        setSessionMasterKey(
          (await storage.get("masterSeed", "session")) || null,
        );
      })();
    }
  }, [isAppLoggedIn]);

  useEffect(() => {
    async function checkLocalStorage() {
      try {
        const encryptedMasterSeed = await storage.get(
          "encryptedMasterKey",
          "local",
        );

        if (encryptedMasterSeed) {
          setIsLocked(true);
        } else {
          setIsLocked(false);
        }
      } catch (error) {
        console.error("Error checking local storage:", error);
      }
    }

    checkLocalStorage();
  }, []);

  return (
    <PopupWrapper theme={theme}>
      {!isAppLoggedIn && (
        <>
          {isLocked ? (
            <Lockscreen setLoggedIn={setAppLoggedIn} theme={theme} />
          ) : (
            <InitializeScreen theme={theme} />
          )}
        </>
      )}

      {isAppLoggedIn && (
        <>
          {sessionMasterKey ? (
            <>
              <App />
            </>
          ) : (
            <>
              <div className="absolute inset-0 !z-50 flex !h-screen !w-screen items-center justify-center bg-black">
                <HashSpinner size={80} color="#0096FF" loading={true} />
              </div>
            </>
          )}
        </>
      )}
    </PopupWrapper>
  );
}
