// This has been temporarily archived in favour of faster development.
// Multichain feature will be added after v1 Release
// Allow me to ship something :D

// Talk is cheap, send patches.

import React, { useEffect, useState } from "react";
import {
  BiSearchAlt,
  BiPlus,
  BiEdit,
  BiUpload,
  BiImageAdd,
  BiTrash,
} from "react-icons/bi";
import { IoArrowBack } from "react-icons/io5";
import { getLocalStorage, setLocalStorage } from "../../utils/storage";

interface Network {
  ticker: string;
  name: string;
  logo: string | null;
  rpc: string;
  ws: string;
  enabled: boolean;
}

export default function Network() {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [knownNetworks, setKnownNetworks] = useState<Network[]>([]);
  const [newNetwork, setNewNetwork] = useState<Network>({
    ticker: "",
    name: "",
    logo: null,
    rpc: "",
    ws: "",
    enabled: false,
  });

  const [showAddNetwork, setShowAddNetwork] = useState<boolean>(false);
  const [showEditNetwork, setShowEditNetwork] = useState<boolean>(false);

  const [editedNetwork, setEditedNetwork] = useState<Network | null>(null);
  const [editedName, setEditedName] = useState<string>("");
  const [editedTicker, setEditedTicker] = useState<string>("");
  const [editedLogo, setEditedLogo] = useState<string | null>(null);
  const [editedRPC, setEditedRPC] = useState<string>("");
  const [editedWS, setEditedWS] = useState<string>("");
  const [editedEnabled, setEditedEnabled] = useState<boolean>(false);

  useEffect(() => {
    // Fetch data from local storage or set default if not found
    const fetchData = async () => {
      const storedNetworks = await getLocalStorage("knownNetworks");
      if (storedNetworks) {
        setKnownNetworks(JSON.parse(storedNetworks));
      } else {
        setKnownNetworks([
          {
            ticker: "XNO",
            name: "Nano",
            logo: "img/crypto/nano.png",
            ws: "wss://node.somenano.com/websocket",
            rpc: "https://rpc.nano.to",
            enabled: true,
          },
          {
            ticker: "BAN",
            name: "Banano",
            logo: "img/crypto/banano.png",
            ws: "wss://node.somenano.com/websocket",
            rpc: "https://rpc.nano.to",
            enabled: true,
          },
          {
            ticker: "XDG",
            name: "Dogenano",
            logo: "img/crypto/dogenano.png",
            ws: "wss://node.somenano.com/websocket",
            rpc: "https://rpc.nano.to",
            enabled: true,
          },
          {
            ticker: "XRO",
            name: "Raione",
            logo: "img/crypto/raione.jpg",
            ws: "wss://node.somenano.com/websocket",
            rpc: "https://rpc.nano.to",
            enabled: true,
          },
        ]);
        setLocalStorage("knownNetworks", JSON.stringify(knownNetworks));
      }
    };
    fetchData();
  }, []);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleAddNetwork = () => {
    setShowAddNetwork(true);
  };

  const handleRemoveNetwork = (ticker: string) => {
    const updatedNetworks = knownNetworks.filter(
      (network) => network.ticker !== ticker,
    );
    setKnownNetworks(updatedNetworks);
    setLocalStorage("knownNetworks", JSON.stringify(updatedNetworks));
  };

  const handleGoBack = () => {
    setShowAddNetwork(false);
    setShowEditNetwork(false);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result?.toString();
        if (base64String) {
          if (showEditNetwork) {
            setEditedLogo(base64String);
          } else {
            setNewNetwork({ ...newNetwork, logo: base64String });
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (showEditNetwork) {
      setEditedName(event.target.value);
    } else {
      setNewNetwork({ ...newNetwork, name: event.target.value });
    }
  };

  const handleTickerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (showEditNetwork) {
      setEditedTicker(event.target.value);
    } else {
      setNewNetwork({ ...newNetwork, ticker: event.target.value });
    }
  };

  const handleRPCChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (showEditNetwork) {
      setEditedRPC(event.target.value);
    } else {
      setNewNetwork({ ...newNetwork, rpc: event.target.value });
    }
  };

  const handleWSChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (showEditNetwork) {
      setEditedWS(event.target.value);
    } else {
      setNewNetwork({ ...newNetwork, ws: event.target.value });
    }
  };

  const handleAddNetworkX = () => {
    if (
      newNetwork.name &&
      newNetwork.ticker &&
      newNetwork.rpc &&
      newNetwork.ws &&
      !knownNetworks.find((network) => network.ticker === newNetwork.ticker) // Check if ticker already exists
    ) {
      const updatedNetworks = [...knownNetworks, newNetwork];
      setKnownNetworks(updatedNetworks);
      setLocalStorage("knownNetworks", JSON.stringify(updatedNetworks));
      setShowAddNetwork(false);
      setNewNetwork({
        ticker: "",
        name: "",
        logo: null,
        rpc: "",
        ws: "",
        enabled: false,
      });
    }
  };

  const handleEditNetwork = (network: Network) => {
    setShowEditNetwork(true);
    setEditedNetwork(network);
    setEditedName(network.name);
    setEditedTicker(network.ticker);
    setEditedLogo(network.logo);
    setEditedRPC(network.rpc);
    setEditedWS(network.ws);
    setEditedEnabled(network.enabled);
  };

  const handleSaveChanges = () => {
    if (editedNetwork) {
      const updatedNetworks = knownNetworks.map((network) =>
        network.ticker === editedNetwork.ticker
          ? {
              ...network,
              name: editedName,
              ticker: editedTicker,
              logo: editedLogo,
              rpc: editedRPC,
              ws: editedWS,
              enabled: editedEnabled,
            }
          : network,
      );
      setKnownNetworks(updatedNetworks);
      setLocalStorage("knownNetworks", JSON.stringify(updatedNetworks));
      setShowEditNetwork(false);
      setEditedNetwork(null);
    }
  };

  const handleDiscardChanges = () => {
    setShowEditNetwork(false);
    setEditedNetwork(null);
    setEditedName("");
    setEditedTicker("");
    setEditedLogo(null);
    setEditedRPC("");
    setEditedWS("");
    setEditedEnabled(false);
  };

  return (
    <div className="container fadeInMe relative h-full mx-auto max-w-md p-4">
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearch}
          placeholder="Search Network.."
          className="w-full px-4 py-2 border border-gray-800 outline-none focus:border-transparent rounded-lg bg-black/70 focus:outline-none focus:ring focus:border-blue-300"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <BiSearchAlt className="text-gray-400" size={21} />
        </div>
      </div>

      <div
        style={{ backgroundColor: "rgb(12, 12, 16)" }}
        className="relative overflow-y-auto p-2 mt-3 rounded-md h-[400px] overflow-y-scroll overflow-x-hidden"
      >
        {knownNetworks
          .filter(
            (network) =>
              network.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              network.ticker.toLowerCase().includes(searchTerm.toLowerCase()),
          )
          .map((network, index) => (
            <div
              key={index}
              className="flex items-center space-x-4 bg-gray-900 rounded-md p-2 mb-2 relative"
            >
              <img
                src={network.logo || "img/crypto/unknown.svg"}
                alt={network.name}
                className="h-8 rounded-full aspect-square"
              />
              <div>
                <p className="font-semibold">{network.name}</p>
                <p className="text-xs text-gray-500">{network.ticker}</p>
              </div>
              <div className="flex-grow" />
              <div className="flex items-center space-x-2">
                <button
                  className="text-xs text-blue-500 hover:text-blue-300"
                  onClick={() => handleEditNetwork(network)}
                >
                  <BiEdit size={18} />
                </button>
                {knownNetworks.length > 1 && ( // disable remove button when there's only one network left
                  <button
                    className="text-xs text-red-500 hover:text-red-300"
                    onClick={() => handleRemoveNetwork(network.ticker)}
                  >
                    <BiTrash size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        {knownNetworks.filter(
          (network) =>
            network.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            network.ticker.toLowerCase().includes(searchTerm.toLowerCase()),
        ).length === 0 && (
          <div className="flex flex-col space-y-2 items-center h-full justify-center text-slate-200">
            <img
              src="img/SadBlob.svg"
              className="select-none h-32 pointer-events-none w-auto"
              draggable={false}
            />
            <p className="text-lg">No such network found!</p>
            <span className="text-xs text-sky-400 align-center text-center">
              "{searchTerm}" not found. are you sure it exists?
            </span>
          </div>
        )}
      </div>

      {(showAddNetwork || showEditNetwork) && (
        <div
          style={{ background: "rgb(16, 16, 20)" }}
          className="absolute z-50 top-0 left-0 h-full w-full p-4 rounded-t-lg transition-all transform translate-y-0"
        >
          <button
            className="text-slate-300 hover:text-slate-200 transition-colors absolute top-2 left-2"
            onClick={handleGoBack}
          >
            <IoArrowBack size={24} />
          </button>
          <div className="flex flex-col space-y-4 mt-4 pb-5">
            {/** preview */}
            <div className="flex flex-row align-center rounded-full bg-transparent justify-center">
              {showEditNetwork && editedLogo ? (
                <img src={editedLogo} className="h-48 w-auto" />
              ) : newNetwork.logo ? (
                <img src={newNetwork.logo} className="h-48 w-auto" />
              ) : (
                <BiImageAdd className="h-48 w-auto" />
              )}
            </div>
            <label
              htmlFor="logoFile"
              role="button"
              onClick={() =>
                setTimeout(
                  () => document.getElementById("logoFile")?.click(),
                  200,
                )
              }
            >
              <div className="bg-slate-700 hover:bg-slate-600 transition-colors flex flex-row justify-center items-center p-2 align-center rounded-full">
                <BiUpload size={24} />
                <span className="text-center align-center items-center">
                  &nbsp;Upload Image
                </span>
              </div>
            </label>
            <input
              type="file"
              id="logoFile"
              accept="image/*"
              onChange={handleImageUpload}
              className="bg-gray-800 text-white p-2 rounded-full hidden"
            />
            <div className="flex flex-row space-x-2">
              <input
                type="text"
                placeholder="Name"
                value={showEditNetwork ? editedName : newNetwork.name}
                onInput={handleNameChange}
                autoComplete="false"
                autoCorrect="false"
                aria-autocomplete="none"
                className="w-2/3 px-4 py-2 border border-gray-800 outline-none focus:border-transparent rounded-lg bg-black/70 focus:outline-none focus:ring focus:border-blue-300"
              />
              <input
                type="text"
                autoComplete="false"
                placeholder="Ticker"
                value={showEditNetwork ? editedTicker : newNetwork.ticker}
                onInput={handleTickerChange}
                autoCorrect="false"
                aria-autocomplete="none"
                className="w-1/3 px-4 py-2 border border-gray-800 outline-none focus:border-transparent rounded-lg bg-black/70 focus:outline-none focus:ring focus:border-blue-300"
              />
            </div>
            <input
              type="text"
              placeholder="RPC URL"
              value={showEditNetwork ? editedRPC : newNetwork.rpc}
              onInput={handleRPCChange}
              autoComplete="false"
              autoCorrect="false"
              aria-autocomplete="none"
              className="w-full px-4 py-2 border border-gray-800 outline-none focus:border-transparent rounded-lg bg-black/70 focus:outline-none focus:ring focus:border-blue-300"
            />
            <input
              type="text"
              placeholder="Websocket URI"
              value={showEditNetwork ? editedWS : newNetwork.ws}
              onInput={handleWSChange}
              autoComplete="false"
              autoCorrect="false"
              aria-autocomplete="none"
              className="w-full px-4 py-2 border border-gray-800 outline-none focus:border-transparent rounded-lg bg-black/70 focus:outline-none focus:ring focus:border-blue-300"
            />
            {/** I'll come back to this some other day. */}
            {/* {showEditNetwork && (
              <div className="flex items-center m-2">
                <div className="w-full flex flex-row items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editedEnabled}
                    onChange={(e) => setEditedEnabled(e.target.checked)}
                    className="form-checkbox h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                  />
                  <span className="text-sm text-gray-400">Enabled</span>
                </div>
              </div>
            )} */}
            <button
              onClick={showEditNetwork ? handleSaveChanges : handleAddNetworkX}
              className="btn bg-blue-500 p-2 rounded-md hover:bg-blue-400 transition-colors text-white"
            >
              {showEditNetwork ? "Save Changes" : "Add Network"}
            </button>
            {showEditNetwork && (
              <button
                onClick={handleDiscardChanges}
                className="btn bg-red-500 p-2 rounded-md hover:bg-red-400 transition-colors text-white"
              >
                Discard Changes
              </button>
            )}
          </div>
        </div>
      )}

      <div className="absolute bottom-0 right-0 z-10 m-4 space-x-2 flex flex-row">
        <div
          className="animAddButton drop-shadow-2xl flex items-center align-center justify-center group rounded-lg bg-blue-500 p-2"
          role="button"
          onClick={handleAddNetwork}
        >
          <BiPlus size={22} className="group-hover:mr-2" />
          <p className="hidden group-hover:inline-block text-xs">Add Network</p>
        </div>
      </div>
    </div>
  );
}
