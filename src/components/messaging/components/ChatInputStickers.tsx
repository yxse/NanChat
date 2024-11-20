import { GiftOutline, MessageOutline, PhoneFill, ReceivePaymentOutline, SendOutline } from "antd-mobile-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { BiChevronLeft, BiMessageSquare } from "react-icons/bi";
import { FiMoreHorizontal } from "react-icons/fi";
import { IoSendOutline } from "react-icons/io5";
import { useNavigate, useParams } from "react-router-dom";
import { socket } from "../socket";
import { WalletContext } from "../../Popup";
import { convertAddress, formatAddress } from "../../../utils/format";
import { CopyToClipboard } from "../../Settings";
import SelectAccount from "../../app/SelectAccount";
import { AccountIcon } from "../../app/Home";
import { Button, DotLoading, Input, List, Modal, Popup, TextArea } from "antd-mobile";
import useSWR from "swr";
import { fetcherMessages, fetcherMessagesPost } from "../fetcher";
import { box } from "multi-nano-web";
import { SlArrowUpCircle } from "react-icons/sl";
import { FaArrowUp } from "react-icons/fa6";
import { useChat } from "../hooks/useChat";
import Send from "../../app/Send";
import { AiOutlineDollar } from "react-icons/ai";
import NetworkList from "../../app/NetworksList";
import useLocalStorageState from "use-local-storage-state";
import { networks } from "../../../utils/networks";

const ChatInputStickers: React.FC<{ onStickerSelect  }> = ({ onStickerSelect  }) => {

    const {data, isLoading} = useSWR('/stickers', fetcherMessages);


    return (
        <>
          <div style={{height: 300, overflowY: 'scroll', marginTop: 8}}>
            <div className="flex flex-wrap gap-2" style={{justifyContent: 'space-evenly'}}>
                {
                    isLoading ? <DotLoading /> : data?.map(sticker => (
                        <div key={sticker.id} onClick={() => onStickerSelect(sticker.id)} className="cursor-pointer">
                            <img src={sticker.cache_url} style={{width: '75px'}} />
                        </div>
                    ))
                }
            </div>

          </div>
        </>
    );
  };

export default ChatInputStickers;