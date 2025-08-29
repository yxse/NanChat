import { memo, useContext, useEffect } from "react";
import useMessageDecryption from "../hooks/use-message-decryption";
import { WalletContext } from "../../Popup";
import ProfileName from "./profile/ProfileName";
import { CloseCircleFill } from "antd-mobile-icons";
import MessageFile from "./MessageFile";
import Sticker from "./Sticker";
import MessageSystem from "./MessageSystem";

export const MessageRaw = memo(({message, ellipsis, maxHeight="42px", includeProfileName}) => {
    const style = ellipsis ? { 
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        // containerType: 'inline-size',
    } : {}
    
    // console.log(message)
    // return 'ok'
    if (message.type === "system" || 
        (message.type === "transfer" && message.content !== "Transfer") // on group chat the content is system message, in private it is just "Transfer"
    ){
        return <div style={style}><MessageSystem raw message={message} /></div>
    }
    
    if (message.stickerId){
        return <Sticker stickerId={message.stickerId} height={maxHeight}/>
    }
    
    if (message.file){
        return <MessageFile file={message.file} message={message} maxHeight={"42px"} />
    }

    const decrypted = useMessageDecryption({message})
     return (
        <div style={style}>
            {includeProfileName && <><ProfileName includeVerified={false} address={message.fromAccount} />{": "}</>}
            {decrypted ? decrypted : 
            '\u00A0' // blank space to keep the height
            } 
        </div>
    )
}, (prevProps, nextProps) => {
  // Return true if props are equal (prevent re-render)
  return prevProps.message._id === nextProps.message._id &&
         prevProps.ellipsis === nextProps.ellipsis &&
         prevProps.includeProfileName === nextProps.includeProfileName;
})

export default MessageRaw;