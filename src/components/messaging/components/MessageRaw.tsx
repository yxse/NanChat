import { useContext, useEffect } from "react";
import useMessageDecryption from "../hooks/use-message-decryption";
import { WalletContext } from "../../Popup";
import ProfileName from "./profile/ProfileName";
import { CloseCircleFill } from "antd-mobile-icons";

const MessageRaw = ({ message, includeProfileName }) => {
    const decrypted = useMessageDecryption({message})
        const { dispatch } = useContext(WalletContext);
    
    useEffect(() => {
        if (decrypted) {
            // dispatch({
            //     type: 'ADD_MESSAGE',
            //     payload: { _id: message._id, content: decrypted }
            // });
        }
    }, [decrypted])
    return (
        <div 
        style={{ // much more faster than antd ellipsis
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            containerType: 'inline-size',
        }}>
        {includeProfileName && <><ProfileName includeVerified={false} address={message.fromAccount} />{": "}</>}
        {decrypted ? decrypted : 
        '\u00A0' // blank space to keep the height
        } 
        </div>
        
    )
}

export default MessageRaw;