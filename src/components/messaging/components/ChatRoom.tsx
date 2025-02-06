import { LockFill, LockOutline, MailOutline, MessageOutline, PhoneFill, SendOutline, TeamOutline } from "antd-mobile-icons";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { BiChevronLeft, BiMessageSquare } from "react-icons/bi";
import { FiMoreHorizontal } from "react-icons/fi";
import { IoSendOutline } from "react-icons/io5";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { socket } from "../socket";
import { WalletContext } from "../../Popup";
import { convertAddress, formatAddress, ShareModal } from "../../../utils/format";
import { CopyToClipboard } from "../../Settings";
import SelectAccount from "../../app/SelectAccount";
import { AccountIcon } from "../../app/Home";
import { Button, DotLoading, Input, List, Skeleton, Space, Toast } from "antd-mobile";
import useSWR from "swr";
import { fetcherAccount, fetcherMessages } from "../fetcher";
import { box } from "multi-nano-web";
import ChatInputMessage from "./ChatInputMessage";
import useSWRInfinite from "swr/infinite";
import { useChat } from "../hooks/useChat";
import InfiniteScroll from 'react-infinite-scroll-component';
import Message from "./Message";
import useDetectKeyboardOpen from "../../../hooks/use-keyboard-open";
import GroupAvatar from "./group-avatar";
import ProfilePicture from "./profile/ProfilePicture";
import NewMessageWarning from "./NewMessageWarning";
import { sendNotificationTauri } from "../../../nano/notifications";
import { useWindowDimensions } from "../../../hooks/use-windows-dimensions";
import { RiVerifiedBadgeFill } from "react-icons/ri";



