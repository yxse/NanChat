import { useState } from "react";
import {
    useNavigate, useLocation, useParams
} from "react-router-dom";
import {
  AiOutlineArrowDown,
  AiOutlineArrowUp,
    AiOutlineHome,
    AiOutlineRetweet,
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
import { useTranslation } from 'react-i18next';


export const ButtonActionCircle = ({title, icon, onClick}) => {
  return <div 
  style={{
    width: 60,
  }}
  className="flex flex-col items-center cursor-pointer" onClick={() => {
    // navigate("/swap?from=" + ticker);
  }}
  ><Button 
  size="large"
// shape="rounded"
                      // {...onLongPress}
                      style={{
                        userSelect: "none",
                        "WebkitUserSelect": "none",
                        "MozUserSelect": "none",
                        "msUserSelect": "none",
                        "borderRadius": "12px",      
                      }}
                      onClick={() => {
                        HapticsImpact({
                          style: ImpactStyle.Medium
                        });
                        onClick();
                      }}
                      className=" ">
                         {icon}
                      </Button>


  <span 
  style={{
    minWidth: 60,
    maxWidth: 70,
    textAlign: "center",
    wordBreak: "break-word",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }}
  className="mt-1 text-sm">{title}</span>
</div>
}

export const SendReceive = () => {
    const navigate = useNavigate();
    const {ticker}= useParams();
    const location = useLocation();
    const [visible, setVisible] = useState<boolean>(false);
    const [action, setAction] = useState<"receive" | "send" | "swap">("receive");
    const {isMobile} = useWindowDimensions()
    const { t } = useTranslation();

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
          <div className="mb-4" style={{
            display: "flex",
            justifyContent: "space-evenly",
            maxWidth: "325px",
            marginRight: "auto",
            marginLeft: "auto",
          }}>
                    <ButtonActionCircle
                    title={t('receive')}
                    icon={<AiOutlineArrowDown size={22} />}
                    onClick={() => {
                      showAction('receive');
                    }}
                    />
                    <ButtonActionCircle
                    title={t('send')}
                    icon={<AiOutlineArrowUp size={22} />}
                    onClick={() => {
                      showAction('send');
                    }}
                    />
                    {(Capacitor.getPlatform() === "web" || !lowBalanceUsd) && 
                    <ButtonActionCircle
                    title={t('swap')}
                    icon={<AiOutlineRetweet size={22} />}
                    onClick={() => {
                      setAction('swap');
                      setVisible(true);
                    }}
                    />}
                    {(Capacitor.getPlatform() !== "ios") && 
                    <ButtonActionCircle
                    title={t('buy')}
                    icon={<GoCreditCard size={22} />}
                    onClick={() => {
                      setAction('buy');
                      setVisible(true);
                    }}
                    />}
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
              action === "receive" ? t('receive') : t('send')
            }</div>
          </div>
          <div style={{maxHeight: "50vh", overflowY: "auto"}}>
          <NetworkList 
          hideZeroBalance={action === "send"}
          hidePrice={true} onClick={(ticker, action) => {
            if (action === 'buy') {
              setAction(action);
            }
            // navigate(ticker + "/" + action);
            setVisible(false);
            setActiveTicker(ticker);
          }} /></div></div>
        }
        </Popup>
      </>
    );
  };