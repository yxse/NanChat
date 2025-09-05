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
import nanoDrop from "../../../../public/icons/nano-drop.svg"
import { RiRedPacketFill, RiRedPacketLine } from "react-icons/ri";
import RedPacket from "../../app/redpacket/RedPacket";
import { useWindowDimensions } from "../../../hooks/use-windows-dimensions";
import { t } from "i18next";

const ButtonAirdrop = ({onClick}) => {
      return <div
      style={{textAlign: 'center'}}>
        <Button
        style={{borderRadius: 12}}
        size='large'
        onClick={() => {
          onClick();
        }}>
        <div style={{fontSize: 34}}>
          <RiRedPacketLine  />
{/* <img src={nanoDrop} width={50} /> */}

        </div>
        </Button>
        <div className='mt-2'>
        {t('redPacket')}
        </div>
        </div>
    }
const ChatInputRedPacket = ({ filterTickers =[], chat }) => {
    const [visible, setVisible] = useState(false);
    const [visibleSelectAccount, setVisibleSelectAccount] = useState(false);
    const [visibleSend, setVisibleSend] = useState(false);
    const [activeTicker, setActiveTicker] = useState<string>(null);
    const [hiddenNetworks, setHiddenNetworks] = useLocalStorageState("hiddenNetworks", []);
    const [customNetworks, setCustomNetworks] = useLocalStorageState("customNetworks", {});
    const navigate = useNavigate()
    const {isMobile, isTablet} = useWindowDimensions()
    const activeMainNetworks = Object.keys(networks).filter((ticker) => !networks[ticker].custom && !hiddenNetworks?.includes(ticker));
    const activeCustomNetworks = customNetworks ? Object.keys(customNetworks).filter((ticker) => !hiddenNetworks.includes(ticker)) : [];
    const onClick = () => {
      if (activeMainNetworks.length + activeCustomNetworks.length === 1) {  // directly show the action if only one active network
        let ticker = activeMainNetworks.length > 0 ? activeMainNetworks[0] : activeCustomNetworks[0];
        setActiveTicker(ticker);
          setVisibleSend(true);
        }
        else{
        setVisible(true);
        }
    }
   
    // console.log("tip rendered")
    return (
        <>
        <ButtonAirdrop onClick={onClick} /> 
        <ResponsivePopup
        bodyClassName="disable-keyboard-resize"
        destroyOnClose={true}
        visible={visibleSend }
        onClose={() => {
                setVisible(false)
                setActiveTicker(null)
                setVisibleSend(false)

        }}
        closeOnMaskClick={true}
        showCloseButton={true}
        >
            {
                activeTicker && 
            <RedPacket 
            hideAddress={true}
            onClose={() => {
                setVisible(false)
                setActiveTicker(null)
                setVisibleSend(false)
            }}
            chatId={chat.id}
            ticker={activeTicker}  onPacketSent={() => {
                setVisible(false)
                setVisibleSend(false)

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
            <div className="text-2xl  text-center p-2">Red Packet</div>
          </div>
          <div style={{maxHeight: "50vh", overflowY: "auto"}}>
          <NetworkList
          hideZeroBalance
          filterTickers={filterTickers}
           hidePrice={true} onClick={(ticker, action) => {
            setActiveTicker(ticker);
            setVisibleSend(true);
            if (isMobile || isTablet) {
              navigate(`/${ticker}/red-packet?chatId=${chat.id}`);
              // view transition bugged on ios cause probably of network select popup
              // if (document.startViewTransition) {
              //       document.startViewTransition(() => {
              //         navigate(`/${ticker}/red-packet?chatId=${chat.id}`, {unstable_viewTransition: false, viewTransition: false})
              //       })
              //   }
              //   else{
              //       navigate(`/${ticker}/red-packet?chatId=${chat.id}`);
              //   }
            }
            setVisible(false);
          }} /></div>
          </div>
        </ResponsivePopup>

        </>
    );
  };

export default ChatInputRedPacket;