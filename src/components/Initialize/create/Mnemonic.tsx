// You know the rules and so do I

import React, { Dispatch, useState, useEffect } from "react";
import { IoArrowBack } from "react-icons/io5";
import { wallet } from "multi-nano-web";

import "../../../styles/mnemonic.css";
import { BsEyeSlashFill } from "react-icons/bs";

import storage from "../../../utils/storage";

export default function Mnemonic({
  setW,
  theme,
}: {
  setW: Dispatch<React.SetStateAction<number>>;
  theme: "light" | "dark";
}) {
  const [checked, setChecked] = useState<boolean>(false);
  const [mnemonic, setMnemonic] = useState<string>("");
  useEffect(() => {
    const generatedMnemonic = wallet.generate().mnemonic;
    setMnemonic(generatedMnemonic);
    storage.set(
      "mnemonic",
      wallet.fromMnemonic(generatedMnemonic).seed,
      "session",
    );
  }, []);
  return (
    <>
      <div
        className={`step-p-nav ${
          theme == "light" && "!bg-white !text-black !border-slate-400"
        }`}
      >
        <div
          className="cursor-pointer text-slate-400 hover:text-slate-200"
          role="button"
          onClick={() => setW(1)}
        >
          <IoArrowBack size={20} />
        </div>
        <div className="step-p-steps select-none">
          <div className="step-dot mr-[10px]" />
          <div className="step-dot mr-[10px]" />
          <div className="step-dot !bg-slate-700" />
        </div>
      </div>

      <div
        className={`step-m-wrapper ${
          theme == "light" && "!bg-white !text-black"
        }`}
      >
        <form
          className="step-m-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (checked) {
              return setW(3);
            }
            return;
          }}
        >
          <div className="step-m-c select-none">
            <div className="step-m-h">
              <p className={`step-m-hp ${theme == "light" && "!text-black"}`}>
                Secret Recovery Phrase
              </p>
              <p className="step-m-hs">
                This phrase is the ONLY way to recover your wallet. Do NOT share
                it with anyone!
              </p>
            </div>
          </div>

          <div className="relative p-2 group">
            <div className="grid grid-cols-3 gap-3 overflow-y-scroll overflow-x-hidden blur-sm group-hover:blur-none word-wrapper">
              {mnemonic.split(" ").map((word, index) => (
                <div
                  key={index}
                  className={`border p-2 text-xs bg-black/60 p-1 rounded-sm ${
                    theme == "light" && "!bg-slate-400/60"
                  }`}
                >
                  <span
                    className={`${
                      theme == "light" && "!text-slate-900"
                    } text-slate-400 select-none`}
                  >
                    {index + 1}.{" "}
                  </span>
                  <span className={`${theme == "light" && "!text-slate-900"}`}>
                    {word}
                  </span>
                </div>
              ))}
            </div>

            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 group-hover:hidden display-transition">
              <BsEyeSlashFill
                size={64}
                className={`${theme == "light" && "!text-slate-400"}`}
              />
            </div>
          </div>

          <div className="step-m-confirm">
            <div
              className={`step-m-checkbox mr-2 ${
                theme == "light" && "!border-slate-600"
              }`}
            >
              <input
                type="checkbox"
                className={`custom-ch ${theme == "light" && "!bg-slate-300"}`}
                onChange={(e) => setChecked(e.currentTarget.checked)}
              />
            </div>
            <p className={`step-m-p ${theme == "light" && "!text-slate-800"}`}>
              I saved my Secret Recovery Phrase
            </p>
          </div>

          <button
            className={`step-m-continue select-none !z-20 ${
              checked
                ? "!cursor-pointer !bg-sky-600"
                : `!opacity-60 !cursor-not-allowed ${
                    theme == "light" && "!text-slate-800"
                  }`
            }`}
          >
            Continue
          </button>

          <div className="!mb-2 !min-h-[20px]" />
        </form>
      </div>
    </>
  );
}
