// @ts-nocheck
import { useEffect, useState } from "react";
import "../../styles/app/home.css";
import { networks } from "../../utils/networks";
import Network, { fetchBalance } from "./Network";
import { Button, DotLoading } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";

export const fetchPrices = async () => {
  const response = await fetch("https://api.nanexplorer.com/prices");
  return response.json();
}
export default function Home() {
  const [selectedTicker, setSelectedTicker] = useState<string>(null);
  const { data: prices, isLoading: isLoadingPrices } = useSWR("prices", fetchPrices);
  const balances = {};
  for (const ticker of Object.keys(networks)) {
    // fetch balance for each network
    balances[ticker] = useSWR("balance-" + ticker, () => fetchBalance(ticker));
  }
  
  const navigate = useNavigate();

  if (selectedTicker) {
    return (
      <Network
        onBack={(ticker) => navigate(`/${ticker}`)}
        ticker={selectedTicker}
      />
    );
  }
  return (
    <div className="container  relative mx-auto">
      {Object.keys(networks).map((ticker) => (
        <div
          key={ticker}
          className="network-card flex justify-between p-2 m-1 cursor-pointer"
          onClick={() => navigate(`/${ticker}`)}
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
            <div className="text-right">
              <div>
                {balances[ticker].isLoading ? <DotLoading /> : balances[ticker].data}
                {
                  !isLoadingPrices && 
                <div className="text-sm text-gray-400">
                ~ {+(prices?.[ticker].usd * balances[ticker].data).toFixed(2)} USD
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
