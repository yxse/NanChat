// You would not believe your eyes..

import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  Link,
  useLocation,
  useSearchParams,
  useParams,
} from "react-router-dom";
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
// when using `"withGlobalTauri": true`, you may use
// const { onOpenUrl } = window.__TAURI__.deepLink;


import { FaBars, FaBarsStaggered } from "react-icons/fa6";
import "../../styles/app.css";
import {
  AiFillDollarCircle,
  AiFillWallet,
  AiOutlineGlobal,
  AiOutlineHome,
  AiOutlineSwap,
} from "react-icons/ai";
import { BiHistory, BiReceipt, BiSolidDashboard, BiWallet } from "react-icons/bi";
import Settings from "../Settings";

import Home from "./Home";
import Art from "./Art";
import Swap from "./Swap";
import History from "./History";
import Network, { ModalReceive } from "./Network";
import { Badge, CapsuleTabs, Popup, SafeArea, SideBar, TabBar, Toast } from "antd-mobile";
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
import { networks } from "../../utils/networks";
import { FaExchangeAlt } from "react-icons/fa";
import { CiSettings } from "react-icons/ci";
import {AppstoreOutline, BellOutline, CompassOutline, LoopOutline, MessageOutline, SetOutline, UserOutline} from "antd-mobile-icons";
import Contacts from "./Contacts";
import PWAInstall from "@khmyznikov/pwa-install/react-legacy";
import PWAInstallComponent from "../PWAInstallComponent";
import useLocalStorageState from "use-local-storage-state";
import SecuritySettings from "./SecuritySettings";
import { useWindowDimensions } from "../../hooks/use-windows-dimensions";
import DeveloperSettings from "./DeveloperSettings";
import NanoAlias from "./NanoAlias";
import { IoWalletOutline } from "react-icons/io5";
import Messaging from "../messaging/Messaging";
import ChatRoom from "../messaging/components/ChatRoom";
import Chat from "../messaging/components/Chat";
import ReloadPrompt from "./ReloadPrompt/ReloadPrompt";
import { Discover } from "./discover/Discover";
import SetName from "../messaging/components/SetName";
import ProfilePictureUpload from "../messaging/components/profile/upload-pfp";
import ProfileHome from "../messaging/components/profile/ProfileHome";
import { SideBarMenu } from "./desktop/SideBarMenu";
// import SetUsername from "../messaging/components/profile/SetUsername";
import AppUrlListener from "./AppUrlListener";
import Buy from "./Buy";
import ChatSocket from "../messaging/socket";

