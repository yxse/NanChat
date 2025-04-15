import { Badge, SideBar } from "antd-mobile";
import { CompassOutline, MessageFill, MessageOutline, SetOutline, UserOutline } from "antd-mobile-icons";
import { useState } from "react";
import { AiFillHome, AiOutlineHome, AiOutlineWallet } from "react-icons/ai";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import useLocalStorageState from "use-local-storage-state";
import { networks } from "../../../utils/networks";
import { useUnreadCount } from "../../messaging/hooks/useChat";
import { SeedVerifiedBadge } from "../../messaging/utils";


export const SideBarMenu = () => {
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
    let btnSize = 22
    const unreadCount = useUnreadCount();
    const tabs = [
      {
        key: "chat",
        title: "Chats",
        icon: <Badge content={unreadCount}><MessageFill size={btnSize} /></Badge>,
      },
      {
        key: "wallet",
        title: "Wallets",
        icon: <AiOutlineWallet size={btnSize} />,
      },
      {
        key: "discover",
        title: "Discover",
        icon: <CompassOutline size={btnSize} />,
      },
      // {
      //   key: "settings",
      //   title: "Settings",
      //   icon: <SetOutline size={btnSize} />
      // }
      {
        key: "me",
        title: <>Me<SeedVerifiedBadge size={btnSize} count={1} icon={false}/></>,
        icon: <UserOutline size={btnSize} />
      }
    ];
    return (
      <>
        <SideBar
        // style={style}
        style={{width: 200, fontSize: "1.3em"}}
          className={""}
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
            else if (key === "profile") {
              navigate("/profile");
              return
            }
            else if (key === "chat") {
              navigate("/chat");
              return
            }
            else if (key === "me") {
              navigate("/me");
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
            <SideBar.Item title={<div style={{display: "flex", alignItems: "center", gap: 8}}>
              {tab.icon}  {tab.title}
            </div>} key={tab.key} />
          ))}
        </SideBar>
      </>
    );
  };