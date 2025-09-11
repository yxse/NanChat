import { useContext, useEffect } from "react";
import useMessageDecryption from "../hooks/use-message-decryption";
import { WalletContext } from "../../useWallet";
import ProfileName from "./profile/ProfileName";
import { CloseCircleFill } from "antd-mobile-icons";
import MessageRaw from "./MessageRaw";

const MessageRawReply = ({ message }) => {

    return (
        <div 
        style={{ // much more faster than antd ellipsis
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
        }}>
            <MessageRaw message={message}  />
        </div>
        
    )
}

export default MessageRawReply;