export const MenuBar = () => {
  const navigate = useNavigate();
  const {ticker}= useParams();
  const location = useLocation();
  const [visible, setVisible] = useState<boolean>(false);
  const [action, setAction] = useState<"receive" | "send" | "swap">("receive");

  const [activeTicker, setActiveTicker] = useState<string>(null);

  const [hiddenNetworks, setHiddenNetworks] = useLocalStorageState("hiddenNetworks", []);
  const [customNetworks, setCustomNetworks] = useLocalStorageState("customNetworks", {});
  const activeMainNetworks = Object.keys(networks).filter((ticker) => !networks[ticker].custom && !hiddenNetworks?.includes(ticker));
  const activeCustomNetworks = customNetworks ? Object.keys(customNetworks).filter((ticker) => !hiddenNetworks.includes(ticker)) : [];

  


  let swapBtn = <div 
  className="swap-btn"
  style={{marginBottom: 32}}>
    {/* <LoopOutline fontSize={32}  fontWeight={0} */}
    <AiOutlineSwap 
    fontSize={36}  
    style={{
    // color: '#000034',
    // color: '#ccc',
    // backgroundColor: '#4A90E2',
    backgroundColor: '#1677ff',
    // boxShadow: "0 0 0 4px #4A90E2",
    // color: '#4A90E2',
    // backgroundColor: '#000034',
    // boxShadow: "0 0 0 2px #000034",
    // boxShadow: "0 0 0 2px #aaa",
    // border: "1px solid #aaa",
    borderRadius: "100%",
    padding: 4,
    
    
  }}
    /></div>
  let btnSize = 22
  let fontSize = 22

  const tabs = [
    {
      key: "",
      title: "Home",
      icon: <AiOutlineHome size={btnSize} />,
    },
    {
      key: "chat",
      title: "Chats",
      icon: <MessageOutline size={btnSize} />,
    },
    {
      key: "swap",
      title: "",
      icon: swapBtn,
    },
    {
      key: "discover",
      title: "Discover",
      icon: <CompassOutline size={btnSize} />,
    },
    {
      key: "settings",
      title: "Settings",
      icon: <SetOutline size={btnSize} />
    },
  ];
  let style = {position: "fixed", bottom: 0, width: "100%", paddingBottom: 16};

  let positionPopup = "right";
  return (
    <>
      <TabBar
      safeArea={false}
      // style={style}
        className={"bottom"}
        activeKey={location.pathname.split("/")[1]}
        onChange={(key) => {
          console.log(location.pathname);
          // setWidget(key);
          setVisible(false);
          if (key === "receive") {
            // console.log(location.pathname.split("/"));
            // if (networks[location.pathname.split("/")[1]]) {
            //   navigate(location.pathname.split("/")[1] + "/receive");
            //   return;
            // }
            if (activeMainNetworks.length + activeCustomNetworks.length === 1) {
              let ticker = activeMainNetworks.length > 0 ? activeMainNetworks[0] : activeCustomNetworks[0];
              setActiveTicker(ticker);
            }
            else{
              setVisible(true);
            }
            setAction("receive");
            return
          }
          else if (key === "discover") {
            navigate("/discover");
            return
          }
          else if (key === "settings") {
            navigate("/settings");
            return
          }
          else if (key === "swap") {
            setVisible(true);
            setAction("swap");
            return
          }
          else if (key === "chat") {
            navigate("/chat");
            return
          }
          else if (key === "") {
            navigate("/");
            return
          }
          // navigate(key);
        }}
      >
        {tabs.map((tab) => (
          <TabBar.Item title={tab.title} key={tab.key} icon={tab.icon} style={tab.key === "swap" ? {marginBottom: 20} : {}} />
        ))}
      </TabBar>
        
      <ModalReceive
      onClose={() => {
        setVisible(false);
        setActiveTicker(null);
      }}
       action={action} ticker={activeTicker} modalVisible={activeTicker} setModalVisible={setVisible} setAction={setAction} />
      <Popup
      position={"bottom"}
      closeOnSwipe
        visible={visible}
        onClose={() => {
          setVisible(false);
        }}
        // onClick={() => setVisible(false)}
        closeOnMaskClick={true}
      >
        {action !== "swap" && <div>
        <div>
          <div className="text-2xl  text-center p-2">{
            action === "receive" ? "Receive" : "Send"
          }</div>
        </div>
        <NetworkList hidePrice={true} onClick={(ticker) => {
          // navigate(ticker + "/" + action);
          setVisible(false);
          setActiveTicker(ticker);
        }} /></div>}
         { action === 'swap' && <Swap 
onSuccess={() => {
  Toast.show({icon: 'success'})
  setVisible(false);
  window.scrollTo(0, 0);
}}
hideHistory={true} defaultFrom={ticker} defaultTo={"BAN"} />}
      </Popup>
    </>
  );
};

