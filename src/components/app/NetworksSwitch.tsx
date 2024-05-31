// @ts-nocheck
import { useEffect, useState } from "react";
import "../../styles/app/home.css";
import { networks } from "../../utils/networks";
import Network, { fetchBalance, showModalReceive } from "./Network";
import { Button, DotLoading, FloatingBubble, Switch } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { BiPlus } from "react-icons/bi";

export default function NetworksSwitch({ onClick }) {
  return (<>
      {Object.keys(networks).map((ticker) => (
        <div
          key={ticker}
          className="network-card flex justify-between p-2 m-1 cursor-pointer"
          onClick={() =>
            onClick(ticker)
          }
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
            <Switch />
          </div>
        </div>
      ))}</>
  );
}
