// You would not believe your eyes..

import { useState } from "react";

import { FaBars, FaBarsStaggered } from "react-icons/fa6";
import "../../styles/app.css";
import {
  AiFillDollarCircle,
  AiFillWallet,
  AiOutlineGlobal,
  AiOutlineSwap,
} from "react-icons/ai";
import { BiHistory, BiSolidDashboard, BiWallet } from "react-icons/bi";
import Settings from "../Settings";

import Home from "./Home";
import Art from "./Art";
import Swap from "./Swap";
import History from "./History";
import Network from "./Network";
import { TabBar } from "antd-mobile";

export default function App() {
  const [widget, setWidget] = useState<
    "home" | "art" | "swap" | "history" | "network"
  >("home");
  const [isNavOpen, setNavOpen] = useState<boolean>(false);

  const tabs = [
    {
      key: "home",
      title: "Wallet",
      icon: <BiWallet size={24} />,
    },
    {
      key: "art",
      title: "Art",
      icon: <BiSolidDashboard size={24} />,
    },
    {
      key: "swap",
      title: "Swap",
      icon: <AiOutlineSwap size={24} />,
    },
    {
      title: "Network",
      icon: <AiOutlineGlobal size={24} />,
      key: "network",
    },
  ];
  return (
    <>
      <section className="app-navbar">
        <div className="app-navbar-menu">
          <div
            className="app-nav-m hover:!bg-black p-1 rounded-md"
            onClick={() => setNavOpen(!isNavOpen)}
          >
            {isNavOpen ? (
              <FaBarsStaggered
                size={16}
                className="!text-slate-500 transform scale-x-[-1]"
              />
            ) : (
              <FaBars size={16} className="!text-slate-500" />
            )}
          </div>
        </div>

        <div className="app-nav-c">
          {widget == "home" && (
            <span className="text-slate-400 text-xl select-none cursor-pointer">
              cesium
            </span>
          )}
          {widget == "network" && (
            <span className="text-slate-400 text-md select-none cursor-pointer">
              Manage Network
            </span>
          )}
        </div>
      </section>

      <div className="w-full h-full relative overflow-y-hidden overflow-x-hidden">
        {/** main content */}

        {widget == "home" && <Home />}
        {widget == "art" && <Art />}
        {widget == "swap" && <Swap />}
        {widget == "history" && <History />}
        {widget == "network" && <Network />}

        <Settings isNavOpen={isNavOpen} />
      </div>
      <TabBar
        activeKey={widget}
        onChange={(key) => {
          console.log(key);
          setWidget(key);
        }}
      >
        {tabs.map((tab) => (
          <TabBar.Item title={tab.title} key={tab.key} icon={tab.icon} />
        ))}
      </TabBar>
    </>
  );
}

// oh btw, I'm a big fan of Adam Young's music. I can't believe I got here already! :D
// PS: I completed other stuff quite early than expected.
// PPS: try listening to All Things Bright and Beautiful album.
