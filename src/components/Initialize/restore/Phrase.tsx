// You know the rules and so do I

import React, { Dispatch, useState } from "react";
import { IoArrowBack } from "react-icons/io5";
import words from "../../../utils/words";
import { tools, wallet } from "multi-nano-web";

import storage from "../../../utils/storage";

import { Bounce, ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import "../../../styles/restore.css";

export default function ImportPhrase({
  setW,
}: {
  setW: Dispatch<React.SetStateAction<number>>;
}) {
  const [mnemonicInputs, setMnemonicInputs] = useState<string[]>(
    new Array(24).fill(""),
  );
  const [activeInputs, setActiveInputs] = useState<number | null>(null);
  const [errorInputs, setErrorInputs] = useState<boolean[]>(
    new Array(24).fill(false),
  );
  const [canContinue, setCanContinue] = useState<boolean>(false);

  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...mnemonicInputs];
    newInputs[index] = value;
    setMnemonicInputs(newInputs);
    validateMnemonic(newInputs);
  };

  const handleInputKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (event.key === " ") {
      event.preventDefault();
      const nextIndex = index === 23 ? 0 : index + 1;
      document.getElementById(`mnemonic-input-${nextIndex}`)?.focus();
    }
  };

  const validateMnemonic = (inputs: string[]) => {
    const isValid = inputs.every((word) => words.includes(word.trim()));
    setCanContinue(isValid);
    setErrorInputs(inputs.map((word) => !words.includes(word.trim())));
  };

  const handleInputBlur = (index: number) => {
    console.log(index);
    validateMnemonic(mnemonicInputs);
    setActiveInputs(null);
  };

  return (
    <>
      <div className="step-p-nav relative">
        <div
          className="cursor-pointer text-slate-400 hover:text-slate-200"
          role="button"
          onClick={() => setW(0)}
        >
          <IoArrowBack size={20} />
        </div>
        <div className="step-p-steps select-none">
          <div className="step-dot mr-[10px]" />
          <div className="step-dot mr-[10px] !bg-slate-700" />
          <div className="step-dot !bg-slate-700" />
        </div>
      </div>

      <div className="w-full h-full flex flex-col justify-between">
        <div className="flex flex-col justify-start w-full align-center mt-10">
          <p className="step-r-p-h select-none">Secret Recovery Phrase</p>
          <p className="step-r-p-p select-none">
            Import an existing wallet with your 24-word secret recovery phrase.
          </p>
        </div>

        <div className="justify-center h-full items-center m-3">
          <div className="bg-transparent w-full max-h-[330px] scroll-auto p-3 overflow-y-auto rounded-md">
            <div className="w-full h-full grid grid-cols-3 gap-3">
              {mnemonicInputs.map((input, index) => (
                <div
                  className={`grid-input-r border-2 ${
                    activeInputs === index && "!border-blue-500"
                  } ${errorInputs[index] && "!border-red-500"}`}
                  key={index}
                >
                  <p className="grid-input-r-p">{index + 1}.</p>
                  <input
                    id={`mnemonic-input-${index}`}
                    pattern="[A-Za-z\s]+"
                    autoCorrect="false"
                    spellCheck="false"
                    className={`grid-input-r-i ${
                      input.trim() && !words.includes(input.trim())
                        ? "invalid-input"
                        : ""
                    }`}
                    value={input}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleInputKeyDown(e, index)}
                    onBlur={() => handleInputBlur(index)}
                    onFocus={() => setActiveInputs(index)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="justify-end items-center m-3 align-center">
          <button
            className={`step-r-p-import ${
              canContinue
                ? "!cursor-pointer !bg-blue-600 hover:!bg-blue-500"
                : "opacity-60 !cursor-not-allowed"
            }`}
            onClick={(e) => {
              toast.error("Invalid Mnemonic!");
              e.preventDefault();
              if (canContinue) {
                if (tools.validateMnemonic(mnemonicInputs.join(" "))) {
                  storage.set(
                    "mnemonic",
                    wallet.fromMnemonic(mnemonicInputs.join(" ")).seed,
                    "session",
                  );
                  return setW(5);
                }
                // todo
              }
              return;
            }}
          >
            Import Wallet
          </button>
        </div>
      </div>

      <ToastContainer
        position="top-center"
        autoClose={1000}
        className="select-none"
        hideProgressBar={false}
        transition={Bounce}
        theme="dark"
        pauseOnHover={false}
      />
    </>
  );
}
