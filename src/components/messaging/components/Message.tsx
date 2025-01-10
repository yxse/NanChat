import { box } from "multi-nano-web";
import { memo, useContext, useEffect, useMemo, useState } from "react";
import { BiMessageSquare } from "react-icons/bi";
import { WalletContext } from "../../Popup";
import { Avatar, DotLoading, Skeleton } from "antd-mobile";
import { convertAddress, formatAddress } from "../../../utils/format";
import MessageTip from "./MessageTip";
import MessageSticker from "./MessageSticker";
import { AccountIcon } from "../../app/Home";
import { fetcherAccount, fetcherMessages } from "../fetcher";
import useSWR from "swr";
import ProfilePicture from "./profile/ProfilePicture";
import { DateHeader } from "../../app/History";

const Message = ({ message, type = "private", prevMessage, nextMessage }) => {
    const { wallet, dispatch
    } = useContext(WalletContext);
    const [decrypted, setDecrypted] = useState(message.isLocal ? message.content : type === 'private' ? null : message.content);
    const [loading, setLoading] = useState(true);
    const activeAccount = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address
    const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
    const toAccount = message.toAccount;
    const { data: account} = useSWR(type === "private" ? null : message.fromAccount, fetcherAccount);
    useEffect(() => {
        // if (!toAccount) return;
        // if (type !== 'private') return;
        if (decrypted) return;
        if (wallet.messages.hasOwnProperty(message._id)) {
            setDecrypted(wallet.messages[message._id]);
        }
        else {
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

        if (!decrypted && 
            !nextMessage // preven scroll flickering when newmessage
        ) {
            // return empty while decrypting message to avoid the "Messages are end-to-end encrypted" flickering
            // eventually messages could be kept into localstorage unencrpted for faster loading
            return <div style={{ height: '100px' }}></div>
        }
        if (!decrypted && nextMessage) {
            return null
        }
    // console.log(message.content);

    if (message?.tip) {
        return <MessageTip message={message} side={message.fromAccount === activeAccount ? 'from' : 'to'} hash={message.tip.hash} ticker={message.tip.ticker} />
    }
    else if (message?.stickerId) {
        return <MessageSticker message={message} side={message.fromAccount === activeAccount ? 'from' : 'to'} />
    }

    const isPreviousMessageFromSameAccount = prevMessage && prevMessage.fromAccount === message.fromAccount;
    const isNextMessageFromSameAccount = nextMessage && nextMessage.fromAccount === message.fromAccount;
    return (
        <>
        <div className="text-center text-sm text-gray-400">
                    <DateHeader timestamp={message.timestamp} timestampPrev={prevMessage?.timestamp} timestampNext={nextMessage?.timestamp} reverse />

        </div>
        <div
            // style={{marginLeft: '10px', marginRight: '10px'}}
            key={message._id}
            className={`flex ${message.fromAccount === activeAccount ? 'justify-end' : 'justify-start'} mb-1 mx-2`}
        >
            {
                type === 'group' && isPreviousMessageFromSameAccount ?
                    <div style={{ width: '48px' }}></div>
                    :
                    type === 'group' && message.fromAccount !== activeAccount && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', flexDirection: 'column' }}>
                            <ProfilePicture address={message.fromAccount} />
                        </div>
                    )
            }
            <div
                style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    // borderRadius: 16, 
                    // borderBottomRightRadius: message.fromAccount === activeAccount ? 0 : 116, 
                    // borderBottomLeftRadius: 
                    // message.fromAccount === activeAccount ? 16 : 
                    // isPreviousMessageFromSameAccount ? 16 : 0,
                    backgroundColor: message.fromAccount === activeAccount ? '#1677ff' : '#171718',
                }}
                className={
                    `max-w-[70%] p-2 rounded-lg 
                ${message.fromAccount === activeAccount ?

                        isPreviousMessageFromSameAccount ?
                            '' : 'rounded-br-none'
                        :
                        isPreviousMessageFromSameAccount
                            ?
                            '' : 'rounded-bl-none'

                    }`}
            >
                {
                    type === 'group' && !isNextMessageFromSameAccount && message.fromAccount !== activeAccount && (
                        <span style={{fontWeight: 'bold'}}>
                            {account?.name || formatAddress(message.fromAccount)}
                        </span>
                    )
                }
                <p
                    style={!decrypted ? {
                        // height: '300px', // allow to have a skeleton with enough height to have correct autoscroll
                    } : {}}
                >{!decrypted && !message.isLocal ?
                    <span className="text-xs opacity-70">(clear) </span>
                    : ''}
                    {decrypted ? decrypted : ""}
                </p>
                    <span 
                    style={{float: 'right'}}
                    className="text-xs opacity-70">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                <div className="flex items-center justify-end gap-1 mt-1">
                    
                    {/* {message.fromAccount === activeAccount && (
                        <BiMessageSquare className="w-4 h-4" />
                    )} */}
                </div>
                {/* {type} */}
            </div>
        </div>
        </>
    )
}

export default Message;