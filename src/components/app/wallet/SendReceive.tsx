import { useState } from "react";
import {
    useNavigate, useLocation, useParams
} from "react-router-dom";
import {
  AiOutlineArrowDown,
  AiOutlineArrowUp,
    AiOutlineHome,
    AiOutlineSwap
} from "react-icons/ai";

import { Button, Popup, TabBar, Toast } from "antd-mobile";
import { networks } from "../../../utils/networks";
import { CompassOutline, MessageOutline, UserOutline } from "antd-mobile-icons";
import useLocalStorageState from "use-local-storage-state";
import { ModalReceive } from "../Network";
import Swap from "../Swap";
import NetworkList from "../NetworksList";
import { useWindowDimensions } from "../../../hooks/use-windows-dimensions";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { HapticsImpact } from "../../../utils/haptic";
import { Capacitor } from "@capacitor/core";
import { GoCreditCard } from "react-icons/go";
import { useWalletBalance } from "../../../hooks/use-wallet-balance";


export const SendReceive = () => {
    const navigate = useNavigate();
    const {ticker}= useParams();
    const location = useLocation();
    const [visible, setVisible] = useState<boolean>(false);
    const [action, setAction] = useState<"receive" | "send" | "swap">("receive");
    const {isMobile} = useWindowDimensions()

    const [activeTicker, setActiveTicker] = useState<string>(null);
  
    const [hiddenNetworks, setHiddenNetworks] = useLocalStorageState("hiddenNetworks", []);
    const [customNetworks, setCustomNetworks] = useLocalStorageState("customNetworks", {});
    const activeMainNetworks = Object.keys(networks).filter((ticker) => !networks[ticker].custom && !hiddenNetworks?.includes(ticker));
    const activeCustomNetworks = customNetworks ? Object.keys(customNetworks).filter((ticker) => !hiddenNetworks.includes(ticker)) : [];
    const {lowBalanceUsd} = useWalletBalance()
    const showAction = (action: "receive" | "send") => {
        setAction(action);
        if (activeMainNetworks.length + activeCustomNetworks.length === 1) {  // directly show the action if only one active network
            let ticker = activeMainNetworks.length > 0 ? activeMainNetworks[0] : activeCustomNetworks[0];
            setActiveTicker(ticker);
        }
        else{
            setVisible(true);
        }
    }

    return (
      <>
         {
          isMobile && <>
          <div className="flex justify-center mb-4 space-x-4 ">
                  <div className="flex flex-col items-center cursor-pointer" onClick={() => {
                      // navigate("/swap?from=" + ticker);
                    }}
                    >
                      <Button 
                      onClick={() => {
                        HapticsImpact({
                          style: ImpactStyle.Medium
                        });
                        setAction('receive');
                        setVisible(true);
                      }}
                      className="py-2 px-2 rounded-full ">
                        <AiOutlineArrowDown size={22} />
                      </Button>
                      <span className="text-xs mt-1">Receive</span>
                    </div>
                    <div className="flex flex-col items-center cursor-pointer" onClick={() => {
                      // navigate("/swap?from=" + ticker);
                    }}
                    >
                      <Button 
                      // {...onLongPress}
                      style={{
                        userSelect: "none",
                        "WebkitUserSelect": "none",
                        "MozUserSelect": "none",
                        "msUserSelect": "none",
                        
                      }}
                      onClick={() => {
                        HapticsImpact({
                          style: ImpactStyle.Medium
                        });
                        setAction('send');
                        setVisible(true);
                      }}
                      className="py-2 px-2 rounded-full ">
                         <AiOutlineArrowUp size={22} />
                         {/* 📤 */}
                      </Button>
                      <span className="text-xs mt-1">Send</span>
                    </div>
                    {
          (Capacitor.getPlatform() === "web" || !lowBalanceUsd) && 
          <div className="flex flex-col items-center cursor-pointer" onClick={() => {
            // navigate("/swap?from=" + ticker);
          }}
          >
            <Button 
            onClick={() => {
              HapticsImpact({
                style: ImpactStyle.Medium
              });
              setAction('swap');
              setVisible(true);
            }}
            className="py-2 px-2 rounded-full ">
              <AiOutlineSwap size={22} />
            </Button>
            <span className="text-xs mt-1">Swap</span>
          </div>
            }
          {
            <div className="flex flex-col items-center cursor-pointer" onClick={() => {
              setAction('buy');
              setVisible(true);
            }}
            >
              <Button className="py-2 px-2 rounded-full ">
                <GoCreditCard size={22} className="" />
              </Button>
              <span className="text-xs mt-1">Buy</span>
            </div>
          }
                    </div>
      </>
        }
        <ModalReceive
        onClose={() => {
          setVisible(false);
          setActiveTicker(null);
        }}
         action={action} ticker={activeTicker} modalVisible={activeTicker} setModalVisible={setVisible} setAction={setAction} />
         
        <Popup
        position={"bottom"}
        // closeOnSwipe
          visible={visible}
          onClose={() => {
            setVisible(false);
          }}
          // onClick={() => setVisible(false)}
          closeOnMaskClick={true}
        >
            { (action === 'swap' || action === 'buy') ? <Swap 
           defaultAction={action}
           onSuccess={() => {
             Toast.show({icon: 'success'})
             setVisible(false);
             console.log("success swap")
             window.scrollTo(0, 0);
           }}
           hideHistory={true} 
           fiatDefaultTo={ticker}
           defaultTo={ticker === "XNO" ? "BAN" : ticker}
           defaultFrom={"XNO"} />
           : 
          
          <div           >
          <div>
            <div className="text-2xl  text-center p-2">{
              action === "receive" ? "Receive" : "Send"
            }</div>
          </div>
          <div style={{maxHeight: "50vh", overflowY: "auto"}}>
          <NetworkList hidePrice={true} onClick={(ticker) => {
            // navigate(ticker + "/" + action);
            setVisible(false);
            setActiveTicker(ticker);
          }} /></div></div>
        }
        </Popup>
      </>
    );
  };