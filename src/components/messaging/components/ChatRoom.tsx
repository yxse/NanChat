import { LockFill, LockOutline, MailOutline, MessageOutline, MoreOutline, PhoneFill, SendOutline, TeamOutline, UserOutline } from "antd-mobile-icons";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { BiChevronLeft, BiMessageSquare } from "react-icons/bi";
import { FiMoreHorizontal } from "react-icons/fi";
import { IoSendOutline } from "react-icons/io5";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { socket } from "../socket";
import { WalletContext } from "../../Popup";
import { convertAddress, formatAddress, ShareModal } from "../../../utils/format";
import { CopyToClipboard } from "../../Settings";
import SelectAccount from "../../app/SelectAccount";
import { AccountIcon } from "../../app/Home";
import { Button, DotLoading, Input, List, Modal, NavBar, SafeArea, Skeleton, Space, Toast } from "antd-mobile";
import useSWR from "swr";
import { fetcherAccount, fetcherMessages, joinRequest } from "../fetcher";
import { box } from "multi-nano-web";
import ChatInputMessage from "./ChatInputMessage";
import useSWRInfinite from "swr/infinite";
import { getKey, useChat } from "../hooks/useChat";
import InfiniteScroll from 'react-infinite-scroll-component';
import Message, { InfoMessageEncrypted, WelcomeMessage } from "./Message";
import useDetectKeyboardOpen from "../../../hooks/use-keyboard-open";
import GroupAvatar from "./group-avatar";
import ProfilePicture from "./profile/ProfilePicture";
import NewMessageWarning from "./NewMessageWarning";
import { sendNotificationTauri } from "../../../nano/notifications";
import { useWindowDimensions } from "../../../hooks/use-windows-dimensions";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import ProfileName from "./profile/ProfileName";
import { formatOnlineStatus } from "../../../utils/telegram-date-formatter";
import { HeaderStatus } from "./HeaderStatus";
import { StatusBar } from "@capacitor/status-bar";
import { TEAM_ACCOUNT } from "../utils";
import { useHideNavbarOnMobile } from "../../../hooks/use-hide-navbar";
import { useInviteFriends } from "../hooks/use-invite-friends";
import { useChats } from "../hooks/use-chats";
import { useSWRConfig } from "swr"
import { unstable_serialize } from 'swr/infinite'

