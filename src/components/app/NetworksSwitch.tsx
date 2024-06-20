// @ts-nocheck
import { useEffect, useState } from "react";
import "../../styles/app/home.css";
import { networks } from "../../utils/networks";
import Network, { fetchBalance, showModalReceive } from "./Network";
import { Button, DotLoading, FloatingBubble, Switch } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { BiPlus } from "react-icons/bi";
import { useLocalStorage } from "../../utils/useLocalStorage";

export default function NetworksSwitch({ onClick }) {
  const navigate = useNavigate();
  const [hiddenNetworks, setHiddenNetworks] = useLocalStorage("hiddenNetworks", []);

  return (<>
      {Object.keys(networks).map((ticker) => (
        <div
          key={ticker}
          className="network-card flex justify-between p-2 m-1 cursor-pointer"
        >
          <div className="network-info flex">
            <img
              width={42}
              src={networks[ticker].logo}
              alt={`${ticker} logo`}
              className="network-card-header-logo-img"
            />
            <div className="flex flex-col ml-3 justify-center">
              <div>{ticker}</div>
              <div className="text-sm text-gray-400">
                {networks[ticker].name}
              </div>
            </div>
          </div>
          <div className="network-balance">
            <Switch 
            checked={!hiddenNetworks.includes(ticker)}
            onChange={(checked) => {
              setHiddenNetworks(checked ? hiddenNetworks.filter((t) => t !== ticker) : [...hiddenNetworks, ticker]);
              // console.log(checked);
              // onClick(ticker, checked);
            } }
            />
          </div>
        </div>
      ))}
      <div>
        <Button
          onClick={() => navigate("/add-network")}
          className="m-2 w-full mb-4"
          type="primary"
        ><div className="flex justify-center items-center gap-2">
          <BiPlus /> Add Network
        </div>
        </Button>
      </div>
      </>
  );
}
