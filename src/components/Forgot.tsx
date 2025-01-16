import React from "react";

import "../styles/forgot.css";
import { BiLockAlt } from "react-icons/bi";
import { BiX } from "react-icons/bi";

import { removeSeed, resetWallet } from "../utils/storage";

// theme done!
export default function Forgot({
  goBack,
  theme,
}: {
  goBack: React.Dispatch<React.SetStateAction<boolean>>;
  theme: "dark" | "light";
}) {
  return (
    <>
      <section
        className={`forgot-nav ${
          theme == "light" && "!bg-white !text-black !border-slate-400"
        } select-none`}
      >
        <div
          className="forgot-close-btn !text-red-500 !ml-3 hover:!bg-slate-200 !rounded-full"
          onClick={() => goBack(false)}
        >
          <BiX size={24} />
        </div>
        <div className="forgot-w">
          <p className={`${theme == "light" && "!text-black"}`}>
            Forgot Password
          </p>
        </div>
        <div />
      </section>

      <div className={`${theme == "light" && "!bg-white"} forgot-c-w !p-3`}>
        <div />
        <section className="forgot-c-s">
          <BiLockAlt
            size={128}
            className={`!mb-3 p-6 bg-black/50 ${
              theme == "light" && "!text-black/70 !bg-slate-200/50"
            } rounded-full`}
          />
          <p
            className={`forgot-p-c-s-p ${
              theme == "light" && "!text-black"
            } !mb-2`}
          >
            Forgot Password
          </p>
          <p className={`f-p-c ${theme == "light" && "!text-slate-600"}`}>
            You can reset your password by entering your wallet's 24 word
            recovery phrase. Cesium cannot recover your password for you.
          </p>
        </section>

        <div className="w-full">
          <button
            className={`f-p-c-b ${
              theme == "light" && "!text-black/90"
            } hover:!bg-red-400`}
            onClick={async () => {
              await removeSeed();
              return window.location.reload();
            }}
          >
            Reset Secret Phrase
          </button>
        </div>
      </div>
    </>
  );
}
