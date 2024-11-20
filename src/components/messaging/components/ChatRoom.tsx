import { LockFill, LockOutline, MessageOutline, PhoneFill, SendOutline, TeamOutline } from "antd-mobile-icons";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { BiChevronLeft, BiMessageSquare } from "react-icons/bi";
import { FiMoreHorizontal } from "react-icons/fi";
import { IoSendOutline } from "react-icons/io5";
import { useNavigate, useParams } from "react-router-dom";
import { socket } from "../socket";
import { WalletContext } from "../../Popup";
import { convertAddress, formatAddress } from "../../../utils/format";
import { CopyToClipboard } from "../../Settings";
import SelectAccount from "../../app/SelectAccount";
import { AccountIcon } from "../../app/Home";
import { Button, DotLoading, Input, List, Skeleton } from "antd-mobile";
import useSWR from "swr";
import { fetcherMessages } from "../fetcher";
import { box } from "multi-nano-web";
import ChatInputMessage from "./ChatInputMessage";
import useSWRInfinite from "swr/infinite";
import { useChat } from "../hooks/useChat";
import InfiniteScroll from 'react-infinite-scroll-component';
import Message from "./Message";
import useDetectKeyboardOpen from "../../../hooks/use-keyboard-open";
import GroupAvatar from "./group-avatar";



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
    const [page, setPage] = useState(0);
    const {
        messages,
        loadMore,
        mutate,
        isLoadingMore,
        isLoadingInitial
    } = useChat(account);
   
    // const { data: names } = useSWR<Chat[]>(`/names?accounts=${account}`, fetcherMessages);
    const {data: chats} = useSWR<Chat[]>(`/chats?account=${activeAccount}`, fetcherMessages);
    const chat = chats?.find(chat => chat.id === account);
    const names = chat?.participants;
    let participant = names?.find(participant => participant._id !== activeAccount)
    let address = participant?._id;
    if (account?.startsWith('nano_')) {
        address = account;
    }
    const nameOrAccount = participant?.name || formatAddress(address);
    
    // useEffect(() => {
    //     if (pages) {
    //         setMessages(messagesHistory);
    //     }
    // }, [pages, messagesEndRef]);

    useEffect(() => {
        socket.on('message', (message: Message) => {
            // setMessages(prev => [...prev, message]);
            if (message.fromAccount !== address && chat.type === 'private') {
                return;
            }
            mutate(currentPages => {
                const newPages = [...(currentPages || [])];
                newPages[0] = [message, ...(newPages[0] || [])];
                return newPages;
            }, false);
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
            // messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
            
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
            }, 10 );

        }
        , [messages, chat]);

        useEffect(() => {
            scrollToBottom(); // scroll bottom by default when coming back cause infiste scroll bug if scrolled top and coming back,  todo scroll restoration react router
            if (account){
                
            // hide nabar when in chat
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
        
    }, [account]);

    console.log("account", account);

    const HeaderPrivate = () => {
        return (
            <div
                onClick={() => {
                    navigate(`/chat/${address}/info`);
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
                            <LockOutline  className="mr-2" />
                            {nameOrAccount}
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
                    <div className="">
                        <AccountIcon account={address} width={48} />
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
                            <TeamOutline  className="mr-2" />
                            {chat?.name}
                        </h2>
                    </div>
                    <div className="">
                        <GroupAvatar />
                    </div>
                </div>
        )
    }

    return (
        <div 
        style={{
            display: 'flex', 
            flexDirection: 'column', 
            // overflow: 'auto',
            height: '100%', 
            width: '100%',
            flexGrow: 1,
            // animation: "slide-in 0.4s",
            // animationIterationCount: "1",
            // animationFillMode: "forwards",
            }}>
            <List.Item
        style={{ zIndex: 1 }}
            // prefix={
            //     <AccountIcon account={account} width={48} />
            // }
            >
                {
                    chat?.type === 'private' ? <HeaderPrivate /> : <HeaderGroup />
                }
            </List.Item>
            {
              account == null && (
                    <div className="flex items-center justify-center h-full">
                            Select a chat to start messaging
                    </div>
                )
            }
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
                          flexGrow: 1,
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
    flexDirection: 'column-reverse',
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
            
            hasMore={true}
            loader={null}
            inverse={true}
            scrollThreshold={"600px"}
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
            {/* {
                        isLoadingMore && (
                            <div className="text-center m-4">
                                <DotLoading />
                            </div>
                        )
                    } */}

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
            <ChatInputMessage
            messageInputRef={messageInputRef}
                onSent={(message) => {

                    // mutate(prev => {
                    //     return [...prev, { ...message, isLocal: true }];
                    // }, false);
                    mutate(currentPages => {
                        const newPages = [...(currentPages || [])];
                        // newPages[0] = [...(newPages[0] || []), { ...message, isLocal: true }];
                        // newPages[0] = [{ ...message, isLocal: true, _id: Math.random().toString()
                        newPages[0] = [{ ...message, isLocal: true }, ...(newPages[0] || [])];
                        return newPages;
                    }, false);
                    setTimeout(() => {
                        scrollToBottom();
                    }, 0);
                    // setMessages(prev => [...prev, { ...message, isLocal: true }]);
                }}
            />
        </div>
    );
};

export default ChatRoom;