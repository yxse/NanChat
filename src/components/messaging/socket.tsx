import { io } from 'socket.io-client';
import { APP_PLATFORM, APP_VERSION } from '../../utils/client-version';

export const socket = io(import.meta.env.VITE_PUBLIC_BACKEND, {
    autoConnect: false,
    // in query rather than auth: socket.auth is overwritten with the chat token on connect
    query: { appVersion: APP_VERSION, appPlatform: APP_PLATFORM },
});

import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes, useParams, useLocation } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import ChatList from './ChatList';
import { WalletCondress } from '../../../utils/format';
import SetName from './SetName';
import AccountInfo from './AccountInfo';
import { askPermission } from '../../../nano/notifications';
import useSWR, { useSWRConfig } from 'swr';
import { WalletContext } from "../useWallet";
import { useWallet } from "../useWallet";
import { fetcherMessages } from './fetcher';
import { convertAddress } from "../../utils/convertAddress";
import { getChatToken } from '../../utils/storage';
import { useChats } from './hooks/use-chats';
import { unstable_serialize } from 'swr/infinite';
import { getKey } from './hooks/useChat';
import { isChatOpen, onMessagesSynced, onMessageSyncFinished, readNewestCachedPage, storeIncomingMessage } from './message-cache';
import { LIMIT_MESSAGES_INITIAL } from './utils';
import { isMentionNotified, isMentionNotifiedWhenMuted } from './mentions';
import i18n from '../../i18n';

// most recent chats whose newest page is preloaded into the (persisted) SWR cache
const PRELOAD_CHATS = 30;
// chats whose cached pages survive the launch pruning (recently opened chats are usually among them)
const PRUNE_KEEP_CHATS = 100;
import { sendNotificationTauri } from '../../nano/notifications';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Modal, Toast } from 'antd-mobile';
import Sticker from './components/Sticker';
import { ModalReceive } from '../app/Network';
import useLocalStorageState from 'use-local-storage-state';

