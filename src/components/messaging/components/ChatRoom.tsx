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
import { LIMIT_MESSAGES, LIMIT_MESSAGES_INITIAL, shouldStickToBottom, TEAM_ACCOUNT, useImmediateSafeMutate } from "../utils";
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
import ChatLocked from "./group/ChatLocked";


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
    const {isMobile, isTablet} = useWindowDimensions()
    const {chat, isLoading} = useChats(account);
    const messagesRef = useRef(messages);
    useEffect(() => { messagesRef.current = messages; }, [messages]);
    const loadMoreRef = useRef(loadMore);
    useEffect(() => { loadMoreRef.current = loadMore; }, [loadMore]);

    const goToMessageIos = useCallback(async (replyMessage: { _id: string; height: number }) => {
        const scrollToElement = () => {
            const el = document.querySelector(`[data-message-id="${replyMessage._id}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return true;
            }
            return false;
        };

        if (scrollToElement()) return;

        const currentMessages = messagesRef.current;
        const lowestLoadedHeight = currentMessages[currentMessages.length - 1]?.height;
        if (!lowestLoadedHeight || !replyMessage.height || replyMessage.height >= lowestLoadedHeight) return;

        const pagesToLoad = Math.ceil((lowestLoadedHeight - replyMessage.height) / LIMIT_MESSAGES) + 1;

        for (let i = 0; i < pagesToLoad; i++) {
            try {
                await loadMoreRef.current(LIMIT_MESSAGES);
                await new Promise(r => setTimeout(r, 100));
                if (scrollToElement()) return;
            } catch (e) {
                break;
            }
        }

        scrollToElement();
    }, []);
    const safeMutate = useImmediateSafeMutate(mutate);
    const virtualized = Capacitor.getPlatform() !== "ios"
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
        if (virtualized) return
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
        // debugger
        // console.log(location.state)
        if (!isMobile){
            scrollToBottom(); // scroll bottom by default when coming back cause infiste scroll bug if scrolled top and coming back,  todo scroll restoration react router
            reset() // on larger screen we force reset as it will not be reseted by the other scrollTop reset
            // debugger
        }
    }, [account]);

    useHideNavbarOnMobile(account);
    useEffect(() => {
        // console.log("height", infiniteScrollRef.current?.scrollTop);
        // console.log("height", infiniteScrollRef.current?.scrollHeight);
        // console.log("height", infiniteScrollRef.current?.clientHeight);
    }, [chat, messages])

    useEffect(() => {
        if (messages[0]?.error && messages[0]?.chatId !== null && messages[0]?.error == "Chat already exists"){ // chat already exists
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
        // debugger
        requestAnimationFrame(() =>
        // shouldStickToBottom.current = true
        
        virtuaRef.current.scrollToIndex(messages.length + LIMIT_MESSAGES, { // idk why but need to add LIMIT_MESSAGES to scroll to bottom
          align: 'end',
          smooth: false // true can cause issue if too much messages loaded
        })
      )
        
    }
}, [scrollToBottom, messages.length]); 
  useEffect(() => {
      return () => {
        saveScrollPosition.cancel();
      };
    }, [saveScrollPosition]);
useEffect(() => {
    if (
        ((!isMobile && !isTablet) ||
        (!sessionStorage.getItem("list-cache-" + chat?.id)))
        && virtualized
    ){
        // debugger
        reset()
    }
    if (virtualized) return
      // restore scroll position
      const scrollTop = localStorage.getItem(scrollKeyStore);
      if (scrollTop) {
        // debugger
          const scrollTopInt = parseInt(scrollTop);
          if (!isNaN(scrollTopInt)) {
            // debugger
              if (infiniteScrollRef.current) {
                  (infiniteScrollRef.current as any).scrollTo(0, scrollTopInt);
                // setTimeout(() => {
                // }, 0)
              }
          }
      }
      else{
        reset()
        // debugger
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
                    <DelayedSpinner isLoading={isLoadingFirstPage || showSpinnerLoadingMoreInHeader} delay={showSpinnerLoadingMoreInHeader ? 0 : 400} spinnerProps={{style:{width: 24}}}/>
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
                    <DelayedSpinner isLoading={isLoadingFirstPage || showSpinnerLoadingMoreInHeader} delay={showSpinnerLoadingMoreInHeader ? 0 : 400} spinnerProps={{style:{width: 24}}}/>
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
                    <div
                        ref={infiniteScrollRef}
                        id="scrollableDiv"
                        //   className="scrollableDiv"
                        style={{
                            height: "100%",
                            width: '100%',
                            overflow: !virtualized ? "scroll": "hidden",
                            display: !virtualized ? "flex": "block",
                            // flexDirection: "column-reverse",
                            flexDirection: !virtualized ? "column-reverse": "column",
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
                        !virtualized ? 
                        <InfiniteScrollingMessages
                        saveScrollPosition={saveScrollPosition}
                        loadMore={loadMore} chat={chat} isLoadingMore={isLoadingMore} hasMore={hasMore}
                        messages={messages.reverse()}
                        infiniteScrollRef={infiniteScrollRef} isLoadingInitial={isLoadingInitial} setAutoScroll={setAutoScroll}
                        onGoToMessage={goToMessageIos} />
                                 :   
                                    <VirtualizedMessagesVirtua
                                    isNewChat={isNewChat}
                                    isLoadingFirstPage={isLoadingFirstPage}
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