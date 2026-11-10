import { BellMuteOutline, LockFill, LockOutline, MailOutline, MessageOutline, MoreOutline, PhoneFill, SearchOutline, SendOutline, TeamOutline, UserOutline } from "antd-mobile-icons";
import { useTranslation } from "react-i18next";
import { useOpenChatSearch, useSearchShortcut } from "./MessageSearch";
import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BiChevronLeft, BiMessageSquare } from "react-icons/bi";
import { FiMoreHorizontal } from "react-icons/fi";
import { IoSendOutline } from "react-icons/io5";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { socket } from "../socket";
import { WalletContext } from "../../useWallet";
import { formatAddress, ShareModal } from "../../../utils/format";
import { convertAddress } from "../../../utils/convertAddress";
import { CopyToClipboard } from "../../Settings";
import SelectAccount from "../../app/SelectAccount";
import { AccountIcon } from "../../app/Home";
import { Button, DotLoading, Input, List, Modal, NavBar, SafeArea, Skeleton, Space, SpinLoading, Toast } from "antd-mobile";
import useSWR from "swr";
import { fetcherAccount, fetcherMessages, joinRequest } from "../fetcher";
import { saveMessageCache } from "../message-cache";
import { box } from "multi-nano-web";
import ChatInputMessage from "./ChatInputMessage";
import useSWRInfinite from "swr/infinite";
import { getKey, useChat } from "../hooks/useChat";
import Message, { InfoMessageEncrypted, WelcomeMessage } from "./Message";
import useDetectKeyboardOpen from "../../../hooks/use-keyboard-open";
import GroupAvatar from "./group-avatar";
import ProfilePicture from "./profile/ProfilePicture";
import NewMessageWarning from "./NewMessageWarning";
import { sendNotificationTauri } from "../../../nano/notifications";
import { useBreakpoint } from "../../../hooks/use-windows-dimensions";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import ProfileName from "./profile/ProfileName";
import { formatOnlineStatus } from "../../../utils/telegram-date-formatter";
import { HeaderStatus } from "./HeaderStatus";
import { StatusBar } from "@capacitor/status-bar";
import { LIMIT_MESSAGES_INITIAL, shouldStickToBottom, TEAM_ACCOUNT, useImmediateSafeMutate } from "../utils";
import { useHideNavbarOnMobile } from "../../../hooks/use-hide-navbar";
import { useInviteFriends } from "../hooks/use-invite-friends";
import { useChats } from "../hooks/use-chats";
import { useSWRConfig } from "swr"
import { unstable_serialize } from 'swr/infinite'
import { debounce } from 'lodash';
import { removeData } from "../../../services/database.service";
import { Capacitor } from "@capacitor/core";
import { VirtualizedMessagesVirtua } from "./VirtualizedMessagesVirtua";
import MessageList, { MessageListHandle } from "./messages/MessageList";
import { DelayedSpinner } from "./DelayedSpinner";
import { App } from "@capacitor/app";
import ChatLocked from "./group/ChatLocked";
import ActiveCallBanner from "../call/ActiveCallBanner";
import { useElementHeight } from "../../../hooks/use-element-height";