const ChatRoom: React.FC<{}> = ({ onlineAccount }) => {
    const {
        account
    } = useParams();
    // const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const infiniteScrollRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
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
    const {
        messages,
        loadMore,
        mutate,
        isLoadingMore,
        isLoadingInitial,
        hasMore,
    } = useChat(account);

    const { data: chats, mutate: mutateChats } = useSWR<Chat[]>(`/chats`, fetcherMessages);
    const chat = chats?.find(chat => chat.id === account);
    const names = chat?.participants;
    let participant = names?.find(participant => participant._id !== activeAccount)
    if (chat?.participants[0]?._id === chat?.participants[1]?._id) {
        participant = chat?.participants[0];
    }
    let address = participant?._id;
    if (account?.startsWith('nano_')) {
        address = account;
    }
    // const { data: names2 } = useSWR<Chat[]>(`/names?accounts=${address}`, fetcherMessages);
    // const nameOrAccount = names2?.[0]?.name || formatAddress(address);
    const { data: nanwalletAccount, isLoading: isLoadingNanwalletAccount } = useSWR(address, fetcherAccount);
    const nameOrAccount = participant?.name || formatAddress(address);
    const location = useLocation();
    const accountExists = isLoadingNanwalletAccount || nanwalletAccount?.error === undefined;
    // useEffect(() => {
    //     if (pages) {
    //         setMessages(messagesHistory);
    //     }
    // }, [pages, messagesEndRef]);

    useEffect(() => {
        socket.on('message', (message: Message) => {
            // setMessages(prev => [...prev, message]);
            // if (message.fromAccount !== address && chat?.type === 'private') {
            //     debugger
            //     return;
            // }
            console.log('message', message);
            if (chats.find(chat => chat.id === message.chatId) !== undefined) { // dont local mutate if chat not yet exist / just created to prevent issue new chat not showing
                mutateChats(currentChats => { // local mutate to update last message in chat list without refetching
                    const newChats = [...(currentChats || [])];
                    const chatIndex = newChats.findIndex(chat => chat.id === message.chatId);
                    if (chatIndex !== -1) {
                        const newChat = { ...newChats[chatIndex] };
                        newChat.lastMessage = message.content;
                        newChat.lastMessageTimestamp = new Date().toISOString();
                        newChat.lastMessageId = message._id;
                        newChat.isLocal = false;
                        // move chat to top
                        newChats.splice(chatIndex, 1);
                        newChats.unshift(newChat);
                    }
                    return newChats;
                }, false);
            }

            if (account == null) return // don't mutate messages if on /chat page to prevent showing new message if chat not selected
            if (message.fromAccount !== address && chat?.type === 'private') return // don't mutate messages if not for this chat

            mutate(currentPages => {
                if (account == null) return // don't mutate if on /chat page to prevent showing new message if chat not selected
                if (message.fromAccount !== address && chat?.type === 'private') return // don't mutate if message is not for this chat
                const newPages = [...(currentPages || [])];
                newPages[0] = [message, ...(newPages[0] || [])];
                return newPages;
            }, false);

            console.log("pathname", location.pathname);
            console.log("chatId", message.chatId);
            // if (location.pathname !== `/chat/${message.chatId}`) {
            sendNotificationTauri(message.fromAccountName, "New message");
            // }
            setTimeout(() => {
                // window.scrollTo(0, document.body.scrollHeight);
            }, 1000);
        });
        return () => {
            socket.off('message');
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
        if (document.activeElement === messageInputRef.current.nativeElement && isKeyboardOpen) {
            messageInputRef.current?.blur();
            messageInputRef.current?.focus(); // probably hacky but fix scroll bottom android when keyboard open, cause maybe by istyping?
        }

        console.log("scrollTop", infiniteScrollRef.current?.scrollTop);
        console.log("scrollTop", infiniteScrollRef.current?.scrollHeight);
        // if (infiniteScrollRef.current?.scrollTop > -400) {
        if (autoScroll) {
            // scrollToBottom();
            // setTimeout(() => {
            //     scrollToBottom();
            // }, 1000);
        }
        setTimeout(() => {
            // window.scrollTo(0, 0);
        }, 10);

    }
        , [messages, chat]);

    useEffect(() => {
        scrollToBottom(); // scroll bottom by default when coming back cause infiste scroll bug if scrolled top and coming back,  todo scroll restoration react router
        if (account) {
            if (width <= 768) {
                // hide nabar when in chat and chatlist hidden (screen < 768)
                const admTabBar = document.querySelector('.adm-tab-bar.bottom');
                if (admTabBar) {
                    admTabBar.setAttribute('style', 'display: none');
                }
                return () => {
                    setAutoScroll(true);
                    if (admTabBar) {
                        admTabBar.setAttribute('style', 'display: block');
                    }
                };
            }
        }

    }, [account, width]);

    useEffect(() => {
        console.log("height", infiniteScrollRef.current?.scrollTop);
        console.log("height", infiniteScrollRef.current?.scrollHeight);
        console.log("height", infiniteScrollRef.current?.clientHeight);
    }, [chat, messages])

    useEffect(() => {
        if (messages[0]?.error && messages[0]?.chatId !== null){ // chat already exists
            navigate('/chat/' + messages?.[0]?.chatId, { replace: true });
        }
    }, [messages])

    console.log("account", account);

    const HeaderPrivate = () => {
        return (
            <div
                onClick={() => {
                    navigate(`/chat/${address}/info`);
                }}
                style={{
                    // height: '5vh',
                    touchAction: 'none',
                }}
                className="flex items-center cursor-pointer">
                <BiChevronLeft
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate('/chat')
                    }}
                    className="w-8 h-8 text-gray-500" />

                <div className="flex-1 text-center">
                    <h2 className="font-medium flex items-center justify-center gap-2">
                        {nameOrAccount} {participant?.verified && <RiVerifiedBadgeFill />}
                    </h2>
                    {
                        onlineAccount.includes(address) ? (
                            <div className="text-blue-500">
                                online
                            </div>
                        )
                            : (
                                <div className="text-gray-500">
                                    offline
                                </div>
                            )
                    }
                </div>
                <div className="mr-2">
                    <ProfilePicture address={address} />
                </div>
            </div>
        )
    }
    const HeaderGroup = () => {
        return (
            <div
                onClick={() => {
                    // navigate(`/chat/${address}/info`);
                }}
                style={{
                    height: '5vh',
                    touchAction: 'none',
                }}
                className="flex items-center cursor-pointer">
                <BiChevronLeft
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate('/chat')
                    }}
                    className="w-8 h-8 text-gray-500" />

                <div className="flex-1 text-center">
                    <h2 className="font-medium flex items-center justify-center">
                        <TeamOutline className="mr-2" />
                        {chat?.name}
                    </h2>
                </div>
                <div className="">
                    <GroupAvatar />
                </div>
            </div>
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
                    <List.Item
                        style={{ zIndex: 1 }}
                    // prefix={
                    //     <AccountIcon account={account} width={48} />
                    // }
                    >
                        {
                            chat?.type === 'group' ? <HeaderGroup /> : <HeaderPrivate />
                        }
                    </List.Item>
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
                                        console.log(e.target.scrollTop);
                                        if (e.target.scrollTop > 0) {
                                            setAutoScroll(true);
                                            console.log("enable autoscroll");
                                            infiniteScrollRef.current.className = "scrollableDiv";
                                        }
                                        else {
                                            setAutoScroll(false);
                                            console.log("disable autoscroll");
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
                                                    // key={message._id}
                                                    message={message}
                                                    prevMessage={messages[index + 1]}
                                                    nextMessage={messages[index - 1]}
                                                    activeAccount={activeAccount}
                                                    activeAccountPk={activeAccountPk}
                                                    type={chat?.type}
                                                    hasMore={hasMore}
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
                    <NewMessageWarning fromAddress={address} account={activeAccount} chatId={account} />
                }
                    <ChatInputMessage
                        messageInputRef={messageInputRef}
                        onSent={(message) => {

                            // mutate(prev => {
                            //     return [...prev, { ...message, isLocal: true }];
                            // }, false);
                            const id = Math.random().toString();
                            mutate(currentPages => {
                                const newPages = [...(currentPages || [])];
                                // newPages[0] = [...(newPages[0] || []), { ...message, isLocal: true }];
                                // newPages[0] = [{ ...message, isLocal: true, _id: Math.random().toString()
                                newPages[0] = [{ ...message, isLocal: true, _id: id}, ...(newPages[0] || [])];
                                return newPages;
                            }, false);
                            mutateChats(currentChats => { // local mutate to update last message in chat list without refetching
                                const newChats = [...(currentChats || [])];
                                const chatIndex = newChats.findIndex(chat => chat.id === account);
                                if (chatIndex !== -1) {
                                    const newChat = { ...newChats[chatIndex] };
                                    newChat.lastMessage = message.content;
                                    newChat.lastMessageTimestamp = new Date().toISOString();
                                    newChat.lastMessageId = id;
                                    newChat.isLocal = true;
                                    newChats.splice(chatIndex, 1);
                                    newChats.unshift(newChat);
                                }
                                return newChats;
                            }, false);
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
                                This account is not yet on NanWallet
                            </div>
                            <Button 
                            color="primary"
                            onClick={() => {
                                ShareModal({
                                    title: `Hey, I'm using NanWallet for end-to-end encrypted messaging. Install NanWallet and message me at https://nanwallet.com/chat/${activeAccount}`,
                                })
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
           
        </div>
    );
};

export default ChatRoom;