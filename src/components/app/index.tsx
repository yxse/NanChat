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
  AiOutlineWallet,
} from "react-icons/ai";
import { BiHistory, BiReceipt, BiSolidDashboard, BiWallet } from "react-icons/bi";
import Settings from "../Settings";

import Home from "./Home";
import Art from "./Art";
import Swap from "./Swap";
import History from "./History";
import Network, { ModalReceive } from "./Network";
import { Badge, CapsuleTabs, Popup, reduceMotion, SafeArea, SideBar, TabBar, Toast } from "antd-mobile";
import Send from "./Send";
import Protocol_handler from "./protocol_handler";
import Sign from "../../api-invoke/Sign";
import { SlArrowDownCircle, SlArrowUpCircle } from "react-icons/sl";
import ReceiveSelect from "./ReceiveSelect";
import NetworkList from "./NetworksList";
import SwapTransaction from "./SwapTransaction";
import InitialPopup, { useWallet } from "../Popup";
import ChangeRep from "./ChangeRep";
import AddNetwork from "./AddNetwork";
import { networks } from "../../utils/networks";
import { FaExchangeAlt } from "react-icons/fa";
import { CiSettings } from "react-icons/ci";
import {AppstoreOutline, BellOutline, CompassOutline, LoopOutline, MessageOutline, SetOutline, UserContactOutline, UserOutline} from "antd-mobile-icons";
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
import SetUsername from "../messaging/components/profile/SetUsername";
import AppUrlListener from "./AppUrlListener";
import Buy from "./Buy";
import ChatSocket from "../messaging/socket";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";
import NotificationSettings from "./NotificationSettings";
import { authenticate } from "../../utils/biometrics";
import { getIsPasswordEncrypted, getSeed } from "../../utils/storage";
import useSWR from "swr";
import { fetcherChat, getNewChatToken } from "../messaging/fetcher";
import { useUnreadCount } from "../messaging/hooks/useChat";
import FileManagement from '../FileManagement';
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { getToken } from "../../nano/notifications";
import { box, wallet } from "multi-nano-web";
import { ShareExtension } from 'capacitor-share-extension';
import { getSharedKey } from "../../services/sharedkey";
import { SeedVerifiedBadge } from "../messaging/utils";
import BlockedChats from "./BlockedChats";
import SwapHistory from "./SwapHistory";
import { useTranslation } from 'react-i18next';

// reduceMotion()