const ChatRoom: React.FC<{}> = ({  }) => {
    const {mutate: mutateInifinite} = useSWRConfig();
    const {
        account
    } = useParams();
    // const [messages, setMessages] = useState<Message[]>([]);
    const messageListRef = useRef<MessageListHandle>(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // opened from a search result: ?msg=<message id>&h=<height>
    const searchTargetId = searchParams.get('msg');
    const searchTargetHeight = Number(searchParams.get('h'));
    const initialTarget = useMemo(
        () => (searchTargetId && Number.isInteger(searchTargetHeight) ? { _id: searchTargetId, height: searchTargetHeight } : null),
        [searchTargetId, searchTargetHeight],
    );
    const { wallet } = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
    // const { data: messagesHistory } = useSWR<Message[]>(`/messages?chatId=${account}`, fetcherMessages);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);
    // const isKeyboardOpen = useDetectKeyboardOpen(); // used to fix scroll bottom android when keyboard open and new message sent
    const {width} = useBreakpoint();
    //   const { ref: messagesEndRef, setScroll } = useScrollRestoration('contacts', {
    //     persist: 'localStorage',
    //   });
    const virtuaRef = useRef(null);
    const { inviteFriends } = useInviteFriends();
    const {
        messages,
        loadMore,
        mutate,
        isLoadingMore,
        isLoadingInitial,
        isLoadingFirstPage,
        hasMore,
        reset
    } = useChat(account);
    const {isMobile, isTablet} = useBreakpoint()
    const {chat, isLoading} = useChats(account);
    const { t } = useTranslation();
    const openChatSearch = useOpenChatSearch();
    useSearchShortcut(chat?.id); // Ctrl+F: search in this chat (all chats when none is open)
    const safeMutate = useImmediateSafeMutate(mutate);
    // android and web/desktop use the virtua virtualizer; ios uses the non-virtualized MessageList
    // (virtua has scroll inertia issues on webkit, see https://github.com/inokawa/virtua/issues/473)
    const virtualized = Capacitor.getPlatform() !== 'ios'
    // the header floats over the messages (translucent, blurred), the lists reserve its height as top padding.
    // measured because the active call banner changes it
    const [headerRef, headerHeight] = useElementHeight();
    // console.log("chats", chat);
    // const chat = chats?.find(chat => chat.id === account);
    const names = chat?.participants;
    let participant = names?.find(participant => participant._id !== activeAccount)
    if (chat?.participants[0]?._id === chat?.participants[1]?._id) {
        participant = chat?.participants[0];
    }
    let address = chat?.type === "group" ? chat?.creator : participant?._id;
    let isNew = false
    if (account?.startsWith('nano_')) {
        address = account;
        isNew = true;
    }
    const isNewChat = chat && !chat?.accepted && activeAccount !== chat?.creator
    const showSpinnerLoadingMoreInHeader = (!isLoadingInitial && !isLoadingFirstPage && messages.length >= LIMIT_MESSAGES_INITIAL) && isLoadingMore && virtualized // we show spinner in header when using virtualizer to maybe prevent content shift / fix scroll to bottom
    // const showSpinnerLoadingMoreInHeader = false
    const { data: nanwalletAccount, isLoading: isLoadingNanwalletAccount } = useSWR(isNew ? address : null, fetcherAccount);
    const location = useLocation();
    const accountExists = isLoadingNanwalletAccount || nanwalletAccount?.error === undefined;
    const chatLocked = (chat == null && 
        (!account?.startsWith('nano_')   // don't show chat locked only for 1:1 chat
        && account != null)) // don't show chat locked if no chat selected
    // useEffect(() => {
    //     if (pages) {
    //         setMessages(messagesHistory);
    //     }
    // }, [pages, messagesEndRef]);


    useEffect(() => { 
    let listener;
    
    const setupListener = async () => {
        listener = await App.addListener('resume', () => {
            console.log('app resume, mutate messages');
            safeMutate()
        });
    };
    
    setupListener();
    
    return () => {
        if (listener) {
            listener.remove();
        }
    };
}, [])
    const onReconnect = () => {
        console.log('reconnect socket mutate messages');
        safeMutate()
    }
     useEffect(() => {
            socket.io.on('reconnect', onReconnect)
                // refetch messages when reconnect
                // on mobile, if the app is in background, the socket connection will be lost, so we need to refresh the message on reconnect
                 // eventually we could optimize this by sending only new data, for example with a ?ts=timestamp query param instead of re fetching all messages
            return () => {
                socket.io.off('reconnect', onReconnect);
            };
        }, [account]);

    const mutateRef = useRef(mutate);
    const activeAccountRef = useRef(activeAccount);
    const activeAccountPkRef = useRef(activeAccountPk);
    useEffect(() => {
        mutateRef.current = mutate;
        activeAccountRef.current = activeAccount;
        activeAccountPkRef.current = activeAccountPk;
    });

    useEffect(() => {
        if (!account) return;
        socket.emit('join', account); // join chat id
        const onJoinRequestUpdate = (newMessage) => {
            console.log("join request update", newMessage);
            mutateRef.current(currentPages => {
                // find by id and update
                const newPages = [...(currentPages || [])];
                const messageIndex = newPages[0].findIndex(message => message._id === newMessage._id);
                if (messageIndex !== -1) {
                    newPages[0][messageIndex] = newMessage;
                    saveMessageCache(newMessage.chatId, newMessage, activeAccountRef.current, activeAccountPkRef.current)
                }
                return newPages;

            }, false);
        };
        const onDeleteMessage = ({chatId, height, messageSystem}) => {
            console.log("recalled message", height); // best effort is to remove message from local cache, but not guaranteed to be removed by everyone cache
            mutateRef.current(currentPages => {
                const newPages = [...(currentPages || [])];
                const messageIndex = newPages[0].findIndex(message => message.height === height);
                if (messageIndex !== -1) {
                    debugger
                    newPages[0][messageIndex] = messageSystem;
                    saveMessageCache(chatId, messageSystem, activeAccountRef.current, activeAccountPkRef.current)
                }
                return newPages;
            }, false);
        };
        socket.on('update-join-request-message', onJoinRequestUpdate);
        socket.on('delete-message', onDeleteMessage);

        return () => {
            socket.emit('leave', account);
            socket.off('update-join-request-message', onJoinRequestUpdate);
            socket.off('delete-message', onDeleteMessage);
        };
    }, [account]);


    const scrollToBottom = () => {
        messageListRef.current?.scrollToBottom();
    };

    useHideNavbarOnMobile(account);

    useEffect(() => {
        if (messages[0]?.error && messages[0]?.chatId !== null && messages[0]?.error == "Chat already exists"){ // chat already exists
            navigate('/chat/' + messages?.[0]?.chatId, { replace: true });
        }
    }, [messages])

    // console.log("messages", messages.length)

    // the virtua list goes to the bottom by itself when we send a message (it slides to it); not with virtua's
    // scrollToIndex here: called before the message is added, it targeted the previous last message and kept
    // re-applying it while stickers / images loaded, pulling the list up away from the sent message
    const onSent = useCallback(() => {
    setTimeout(() => {
        scrollToBottom();
    }, 0);
}, [scrollToBottom]);
useEffect(() => {
    // virtua only: trim loaded pages unless its scroll cache will restore the position (MessageList handles this itself)
    if (virtualized && ((!isMobile && !isTablet) || !sessionStorage.getItem("list-cache-v2-" + chat?.id))) {
        reset()
    }
}, [account]);
    const StartConversation = ({address}) => {
        if (!accountExists) return null;
        return (  <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <div
                style={{
                    borderRadius: 32,
                    padding: 8,
                    paddingRight: 16,
                    paddingLeft: 16,
                    backgroundColor: 'var(--adm-color-background)',
                }}
            >
                Start a conversation with <ProfileName address={address} fallback={formatAddress(address)} />
            </div>
            </div>
            )
    }
    // large screens: search in this chat, opens next to it (on phones: from the contact / group info)
    const searchButton = chat?.id && (!isMobile || isTablet) ? (
        <SearchOutline
            fontSize={24}
            aria-label={t('searchMessages')}
            onClick={() => openChatSearch(chat.id)}
        />
    ) : null;
    const HeaderPrivate = () => {
        return (
            <NavBar
            
                className="app-navbar"
                backArrow={true}
                onBack={() => {
                    navigate('/chat');
                }}
                right={
                    <span style={{float: "right", cursor: "pointer", display: "flex", gap: 16}}>
                    {searchButton}
                    <UserOutline
                    onClick={() => {
                        navigate(`/chat/${address}/info`);
                    }}
                    fontSize={24} /></span>
                }
                >
                   <div 
                   // contain inline-size: the name width must not count in the min-content width of the parent
                   // flex layouts, otherwise a long name widens the whole page (horizontal scroll)
                   style={{cursor: "pointer", contain: "inline-size"}}
                   onClick={() => {
                    navigate(`/chat/${address}/info`);
                }}
                   className="flex-1 min-w-0 text-center">
                    <h2 className="flex items-center justify-center gap-2 min-w-0">
                    <span className="truncate min-w-0"><ProfileName address={address} fallback={formatAddress(address)} /></span>
                    {chat?.muted && <BellMuteOutline fontSize={18} style={{marginRight: 8}}/>}
                    {/* <DotLoading /> */}
                    <DelayedSpinner isLoading={isLoadingFirstPage || showSpinnerLoadingMoreInHeader} delay={showSpinnerLoadingMoreInHeader ? 300 : 400} spinnerProps={{style:{width: 24}}}/>
                    </h2>
                </div>
                </NavBar>
                
        )
        
    }
    const HeaderGroup = () => {
        return (
            <NavBar
                className="app-navbar "
                backArrow={true}
                onBack={() => {
                    navigate(`/chat`);
                }}
                right={
                    <span style={{float: "right", cursor: "pointer", display: "flex", gap: 16}}>
                    {searchButton}
                    <MoreOutline
                    onClick={() => {
                        navigate(`/chat/${
                            account
                        }/group`);
                    }}
                    fontSize={24} /></span>
                }
                >
                   <div 
                   style={{
                    cursor: "pointer", 
                }}
                   onClick={() => {
                    navigate(`/chat/${
                        account
                    }/group`);
                }}
                   className="text-center">
                    <h2 
                    
                    className="flex items-center justify-center gap-2">
                    <span
                    style={{
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        maxWidth: width - 160 - 28
                    }}
                    >{chat?.name || 'Group Chat'}</span>
                    ({chat?.participants.length})
                    {chat?.muted && <BellMuteOutline fontSize={18} style={{marginRight: 8}}/>}
                    <DelayedSpinner isLoading={isLoadingFirstPage || showSpinnerLoadingMoreInHeader} delay={showSpinnerLoadingMoreInHeader ? 300 : 400} spinnerProps={{style:{width: 24}}}/>
                    </h2>
                </div>
                </NavBar>
                
        )
        
    }

    // console.log("messages", messages);
    if (chatLocked) {
        return <ChatLocked />
    }
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                // overflow: 'auto',
                height: '100%',
                width: '100%',
                position: 'relative',
                ['--chat-header-height' as any]: `${headerHeight}px`,
                // flexGrow: 1,
                justifyContent: "space-between"
                // animation: "slide-in 0.4s",
                // animationIterationCount: "1",
                // animationFillMode: "forwards",
            }}>
            {
                account != null && (
                    <div
                    ref={headerRef}
                    className="chat-header-glass"
                    // prefix={
                    //     <AccountIcon account={account} width={48} />
                    // }
                    >
                        {
                            // called, not rendered as <HeaderGroup />: they are redefined on every render, as components React would
                            // remount the whole header each time (name, icons and loading spinner flashing)
                            chat?.type === 'group' ? HeaderGroup() : HeaderPrivate()
                        }
                        {chat?.type === 'group' && <ActiveCallBanner chatId={chat.id} />}
                    </div>
                )
            }

            {
                account == null && (
                    <div

                        className="flex items-center justify-center h-full">
                        <span
                            style={{
                                borderRadius: 32,
                                padding: 8,
                                paddingRight: 16,
                                paddingLeft: 16,
                                backgroundColor: 'var(--adm-color-background)',
                            }}
                        >

                            Select a chat to start messaging
                        </span>
                    </div>
                )
            }
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'auto',
                    height: '100vh', 
                    justifyContent: 'space-between',
                    // width: '100%',
                    // flexGrow: 1,
                    // justifyContent: "space-between"
                    // animation: "slide-in 0.4s",
                    // animationIterationCount: "1",
                    // animationFillMode: "forwards",
                }}>
                <div
                    id=""
                    // ref={messagesEndRef}
                    style={{
                        // position: 'absolute', top: '0', bottom: '0',
                        overflow: 'hidden',
                        // width: '100%',
                        // //  marginTop: '9vh',
                        // // marginBottom: 92, 
                        // display: 'flex',
                        //   flexGrow: 1,
                    }}
                >
                    {
                        isLoadingInitial ? (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                height: 'calc(100vh - 45px - 58px - var(--safe-area-inset-bottom) - var(--safe-area-inset-top))',
                                width: '100%',
                                // the header floats over this area (absolute): center the spinner below it
                                paddingTop: 'var(--chat-header-height, 0px)',
                                boxSizing: 'content-box',
                            }}>
                                <SpinLoading style={{width: 48}} />
                            </div>
                        ) : (messages.length === 0 && account != null) ? (
                            <div style={{height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingTop: 'var(--chat-header-height, 0px)'}}>
                                <InfoMessageEncrypted />
                                {chat?.creator === TEAM_ACCOUNT ? <WelcomeMessage /> : StartConversation({address})}
                            </div>
                        ) : account == null ? null : !virtualized ? (
                            <MessageList
                                key={account}
                                ref={messageListRef}
                                chatId={account}
                                chatType={chat?.type}
                                isFromTeam={chat?.creator === TEAM_ACCOUNT}
                                messages={messages}
                                hasMore={hasMore}
                                isLoadingMore={isLoadingMore}
                                loadMore={loadMore}
                                restoreScroll={isMobile}
                                onOpenAtBottom={reset}
                                initialTarget={initialTarget}
                                topInset={headerHeight}
                            />
                        ) : (
                            <div id="scrollableDiv" style={{height: "100%", width: '100%', overflow: "hidden", display: "block"}}>
                                <VirtualizedMessagesVirtua
                                    isNewChat={isNewChat}
                                    isLoadingFirstPage={isLoadingFirstPage}
                                    virtuaRef={virtuaRef}
                                    activeAccount={activeAccount}
                                    activeAccountPk={activeAccountPk}
                                    chat={chat}
                                    hasMore={hasMore}
                                    messages={messages}
                                    fetchNextPage={loadMore}
                                    isFetchingNextPage={isLoadingMore}
                                    initialTarget={initialTarget}
                                    topInset={headerHeight}
                                />
                            </div>
                        )
                    }
                </div>
                <div
                    style={(account == null
                        || (!accountExists)
                    ) ? { display: 'none' } : {}}
                >
                     {
                    isNewChat &&
                    <NewMessageWarning fromAddress={address} account={activeAccount} chat={chat} />
                }
                    <ChatInputMessage
                    // chat={chat}
                    // mutateChats={mutateChats}
                        messageInputRef={messageInputRef}
                        onSent={onSent}
                        onTouch={() => {
                            if (!virtualized)
                                onSent()
                            // scroll bottom when focus input
                        }} 
                    />
                </div>
               
                {
                    !accountExists && account != null && (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                            }}
                        >
                            <div
                                style={{
                                    borderRadius: 32,
                                    padding: 8,
                                    paddingRight: 16,
                                    paddingLeft: 16,
                                    backgroundColor: 'var(--adm-color-background)',
                                }}
                            >
                                This account is not yet on NanChat
                            </div>
                            <Button 
                            color="primary"
                            onClick={() => {
                                inviteFriends();
                            }}
                            className="mt-4"
                            size="middle"
                            shape="rounded"
                            >
                                <Space align="center">
                                <MailOutline />
                                Invite
                                </Space>
                            </Button>
                        </div>
                    )
                }
            </div>
            <div 
            style={{
                "paddingBottom": "calc(var(--safe-area-inset-bottom, 0px) + var(--android-inset-bottom, 0px))",
                "backgroundColor": "var(--adm-color-background)"
            }}></div>
           {/* <SafeArea
           
            style={{
                     backgroundColor: "var(--adm-color-background)"
                   }} position="bottom" /> */}
        </div>
    );
};

export default ChatRoom;