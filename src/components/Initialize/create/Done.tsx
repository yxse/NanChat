// To understand recursion, see the bottom of this file.

import React, { Dispatch, useEffect, useState } from "react";
import { IoArrowBack } from "react-icons/io5";
import Confetti from "react-confetti-boom";
import { ClipLoader as RingLoader } from "react-spinners";
import storage from "../../../utils/storage";

// @ts-expect-error no check
import cryptoWorker from "../../../worker/crypto?worker&url";

export default function Created({
  setW,
  prevStep,
  theme,
}: {
  setW: Dispatch<React.SetStateAction<number>>;
  prevStep?: number;
  theme: "light" | "dark";
}) {
  const [loading, setLoading] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [mnemonic, setMnemonic] = useState<string>("");


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
          onClick={() => setW(prevStep || 2)}
        >
          <IoArrowBack size={20} />
        </div>
        <div className="step-p-steps select-none">
          <div className="step-dot mr-[10px]" />
          <div className="step-dot mr-[10px]" />
          <div className="step-dot" />
        </div>
      </div>
      {loading ? (
        <div
          className={`${
            theme == "light" && "!bg-white !text-black"
          } flex justify-center items-center h-full`}
        >
          <RingLoader color={"#0096FF"} loading={loading} size={150} />
        </div>
      ) : (
        <>
          <div
            className={`relative flex items-center align-center justify-center !min-h-[554px] h-full w-full ${
              theme == "light" && "!bg-white !text-black"
            }`}
          >
            <div className="flex flex-col p-2 items-center align-center justify-center select-none">
              <img
                src="img/logo.svg"
                className="h-32 w-auto"
                draggable={false}
              />
              <p className="mt-4 text-2xl">You're all done!</p>
              <p
                className={`mt-2 text-md text-slate-300 ${
                  theme == "light" && "!text-slate-600"
                }`}
              >
                You can now fully enjoy your wallet.
              </p>

              <div className="ml-2 mr-2 flex justify-center">
                <button
                  className="absolute bottom-0 mb-4 w-11/12 rounded-md hover:bg-blue-400 !text-black p-3 bg-blue-500"
                  onClick={() => window.location.reload()}
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>

          <Confetti
            particleCount={50}
            shapeSize={8}
            mode="fall"
            colors={["#0096FF", "#0047AB", "#FFFF8F", "#301934", "#FFE5B4"]}
          />
        </>
      )}
    </>
  );
}

// To understand recursion, see the top of this file.