export const MenuBar = () => {
  const { t } = useTranslation();
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
    backgroundColor: 'var(--adm-color-background)',
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
  const unreadCount = useUnreadCount();
  const tabs = [
    {
      key: "chat",
      title: t('chats'),
      icon: <Badge content={unreadCount}><MessageOutline size={btnSize} /></Badge>,
    },
    {
      key: "contacts",
      title: t('contacts'),
      icon: <UserContactOutline size={btnSize} />
    },
    {
      key: "wallet",
      title: t('wallets'),
      icon: <AiOutlineWallet size={btnSize} />,
    },
    // {
    //   key: "swap",
    //   title: "",
    //   icon: swapBtn,
    // },
    {
      key: "discover",
      title: t('discover'),
      icon: <CompassOutline size={btnSize} />,
    },
    
    {
      key: "me",
      title: t('me'),
      icon: <SeedVerifiedBadge count={1} icon={true}><UserOutline size={btnSize} /></SeedVerifiedBadge>
    },
    // {
    //   key: "settings",
    //   title: t('settings'),
    //   icon: <SetOutline size={btnSize} />
    // },
  ];
  let style = {position: "fixed", bottom: 0, width: "100%", paddingBottom: 16};

  let positionPopup = "right";
  return (
    <>
      <TabBar
      safeArea={false} // we use the custom var(--safe-area-inset-bottom) injected in MainActivity.java to fix --safe-area-inset-bottom bug from android webview in edge to edge mode
      // safeArea={true}
      // style={style}
      style={{
        userSelect: "none",
        "WebkitUserSelect": "none",
        "MozUserSelect": "none",
        "msUserSelect": "none",
        "marginBottom": "var(--safe-area-inset-bottom)"
      }}
        className={"bottom"}
        activeKey={location.pathname.split("/")[1] || "chat"}
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
          else if (key === "me") {
            navigate("/me");
            return
          }
          else if (key === "swap") {
            setVisible(true);
            setAction("swap");
            return
          }
          else if (key === "contacts") {
            navigate("/contacts");
            return
          }
          else if (key === "chat") {
            navigate("/chat");
            return
          }
          else if (key === "wallet") {
            navigate("/wallet");
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
      destroyOnClose
      position={"bottom"}
      // closeOnSwipe
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
function SafeAreaWrapper({ children, callback }) {
  const location = useLocation();
  const navigate = useNavigate();

  async function checkIntent() {
  try {
      const result: any = await ShareExtension.checkSendIntentReceived();
      /* sample result::
      { payload: [
          {
              "type":"image%2Fjpg",
              "description":"",
              "title":"IMG_0002.JPG",
              // url contains a full, platform-specific file URL that can be read later using the Filsystem API.
              "url":"file%3A%2F%2F%2FUsers%2Fcalvinho%2FLibrary%2FDeveloper%2FCoreSimulator%2FDevices%2FE4C13502-3A0B-4DF4-98ED-9F31DDF03672%2Fdata%2FContainers%2FShared%2FAppGroup%2FF41DC1F5-54D7-4EC5-9785-5248BAE06588%2FIMG_0002.JPG",
              // webPath returns a path that can be used to set the src attribute of an image for efficient loading and rendering.
              "webPath":"capacitor%3A%2F%2Flocalhost%2F_capacitor_file_%2FUsers%2Fcalvinho%2FLibrary%2FDeveloper%2FCoreSimulator%2FDevices%2FE4C13502-3A0B-4DF4-98ED-9F31DDF03672%2Fdata%2FContainers%2FShared%2FAppGroup%2FF41DC1F5-54D7-4EC5-9785-5248BAE06588%2FIMG_0002.JPG",
          }]
       } 
       */
      if (Capacitor.getPlatform() == "android" && result && result.payload && result.payload.length) {
        const contactsFileName = ["natriumcontacts_", "kaliumcontacts_"];
        const title = result.payload?.[0]?.title
        if (title && contactsFileName.find((name) => title.startsWith(name))){
        let json = JSON.stringify(result)
          console.log('Import contact Intent received: ', json);
          navigate('/contacts?import_url=' + decodeURIComponent(result.payload[0]?.url))
        }
      }
  } catch (err) {
      console.log(err);
  }
}

  useEffect(() => {
if (Capacitor.isPluginAvailable('ShareExtension')) {
  window.addEventListener('sendIntentReceived',  () => {
      checkIntent(); // to handle import contact
  });
  checkIntent();
}

    console.log("callback", callback);
    if (callback) {
      navigate(callback.callback);
      return;
    }
  }
  , [callback]);
  return (
    <>
      <div
      style={{
        "paddingTop": "var(--safe-area-inset-top)",
        backgroundColor: 
          location.pathname.startsWith("/wallet") ?
          "var(--main-background-color)" :
          "var(--adm-color-background)" 
      }}
      >
    </div>
      {children}
    </>
  );
}
export default function App({callback}) {
  const [widget, setWidget] = useState<
    "home" | "art" | "swap" | "history" | "network"
  >("home");
  const [isNavOpen, setNavOpen] = useState<boolean>(false);
  const { isMobile, isTablet } = useWindowDimensions();
  const {activeAccount, activeAccountPk} = useWallet();
  

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
        getIsPasswordEncrypted().then((isPasswordEncrypted) => {
          if (isPasswordEncrypted) { // no need to lock wallet if no password is set
            Toast.show("Locking wallet due to inactivity");
            window.location.reload();
          }
        });
      }
    }, [timeSinceLastActivity]);
    
    
    return (<></>);
    }
  
    const {data: newNetworks, isLoading: isLoadingNewNetworks} = useSWR("/networks", fetcherChat); // dynamic add networks
    if (newNetworks) {
      let newNetworksToAdd = {}
      let numberOfNewNetworks = 0
      for (let ticker in newNetworks) {
        if (!networks[ticker]) {
          let newNetworksLs = JSON.parse(localStorage.getItem("newNetworks"))
          if (!newNetworksLs?.[ticker]) {
            newNetworksToAdd[ticker] = newNetworks[ticker]
            numberOfNewNetworks++
          }
        }
      }
     
      if (numberOfNewNetworks > 0) {
        // localStorage.setItem("newNetworks", JSON.stringify(newNetworksToAdd))
        // setCustomNetworks({...customNetworks, ...newNetworksToAdd})
        for (let ticker in newNetworksToAdd) {
         networks[ticker] = newNetworksToAdd[ticker]
        }
        // Toast.show({
        //   content: `Restart NanChat to add ${numberOfNewNetworks} new network${numberOfNewNetworks > 1 ? "s" : ""}`,
        //   duration: 7000
        // })
      }
    }
    console.log("index render")
    useEffect(() => {
      if (activeAccount){
        // getNewChatToken(activeAccount, activeAccountPk).then((r) => {
        //   console.log("got new chat token", r);
        // })
      }
    }
    , [activeAccount, activeAccountPk]);

  return (
    <>
    <LockAfterInactivity />
      {/* <PWAInstallComponent   /> */}
      <div className="app">
      
      <ReloadPrompt />
      <Router>
      <SafeAreaWrapper callback={callback}>
      <ChatSocket />
        <div className="w-full body " 
        // style={{overflow: 'auto'}}
        style={
          {overflow: 'auto', display: "flex"}
        }
        >
        {
          (!isMobile && !isTablet) && 
          <div style={{flex: "none", position: "sticky", top: 0}}>
            <SideBarMenu />
          </div>
        }
        <div style={{flex: 1}}>
          {/** main content */}
            <AppUrlListener />
          <Routes>
            <Route path="/wallet" element={<Home
            // setAction={setAction}
            
             />} />
            {/* <Route path="/settings" element={<Settings isNavOpen={true} setNavOpen={setNavOpen} />} /> */}
            <Route path="/settings/security" element={<SecuritySettings />} />
            <Route path="/settings/notification" element={<NotificationSettings />} />
            <Route path="/settings/alias" element={<NanoAlias />} />
            <Route path="/settings/security/developer" element={<DeveloperSettings />} />
            <Route path="/settings/security/blocked" element={<BlockedChats />} />
            <Route path="/buy" element={<Buy />} />
            <Route path="/swap" element={<SwapHistory />} />
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
            <Route  path="/me" element={<ProfileHome />} />
            <Route  path="/me/settings" element={<Settings />} />
            {/* <Route  path="/settings" element={<Settings />} /> */}
            <Route  path="/profile/pfp" element={<ProfilePictureUpload />} />
            <Route  path="/profile/name" element={<SetName />} />
            <Route  path="/profile/username" element={<SetUsername />} />
            <Route path="/files" element={<FileManagement />} />
            <Route  path="/chat/*" element={<Chat />} />
            <Route  path="/*" element={<Chat />} />
          </Routes>
          </div>
          {/* <Settings isNavOpen={isNavOpen} setNavOpen={setNavOpen} /> */}
        </div>
        {
          (isMobile || isTablet) && <MenuBar />
        }
        {/* <MenuBar /> */}
        {/* <SafeArea style={{
          backgroundColor: 
            location.pathname.startsWith("/chat") ?
            "var(--main-background-color)"
             : "var(--adm-color-background)"
        }} position="bottom" /> */}
      </SafeAreaWrapper>
      </Router>
      </div>
    </>
  );
}

// oh btw, I'm a big fan of Adam Young's music. I can't believe I got here already! :D
// PS: I completed other stuff quite early than expected.
// PPS: try listening to All Things Bright and Beautiful album.
