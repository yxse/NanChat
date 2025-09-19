import { BellMuteOutline, LockFill, LockOutline, MailOutline, MessageOutline, MoreOutline, PhoneFill, SendOutline, TeamOutline, UserOutline } from "antd-mobile-icons";
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
import { fetcherAccount, fetcherMessages, joinRequest, saveMessageCache } from "../fetcher";
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
import { shouldStickToBottom, TEAM_ACCOUNT, useImmediateSafeMutate } from "../utils";
import { useHideNavbarOnMobile } from "../../../hooks/use-hide-navbar";
import { useInviteFriends } from "../hooks/use-invite-friends";
import { useChats } from "../hooks/use-chats";
import { useSWRConfig } from "swr"
import { unstable_serialize } from 'swr/infinite'
import { debounce } from 'lodash';
import { removeData } from "../../../services/database.service";
import { Capacitor } from "@capacitor/core";
import { VirtualizedMessagesVirtua } from "./VirtualizedMessagesVirtua";
import InfiniteScrollingMessages from "./messages/InfiniteScrollingMessages";
import { DelayedSpinner } from "./DelayedSpinner";
import { App } from "@capacitor/app";


const ChatRoom: React.FC<{}> = ({  }) => {
    const {mutate: mutateInifinite} = useSWRConfig();
    const {
        account
    } = useParams();
    // const [messages, setMessages] = useState<Message[]>([]);
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
    // const isKeyboardOpen = useDetectKeyboardOpen(); // used to fix scroll bottom android when keyboard open and new message sent
    const {width} = useWindowDimensions();
    //   const { ref: messagesEndRef, setScroll } = useScrollRestoration('contacts', {
    //     persist: 'localStorage',
    //   });
    const virtuaRef = useRef(null);
    const scrollKeyStore = `scrollTop-chat-room`
    // const [initScrollPosition, setInitScrollPosition] = useState(+(localStorage.getItem(scrollKeyStore) || 0));

const saveScrollPosition = useCallback(
  debounce((position) => {
    try {
      localStorage.setItem(scrollKeyStore, position.toString());
      console.log('Scroll position saved:', position);
    } catch (error) {
      console.error('Error saving scroll position to localStorage:', error);
    }
  }, 200), // 200ms debounce time - adjust as needed
  []
);
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
    const {isMobile} = useWindowDimensions()
    const {chat, isLoading} = useChats(account);
    const safeMutate = useImmediateSafeMutate(mutate);

    console.log("chats", chat);
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
                    saveMessageCache(newMessage.chatId, newMessage, activeAccount, activeAccountPk)
                }
                return newPages;

            }, false);
        });
        socket.on('delete-message', ({chatId, height, messageSystem}) => {
            console.log("recalled message", height); // best effort is to remove message from local cache, but not guaranteed to be removed by everyone cache
            mutate(currentPages => {
                const newPages = [...(currentPages || [])];
                const messageIndex = newPages[0].findIndex(message => message.height === height);
                if (messageIndex !== -1) {
                    debugger
                    newPages[0][messageIndex] = messageSystem;
                    saveMessageCache(chatId, messageSystem, activeAccount, activeAccountPk)
                }
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
        if (Capacitor.getPlatform() !== "ios") return
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
        // if (document.activeElement === messageInputRef.current?.nativeElement && isKeyboardOpen) {
        //     messageInputRef.current?.blur();
        //     messageInputRef.current?.focus(); // probably hacky but fix scroll bottom android when keyboard open, cause maybe by istyping?
        // }

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
        // debugger
        // console.log(location.state)
        if (!isMobile){
            scrollToBottom(); // scroll bottom by default when coming back cause infiste scroll bug if scrolled top and coming back,  todo scroll restoration react router
            reset() // on larger screen we force reset as it will not be reseted by the other scrollTop reset
        }
    }, [account]);

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

    // console.log("messages", messages.length)

    const onSent = useCallback(() => {
    // Your logic here
    setTimeout(() => {
        scrollToBottom();
    }, 0);
    if (virtuaRef && virtuaRef.current){
        shouldStickToBottom.current = true
        virtuaRef.current.scrollToIndex(messages.length - 1, {
          align: 'end',
          smooth: false
        })
    }
}, [scrollToBottom]); 
  useEffect(() => {
      return () => {
        saveScrollPosition.cancel();
      };
    }, [saveScrollPosition]);
useEffect(() => {
      // restore scroll position
      const scrollTop = localStorage.getItem(scrollKeyStore);
      if (scrollTop) {
        // debugger
          const scrollTopInt = parseInt(scrollTop);
          if (!isNaN(scrollTopInt)) {
            // debugger
              if (infiniteScrollRef.current) {
                //   (infiniteScrollRef.current as any).scrollTo(0, scrollTopInt);
                // setTimeout(() => {
                // }, 0)
              }
          }
      }
      else{
        reset()
      }
      return () => {
      }
      }, [infiniteScrollRef]);
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
                    {chat?.muted && <BellMuteOutline fontSize={18} style={{marginRight: 8}}/>}
                    {/* <DotLoading /> */}
                    <DelayedSpinner isLoading={isLoadingFirstPage} delay={400} spinnerProps={{style:{width: 24}}}/>
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
                    {chat?.muted && <BellMuteOutline fontSize={18} style={{marginRight: 8}}/>}
                    <DelayedSpinner isLoading={isLoadingFirstPage} delay={400} spinnerProps={{style:{width: 24}}}/>
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
                    // // height: '100%', 
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
                    <div
                        ref={infiniteScrollRef}
                        id="scrollableDiv"
                        //   className="scrollableDiv"
                        style={{
                            height: "100%",
                            width: '100%',
                            overflow: Capacitor.getPlatform() === "ios" ? "scroll": "hidden",
                            display: 'flex',
                            // flexDirection: "column-reverse",
                            flexDirection: Capacitor.getPlatform() === "ios" ? "column-reverse": "column",
                            // overflowAnchor: 'auto',
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
                            isLoadingInitial ? <div style={{
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: 'calc(100vh - 45px - 58px - var(--safe-area-inset-bottom) - var(--safe-area-inset-top))',
  width: '100%'
}}>
  <SpinLoading style={{width: 48}} />
</div>:
                                <div>
                                    {/* {

                                        hasMore && isLoadingMore && (
                            <div style={{display: "flex", justifyContent: "center", marginTop: 32, marginBottom: 32}}>
                                <SpinLoading />
                            </div>
                        )
                    } */}
                    {/* 
                    
                    on ios not using virtualizer as already good performances without it and scroll much smoother,
                    lot of scroll intertia issue with ios/webkit, see: 
                        https://github.com/inokawa/virtua/issues/473
                        https://github.com/inokawa/virtua/issues/403#issuecomment-1978126177
                    */}
                    {
                        Capacitor.getPlatform() === "ios" ? 
                        <InfiniteScrollingMessages 
                        saveScrollPosition={saveScrollPosition}
                        loadMore={loadMore} chat={chat} isLoadingMore={isLoadingMore} hasMore={hasMore} 
                        messages={messages.reverse()}
                         infiniteScrollRef={infiniteScrollRef} isLoadingInitial={isLoadingInitial} setAutoScroll={setAutoScroll} />
                                 :   
                                    <VirtualizedMessagesVirtua
                                    virtuaRef={virtuaRef}
                                    saveScrollPosition={saveScrollPosition}
                                    activeAccount={activeAccount}
                                    activeAccountPk={activeAccountPk}
                                    chat={chat}
                                    hasMore={hasMore}
                                    messages={messages}
                                    fetchNextPage={loadMore}
                                    isFetchingNextPage={isLoadingMore}
                                    />
}
                                     <div
                                        id="endOfMessages"
                                        ref={messagesEndRef} />
                                </div>
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
                    // chat={chat}
                    // mutateChats={mutateChats}
                        messageInputRef={messageInputRef}
                        onSent={onSent}
                        onTouch={() => {
                            if (Capacitor.getPlatform() === "ios")
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