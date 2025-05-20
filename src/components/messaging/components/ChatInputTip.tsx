import { GiftOutline, MessageOutline, PhoneFill, ReceivePaymentOutline, SendOutline } from "antd-mobile-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { BiChevronLeft, BiMessageSquare } from "react-icons/bi";
import { FiMoreHorizontal } from "react-icons/fi";
import { IoSendOutline } from "react-icons/io5";
import { useNavigate, useParams } from "react-router-dom";
import { socket } from "../socket";
import { WalletContext } from "../../Popup";
import { convertAddress, formatAddress } from "../../../utils/format";
import { CopyToClipboard, ResponsivePopup } from "../../Settings";
import SelectAccount from "../../app/SelectAccount";
import { AccountIcon } from "../../app/Home";
import { Button, DotLoading, Input, List, Modal, Popup, TextArea, Toast } from "antd-mobile";
import useSWR from "swr";
import { fetcherMessages, fetcherMessagesPost } from "../fetcher";
import { box } from "multi-nano-web";
import { SlArrowUpCircle } from "react-icons/sl";
import { FaArrowUp } from "react-icons/fa6";
import { useChat } from "../hooks/useChat";
import Send from "../../app/Send";
import { AiOutlineDollar, AiOutlineDollarCircle, AiOutlineSwap } from "react-icons/ai";
import NetworkList from "../../app/NetworksList";
import useLocalStorageState from "use-local-storage-state";
import { networks } from "../../../utils/networks";
import NewChatPopup, { SelectParticipant } from "./NewChatPopup";
import Swap from "../../app/Swap";

const ChatInputTip: React.FC<{ toAddress, onTipSent, mode }> = ({ toAddress, onTipSent, mode="button", filterTickers =[], type="transfer", chat }) => {
    const [visible, setVisible] = useState(false);
    const [visibleSelectAccount, setVisibleSelectAccount] = useState(false);
    const [visibleSend, setVisibleSend] = useState(false);
    const [destinationAddress, setDestinationAddress] = useState(toAddress);
    const [activeTicker, setActiveTicker] = useState<string>(null);
    const [hiddenNetworks, setHiddenNetworks] = useLocalStorageState("hiddenNetworks", []);
    const [customNetworks, setCustomNetworks] = useLocalStorageState("customNetworks", {});
    const activeMainNetworks = Object.keys(networks).filter((ticker) => !networks[ticker].custom && !hiddenNetworks?.includes(ticker));
    const activeCustomNetworks = customNetworks ? Object.keys(customNetworks).filter((ticker) => !hiddenNetworks.includes(ticker)) : [];
    const onClick = () => {
      if (activeMainNetworks.length + activeCustomNetworks.length === 1) {  // directly show the action if only one active network
        let ticker = activeMainNetworks.length > 0 ? activeMainNetworks[0] : activeCustomNetworks[0];
        setActiveTicker(ticker);
        if (toAddress === undefined){
          setVisibleSelectAccount(true);
        }
        else{
          setVisibleSend(true);
        }
        }
        else{
        setVisible(true);
        }
    }
    const ButtonTransfer = () => {
      return <div
      style={{textAlign: 'center'}}>
        <Button
        style={{borderRadius: 12}}
        size='large'
        onClick={() => {
          onClick();
        }}>
        <div style={{fontSize: 34}}>
        <AiOutlineSwap />
        </div>
        </Button>
        <div className='mt-2'>
        Transfer
        </div>
        </div>
    }
    const ButtonAirdrop = () => {
      return <div
      style={{textAlign: 'center'}}>
        <Button
        style={{borderRadius: 12}}
        size='large'
        onClick={() => {
          onClick();
        }}>
        <div style={{fontSize: 34}}>
        <GiftOutline />
        </div>
        </Button>
        <div className='mt-2'>
        Airdrop
        </div>
        </div>
    }
    const ButtonListTransfer = () => {
      return <List.Item
        onClick={() => {
          onClick();
        }}
        >
          <div className="">
          <AiOutlineSwap style={{display: "inline", marginRight: 8}} />
           Transfer
          </div>
        </List.Item>
    }
    console.log("tip rendered")
    return (
        <>
       {
        mode === "button" ? 
        type === "transfer" ? <ButtonTransfer /> : type === "airdrop" ? <ButtonAirdrop /> : null
        :
        <ButtonListTransfer />
       }
        <ResponsivePopup
        bodyClassName="disable-keyboard-resize"
        destroyOnClose={true}
        visible={visibleSend && destinationAddress}
        onClose={() => {
            setVisibleSend(false)
            setActiveTicker(null)
            setDestinationAddress(undefined)
        }}
        closeOnMaskClick={true}
        showCloseButton={true}
        >
            {
                activeTicker && destinationAddress && 
            <Send 
            hideAddress={true}
            onClose={() => {
                setVisible(false)
                setActiveTicker(null)
                setVisibleSend(false)
            }}
            ticker={activeTicker} defaultAddress={
              convertAddress(destinationAddress, activeTicker)
            } onSent={(ticker, hash) => {
                onTipSent(ticker, hash, destinationAddress);
                setVisible(false)
            }} />
        }
        </ResponsivePopup>
        <ResponsivePopup
        position={"bottom"}
        closeOnSwipe
          visible={visible}
          onClose={() => {
            setVisible(false);
          }}
          // onClick={() => setVisible(false)}
          closeOnMaskClick={true}
        >
          <div>
          <div>
            <div className="text-2xl  text-center p-2">{
              "Transfer"
            }</div>
          </div>
          <div style={{maxHeight: "50vh", overflowY: "auto"}}>
          <NetworkList
          hideZeroBalance
          filterTickers={filterTickers}
           hidePrice={true} onClick={(ticker, action) => {
            if (action === 'buy') {
              return
            }
            // navigate(ticker + "/" + action);
            setActiveTicker(ticker);
            setVisible(false);
            if (toAddress === undefined){
              setVisibleSelectAccount(true);
            }
            else{
              setVisibleSend(true);
            }
          }} /></div>
          </div>
        </ResponsivePopup>
      
          <SelectParticipant
          onClose={() => {
            setVisibleSelectAccount(false);
            setDestinationAddress(undefined);
          }}
          participants={chat?.participants}
          setVisible={setVisibleSelectAccount}
          visible={visibleSelectAccount}
          onAccountSelect={(account) => {
            setDestinationAddress(account);
            setVisibleSend(true);
            setVisibleSelectAccount(false);
          }} />

        </>
    );
  };

export default ChatInputTip;