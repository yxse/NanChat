import { SideBar } from "antd-mobile";
import { CompassOutline, MessageOutline, SetOutline, UserOutline } from "antd-mobile-icons";
import { useState } from "react";
import { AiOutlineHome } from "react-icons/ai";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import useLocalStorageState from "use-local-storage-state";
import { networks } from "../../../utils/networks";

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

    const tabs = [
      {
        key: "",
        title: "Home",
        icon: <AiOutlineHome size={btnSize} />,
      },
      {
        key: "chat",
        title: "Chat",
        icon: <MessageOutline size={btnSize} />,
      },
      {
        key: "discover",
        title: "Discover",
        icon: <CompassOutline size={btnSize} />,
      },
      {
        key: "profile",
        title: "Profile",
        icon: <UserOutline size={btnSize} />,
      },
      {
        key: "settings",
        title: "Settings",
        icon: <SetOutline size={btnSize} />
      }
    ];
    return (
      <>
        <SideBar
        // style={style}
        style={{width: 200, fontSize: "1.3em"}}
          className={""}
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
            else if (key === "profile") {
              navigate("/profile");
              return
            }
            else if (key === "chat") {
              navigate("/chat");
              return
            }
            else if (key === "settings") {
              navigate("/settings");
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
            <SideBar.Item title={<div style={{display: "flex", alignItems: "center", gap: 8}}>
              {tab.icon}  {tab.title}
            </div>} key={tab.key} />
          ))}
        </SideBar>
      </>
    );
  };