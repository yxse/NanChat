import { box } from "multi-nano-web";
import { memo, useContext, useEffect, useMemo, useState } from "react";
import { BiMessageSquare } from "react-icons/bi";
import { useWallet, WalletContext } from "../../Popup";
import { Button, Card, Divider, DotLoading, Modal, Toast } from "antd-mobile";
import { convertAddress, formatAmountRaw } from "../../../utils/format";
import { networks } from "../../../utils/networks";
import useSWR, { useSWRConfig } from "swr";
import { fetchAccountInfo, fetchBlock } from "../Network";
import { rawToMega } from "../../../nano/accounts";
import { ConvertToBaseCurrency, FormatBaseCurrency } from "../Home";
import { openHashInExplorer } from "../../messaging/utils";
import { GiftOutline } from "antd-mobile-icons";
import ProfileName from "../../messaging/components/profile/ProfileName";
import ProfilePicture from "../../messaging/components/profile/ProfilePicture";
import { AiOutlineSwap } from "react-icons/ai";
import useMessageDecryption from "../../messaging/hooks/use-message-decryption";
import Sticker from "../../messaging/components/Sticker";
import { useNavigate } from "react-router-dom";
import { cacheKeyPrefix, fetcherChat, fetcherMessages, openRedPacket } from "../../messaging/fetcher";
import packetOpenedIcon from "../../../../public/icons/red_envelope_opened.png"
import { useChat } from "../../messaging/hooks/useChat";
import { inMemoryMap } from "../../../services/database.service";
import MessageTip from "../../messaging/components/MessageTip";
import { RedPacketIcon, RedPacketIconOpened } from "./RedPacketIcon";

export const useMessageRedpacket = ({message}) => {
   
    const redpacket = message?.redPacket;
    console.log("message gift", message);
    let redPacketMessage = {}
    redPacketMessage.fromAccount = message?.fromAccount
    redPacketMessage.toAccount = message?.toAccount
    redPacketMessage.content = message?.redPacket?.message 
    redPacketMessage._id = message?._id + "-redpacket-message"
    redPacketMessage.type = message?.type
    redPacketMessage.chatId = message?.chatId
    redPacketMessage.isLocal = message?.isLocal

    // delete redPacketMessage.redPacket // this is to allow message decryption as it will be threated as not special message
    const messageDecrypted = useMessageDecryption({ message: redPacketMessage });
    return {
        message: messageDecrypted,
        sticker: message?.redPacket?.stickerId
    }
}

export const useRedpacketState = (message) => {
    const [currentTime, setCurrentTime] = useState(new Date())
    const redPacket = message?.redPacket
    const isGroup = message?.type === "group"
    const {activeAccount} = useWallet()
    
    const isOpen = isGroup ? 
        (redPacket?.openedBy?.find((claim) => claim.account === activeAccount) || redPacket.remain <= 0) : 
        redPacket?.openedBy?.length > 0

    const isExpired = redPacket?.expiredAt ? new Date(redPacket.expiredAt) < currentTime : false
    const state = (isOpen ? "opened" : isExpired ? "expired" : "new")
    const isFinished = redPacket?.remain <= 0

    // Update current time periodically to keep isExpired accurate
    useEffect(() => {
        if (!redPacket?.expiredAt) return

        const expiredAt = new Date(redPacket.expiredAt)
        
        // If already expired, no need to set up timer
        // if (expiredAt <= new Date()) return

        // Calculate time until expiration
        const timeUntilExpiry = expiredAt.getTime() - Date.now()
        
        // Set up timer to update exactly when it expires
        const timeoutId = setTimeout(() => {
            setCurrentTime(new Date())
        }, timeUntilExpiry)

        return () => clearTimeout(timeoutId)
    }, [message, redPacket?.expiredAt])

    return {
        state,
        isOpen, 
        isExpired,
        isFinished
    }
}

