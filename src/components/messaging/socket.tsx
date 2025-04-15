import { io } from 'socket.io-client';

export const socket = io(import.meta.env.VITE_PUBLIC_BACKEND, {
    autoConnect: false,
});

import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes, useParams } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import ChatList from './ChatList';
import { WalletCondress } from '../../../utils/format';
import SetName from './SetName';
import AccountInfo from './AccountInfo';
import { askPermission } from '../../../nano/notifications';
import useSWR, { useSWRConfig } from 'swr';
import { WalletContext } from '../Popup';
import { fetcherMessages } from './fetcher';
import { convertAddress } from '../../utils/format';
import { getChatToken } from '../../utils/storage';
import { useChats } from './hooks/use-chats';
import { unstable_serialize } from 'swr/infinite';
import { getKey } from './hooks/useChat';

const ChatSocket: React.FC = () => {
    const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    const { wallet } = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const {data: accounts, mutate} = useSWR<string[]>('/accounts', fetcherMessages);
    const {chats, mutateChats} = useChats();
    const {mutate: mutateInifinite} = useSWRConfig();

    const { account } = useParams();  // chatId
    useEffect(() => {
        getChatToken().then((token) => {
                    socket.auth = { token };
                    socket.connect();
                });
        return () => {
            socket.disconnect();
        };
    }, [activeAccount]);
    useEffect(() => {
        socket.io.on('reconnect', () => {
            // on mobile, if the app is in background, the socket connection will be lost, so we need to refresh the chats on reconnect
            // eventually we could optimize this by sending only new data, for example with a ?ts=timestamp query param instead of re fetching all chats
           mutateChats()
        });
        socket.emit('join', activeAccount);
        socket.on('accounts', (accounts: string[]) => {
            console.log('online', accounts);
            setOnlineAccount(accounts);
        });

        return () => {
            socket.off('newAccount');
            socket.off('accounts');
            socket.io.off('reconnect');
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
                        
                        mutateInifinite(unstable_serialize((index, prevPageData) => {
                            return getKey(index, prevPageData, message.chatId)
                        }), (currentPages) => {
                    if (message.fromAccount == activeAccount){
                        // mutate only status if message is from ourself
                        // find message with message.height
                        const messageIndex = currentPages[0].findIndex(m => m.height === message.height);
                        if (messageIndex !== -1) {
                            const newPages = [...(currentPages || [])];
                            newPages[0][messageIndex] = {...newPages[0][messageIndex], status: "sent"};
                            return newPages;
                        }
                    } 
                    // if (message.fromAccount !== address && chat?.type === 'private') return // don't mutate if message is not for this chat
                    const newPages = [...(currentPages || [])];
                    newPages[0] = [{...message, status: 'sent'}, ...(newPages[0] || [])];
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
            socket.on('chat', (chat) => {
                try {
                    
                
                mutateChats(currentChats => {
                    // update only the chat that is updated
                    const newChats = [...(currentChats || [])];
                    let chatIndex = newChats.findIndex(c => c.id === chat.id)
                    if (chatIndex === -1) {
                        console.log('new chat', chat);
                        newChats.unshift(chat);
                    }
                    else{
                        newChats[chatIndex] = chat;                    
                    }
                    return newChats;
                }, false);
            } catch (error) {
                console.log('error', error);       
            }
            });
            return () => {
                socket.off('chat');
            };
        }, [activeAccount, chats]);

    return (
        <>
          
        </>
    );
};

export default ChatSocket;