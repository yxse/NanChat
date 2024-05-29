// @ts-nocheck
import { useEffect, useState } from "react";
import "../../styles/app/home.css";
import { networks } from "../../utils/networks";
import Network, { fetchBalance } from "./Network";
import { Button } from 'antd-mobile'

export default function Home() {
  const [selectedTicker, setSelectedTicker] = useState<string>(null);
  const [balances, setBalances] = useState<any>({}); // {ticker: balance}
  
  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const balances = {};
        for (const ticker of Object.keys(networks)) {
          balances[ticker] = await fetchBalance(ticker);
        }
        setBalances(balances);
      } catch (error) {
        console.error("Error fetching balances:", error);
      }
    };
    fetchBalances();
  }
  , []);
  if (selectedTicker) {
    return <Network 
    onBack={(ticker) => setSelectedTicker(ticker)}
    ticker={selectedTicker} />;
  }
  return (
    <div className="container  relative mx-auto">
      {Object.keys(networks).map((ticker) => (
        <div key={ticker} className="network-card flex justify-between p-2 m-1 cursor-pointer" onClick={() => setSelectedTicker(ticker)}>
          <div className="network-info flex">
              <img
              width={42}
                src={networks[ticker].logo}
                alt={`${ticker} logo`}
                className="network-card-header-logo-img"
              />
              <div className="flex flex-col ml-3 justify-center">
              <div>
                {ticker}
              </div>
              <div className="text-sm text-gray-400">
                {networks[ticker].name}
              </div>
              </div>
          </div>
          <div className="network-balance">
          <div className="text-right">
              <div>
                {balances[ticker] === undefined ? "..." : balances[ticker]}
              <div className="text-sm text-gray-400">
                ~0.00 $
              </div>
              </div>
              </div>
          </div>
        </div>

      ))}
      
    </div>
  );
}
