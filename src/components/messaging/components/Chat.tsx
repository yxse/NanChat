import React, { useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes, useParams } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import ChatList from './ChatList';
import { socket } from '../socket';
import { WalletContext } from "../../useWallet";
import { convertAddress } from "../../../utils/convertAddress";
import SetName from './SetName';
import AccountInfo from './AccountInfo';
import { askPermission } from '../../../nano/notifications';
import { fetcherAccount, fetcherMessages } from '../fetcher';
import useSWR from 'swr';
import { getChatToken } from '../../../utils/storage';
import { useWindowDimensions } from '../../../hooks/use-windows-dimensions';
import { Toast } from 'antd-mobile';
import GroupInfo from './GroupInfo';
import { useSWRConfig } from "swr"
import { unstable_serialize } from 'swr/infinite'
import { getKey } from '../hooks/useChat';
import { useChats } from '../hooks/use-chats';
import RedPacketResult from '../../app/redpacket/RedPacketResult';
import GroupsInCommon from './group/GroupsInCommon';

const Chat: React.FC = () => {
    const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    const { wallet, dispatch } = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    // const {data: accounts, mutate} = useSWR<string[]>('/accounts', fetcherMessages);
    const {isTablet, isMobile} = useWindowDimensions();
    const {data: me, isLoading, mutate} = useSWR(activeAccount, fetcherAccount);
    const [isRegistered, setIsRegistered] = useState(true)
    //     getChatToken().then((token) => {
    //         socket.auth = { token };
    //         socket.connect();
    //         console.log('socket connected');
    //     });
    //     return () => {
    //         socket.disconnect();
    //         console.log('disconnect socket');
    //     };
    // }, [activeAccount]);

    useEffect(() => {
        // todo add modal
        askPermission();
        
    }, [])
    useEffect(() => {
        async function navigateToNameIfNotRegistered() {
            if (me && !me?.name) {
                debugger
                await mutate()
                if (me && !me?.name) {
                    // navigate('/profile/name'); 
                    setIsRegistered(false)
                    return
                }
                else {
                    setIsRegistered(true)
                }
            }
            else {
                setIsRegistered(true)
            }
        }
        navigateToNameIfNotRegistered()
    }
    , [ me]);
    function navigateWithTransition(path: string) {
        if (document.startViewTransition) {
            let reduceMotion = document.documentElement.classList.contains('no-animation')
            if (reduceMotion) {
                navigate(path)
                return
            }
            document.startViewTransition(() => {
                navigate(path, {unstable_viewTransition: true})
            })
        }
        else {
            navigate(path)
        }
    }
    if (!isRegistered) {
        return <SetName />
    }
    return (
        <>
            <Routes>
                <Route path="/red-packet-result" element={<RedPacketResult  />}/>
                <Route path="/profile" element={<SetName />} />
                <Route path="/:account" element={
                    <div key={"chat-account"}
                     className="flex flex-row" style={{ overflow: "auto", height: "100%" }}>
                        {
                            (!isMobile || isTablet) &&
                        
                        <div
                        className='hide-on-mobile'
                         style={{
                            height: "100%", 
                            display: "flex", 
                            flexDirection: "column",
                            flexBasis: "45%", 
                            maxWidth: 420

                            }}>
                        <ChatList
                            onChatSelect={(chatId) => {
                                if (isTablet) {
                                    navigateWithTransition(`/chat/${chatId}`)
                                }
                                else {
                                    navigate(`/chat/${chatId}`)
                                }
                            }}
                        /></div>}
                        <div style={{
                            height: "100%", 
                            display: "flex", 
                            flexDirection: "column",
                            // width: "100%",
                            flexBasis: "55%",
                            flexGrow: 1,
                            minWidth: 180,
                            }}>

                        <ChatRoom key={"chat-room-1"} />
                        </div>
                    </div>
                } />
                <Route path="/:account/group" element={<GroupInfo />} />
                <Route path="/:account/info" element={<AccountInfo />} />
                <Route path="/:account/info/groups" element={<GroupsInCommon />} />
                <Route path="/" element={<div key={"chat"} className="flex flex-row has-nav" style={{ overflow: "auto", height: "100%" }}>
                        <div
                        className='full-width-on-mobile'
                         style={{
                            height: "100%", 
                            display: "flex", 
                            flexDirection: "column",
                            // flexBasis: "45%", 
                            maxWidth: 420,
                            width: "100%"
                            }}>
                        <ChatList
                            
                            onChatSelect={(chatId) => {
                                if (isMobile || isTablet) {
                                    navigateWithTransition(`/chat/${chatId}`)
                                }
                                else {
                                    navigate(`/chat/${chatId}`)
                                }
                            }}
                        /></div>
                        {
                             (!isMobile || isTablet) &&
                        
                        <div
                        className='hide-on-mobile'
                         style={{
                            height: "100%", 
                            display: "flex", 
                            flexDirection: "column",
                            // width: "100%",
                            flexBasis: "55%",
                            flexGrow: 1,
                            minWidth: 180,
                            }}>

                        <ChatRoom key={"chat-room-2"}  />
                        </div>}
                    </div>} />
            </Routes>
        </>
    );
};

export default Chat;