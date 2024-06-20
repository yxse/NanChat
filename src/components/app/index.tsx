// You would not believe your eyes..

import { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  Link,
  useLocation,
} from "react-router-dom";

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
import { Popup, TabBar } from "antd-mobile";
import Send from "./Send";
import Protocol_handler from "./protocol_handler";
import Sign from "../../api-invoke/Sign";
import { SlArrowDownCircle, SlArrowUpCircle } from "react-icons/sl";
import ReceiveSelect from "./ReceiveSelect";
import NetworkList from "./NetworksList";
import SwapTransaction from "./SwapTransaction";
import InitialPopup from "../Popup";
import ChangeRep from "./ChangeRep";
import AddNetwork from "./AddNetwork";

export default function App() {
  const [widget, setWidget] = useState<
    "home" | "art" | "swap" | "history" | "network"
  >("home");
  const [isNavOpen, setNavOpen] = useState<boolean>(false);
  const tabs = [
    {
      key: "",
      title: "Wallet",
      icon: <BiWallet size={28} />,
    },
    {
      key: "receive",
      title: "Receive",
      icon: <SlArrowDownCircle size={22} />,
    },
    {
      key: "send",
      title: "Send",
      icon: <SlArrowUpCircle size={22} />,
    },
    {
      key: "swap",
      title: "Swap",
      icon: <AiOutlineSwap size={28} />,
    },
  ];

  const MenuBar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [visible, setVisible] = useState<boolean>(false);
    const [action, setAction] = useState<"receive" | "send">("receive");
    return (
      <>
        <TabBar
          className="mb-4"
          activeKey={location.pathname.split("/")[1]}
          onChange={(key) => {
            console.log(location.pathname);
            // setWidget(key);
            setVisible(false);
            if (key === "receive") {
              setVisible(true);
              setAction("receive");
              return
            }
            else if (key === "send") {
              setVisible(true);
              setAction("send");
              return
            }
            navigate(key);
          }}
        >
          {tabs.map((tab) => (
            <TabBar.Item title={tab.title} key={tab.key} icon={tab.icon} />
          ))}
        </TabBar>
        <Popup
          visible={visible}
          onClose={() => {
            setVisible(false);
          }}
          onClick={() => setVisible(false)}
          closeOnMaskClick={true}
        >
          <div>
            <div className="text-2xl  text-center p-2">{
              action === "receive" ? "Receive" : "Send"
            }</div>
          </div>
          <NetworkList hidePrice={true} onClick={(ticker) => {
            navigate(ticker + "/" + action);
          }} />
        </Popup>
      </>
    );
  };


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
            <Route path="/swap" element={<Swap />} />
            <Route path="/swap/:id" element={<SwapTransaction />} />
            <Route path="/history" element={<History />} />
            <Route path="/add-network" element={<AddNetwork />} />
            <Route path="/" element={<Home />} />
            <Route path="/sign" element={<Sign />} />
            <Route path="/art" element={<Art />} />
            <Route path="/protocol_handler" element={<Protocol_handler />} />
            <Route path="/:ticker" element={<Network />} />
            <Route
              path="/:ticker/receive"
              element={<Network defaultReceiveVisible={true} />}
            />
            <Route path="/:ticker/send" element={<Send />} />
            <Route path="/:ticker/representative" element={<ChangeRep />} />
          </Routes>
          <Settings isNavOpen={isNavOpen} setNavOpen={setNavOpen} />
        </div>
        <MenuBar />
      </Router>
    </>
  );
}

// oh btw, I'm a big fan of Adam Young's music. I can't believe I got here already! :D
// PS: I completed other stuff quite early than expected.
// PPS: try listening to All Things Bright and Beautiful album.
