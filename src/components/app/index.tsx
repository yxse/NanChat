// You would not believe your eyes..

import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

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
import Send from "./Send";
import Protocol_handler from "./protocol_handler";

export default function App() {
  const [widget, setWidget] = useState<
    "home" | "art" | "swap" | "history" | "network"
  >("home");
  const [isNavOpen, setNavOpen] = useState<boolean>(false);

  const tabs = [
    {
      key: "home",
      title: "Wallet",
      icon: <BiWallet size={28} />,
    },
    {
      key: "art",
      title: "Art",
      icon: <BiSolidDashboard size={28} />,
    },
    {
      key: "swap",
      title: "Swap",
      icon: <AiOutlineSwap size={28} />,
    },
    {
      title: "Network",
      icon: <AiOutlineGlobal size={28} />,
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
      <Router>
      <div className="w-full h-full relative overflow-y-hidden overflow-x-hidden">
        {/** main content */}
        <Routes>
  <Route path="/" element={<Home />} />
  <Route path="/art" element={<Art />} />
  <Route path="/swap" element={<Swap />} />
  <Route path="/history" element={<History />} />
  <Route path="/network" element={<Network />} />
  <Route path="/protocol_handler" element={<Protocol_handler />} />
  <Route path="/:ticker" element={<Network />} />
  <Route path="/:ticker/send" element={<Send />} />
</Routes>
        <Settings isNavOpen={isNavOpen} />
      </div>
      </Router>
      <TabBar
      className="mb-4"
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