const ModalRedPacketOpen = ({visible, setVisible, message, messageDecrypted, sticker}) => {
    const {data, mutate: mutateRedPacket} = useSWR(visible ? '/redpacket?id=' + message._id : null, fetcherMessages) // only fetch when visible for optimization
    const {state, isOpen, isExpired} = useRedpacketState(data)
    const navigate = useNavigate()
    const {mutate: mutateMessages} = useChat(message.chatId)
    const {activeAccount} = useWallet()
    const navigateToResult = () => {
        navigate(`/red-packet-result?id=${message._id}`, {viewTransition: false})
    }
    useEffect(() => {
        debugger
        if (isOpen && data && !data?.error) {
            debugger
            mutateMessages(currentPages => {
                if (!currentPages) return currentPages;
                const key = cacheKeyPrefix(message.chatId) + message.height
                return currentPages.map(page => {
                    // Check if this page contains the message we want to update
                    const messageIndex = page.findIndex(m => m._id === message._id);
                    debugger
                    if (messageIndex !== -1) {
                        // This page contains our message, update it
                        const updatedPage = [...page];
                        updatedPage[messageIndex] = data;
                        inMemoryMap.set(key, data)
                        localStorage.setItem(key, JSON.stringify(data)); // update localstorage cache
                        return updatedPage;
                    }
                    
                    // This page doesn't contain our message, return unchanged
                    return page;
                });
            }, false);
            if (message.type === 'group' || message.fromAccount !== activeAccount){
                navigateToResult() // only for group red packet or if not from the sender
                return
            }
        }
        if (visible && message.fromAccount === activeAccount && message.type === "group"){
            navigateToResult() 
        }
        else if (visible && isExpired && message.type === "group"){
            navigateToResult() 
        }
    }, [isOpen, data, message._id, navigate, isExpired]);
    
    const actions = []
        actions.push({
                key: 'confirm',
                style: {"backgroundColor":"#f7d672","borderRadius":"50%","width":"80px","height":"80px","WebkitBoxShadow":"0px 0px 15px 5px rgba(0, 0, 0, 0.54)","boxShadow":"0px 0px 15px 0px rgba(0, 0, 0, 0.54)","border":"none", color: "black", margin: "auto"},
                text: <>
                <div
                >
                Open
                </div>
                    </>,
                primary: true,
                onClick: async () => {
                    if (message.fromAccount === activeAccount){
                        Toast.show({content: "You cannot open your own red packet!"})
                        return
                    }
                    // Toast.show({icon: "loading"})
                    let r = await openRedPacket({id: message._id})
                    // if (!r?.error){
                    //     await mutate("/redpacket?id=" + message._id, r)
                    // }
                    // else{
                    //     await mutate("/redpacket?id=" + message._id)
                    // }
                    navigateToResult()
                    await mutateRedPacket() 
                    // await mutateRedPacket(r) // this is causing navigation glitch on ios
                    // navigate(`/red-packet-result?id=`+ message._id, {state: {message: redPacketMessage, stickerId: message.redPacket.stickerId, id: message._id, ticker: ticker}})
                    // navigateToResult()

                    
                }
                
            })
    return  <Modal
        
        closeOnMaskClick
        showCloseButton
        bodyStyle={{
            backgroundColor: "rgb(203, 64, 64)",
            backgroundImage: "url(https://bucket.nanwallet.com/logo/45-degree-fabric-dark.png)"
        }}
        actions={actions}
        visible={visible && !isExpired}
        onClose={() => {
            setVisible(false);
        }}
        content={
            <div><div>
            {/* <img src={networks[ticker]?.logo} style={{width: '32px', height: '32px', display: "inline-block"}} />  */}
            <div style={{display: 'flex', gap: 4, alignItems: 'center', justifyContent: "center", color: "#dbdbdb"}}>
            <ProfilePicture address={message.fromAccount} size={32} /> <ProfileName address={message.fromAccount} />
            </div>
            {
                isExpired ?
                <div style={{textAlign: "center", marginTop: 16, fontSize: 24, fontWeight: "bold", color: "#dbdbdb"}}>
            Red Packet Expired
            </div> :
                 messageDecrypted ? 
            <div style={{textAlign: "center", marginTop: 16, fontSize: 24, fontWeight: "bold", color: "#dbdbdb"}}>
            {messageDecrypted}
            </div> : 
            <div style={{textAlign: "center", marginTop: 16, fontSize: 24, fontWeight: "bold", color: "#dbdbdb"}}>
            Best wishes!
            </div>
            }
            </div>
            {
                sticker && <div style={{display: 'flex', justifyContent: 'center', marginTop: 16}}>
            <Sticker stickerId={sticker} height="60px" />
            </div>
            }
        </div> 
        }
        // title={}
        />
}

