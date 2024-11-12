import { box } from "multi-nano-web";
import { memo, useContext, useEffect, useMemo, useState } from "react";
import { BiMessageSquare } from "react-icons/bi";
import { WalletContext } from "../../Popup";
import { DotLoading } from "antd-mobile";
import { convertAddress } from "../../../utils/format";
import MessageTip from "./MessageTip";

const Message = ({ message }) => {
    const { wallet, dispatch
     } = useContext(WalletContext);
     const [decrypted, setDecrypted] = useState(message.isLocal ? message.content : false);
     const [loading, setLoading] = useState(true);
     const activeAccount = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address
     const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
     const toAccount = message.toAccount;
    useEffect(() => {
        // if (!toAccount) return;
        if (decrypted) return;
        if (wallet.messages.hasOwnProperty(message._id)) {
            setDecrypted(wallet.messages[message._id]);
        }
        else{
            try {
                console.log("decrypting", message.content);
                let r = box.decrypt(message.content,
                    message.fromAccount === activeAccount ? toAccount : message.fromAccount
                    , activeAccountPk)
                console.log("decrypted", r);
                setDecrypted(r);
                let id = message.isLocal ? Math.random().toString() : message._id;
                dispatch({ type: 'ADD_MESSAGE', payload: { _id: id, content: r } });
                } catch (error) {
                    // debugger
                    console.log(error);
                    setDecrypted(message.content);
                }
        }
    }

    
    , []);

    if (!decrypted) {
        return null;
    }
    // console.log(message.content);
   
    if (message?.tip){
        return <MessageTip message={message} side={message.fromAccount === activeAccount ? 'from' : 'to'} hash={message.tip.hash} ticker={message.tip.ticker} />
    }
    return (
        <div
        // style={{marginLeft: '10px', marginRight: '10px'}}
        key={message._id}
        className={`flex ${message.fromAccount === activeAccount ? 'justify-end' : 'justify-start'} mb-1 mx-4`}
    >
        <div
        style={{
            whiteSpace: 'pre-wrap', 
            wordBreak: 'break-word',
            borderRadius: 18, 
            // borderBottomRightRadius: message.fromAccount === activeAccount ? 0 : 18, 
            // borderBottomLeftRadius: message.fromAccount === activeAccount ? 18 : 0
        }}
            className={`max-w-[70%] p-3 rounded-lg ${message.fromAccount === activeAccount
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-white text-gray-800 rounded-bl-none'
                }`}
        >
            <p
            style={!decrypted ? {
                // height: '300px', // allow to have a skeleton with enough height to have correct autoscroll
            } : {}}
            >{!decrypted && !message.isLocal ?
                <span className="text-xs opacity-70">(clear) </span>
                : ''}
                {decrypted ? decrypted : ""}
            </p>
            <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-xs opacity-70">
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {message.fromAccount === activeAccount && (
                    <BiMessageSquare className="w-4 h-4" />
                )}
            </div>
        </div>
    </div>
    )
}

export default Message;