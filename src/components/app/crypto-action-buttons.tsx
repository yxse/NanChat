import React from 'react';
import { AiOutlineArrowDown, AiOutlineArrowUp, AiOutlineSwap } from 'react-icons/ai';

const CryptoActionButtons = ({ setAction, setActiveTicker, setVisible, ticker }) => {
  const handleClick = (action) => (e) => {
    e.stopPropagation();
    setAction(action);
    setActiveTicker(ticker);
    setVisible(true);
  };

  return (
    <div className="flex space-x-4 ml-6 mr-1 justify-end max-sm:hidden">
      <div
        className="flex flex-col items-center"
        onClick={handleClick("receive")}
      >
        <AiOutlineArrowDown
          size={36}
          className="bg-gray-800 rounded-full p-2 hover:bg-gray-900 text-white"
        />
        <div className="text-sm text-gray-400 text-center">
          Receive
        </div>
      </div>
      <div
        className="flex flex-col items-center"
        onClick={handleClick("send")}
      >
        <AiOutlineArrowUp
          size={36}
          className="bg-gray-800 rounded-full p-2 hover:bg-gray-900 text-white"
        />
        <div className="text-sm text-gray-400 text-center">
          Send
        </div>
      </div>
      <div
        className="flex flex-col items-center"
        onClick={handleClick("swap")}
      >
        <AiOutlineSwap
          size={36}
          className="bg-gray-800 rounded-full p-2 hover:bg-gray-900 text-white"
        />
        <div className="text-sm text-gray-400 text-center">
          Swap
        </div>
      </div>
    </div>
  );
};

export default CryptoActionButtons;
