import { GiftOutline, MessageOutline, PhoneFill, ReceivePaymentOutline, SendOutline } from "antd-mobile-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { BiChevronLeft, BiMessageSquare } from "react-icons/bi";
import { FiMoreHorizontal } from "react-icons/fi";
import { IoSendOutline } from "react-icons/io5";
import { Link, useNavigate, useParams } from "react-router-dom";
import { socket } from "../socket";
import { useWallet, WalletContext } from "../../Popup";
import { convertAddress, formatAddress } from "../../../utils/format";
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

const MessageSystem: React.FC<{ message }> = ({ message }) => {
  const { activeAccount } = useWallet();

  const addresses = message.content.match(/nano_[a-zA-Z0-9]{60}/g);
  let action = message.content.split(' ')[1];
  if (message.content.includes('recalled')) {
    action = 'recalled a message';
  }
  if (message.content.includes('created')) {
    action = 'created the group';
  }
  
  const { data, isLoading } = useSWR(`/names?accounts=${addresses?.join(',')}`, fetcherMessages, {
    dedupingInterval: 60000,
  });

  if (isLoading) {
    return <DotLoading />;
  }
    return (
      <div className="text-center m-4" style={{ color: "var(--adm-color-text-secondary)" }}>
        <Link to={'/chat/' + addresses?.[0] + '/info'} style={{ color: "var(--adm-color-primary)" }}>
          {data?.find((d) => d._id === addresses?.[0])?.name} </Link> {action} {" "}

          {addresses?.map((address, index) => {
            if (index === 0) {
              return null;
            }
            return (
              <span key={index} className="" style={{ color: "var(--adm-color-text-secondary)" }}>
                <Link to={'/chat/' + address + '/info'} style={{ color: "var(--adm-color-primary)" }}>
                {data?.find((d) => d._id === address)?.name}
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