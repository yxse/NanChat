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
import { LockFill } from "antd-mobile-icons";
import useMessageDecryption from "../hooks/use-message-decryption";
import ProfileName from "./profile/ProfileName";
import { Link } from "react-router-dom";
import MessageFile from "./MessageFile";
import MessageSystem from "./MessageSystem";
import MessageJoinRequest from "./MessageJoinRequest";
import { DateHeader } from "./date-header-component";

const Message = ({ message, type = "private", prevMessage, nextMessage, hasMore }) => {
    const { wallet, dispatch
    } = useContext(WalletContext);
    // const [decrypted, setDecrypted] = useState(message.isLocal ? message.content : type === 'private' ? null : message.content);
    const [loading, setLoading] = useState(true);
    const activeAccount = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address
    const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
    const toAccount = message.toAccount;
    // const { data: account} = useSWR(type === "private" ? null : message.fromAccount, fetcherAccount);
    const decrypted = useMessageDecryption({message})
    useEffect(() => {
        if (decrypted) {
            dispatch({
                type: 'ADD_MESSAGE',
                payload: { _id: message._id, content: decrypted }
            });
        }
    }, [decrypted])
    // useEffect(() => {
    //     // if (!toAccount) return;
    //     // if (type !== 'private') return;
    //     if (decrypted) return;
    //     if (wallet.messages.hasOwnProperty(message._id)) {
    //         setDecrypted(wallet.messages[message._id]);
    //     }
    //     else {
    //         try {
    //             let cached = localStorage.getItem("message-" + message._id);
    //             if (cached) {
    //                 setDecrypted(cached);
    //                 dispatch({ type: 'ADD_MESSAGE', payload: { _id: message._id, content: cached } });
    //                 return;
    //             }
    //             console.log("decrypting", message.content);
    //             let r = box.decrypt(message.content,
    //                 message.fromAccount === activeAccount ? toAccount : message.fromAccount
    //                 , activeAccountPk)
    //             console.log("decrypted", r);
    //             setDecrypted(r);
    //             localStorage.setItem("message-" + message._id, r);
    //             let id = message.isLocal ? Math.random().toString() : message._id;
    //             dispatch({ type: 'ADD_MESSAGE', payload: { _id: id, content: r } });
    //         } catch (error) {
    //             // debugger
    //             console.log(error);
    //             setDecrypted(message.content);
    //         }
    //     }
    // }


    //     , []);

        // if (!decrypted && 
        //     !nextMessage // preven scroll flickering when newmessage
        // ) {
        //     // return empty while decrypting message to avoid the "Messages are end-to-end encrypted" flickering
        //     // eventually messages could be kept into localstorage unencrpted for faster loading
        //     return <div style={{ height: '100px' }}></div>
        // }
        if (!decrypted) {
            return null
        }
    // console.log(message.content);

    if (message?.type === "join-request") {
        return (<MessageJoinRequest message={message} />)
    }
    if (message?.type === "system" || message?.type === "join-request") {
        return (<MessageSystem message={message} />)
    }
    if (message?.tip) {
        return <MessageTip message={message} side={message.fromAccount === activeAccount ? 'from' : 'to'} hash={message.tip.hash} ticker={message.tip.ticker} />
    }
    if (message?.file){
        return <MessageFile message={message} side={message.fromAccount === activeAccount ? 'from' : 'to'} file={message.file} />
    }
    else if (message?.stickerId) {
        return <MessageSticker message={message} side={message.fromAccount === activeAccount ? 'from' : 'to'} />
    }

    const isPreviousMessageFromSameAccount = prevMessage && prevMessage.fromAccount === message.fromAccount;
    const isNextMessageFromSameAccount = nextMessage && nextMessage.fromAccount === message.fromAccount;
    return (
        <>
        {
            decrypted && !hasMore && !nextMessage && 
            <div className="flex items-center justify-center text-sm text-center" style={{ 
                color: 'var(--adm-color-warning)',
                backgroundColor: 'var(--adm-color-background)', padding: '16px', margin: 32, borderRadius: 8 }}>
                                                <div>
                                                    <LockFill className="mr-2 inline" />
                                                    Messages and files are end-to-end encrypted using nano. No one outside of this chat can read them.
                                                </div>
                                            </div>
        }
        <div className="text-center text-sm" style={{ color: 'var(--adm-color-text-secondary)' }}>
                    <DateHeader timestamp={message.timestamp} timestampPrev={prevMessage?.timestamp} timestampNext={nextMessage?.timestamp} reverse />

        </div>
        <div
            // style={{marginLeft: '10px', marginRight: '10px'}}
            key={message._id}
            className={`message flex ${message.fromAccount === activeAccount ? 'justify-end' : 'justify-start'} mb-2 mx-2`}
        >
            {
                type === 'group' && isPreviousMessageFromSameAccount ?
                    <div style={{ width: '48px' }}></div>
                    :
                    type === 'group' && message.fromAccount !== activeAccount && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', flexDirection: 'column' }}>
                            <Link to={`/chat/${message.fromAccount}`}>
                                <ProfilePicture address={message.fromAccount} />
                            </Link>
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
                    backgroundColor: message.fromAccount === activeAccount ? 'var(--adm-color-primary)' : 'var(--adm-color-background)',
                }}
                className={
                    `max-w-[70%] p-2 rounded-md 
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
                            <ProfileName address={message.fromAccount} fallback={"..."} />
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
                    {/* <span 
                    style={{float: 'right'}}
                    className="text-xs opacity-70">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span> */}

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