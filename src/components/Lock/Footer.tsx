// Please don't ask me why it's done here

import React, { useEffect, useState } from "react";
import { ClipLoader as HashSpinner } from "react-spinners";
import { wallet } from "multi-nano-web";

// @ts-expect-error no check
import cryptoWorker from "../../worker/crypto?worker&url";
import storage from "../../utils/storage";
import { decrypt } from "../../worker/crypto";

// theme added
export default function Footer({
  shouldCall,
  setShouldCall,
  setInvalidPass,
  setLoggedIn,
  theme,
}: {
  shouldCall: boolean;
  setShouldCall: React.Dispatch<React.SetStateAction<boolean>>;
  setInvalidPass: React.Dispatch<React.SetStateAction<boolean>>;
  setLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  theme: "dark" | "light";
}) {
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);


  useEffect(() => {
    return
    if (password === "" && !localStorage.getItem("seed")) return;
    setLoading(true);
    async function decryptData() {
      if (localStorage.getItem("seed")) {
        const seed = localStorage.getItem("seed");
        const res = seed.length === 128 ? wallet.fromSeed(seed) : wallet.fromLegacySeed(seed);
        setSeed(res.seed);
        setLoggedIn(true);
        return;
      }
      else {
        try {
          let encryptedMasterKey = await storage.get("encryptedMasterKey", "local");
          let result = await decrypt(encryptedMasterKey, password);
          const res = result.length === 128 ? wallet.fromSeed(result) : wallet.fromLegacySeed(result); 
          setInvalidPass(false);
          setSeed(res.seed);
          setLoggedIn(true);
        } catch (error) {
          console.log(error)
          setLoading(false);
        }
      }
    }
    decryptData();
  }, [password]);

  const handleUnlock = () => {
    // @ts-expect-error unlock
    // add focus to input
    document.getElementById("unlock-pass").focus();

    const elem = document.getElementById("unlock-pass").value;
    if (!elem || elem === "") return;
    setPassword(elem);
  };

  useEffect(() => {
    if (shouldCall) {
      setShouldCall(false);
      return handleUnlock();
    }
  }, [shouldCall]);

  return (
    <div
      className={`lockscreen-footer ${
        theme == "light" && "!bg-white !text-black"
      }`}
    >
      <div className="w-full" tabIndex={0}>
        <button
          formTarget="unlock"
          style={{ fontWeight: 600 }}
          className="unlock-button"
          onClick={handleUnlock}
        >
          Unlock
        </button>
      </div>
      {loading && (
        <div className="absolute inset-0 !z-50 flex !h-screen !w-screen items-center justify-center bg-black/90">
          <HashSpinner size={80} color="#0096FF" loading={loading} />
        </div>
      )}
    </div>
  );
}
