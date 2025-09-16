import { GiftOutline, MessageOutline, PhoneFill, ReceivePaymentOutline, SendOutline } from "antd-mobile-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { BiChevronLeft, BiMessageSquare } from "react-icons/bi";
import { FiMoreHorizontal } from "react-icons/fi";
import { IoSendOutline } from "react-icons/io5";
import { Link, useNavigate, useParams } from "react-router-dom";
import { socket } from "../socket";
import { WalletContext } from "../../useWallet";
import { useWallet } from "../../useWallet";
import { formatAddress } from "../../../utils/format";
import { convertAddress } from "../../../utils/convertAddress";
import { CopyToClipboard, ResponsivePopup } from "../../Settings";
import SelectAccount from "../../app/SelectAccount";
import { AccountIcon } from "../../app/Home";
import { Button, Card, DotLoading, Input, List, Modal, Popup, TextArea } from "antd-mobile";
import useSWR from "swr";
import { fetcherAccount, fetcherMessages, fetcherMessagesPost } from "../fetcher";
import { box } from "multi-nano-web";
import { SlArrowUpCircle } from "react-icons/sl";
import { FaArrowUp } from "react-icons/fa6";
import { useChat } from "../hooks/useChat";
import Send from "../../app/Send";
import { AiOutlineDollar, AiOutlineDollarCircle, AiOutlineSwap } from "react-icons/ai";
import NetworkList from "../../app/NetworksList";
import useLocalStorageState from "use-local-storage-state";
import { networks } from "../../../utils/networks";
import { DateHeader } from "../../app/History";
import { formatTelegramDate } from "../../../utils/telegram-date-formatter";
import ProfileName from "./profile/ProfileName";
import { RedPacketIcon } from "../../app/redpacket/RedPacketIcon";

const RedPacketLink = ({id}) => {
  return <Link to={"/chat/red-packet-result?id=" + id} style={{color: "var(--gold-color)"}}>Red Packet</Link>
}

const MessageSystem: React.FC<{ message, raw }> = ({ message, raw }) => {
  const { activeAccount } = useWallet();

  const addresses = message.content.match(/nano_[a-zA-Z0-9]{60}/g);
  let actionMessage = message.content.split(' ')[1];
  let action = message.content.split(' ')[1];
  let redPacketId, isAllOpened
  if (message.content.includes('recalled')) {
    actionMessage = 'recalled a message';
  }
  else if (message.content.includes('created')) {
    actionMessage = 'created the group';
  }
  else if (message.content.includes('opened')) {
    redPacketId = message.content.split(' ')[2]
    if (message.content.includes('all received')){
      isAllOpened = true
    }
    actionMessage = 'opened red packet from';
  }
  else if (message.content.includes('expired')) {
    redPacketId = message.content.split(' ')[2]
    if (raw) {
      actionMessage = <>Red Packet Expired</>
    }
    else{
      actionMessage = <><RedPacketLink id={redPacketId} /> Expired</>
    }
    action = "expired"
  }
  else if (message.content.includes('transferred')) {
    actionMessage = `transferred ${message.content.split(' ')[2]} ${message.content.split(' ')[3]} to`;
  }
  
  // const { data, isLoading } = useSWR(`/names?accounts=${addresses?.join(',')}`, fetcherMessages, {
  //   dedupingInterval: 60000,
  // });

    if (raw) { // used to display in chatList
       return (
      <>{"["}
        <ProfileName address={addresses?.[0]} /> {actionMessage} {" "}
          {addresses?.map((address, index) => {
            if (index === 0) {
              return null;
            }
            return (
              <span key={index} className="" style={{ }}>
                    <ProfileName address={address} />
                {index === addresses.length - 1 ? null : ", "}
              </span>
            );
          })}
          {"]"}
      </>
    );
    }
    if (action === "opened"){ // red packet
    return <div className="text-center m-4" style={{  }}>  <RedPacketIcon width={18} style={{verticalAlign: "baseline"}}/> <ProfileName address={addresses?.[0]} /> opened <RedPacketLink id={redPacketId} /> from {" "}
          <ProfileName address={addresses?.[1]} />{isAllOpened && ". The red packets are all received."}
      </div>
    }
    return (
      <div className="text-center m-4" style={{ color: "var(--adm-color-text-secondary)" }}>
        <Link to={'/chat/' + addresses?.[0] + '/info'} style={{ color: "var(--adm-color-primary)" }}>
        <ProfileName address={addresses?.[0]} />
           </Link> {actionMessage} {" "}

          {addresses?.map((address, index) => {
            if (index === 0) {
              return null;
            }
            return (
              <span key={index} className="" style={{ color: "var(--adm-color-text-secondary)" }}>
                <Link to={'/chat/' + address + '/info'} style={{ color: "var(--adm-color-primary)" }}>
                    <ProfileName address={address} />
                  </Link>
                {index === addresses.length - 1 ? null : ", "}
              </span>
            );
          })}
          
        {/* <span className="text-xs block mt-1">
        {formatTelegramDate(message.timestamp)}
        </span>   */}
      </div>
    );
  };

export default MessageSystem;