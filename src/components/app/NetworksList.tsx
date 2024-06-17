// @ts-nocheck
import { useEffect, useState } from "react";
import "../../styles/app/home.css";
import { networks } from "../../utils/networks";
import Network, { fetchBalance, showModalReceive } from "./Network";
import { Button, Divider, DotLoading, FloatingBubble, List } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { BiPlus } from "react-icons/bi";

export const fetchPrices = async () => {
  const response = await fetch("https://api.nanexplorer.com/prices");
  return response.json();
};

export function tickerTitle(ticker, logo, name) {
  return <div>

    <div className="flex items-center">
      <img
        width={42}
        src={logo}
        alt={`${name} logo`} />
      <div className="flex flex-col ml-3 justify-center">
        <div>{ticker}</div>
        <div className="text-sm text-gray-400">
          {name}
        </div>

      </div>
    </div>

  </div>;
}

export const NetworkItem = ({ ticker, onClick, hidePrice = false }) => {
  const { data: prices, isLoading: isLoadingPrices } = useSWR(
    "prices",
    fetchPrices,
    {
      revalidateOnMount: false,
      revalidateOnFocus: false,
    }
  );
  const { data, isLoading } = useSWR("balance-" + ticker, () => fetchBalance(ticker));
  return <div>
    <div
      key={ticker}
      className={"network-card flex justify-between cursor-pointer flex-start p-0 m-0"}
      onClick={() =>
        onClick(ticker)
      }
    >
      <div className="flex items-center">
        <img
          width={42}
          src={networks[ticker].logo}
          alt={`${networks[ticker].logo} logo`} />
        <div className="flex flex-col ml-3 justify-center">
          <div>{ticker}</div>
          <div className="text-sm text-gray-400">
            {networks[ticker].name}
          </div>
          {
            !hidePrice &&
            <div className="flex items-center space-x-1 mt-1">
              <div className="text-xs text-gray-400">
                ${+(prices?.[ticker].usd)?.toPrecision(4)}
              </div>
              {
                prices?.[ticker].change > 0 ? <div className="text-xs text-green-600">
                  +{(prices?.[ticker].change * 100)?.toFixed(2)}%
                </div> : <div className="text-xs text-red-600">
                  {(prices?.[ticker].change * 100)?.toFixed(2)}%
                </div>
              }
            </div>
          }
        </div>
      </div>


      {/* {tickerTitle(ticker, networks[ticker].logo, networks[ticker].name, onClick)} */}
      <div className="network-balance">
        <div className="text-right">
          <div>
            {isLoading ? (
              <DotLoading />
            ) : (
              data
            )}
            {!isLoadingPrices && (
              <div className="text-sm text-gray-400">
                ~{" "}
                {+(prices?.[ticker].usd * data).toFixed(2)}{" "}
                USD
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

  </div>
}

export default function NetworkList({ onClick, hidePrice }) {

  return (<>
    <List>

      {Object.keys(networks).map((ticker) => (
        <List.Item>

          <NetworkItem
            key={ticker}
            ticker={ticker}
            onClick={onClick}
            hidePrice={hidePrice}
          />

        </List.Item>
      ))}
    </List>
  </>
  );
}
