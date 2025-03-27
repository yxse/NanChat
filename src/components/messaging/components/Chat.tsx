import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes, useParams } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import ChatList from './ChatList';
import { socket } from '../socket';
import { WalletContext } from '../../Popup';
import { convertAddress } from '../../../utils/format';
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

const Chat: React.FC = () => {
    const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    const { wallet, dispatch } = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const {data: accounts, mutate} = useSWR<string[]>('/accounts', fetcherMessages);
    const {isMobile} = useWindowDimensions();
    const {data: me, isLoading} = useSWR(activeAccount, fetcherAccount);
    const {mutate: mutateInifinite} = useSWRConfig();
    const {chats, mutateChats} = useChats();
const {
        account
    } = useParams();
    useEffect(() => {
        getChatToken().then((token) => {
            socket.auth = { token };
            socket.connect();
            console.log('socket connected');
        });
        return () => {
            socket.disconnect();
            console.log('disconnect socket');
        };
    }, [activeAccount]);
    useEffect(() => {
        
        socket.emit('join', activeAccount);
        socket.on('accounts', (accounts: string[]) => {
            console.log('online', accounts);
            setOnlineAccount(accounts);
        });
       
        socket.on('newAccount', (account: string) => {
            console.log('newAccount', account);
            // console.log('onlineAccount', onlineAccount);
            // if (!onlineAccount.includes(account)) {
            //     setOnlineAccount(prev => [...prev, account]);
            // }
            console.log('newAccounts', accounts);

            let newAccounts = {
                online: [],
                offline: []
            }
            // newAccounts.offline = accounts.offline.filter(acc => acc._id !== account._id);
            // newAccounts.online = accounts.online.filter(acc => acc._id !== account._id);
            // newAccounts.online.push(account);
            // newAccounts.online = newAccounts.online.sort((a, b) => a.name.localeCompare(b.name));
            // console.log('newAccounts', newAccounts);
            // mutate(newAccounts, false); 

        });



        return () => {
            socket.off('newAccount');
            socket.off('accounts');
        };
    }, [activeAccount, onlineAccount, accounts]);


    useEffect(() => {
        socket.on('message', async (message: Message) => {
            try {
                
            
            console.log('message', message);
            console.log('account', account);
            if (chats.find(chat => chat.id === message.chatId) !== undefined) { // dont local mutate if chat not yet exist / just created to prevent issue new chat not showing
                            mutateChats(currentChats => { // local mutate to update last message in chat list without refetching
                                const newChats = [...(currentChats || [])];
                                const chatIndex = newChats.findIndex(chat => chat.id === message.chatId);
                                if (chatIndex !== -1) {
                                    const newChat = { ...newChats[chatIndex] };
                                    newChat.lastMessage = message.content;
                                    newChat.unreadCount = message.fromAccount === activeAccount ?
                                     0 : // don't increment unread count if message is from ourself
                                    (
                                        message.chatId === account ? 0 : // don't increment unread count if chat is the current open chat
                                        newChat.unreadCount + 1
                                    );
                                    newChat.lastMessageFrom = message.fromAccount;
                                    newChat.lastMessageTimestamp = new Date().toISOString();
                                    newChat.lastMessageId = message._id;
                                    newChat.isLocal = false;
                                    newChat.height = message.height;
                                    // move chat to top
                                    newChats.splice(chatIndex, 1);
                                    newChats.unshift(newChat);
                                }
                                return newChats;
                            }, false);
                        }
                        
                if (message.fromAccount == activeAccount) return // don't mutate if message is from ourself
                mutateInifinite(unstable_serialize((index, prevPageData) => {
                    return getKey(index, prevPageData, message.chatId)
                }), (currentPages) => {
                    // if (message.fromAccount !== address && chat?.type === 'private') return // don't mutate if message is not for this chat
                    const newPages = [...(currentPages || [])];
                    newPages[0] = [message, ...(newPages[0] || [])];
                    return newPages;
                }
                , false);

                // if (message.fromAccount !== address && chat?.type === 'private') return // don't mutate messages if not for this chat
                //                 mutate(currentPages => {
                //                     if (account == null) return // don't mutate if on /chat page to prevent showing new message if chat not selected
                //                     if (message.fromAccount !== address && chat?.type === 'private') return // don't mutate if message is not for this chat
                //                     const newPages = [...(currentPages || [])];
                //                     newPages[0] = [message, ...(newPages[0] || [])];
                //                     return newPages;
                //                 }, false);

            } catch (error) {
                console.log('error', error);
            }
            finally {
                console.log('finally');
            }
        });
        return () => {
            socket.off('message');
        };
    }, [activeAccount, chats]);
    useEffect(() => {
        // todo add modal
        askPermission();
        
    }, [])
    useEffect(() => {
        if (me && me.error === "Account not found") {
            navigate('/profile/name'); 
        }
    }
    , [ me]);
    return (
        <>
            <Routes>
                <Route path="/profile" element={<SetName />} />
                <Route path="/:account" element={
                    <div key={"chat-account"}
                     className="flex flex-row" style={{ overflow: "auto", height: "100%" }}>
                        <div
                        className='hide-on-mobile'
                         style={{
                            height: "100%", 
                            display: "flex", 
                            flexDirection: "column",
                            flexBasis: "45%", 
                            overflowY: "scroll",
                            overflowX: "hidden",
                            maxWidth: 420

                            }}>
                        <ChatList
                            onlineAccount={onlineAccount}
                            onChatSelect={(chatId) => {
                                if (isMobile) {
                                    document.startViewTransition(() => {
                                        navigate(`/chat/${chatId}`, {unstable_viewTransition: true})
                                    })
                                }
                                else {
                                    navigate(`/chat/${chatId}`)
                                }
                            }}
                        /></div>
                        <div style={{
                            height: "100%", 
                            display: "flex", 
                            flexDirection: "column",
                            // width: "100%",
                            flexBasis: "55%",
                            flexGrow: 1,
                            minWidth: 180,
                            }}>

                        <ChatRoom key={"chat-room"} onlineAccount={onlineAccount} />
                        </div>
                    </div>
                } />
                <Route path="/:account/group" element={<GroupInfo onlineAccount={onlineAccount} />} />
                <Route path="/:account/info" element={<AccountInfo onlineAccount={onlineAccount} />} />
                <Route path="/" element={<div key={"chat"} className="flex flex-row has-nav" style={{ overflow: "auto", height: "100%" }}>
                        <div
                        className='full-width-on-mobile'
                         style={{
                            height: "100%", 
                            display: "flex", 
                            flexDirection: "column",
                            // flexBasis: "45%", 
                            overflowY: "scroll",
                            overflowX: "hidden",
                            maxWidth: 420,
                            width: "100%"
                            }}>
                        <ChatList
                            onlineAccount={onlineAccount}
                            onChatSelect={(chatId) => {
                                if (isMobile) {
                                    document.startViewTransition(() => {
                                        navigate(`/chat/${chatId}`, {unstable_viewTransition: true})
                                    })
                                }
                                else {
                                    navigate(`/chat/${chatId}`)
                                }
                            }}
                        /></div>
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

                        <ChatRoom key={"chat-room"} onlineAccount={onlineAccount} />
                        </div>
                    </div>} />
            </Routes>
        </>
    );
};

export default Chat;