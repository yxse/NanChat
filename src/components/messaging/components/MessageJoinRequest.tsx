import { GiftOutline, MessageOutline, PhoneFill, ReceivePaymentOutline, SendOutline } from "antd-mobile-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { BiChevronLeft, BiMessageSquare } from "react-icons/bi";
import { FiMoreHorizontal } from "react-icons/fi";
import { IoSendOutline } from "react-icons/io5";
import { useNavigate, useParams } from "react-router-dom";
import { socket } from "../socket";
import { useWallet, WalletContext } from "../../Popup";
import { convertAddress, formatAddress } from "../../../utils/format";
import { CopyToClipboard, ResponsivePopup } from "../../Settings";
import SelectAccount from "../../app/SelectAccount";
import { AccountIcon } from "../../app/Home";
import { Button, Card, DotLoading, Input, List, Modal, Popup, TextArea, Toast } from "antd-mobile";
import useSWR from "swr";
import { acceptJoinRequest, fetcherAccount, fetcherMessages, fetcherMessagesPost, rejectJoinRequest } from "../fetcher";
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
import { updateSharedKeys } from "../../../services/sharedkey";
import { formatTelegramDate } from "../../../utils/telegram-date-formatter";
import { useChats } from "../hooks/use-chats";

const MessageJoinRequest: React.FC<{ message }> = ({ message }) => {
  const { activeAccount, activeAccountPk } = useWallet();

  const addresses = message.content.match(/nano_[a-zA-Z0-9]{60}/g);
  const { chat, mutateChats, isLoading: isLoadingChat} = useChats(message.chatId);
  const { data, isLoading } = useSWR(`/names?accounts=${addresses.join(',')}`, fetcherMessages, {
    dedupingInterval: 60000,
  });
  const [loadingAccept, setLoadingAccept] = useState(false);
  const [loadingReject, setLoadingReject] = useState(false);

  if (isLoading || isLoadingChat) {
    return <DotLoading />;
  }
  if (message.joinRequest.status === "pending") {
    return (
      <div className="text-center m-4" style={{ color: "var(--adm-color-text-secondary)" }}>
        {
          activeAccount === addresses[0] ? "You " : data?.find((d) => d._id === addresses[0])?.name} <span className="text-xs">({formatAddress(addresses[0])})</span> asked to join the chat
          <span className="text-xs block mt-1">
        {formatTelegramDate(message.timestamp)}
        </span>  
        <div className="mt-1 space-x-2">
          <Button
            shape="rounded"
            loading={loadingAccept}
            onClick={async () => {
              setLoadingAccept(true)
              try {
                let r = await acceptJoinRequest(message.chatId, message.fromAccount)
                if (r.error) {
                  throw new Error(r.error)
                }
                let allParticipants = chat?.participants.map((p) => p._id)
                allParticipants.push(message.fromAccount)
                await updateSharedKeys(message.chatId, allParticipants, activeAccountPk)
                mutateChats()
              } catch (error) {
                Toast.show({ content: error.message })
              } finally {
                setLoadingAccept(false)
              }
            }}
            color="primary"

          >
            Accept
          </Button>
          <Button
            shape="rounded"
            loading={loadingReject}
            onClick={async () => {
              setLoadingReject(true)
              try {
                let r = await rejectJoinRequest(message.chatId, message.fromAccount)
                if (r.error) {
                  throw new Error(r.error)
                }
                mutateChats()
              } catch (error) {
                Toast.show({ content: error.message })
              } finally {
                setLoadingReject(false)
              }
            }}

            color="default"
          >
            Reject
          </Button>

        </div>
        
      </div>
    );
  };
  return (
    <div className="text-center m-4" style={{ color: "var(--adm-color-text-secondary)" }}>
      {
        activeAccount === addresses[0] ? "You " : data?.find((d) => d._id === addresses[0])?.name} <span className="text-xs">({formatAddress(addresses[0])})</span> asked to join the chat
        <span className="text-xs block mt-1">
        {formatTelegramDate(message.timestamp)}
        </span>  
    </div>
  );
};

export default MessageJoinRequest;