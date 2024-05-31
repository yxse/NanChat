// @ts-nocheck
import { useEffect, useState } from "react";
import "../../styles/app/home.css";
import { networks } from "../../utils/networks";
import Network, { fetchBalance, showModalReceive } from "./Network";
import { Button, DotLoading, FloatingBubble, Popup } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { BiPlus } from "react-icons/bi";
import NetworkList from "./NetworksList";
import NetworksSwitch from "./NetworksSwitch";

export const fetchPrices = async () => {
  const response = await fetch("https://api.nanexplorer.com/prices");
  return response.json();
};
export default function Home({ }) {
  const [selectedTicker, setSelectedTicker] = useState<string>(null);
  const [networksSwitchVisible, setNetworksSwitchVisible] = useState<boolean>(false);
  const { data: prices, isLoading: isLoadingPrices } = useSWR(
    "prices",
    fetchPrices,
  );
  const balances = {};
  for (const ticker of Object.keys(networks)) {
    // fetch balance for each network
    balances[ticker] = useSWR("balance-" + ticker, () => fetchBalance(ticker));
  }

  const navigate = useNavigate();

  return (
    <div className="container  relative mx-auto" style={{ maxWidth: 600 }}>
      <NetworkList onClick={(ticker) => navigate(`/${ticker}`)} />
      <FloatingBubble
        style={{
          '--initial-position-bottom': '92px',
          '--initial-position-right': '24px',
          '--edge-distance': '24px',
        }}
        onClick={() => setNetworksSwitchVisible(true)}
      >
        <BiPlus size={24} />
      </FloatingBubble>
      <Popup
      visible={networksSwitchVisible}
      onClose={() => setNetworksSwitchVisible(false)}
      closeOnMaskClick={true}
      >
        <NetworksSwitch />
      </Popup>

    </div>
  );
}