export default function App() {
  const [widget, setWidget] = useState<
    "home" | "art" | "swap" | "history" | "network"
  >("home");
  const [isNavOpen, setNavOpen] = useState<boolean>(false);
  const { isMobile } = useWindowDimensions();

  

  

  const LockAfterInactivity = () => {
    const [timeSinceLastActivity, setTimeSinceLastActivity] = useState(0);
    const [lockTimeSeconds, setLockTimeSeconds] = useLocalStorageState("lock-after-inactivity", {defaultValue: 
      60 * 30 // 30 minutes
    });
    const handleActivity = () => {
      setTimeSinceLastActivity(0);
    };

    useEffect(() => {
      // const myworker = new Worker(new URL("./src/service-worker.js", import.meta.url));
     

      const interval = setInterval(() => {
          setTimeSinceLastActivity((prev) => prev + 1);
      }, 1000);

      return () => clearInterval(interval);
    }, []);

    useEffect(() => {
      window.addEventListener("mousemove", handleActivity);
      window.addEventListener("touchstart", handleActivity);

      return () => {
        window.removeEventListener("mousemove", handleActivity);
        window.removeEventListener("touchstart", handleActivity);
      };
    }, []);

    useEffect(() => {
      if (timeSinceLastActivity > lockTimeSeconds && lockTimeSeconds !== -1) {
        Toast.show("Locking wallet due to inactivity");
        window.location.reload();
      }
    }, [timeSinceLastActivity]);
    
    useEffect(() => {
      
    }
    , []);
    return (<></>);
    }
  

    console.log("index render")
  return (
    <>
    <LockAfterInactivity />
      {/* <PWAInstallComponent   /> */}
      <div className="app">
      
      <section className="app-navbar hidden">
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
              Nanswap Wallet
            </span>
          )}
          {widget == "network" && (
            <span className="text-slate-400 text-md select-none cursor-pointer">
              Manage Network
            </span>
          )}
        </div>
        {/* <div
            className="text-slate-400 "
            onClick={() => setNavOpen(!isNavOpen)}
          >
              <BellOutline fontSize={18}  />
          </div> */}
          
      </section>
      <ReloadPrompt />
      <SafeArea position="top" style={{backgroundColor: "rgb(16, 16, 24)"}} />
      <Router>
      <ChatSocket />
        <div className="w-full body " 
        // style={{overflow: 'auto'}}
        style={
          {overflow: 'auto', display: "flex"}
        }
        >
        {
          !isMobile && 
          <div style={{flex: "none"}}>
            <SideBarMenu />
          </div>
        }
        <div style={{flex: 1}}>
          {/** main content */}
            <AppUrlListener />
          <Routes>
            <Route path="/" element={<Home
            // setAction={setAction}
            
             />} />
            {/* <Route path="/settings" element={<Settings isNavOpen={true} setNavOpen={setNavOpen} />} /> */}
            <Route path="/settings/security" element={<SecuritySettings />} />
            <Route path="/settings/alias" element={<NanoAlias />} />
            <Route path="/settings/security/developer" element={<DeveloperSettings />} />
            <Route path="/buy" element={<Buy />} />
            <Route path="/swap" element={<Swap />} />
            <Route path="/swap/:id" element={<SwapTransaction />} />
            <Route path="/history" element={<History />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/add-network" element={<AddNetwork />} />
            <Route path="/sign" element={<Sign />} />
            <Route path="/art" element={<Art />} />
            <Route path="/protocol_handler" element={<Protocol_handler />} />
            <Route path="/:ticker" element={<Network defaultReceiveVisible={false}/>} />
            <Route
              path="/:ticker/receive"
              element={<Network defaultReceiveVisible={true} defaultAction="receive" />} />
            <Route path="/:ticker/send" element={<Network defaultReceiveVisible={true} defaultAction="send" />} />
            <Route path="/:ticker/representative" element={<ChangeRep />} />
            {/* <Route path="/messages" element={<Messaging />} />
            <Route path="/messages/:account" element={<ChatRoom />} />
            <Route path="/messages/g/:roomId" element={<Messaging />} /> */}
            <Route path="/discover" element={<Discover />} />
            <Route  path="/settings" element={<ProfileHome />} />
            <Route  path="/profile/pfp" element={<ProfilePictureUpload />} />
            <Route  path="/profile/name" element={<SetName />} />
            {/* <Route  path="/profile/username" element={<SetUsername />} /> */}
            <Route  path="/chat/*" element={<Chat />} />
          </Routes>
          </div>
          {/* <Settings isNavOpen={isNavOpen} setNavOpen={setNavOpen} /> */}
        </div>
        {
          isMobile && <MenuBar />
        }
        {/* <MenuBar /> */}
        <SafeArea position="bottom" />
      </Router>
      </div>
    </>
  );
}

// oh btw, I'm a big fan of Adam Young's music. I can't believe I got here already! :D
// PS: I completed other stuff quite early than expected.
// PPS: try listening to All Things Bright and Beautiful album.