const ChatSocket: React.FC = () => {
    const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    

    // payment request handling
    const [paymentTicker, setPaymentTicker] = React.useState<string | null>(null);
    const [paymentAddress, setPaymentAddress] = React.useState<string>("");
    const [paymentAmount, setPaymentAmount] = React.useState<string>("");
    const [paymentTitle, setPaymentTitle] = React.useState<string>("Payment request");
    const [paymentVisible, setPaymentVisible] = React.useState<boolean>(false);
    const [developerMode] = useLocalStorageState("developer-mode", { defaultValue: false });

    const {activeAccount, activeAccountPk, wallet} = useWallet()
    const {chats, mutateChats} = useChats();
    const {mutate: mutateInifinite, cache: swrCache} = useSWRConfig();
    const location = useLocation();
    const { account } = useParams();  // chatId
    useEffect(() => {
        getChatToken(activeAccountPk).then((token) => {
                    socket.auth = { token };
                    socket.connect();
                    console.log('socket connected');
                    // mutateChats()
                });
        return () => {
            socket.disconnect();
            console.log('disconnect socket');
        };
    }, [activeAccount]);
    const onReconnect = () => {
            console.log('reconnect socket');
            socket.emit('join', activeAccount);
            for (let ticker of Object.keys(wallet.wallets)) {
                wallet.wallets[ticker]?.receiveAllActiveAccount();
              }
            // on mobile, if the app is in background, the socket connection will be lost, so we need to refresh the chats on reconnect
            // eventually we could optimize this by sending only new data, for example with a ?ts=timestamp query param instead of re fetching all chats
    }
    const onConnect = () => {
            console.log('socket open');
            mutateChats()
    }
    useEffect(() => {
        socket.io.on('reconnect', onReconnect);
        socket.on('connect', onConnect)

        socket.emit('join', activeAccount);

        return () => {
            socket.io.off('reconnect', onReconnect);
            socket.off('connect', onConnect)
        };
    }, [activeAccount, onlineAccount]);

    
    useEffect(() => {
        const handleAllMessage = async (message: Message) => {
            try {
                
            
            console.log('message', message);
            // keep the message store up to date, so the chat opens from it without a request
            const decryptedMessage = storeIncomingMessage(message, activeAccount, activeAccountPk);
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
                                    if (message.fromAccount === activeAccount || message.chatId === account) {
                                        newChat.unreadMention = false;
                                    }
                                    else if (isMentionNotified(message, newChat, activeAccount)) {
                                        newChat.unreadMention = true; // "[@you]" in the chats list
                                    }
                                    newChat.lastMessageFrom = message.fromAccount;
                                    newChat.lastMessageTimestamp = new Date().toISOString();
                                    newChat.lastMessageId = message._id;
                                    newChat.lastMessageType = message.type;
                                    newChat.isLocal = false;
                                    newChat.height = message.height;
                                    // move chat to top
                                    newChats.splice(chatIndex, 1);
                                    newChats.unshift(newChat);
                                }
                                return newChats;
                            }, false);
                        }

                        // show it decrypted: an encrypted message renders empty until decrypted, then pops in without
                        // its enter animation (the encrypted content is kept, as for any message of the page)
                        const decrypted = await decryptedMessage;
                        const shownMessage = decrypted ? { ...decrypted, content: message.content } : message;
                        mutateInifinite(unstable_serialize((index, prevPageData) => {
                            return getKey(index, prevPageData, message.chatId)
                        }), (currentPages) => {
                            // chat never loaded: don't create a page with only this message, the chat loads from the message store
                            if (!currentPages) return currentPages;
                            if (message.fromAccount === activeAccount &&
                                currentPages?.[0].find(m => m._id === message._id) !== undefined) return currentPages; // don't mutate if message already exist, happens if we send the message, and still useful if chat opens on another device 
                    // if (message.fromAccount == activeAccount){
                    //     return currentPages;
                    //     // // mutate only status if message is from ourself
                    //     // // find message with message.height
                    //     // const messageIndex = currentPages?.[0].findIndex(m => m.height === message.height);                           
                    //     // //messageIndex can be undefined if new private chat
                    //     // debugger
                    //     // if (messageIndex !== -1 && messageIndex !== undefined) {
                    //     //     const newPages = [...(currentPages || [])];
                    //     //     newPages[0][messageIndex] = {...newPages[0][messageIndex], status: "sent", _id: message._id}; // update with real message id
                    //     //     return newPages;
                    //     // }
                    // } 
                    // if (message.fromAccount !== address && chat?.type === 'private') return // don't mutate if message is not for this chat
                    const newPages = [...(currentPages || [])];
                    newPages[0] = [{...shownMessage, status: 'sent'}, ...(newPages[0] || [])];
                    // deduplicate messages, can sometime happen on reconnect probably cause race condition socket & fetchMessages
                    newPages[0] = newPages[0].filter((msg, index, self) =>
                        index === self.findIndex((m) => m._id === msg._id)
                    );
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

            if (isTauri()) {
                const appWindow = getCurrentWindow();
                const isFocused = await appWindow.isFocused();
                console.log('isFocused', isFocused);
                if (isFocused) return; // don't show notification if app is focused
                if (location.pathname !== `/chat/${message.chatId}`) {
                    const chat = chats.find(c => c.id === message.chatId);
                    const mentioned = isMentionNotified(message, chat, activeAccount);
                    if (chat?.muted && !isMentionNotifiedWhenMuted(message, chat, activeAccount)) return; // muted, except the @mentions
                    sendNotificationTauri(message.fromAccountName, mentioned ? i18n.t('mentionedYou') : "New message");
                }
            }
    }
        socket.on('message', handleAllMessage)
        return () => {
            socket.off('message', handleAllMessage);
        };
    }, [activeAccount, activeAccountPk, chats]);

    // Preload the newest page of closed chats from the message store into the SWR cache, so moving from the chats
    // list to a chat room shows its messages instantly (no loading state, no request).
    // Only the most recent chats are preloaded: the SWR cache is persisted (swr-idb-cache), every entry is loaded at
    // launch and written back by useChat's reset, so an entry per chat (thousands) made launch and every chat switch
    // slow. Other chats open from the message store (one indexed read).
    const recentChatIdsRef = React.useRef<Set<string>>(new Set());
    recentChatIdsRef.current = React.useMemo(
        () => new Set((chats || []).slice(0, PRELOAD_CHATS).map((c) => c?.id).filter(Boolean)),
        [chats],
    );
    useEffect(() => {
        const infiniteKey = (chatId: string) => unstable_serialize((index, prev) => getKey(index, prev, chatId));
        const preload = async (chatId: string, onlyIfMissing: boolean) => {
            if (isChatOpen(chatId)) return; // an open chat refreshes itself (useChat)
            const key = infiniteKey(chatId);
            const inCache = !!swrCache.get(key)?.data;
            if (onlyIfMissing && inCache) return;
            if (!inCache && !recentChatIdsRef.current.has(chatId)) return; // see PRELOAD_CHATS
            try {
                const page = await readNewestCachedPage(chatId, LIMIT_MESSAGES_INITIAL);
                if (page && !isChatOpen(chatId)) await mutateInifinite(key, [page], { revalidate: false });
            } catch (error) {
                console.log('preload chat failed', chatId, error);
            }
        };
        // chats with new messages: replace the (stale) preloaded page
        const offSynced = onMessagesSynced((chatId) => preload(chatId, false));
        // after a sync: the most recent chats that have no page in memory yet
        const offFinished = onMessageSyncFinished(async (syncedChats) => {
            for (const chat of syncedChats.slice(0, PRELOAD_CHATS)) {
                if (chat?.id) await preload(chat.id, true);
            }
        });
        return () => {
            offSynced();
            offFinished();
        };
    }, [activeAccount]);

    // Drop the cached message pages of chats outside the most recent ones (earlier builds preloaded every synced chat,
    // leaving thousands of entries). Once per session, in small batches so the deletes never block the UI.
    const prunedRef = React.useRef(false);
    useEffect(() => {
        if (prunedRef.current || !Array.isArray(chats) || chats.length === 0) return;
        prunedRef.current = true;
        const keep = new Set(chats.slice(0, PRUNE_KEEP_CHATS).map((c) => c?.id));
        const stale: string[] = [];
        for (const key of swrCache.keys()) {
            if (!key.startsWith('$inf$/messages?')) continue;
            const chatId = new URLSearchParams(key.slice(key.indexOf('?') + 1)).get('chatId');
            if (chatId && !keep.has(chatId) && !isChatOpen(chatId)) stale.push(key);
        }
        if (!stale.length) return;
        console.log('swr cache: pruning', stale.length, 'message pages');
        // not cancelled when chats change (they do on every refresh): runs to the end once started
        const step = () => {
            for (const key of stale.splice(0, 200)) {
                const chatId = new URLSearchParams(key.slice(key.indexOf('?') + 1)).get('chatId');
                if (!chatId || !isChatOpen(chatId)) swrCache.delete(key);
            }
            if (stale.length) setTimeout(step, 50);
        };
        setTimeout(step, 2000); // after the launch work
    }, [chats]);

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
     useEffect(() => {
        const stickersId = ['14544', '2786', 'duck-2']
        const handleError = (error) => {
            console.log('Socket error:', error);
            if (error.error === 'Rate limit exceeded') {
            Modal.clear()
            Modal.alert({
                content: <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
                    <Sticker stickerId={stickersId[Math.floor(Math.random() * stickersId.length)]} width={96} />
                    <br />
                    Rate limited. Please slow down a bit.
                </div>,
                confirmText: 'OK',
            })
            }
        }
        socket.on('error', handleError);
            return () => {
                socket.off('error', handleError);
            };
        }, [activeAccount]);

    // Merchant "pull" payment requests: a merchant scanned this user's QR (see
    // /payment-request in the backend). Open the standard send confirm popup
    // (titled "Payment request") prefilled with the merchant address & amount,
    // reusing all validation + PIN. Its Cancel button denies the request.
    useEffect(() => {
        const handlePaymentRequest = async (request) => {
            try {
                const { address, amount, ticker, merchantName } = request || {};
                if (!ticker || !wallet.wallets[ticker]) {
                    Toast.show({ content: `Received an unsupported payment request (${ticker})` });
                    return;
                }
                Modal.clear();
                setPaymentTicker(ticker);
                setPaymentAddress(address);
                setPaymentAmount(String(amount));
                setPaymentTitle(merchantName ? `Payment request from ${merchantName}` : 'Payment request');
                setPaymentVisible(true);
            } catch (e) {
                console.log('payment-request error', e);
            }
        };
        socket.on('payment-request', handlePaymentRequest);
        return () => {
            socket.off('payment-request', handlePaymentRequest);
        };
    }, [activeAccount, wallet]);

    if (!paymentVisible) return null;
    if (!developerMode) return null; // payment request currently only available in developer mode
    return (
        <>
          <ModalReceive
            action="send"
            ticker={paymentTicker}
            modalVisible={paymentVisible}
            setModalVisible={setPaymentVisible}
            setAction={() => {}}
            defaultAddress={paymentAddress}
            defaultAmount={paymentAmount}
            autoConfirm={paymentVisible}
            confirmTitle={paymentTitle}
            onClose={() => { setPaymentTicker(null); setPaymentAddress(""); setPaymentAmount(""); }}
          />
        </>
    );
};

export default ChatSocket;