const ChatRoom: React.FC<{}> = ({ onlineAccount }) => {
    const {mutate: mutateInifinite} = useSWRConfig();
    const {
        account
    } = useParams();
    // const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const infiniteScrollRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { wallet } = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
    // const { data: messagesHistory } = useSWR<Message[]>(`/messages?chatId=${account}`, fetcherMessages);
    const [autoScroll, setAutoScroll] = useState(true);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);
    const isKeyboardOpen = useDetectKeyboardOpen(); // used to fix scroll bottom android when keyboard open and new message sent
    const {isMobile, width} = useWindowDimensions();
    const [page, setPage] = useState(0);
    const [height, setHeight] = useState(2000)
    const { inviteFriends } = useInviteFriends();
    const {
        messages,
        loadMore,
        mutate,
        isLoadingMore,
        isLoadingInitial,
        hasMore,
    } = useChat(account);

    const {chat, chats, isLoading, mutateChats} = useChats(account);
    // console.log("chats", chats);
    // const chat = chats?.find(chat => chat.id === account);
    const names = chat?.participants;
    let participant = names?.find(participant => participant._id !== activeAccount)
    if (chat?.participants[0]?._id === chat?.participants[1]?._id) {
        participant = chat?.participants[0];
    }
    let address = participant?._id;
    let isNew = false
    if (account?.startsWith('nano_')) {
        address = account;
        isNew = true;
    }
    const { data: nanwalletAccount, isLoading: isLoadingNanwalletAccount } = useSWR(isNew ? address : null, fetcherAccount);
    const nameOrAccount = participant?.name || formatAddress(address);
    const location = useLocation();
    const accountExists = isLoadingNanwalletAccount || nanwalletAccount?.error === undefined;
    // useEffect(() => {
    //     if (pages) {
    //         setMessages(messagesHistory);
    //     }
    // }, [pages, messagesEndRef]);

    useEffect(() => {
        if (!isLoading && chat == null && !account?.startsWith('nano_')) {
            setTimeout(() => { // this somehow fix huge performance issue on iphone when selecting chat and coming back multiple times
                // navigate('/chat');
              }, 0);
            if (searchParams.has('join')) {
                Modal.confirm({
                    title: 'Join the group?',
                    onConfirm: () => {
                        joinRequest(account).then((res) => {
                            if (res.error) {
                                Toast.show({ content: res.error , icon: "fail" });
                                return;
                            }
                            Toast.show({ content: 'Request sent', icon: "success"});
                        })
                    },
                    confirmText: 'Ask to join',
                    cancelText: 'Cancel',
                });   
            }
        }
    }, [])
     useEffect(() => {
            socket.io.on('reconnect', () => {
                console.log('reconnect socket mutate messages');
                // refetch messages when reconnect
            mutate();
                // on mobile, if the app is in background, the socket connection will be lost, so we need to refresh the message on reconnect
                 // eventually we could optimize this by sending only new data, for example with a ?ts=timestamp query param instead of re fetching all messages

            });
            return () => {
                socket.io.off('reconnect');
            };
        }, []);

    useEffect(() => {
        socket.emit('join', account); // join chat id
//         socket.on('message', (message: Message) => {
//             // setMessages(prev => [...prev, message]);
//             // if (message.fromAccount !== address && chat?.type === 'private') {
//             //     debugger
//             //     return;
//             // }
//             // console.log('message', message);
//             // if (chats.find(chat => chat.id === message.chatId) !== undefined) { // dont local mutate if chat not yet exist / just created to prevent issue new chat not showing
//             //     mutateChats(currentChats => { // local mutate to update last message in chat list without refetching
//             //         const newChats = [...(currentChats || [])];
//             //         const chatIndex = newChats.findIndex(chat => chat.id === message.chatId);
//             //         if (chatIndex !== -1) {
//             //             const newChat = { ...newChats[chatIndex] };
//             //             newChat.lastMessage = message.content;
//             //             newChat.unreadCount = message.fromAccount === activeAccount ?
//             //              0 : // don't increment unread count if message is from ourself
//             //             (
//             //                 message.chatId === account ? 0 : // don't increment unread count if chat is the current open chat
//             //                 newChat.unreadCount + 1
//             //             );
//             //             newChat.lastMessageFrom = message.fromAccount;
//             //             newChat.lastMessageTimestamp = new Date().toISOString();
//             //             newChat.lastMessageId = message._id;
//             //             newChat.isLocal = false;
//             //             newChat.height = message.height;
//             //             // move chat to top
//             //             newChats.splice(chatIndex, 1);
//             //             newChats.unshift(newChat);
//             //         }
//             //         return newChats;
//             //     }, false);
//             // }

//             if (account == null) return // don't mutate messages if on /chat page to prevent showing new message if chat not selected
            
// // debugger
            
//                 if (message.fromAccount !== address && chat?.type === 'private') return // don't mutate messages if not for this chat
//                 // mutate(currentPages => {
//                 //     if (account == null) return // don't mutate if on /chat page to prevent showing new message if chat not selected
//                 //     if (message.fromAccount !== address && chat?.type === 'private') return // don't mutate if message is not for this chat
//                 //     const newPages = [...(currentPages || [])];
//                 //     newPages[0] = [message, ...(newPages[0] || [])];
//                 //     return newPages;
//                 // }, false);

//             console.log("pathname", location.pathname);
//             console.log("chatId", message.chatId);
//             // if (location.pathname !== `/chat/${message.chatId}`) {
//             sendNotificationTauri(message.fromAccountName, "New message");
//             // }
//             // setTimeout(() => {
//             //     // window.scrollTo(0, document.body.scrollHeight);
//             // }, 1000);
//         });
        socket.on('update-join-request-message', (newMessage) => {
            console.log("join request update", newMessage);
            mutate(currentPages => {
                // find by id and update
                const newPages = [...(currentPages || [])];
                const messageIndex = newPages[0].findIndex(message => message._id === newMessage._id);
                if (messageIndex !== -1) {
                    newPages[0][messageIndex] = newMessage;
                }
                return newPages;

            }, false);
        });
        socket.on('delete-message', ({chatId, height}) => {
            console.log("recalled message", height); // best effort is to remove message from local cache, but not guaranteed to be removed by everyone cache
            mutate(currentPages => {
                const newPages = [...(currentPages || [])];
                newPages[0] = newPages[0].filter(message => message.height !== height && message.chatId === chatId);
                return newPages;
            }, false);
        });

        return () => {
            // socket.off('message');
            socket.off('update-join-request-message');
            socket.off('delete-message');
        };
    }, [address, chat]);


    const scrollToBottom = () => {
        // return
        // debugger
        // messagesEndRef.current?.
        // scroll({
        //     top: messagesEndRef.current.scrollHeight,
        //     behavior: 'instant',
        // })
        // window.scrollTo(0,document.body.scrollHeight);
        // window.scrollTo(0, document.body.scrollHeight);
        // messagesEndRef.current?.scrollTo(0, -1);
        // messagesEndRef.current?.scrollTo(0, messagesEndRef.current.offsetHeight + 1000);
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });

    };

    useEffect(() => {
        // scrp
        // debugger
        if (document.activeElement === messageInputRef.current?.nativeElement && isKeyboardOpen) {
            messageInputRef.current?.blur();
            messageInputRef.current?.focus(); // probably hacky but fix scroll bottom android when keyboard open, cause maybe by istyping?
        }

        // console.log("scrollTop", infiniteScrollRef.current?.scrollTop);
        // console.log("scrollTop", infiniteScrollRef.current?.scrollHeight);
        // if (infiniteScrollRef.current?.scrollTop > -400) {
        if (autoScroll) {
            // scrollToBottom();
            // setTimeout(() => {
            //     scrollToBottom();
            // }, 1000);
        }
        // setTimeout(() => {
        //     // window.scrollTo(0, 0);
        // }, 10);

    }
        , [messages, chat]);

    useEffect(() => {
        scrollToBottom(); // scroll bottom by default when coming back cause infiste scroll bug if scrolled top and coming back,  todo scroll restoration react router

    }, [account, width]);

    useHideNavbarOnMobile(account);
    useEffect(() => {
        // console.log("height", infiniteScrollRef.current?.scrollTop);
        // console.log("height", infiniteScrollRef.current?.scrollHeight);
        // console.log("height", infiniteScrollRef.current?.clientHeight);
    }, [chat, messages])

    useEffect(() => {
        if (messages[0]?.error && messages[0]?.chatId !== null){ // chat already exists
            navigate('/chat/' + messages?.[0]?.chatId, { replace: true });
        }
    }, [messages])

    // console.log("account", account);

    
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
    const HeaderPrivate = () => {
        return (
            <NavBar
            
                className=" "
                backArrow={true}
                onBack={() => {
                    navigate('/chat');
                }}
                right={
                    <span style={{float: "right", cursor: "pointer"}}>
                    <UserOutline 
                    onClick={() => {
                        navigate(`/chat/${address}/info`);
                    }}
                    fontSize={24} /></span>
                }
                >
                   <div 
                   style={{cursor: "pointer"}}
                   onClick={() => {
                    navigate(`/chat/${address}/info`);
                }}
                   className="flex-1 text-center">
                    <h2 className="flex items-center justify-center gap-2">
                    <ProfileName address={address} fallback={formatAddress(address)} />
                    </h2>
                    <HeaderStatus lastOnline={participant?.lastOnline} />
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
                    <span style={{float: "right", cursor: "pointer"}}>
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
                   style={{cursor: "pointer"}}
                   onClick={() => {
                    navigate(`/chat/${
                        account
                    }/group`);
                }}
                   className="flex-1 text-center">
                    <h2 className="flex items-center justify-center gap-2">
                    {chat?.name || 'Group Chat'} ({chat?.participants.length})
                    </h2>
                </div>
                </NavBar>
                
        )
        
    }

    // console.log("messages", messages);
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                // overflow: 'auto',
                height: '100%',
                width: '100%',
                // flexGrow: 1,
                justifyContent: "space-between"
                // animation: "slide-in 0.4s",
                // animationIterationCount: "1",
                // animationFillMode: "forwards",
            }}>
            {
                account != null && (
                    <div
                    style={{borderBottom: '1px solid var(--adm-color-border)'}}
                    // prefix={
                    //     <AccountIcon account={account} width={48} />
                    // }
                    >
                        {
                            chat?.type === 'group' ? <HeaderGroup /> : <HeaderPrivate />
                        }
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
                    // height: '100%', 
                    width: '100%',
                    flexGrow: 1,
                    justifyContent: "space-between"
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
                        width: '100%',
                        //  marginTop: '9vh',
                        // marginBottom: 92, 
                        display: 'flex',
                        //   flexGrow: 1,
                    }}
                >
                    <div
                        ref={infiniteScrollRef}
                        id="scrollableDiv"
                        //   className="scrollableDiv"
                        style={{
                            height: "100%",
                            width: '100%',
                            overflow: 'auto',
                            display: 'flex',
                            flexDirection: "column-reverse",
                            overflowAnchor: 'auto',
                            // touchAction: 'none', // don't or ios scroll glitch
                        }}
                    >
{
    ((messages.length === 0 && !isLoadingInitial) && account != null) && (
        <div>
        <InfoMessageEncrypted />
        {
             chat?.creator === TEAM_ACCOUNT ? <WelcomeMessage /> : 
             
                 <StartConversation address={address} />
        }
      

        </div>
    )
}
                        {
                            isLoadingInitial ? <Skeleton animated /> :
                                <InfiniteScroll
                                    // scrollThreshold={"800px"}
                                    dataLength={messages.length}
                                    next={() => {
                                        // if (!isLoadingMore){
                                        setAutoScroll(false);
                                        loadMore();
                                        // }
                                    }}

                                    hasMore={hasMore}
                                    // loader={<Skeleton animated />}
                                    inverse={true}
                                    // scrollThreshold={"300px"} // this cause scroll flickering issue
                                    onScroll={(e) => {
                                        //disable auto scroll when user scrolls up
                                        // console.log(e.target.scrollTop);
                                        if (e.target.scrollTop > 0) {
                                            setAutoScroll(true);
                                            // console.log("enable autoscroll");
                                            infiniteScrollRef.current.className = "scrollableDiv";
                                        }
                                        else {
                                            setAutoScroll(false);
                                            // console.log("disable autoscroll");
                                            infiniteScrollRef.current.className = "scrollableDivAuto";
                                        }
                                        // if (e.target.scrollTop < 0) {
                                        //     setAutoScroll(false);
                                        //     console.log("disable autoscroll");
                                        // }
                                        // else {
                                        //     setAutoScroll(true);
                                        //     console.log("enable autoscroll");
                                        // }
                                    }}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        userSelect: 'none',

                                        //  overflowAnchor: 'none',
                                    }} //To put endMessage and loader to the top.
                                    endMessage={
                                        null
                                    }
                                    scrollableTarget="scrollableDiv"

                                >
                                    {
                                        hasMore && isLoadingMore && (
                            <div className="text-center m-4">
                                <DotLoading />
                            </div>
                        )
                    }
                    
                                    {messages.reverse().map((message, index) => {
                                        return (
                                            <div
                                                key={message._id}
                                            // id={index == messages.length - 1 ? "endOfMessages" : ""}
                                            // ref={index === messages.length - 1 ? messagesEndRef : null}
                                            >
                                                <Message
                                                    key={message._id + message.status}
                                                    message={message}
                                                    prevMessage={messages[index + 1]}
                                                    nextMessage={messages[index - 1]}
                                                    activeAccount={activeAccount}
                                                    activeAccountPk={activeAccountPk}
                                                    type={chat?.type}
                                                    hasMore={hasMore}
                                                    isFromTeam={chat?.creator === TEAM_ACCOUNT}
                                                // toAccount={names?.find(participant => participant._id !== message.fromAccount)?._id}
                                                />
                                            </div>
                                        )
                                    })}
                                    <div
                                        id="endOfMessages"
                                        ref={messagesEndRef} />
                                </InfiniteScroll>
                        }

                    </div>
                </div>
                {/* <Button 
                onClick={() => {
                    setAutoScroll(false);
                    loadMore();
                }}
                className="w-full"
                size="small"
                color="primary">
                    Load more
                </Button> */}
                
                <div
                    style={(account == null
                        || (!accountExists)
                    ) ? { display: 'none' } : {}}
                >
                     {
                    chat &&
                    !chat?.accepted &&
                    activeAccount !== chat?.creator &&
                    <NewMessageWarning fromAddress={address} account={activeAccount} chat={chat} />
                }
                    <ChatInputMessage
                        messageInputRef={messageInputRef}
                        onSent={(message) => {

                            // mutate(prev => {
                            //     return [...prev, { ...message, isLocal: true }];
                            // }, false);
                            setTimeout(() => {
                                scrollToBottom();
                            }, 0);
                            // setMessages(prev => [...prev, { ...message, isLocal: true }]);
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
                "paddingBottom": "var(--safe-area-inset-bottom)",
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