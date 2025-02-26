import { useContext, useEffect } from "react";
import useMessageDecryption from "../hooks/use-message-decryption";
import { WalletContext } from "../../Popup";
import ProfileName from "./profile/ProfileName";

const MessageRaw = ({ message }) => {
    const decrypted = useMessageDecryption({message})
        const { dispatch } = useContext(WalletContext);
    
    useEffect(() => {
        if (decrypted) {
            dispatch({
                type: 'ADD_MESSAGE',
                payload: { _id: message._id, content: decrypted }
            });
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
        {message?.type === "group" && <><ProfileName address={message.fromAccount} />{": "}</>}
        {decrypted}
        </div>
        
    )
}

export default MessageRaw;