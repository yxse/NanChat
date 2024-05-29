import { AiOutlineSignature } from "react-icons/ai";

export default function Sign() {
  return (
    <div className="flex flex-col overflow-hidden justify-between w-full h-full">
      <nav className="flex select-none w-full shadow-md items-center rounded-b-lg justify-start p-2 bg-slate-800 text-center">
        <div className="w-full flex flex-row items-center">
          <div className="justify-center flex w-full">
            <p className="text-blue-400">Signature Request</p>
          </div>
          <div className="absolute right-0 m-3 group">
            <AiOutlineSignature
              size={21}
              className="text-sky-300 group-hover:text-sky-200 transition-colors"
            />
          </div>
        </div>
      </nav>

      <div className="flex justify-center h-full p-4">
        <div className="flex flex-col justify-between h-full w-full">
          <div className="flex flex-col w-full justify-start mt-3 items-center">
            <div className="flex flex-col space-y-2 overflow-hidden justify-center text-center w-full">
              <div className="flex mb-2 items-center justify-center">
                {/** image placeholder */}
                <img
                  className="h-20 w-20 rounded-full border-4 border-gray-200 select-none pointer-events-none"
                  draggable={false}
                  src="https://nanswap.com/faviconArt.png?1"
                  alt="Web Logo"
                />
              </div>
              <p className="text-slate-200 text-lg font-semibold">
                Nanswap ART
              </p>
              <div className="flex flex-col">
                <p className="text-sky-500 font-link select-none hover:underline">
                  https://nanswap.com
                </p>
                <p className="text-slate-500 hover:text-slate-400 cursor-pointer transition-colors text-sm mt-1 justify-end">
                  1pkkcc...bwbcgz
                </p>
              </div>
            </div>
          </div>

          <p>Message:</p>
          <div className="flex !overflow-scroll h-full w-full p-3 text-left bg-slate-800/70 rounded-md mt-4 justify-center">
            I would like to link{" "}
            {
              "{this} account to my nanswap art account with username {username}"
            }
          </div>
        </div>
      </div>

      <div className="relative select-none justify-end">
        <div className="absolute inset-x-0 top-0 w-full h-0.5 bg-gray-800/50" />

        {/** buttons */}
        <div className="flex flex-row items-center justify-center space-x-5 p-3">
          <div
            role="button"
            className="flex text-center w-full rounded-full p-2 bg-transparent border border-solid border-red-500 text-red-500 hover:border-red-400 hover:text-red-400 transition-colors"
          >
            <span className="text-sm w-full">CANCEL</span>
          </div>

          <div
            role="button"
            className="flex text-center w-full rounded-full p-2 bg-blue-500 text-slate-200 hover:bg-blue-400 hover:text-slate-100 transition-colors"
          >
            <span className="text-sm w-full">SIGN</span>
          </div>
        </div>
      </div>
    </div>
  );
}
