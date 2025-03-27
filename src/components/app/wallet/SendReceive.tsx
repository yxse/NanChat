import { useState } from "react";
import {
    useNavigate, useLocation, useParams
} from "react-router-dom";
import {
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
          
      <div className="flex items-center justify-center gap-5 mb-5 mx-2">
   
        <Button
        onClick={() => {
            showAction("receive");
            HapticsImpact({
              style: ImpactStyle.Medium
          });
        }}
        style={{width: "50%"}}
            type="button"
            shape="rounded"
            size="large"
          >
            Receive
          </Button>

          <Button
          onClick={() => {
            showAction("send");
            HapticsImpact({
              style: ImpactStyle.Medium
          });
          }}
          style={{width: "50%"}}
            type="button"
            shape="rounded"
            size="large"
          >
            Send
          </Button>
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
        </Popup>
      </>
    );
  };