// @ts-nocheck
import { useEffect, useState } from "react";
import "../../styles/app/home.css";
import { networks } from "../../utils/networks";
import Network, { fetchBalance, showModalReceive } from "./Network";
import { Button, Dialog, DotLoading, FloatingBubble, Switch, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { BiPlus } from "react-icons/bi";
import { AiOutlineDelete } from "react-icons/ai";
import useLocalStorageState from "use-local-storage-state";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export default function NetworksSwitch({ onClick }) {
  const navigate = useNavigate();
  const [hiddenNetworks, setHiddenNetworks] = useLocalStorageState("hiddenNetworks", {defaultValue: []})
  const [customNetworks, setCustomNetworks] = useLocalStorageState("customNetworks", {defaultValue: {}})
  return (<>
      {Object.keys(networks).filter((ticker) => !networks[ticker].custom).map((ticker) => (
        renderNetworkSwitch(ticker, networks[ticker])
      ))}
      {Object.keys(customNetworks).map((ticker) => (
        renderNetworkSwitch(ticker, customNetworks[ticker], true)
      ))}
      <div className="p-4">
        <Button
          onClick={() => navigate("/add-network")}
          className="w-full mb-4"
          type="primary"
        ><div className="flex justify-center items-center gap-2">
          <BiPlus /> Add Network
        </div>
        </Button>
      </div>
      </>
  );

  function renderNetworkSwitch(ticker: string, network: any, canDelete = false) {
    return <div
      key={ticker}
      className="network-card flex justify-between p-2 m-1 cursor-pointer"
      onClick={() => {
        Haptics.impact({
          style: ImpactStyle.Medium
        });
        let checked = hiddenNetworks.includes(ticker);
        console.log(ticker, checked, hiddenNetworks);
        setHiddenNetworks(checked ? hiddenNetworks.filter((t) => t !== ticker) : [...hiddenNetworks, ticker]);
      } }
    >
      <div className="network-info flex">
        <img
          width={42}
          src={network.logo}
          alt={`${ticker} logo`}
          className="network-card-header-logo-img" />
        <div className="flex flex-col ml-3 justify-center">
          <div>{ticker}</div>
          <div className="text-sm text-gray-400">
            {network.name}
          </div>
        </div>
      </div>
      <div className="flex gap-2 items-center">
        {canDelete &&

          <AiOutlineDelete
            size={24}
            className="text-red-500" onClick={(e) => {
              e.stopPropagation();
              Dialog.confirm({
                closeOnMaskClick: true,
                title: `Delete ${ticker} network?`,
                cancelText: "Cancel",
                confirmText: "Delete",
                onConfirm: () => {
                  let customNetworksTmp = JSON.parse(localStorage.getItem("customNetworks"));
                  delete customNetworksTmp[ticker];
                  // localStorage.setItem("customNetworks", JSON.stringify(customNetworks));
                  setCustomNetworks(customNetworksTmp);
                  Toast.show({
                    icon: "success",
                    content: "Network removed",
                  });
                },
                content: "You will need to add it again to view your assets in this network",
              });
            } } />}
        <Switch
          checked={!hiddenNetworks?.includes(ticker)} />

      </div>
    </div>;
  }
}