const MessageRedPacket = ({ message, side, hash }) => {

    const redpacket = message.redPacket;
    const ticker = redpacket?.ticker;
    const [modalVisible, setModalVisible] = useState(false);
    console.log("message gift", message);
    const {message: messageDecrypted, sticker} = useMessageRedpacket({ message: message });
    const {activeAccount} = useWallet()
    const {state, isOpen, isExpired} = useRedpacketState(message)
     const isGroup = message.type === "group"

    console.log("message gift", message);
    

    //    const messageDecrypted = useMessageDecryption({message: redPacketMessage})
    const modalSuccessContent =   <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                            <ProfilePicture address={message.fromAccount} size={32} /> Cash Gift from <ProfileName address={message.fromAccount} />
                            </div>



  // Store decrypted message in wallet state for reuse
//   useEffect(() => {
//     if (messageDecrypted) {
//       dispatch({
//         type: 'ADD_MESSAGE',
//         payload: { _id: message._id, content: messageDecrypted }
//       });
//     }
//   }, [messageDecrypted, dispatch, message._id]);
    if (isOpen && !isGroup) return <MessageTip hash={redpacket.openedBy[0].hash} ticker={redpacket.ticker}  message={message} fromRedPacket={true}/>
    return (
        <div
        onClick={() => {
            // openHashInExplorer(hash, ticker);
            setModalVisible(true);

        }}
        style={{color: 'var(--adm-color-text)', cursor: 'pointer'}}
        // style={{marginLeft: '10px', marginRight: '10px'}}
        key={message._id}
        // className={`flex ${side === "from" ? 'justify-end' : 'justify-start'} mb-1 mx-2`}
    >
       <ModalRedPacketOpen visible={modalVisible} setVisible={setModalVisible} messageDecrypted={messageDecrypted} sticker={sticker} message={message} />
        <Card
        style={{backgroundColor: "", color: "var(--adm-color-text)"}}
        >
            <div className="flex items-center gap-2 ">
                <div>
                    {
                        (isOpen || isExpired) ? <RedPacketIconOpened width={32} />: <RedPacketIcon width={32} />
                    }
                </div>
                <div className="flex flex-col">
                    <div style={{textOverflow: "ellipsis",
                overflow: "hidden",
                whiteSpace: "nowrap",
                maxWidth: 200
                }}>
                    {messageDecrypted}</div>
                  
                    <div className='text-xs' style={{

                }}> 
                {isOpen ? "Opened" : ""}
                {!isOpen && isExpired ? "Expired" : ""}
                </div>
                </div>
            </div>
               <div className="text-xs" 
            //    style={{color: 'var(--adm-color-text-secondary)'}}
               >
              <Divider style={{margin: '8px 0'}}/>
              <div style={{display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'start', marginLeft: 4, color: "var(--adm-color-text-secondary)"}}>
               <img src={networks[ticker]?.logo} style={{width: '16px', height: '16px'}} />
               {/* {networks[ticker]?.name}  */}
               NanChat Red Packet
              </div>
              {/* <AiOutlineSwap style={{display: "inline", marginRight: 4}}/>
              Transfer */}
            </div>
            {/* {amountMega} */}
            
        </Card>
    </div>
    )
}

export default MessageRedPacket;