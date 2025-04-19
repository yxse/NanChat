import { Avatar, Badge, Button, Card, DotLoading, Ellipsis, Input, List, Modal, NavBar, Popover, SearchBar, Space, Toast } from "antd-mobile";
import { AddCircleOutline, ChatAddOutline, FillinOutline, LockFill, LockOutline, MailOutline, MessageFill, MessageOutline, ScanCodeOutline, SystemQRcodeOutline, TeamOutline, UserCircleOutline, UserContactOutline, UserOutline, UserSetOutline } from "antd-mobile-icons";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { FiMoreHorizontal } from "react-icons/fi";
import { AccountIcon } from "../../app/Home";
import { socket } from "../socket";
import { LedgerContext, useWallet, WalletContext } from "../../Popup";
import { convertAddress, formatAddress, ShareModal } from "../../../utils/format";
import { fetcherAccount, fetcherMessages, fetcherMessagesPost, getNewChatToken } from "../fetcher";
import useSWR from "swr";
import SetName from "./SetName";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { box } from "multi-nano-web";
import GroupAvatar from "./group-avatar";
import Contacts from "../../app/Contacts";
import useLocalStorageState from "use-local-storage-state";
import { AiOutlinePlusCircle } from "react-icons/ai";
import NewChatPopup from "./NewChatPopup";
import { useWindowDimensions } from "../../../hooks/use-windows-dimensions";
import { QRCodeSVG } from "qrcode.react";
import icon from "../../../../public/icons/icon.png";
import { DisconnectLedger } from "../../Initialize/Start";
import SelectAccount from "../../app/SelectAccount";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import { Scanner } from "../../app/Scanner";
import isValid from 'nano-address-validator';
import useMessageDecryption from "../hooks/use-message-decryption";
import MessageRaw from "./MessageRaw";
import { CopyButton } from "../../app/Icons";
import { formatTelegramDate } from "../../../utils/telegram-date-formatter";
import ProfileName from "./profile/ProfileName";
import { showAccountQRCode } from "../utils";
import { useInviteFriends } from "../hooks/use-invite-friends";
import BackupContacts from "./contacts/BackupContacts";
import { useChats } from "../hooks/use-chats";
import {
    List as VirtualizedList,
    AutoSizer,
    WindowScroller,
  } from 'react-virtualized'
import { updateSharedKeys } from "../../../services/sharedkey";
import { NoAvatar } from "./icons/NoAvatar";

export const ChatAvatar = ({ chat }) => {
    const {activeAccount} = useWallet();
    let accountTo = activeAccount;
    let from = chat.participants.find(participant => participant._id !== activeAccount);
    if (chat.participants[0]?._id === chat.participants[1]?._id) { // chat with self
    from = chat.participants[0]; 
    }
    if (chat.type === 'group') {
    from = {_id: chat.lastMessageFrom}
    accountTo = chat.sharedAccount;
    }
    const accountFrom = from?._id;
    if (chat.type === 'group') {
        return <GroupAvatar
            chatId={chat.id}
        />
    }
    return <AccountAvatar
        url={from?.profilePicture?.url}
        account={accountFrom}
        badgeColor={'gray'}
    />
}

export const LedgerNotCompatible = () => {
    return (
        <div className="m-4">
        <div className="text-base mb-4">
            Chat is not compatible with Ledger. Please disconnect Ledger to use E2E encrypted chat.
        </div>
        <DisconnectLedger />
        </div>
    );
}

const Footer = () => {
    const {inviteFriends} = useInviteFriends()
    return <div><div className="mt-6 pt-4 mb-4 ml-2 text-center" style={{ color: 'var(--adm-color-text-secondary)' }}>
    <LockFill className="mr-2 inline" />Your chats are end-to-end encrypted using nano.
</div>
<div className="text-center mb-6 pb-6">
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
            {/* <MailOutline /> */}
            Invite Friends to Chat
            </Space>
        </Button>
</div></div>
}

const ChatList: React.FC = ({ onChatSelect }) => {
    const { wallet } = useContext(WalletContext)
    const { account } = useParams();
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
    const {chats, mutateChats: mutate, isLoading: isLoadingChat} = useChats(account);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const location = useLocation();

    const [isNewChatVisible, setIsNewChatVisible] = useState(false);
    const {ledger, setLedger} = useContext(LedgerContext);
    const {data: me, isLoading} = useSWR(activeAccount, fetcherAccount);
    // const { data: accounts, isLoading } = useSWR<string[]>('/accounts?search=' + activeAccount, fetcherMessages);
    // const onlineAccount = accounts?.online;
    // const offlineAccount = accounts?.offline;
    // const all = onlineAccount?.concat(offlineAccount);
    // const filteredChats = chats?.filter(chat =>
    //     chat.name?.toLowerCase().includes(searchQuery?.toLowerCase())
    // );
    // const accountData = accounts?.find(name => name._id === activeAccount)
    const filteredChats = chats
    const {isMobile, width} = useWindowDimensions()
    const {inviteFriends} = useInviteFriends()
   



    if (ledger) {
        return <LedgerNotCompatible />
    }
    if (!chats || isLoadingChat) {
        return <DotLoading />
    }
    const right = (
        <div style={{ fontSize: 24, marginTop: 6 }}>
            <Popover.Menu
          mode='dark'
          actions={[
            { key: 'new_chat', icon: <MessageFill />, text: 'New Chat' },
            { key: 'invite', icon: <MailOutline />, text: 'Invite Friends' },
            { key: 'my_qr', icon: <SystemQRcodeOutline />, text: 'My QR Code' },
            { key: 'scan_qr', icon: <ScanCodeOutline />, text: <Scanner
                onScan={(result) => {
                    if (result){
                      let address = false
                        if (result.includes('https://nanwallet.com/chat/')) {
                            address = result.split('https://nanwallet.com/chat/')[1];
                        }
                        else if (result.startsWith('nano_') && isValid(result)){
                            address = result;
                        }
                        else if (result.startsWith('nano:') && isValid(result.split('nano:')[1])){
                            address = result.split('nano:')[1];
                        }
                        if (address){
                          Modal.clear();
                          onChatSelect(address);
                        }
                        else{
                          Toast.show({content: "Invalid QR Code. Please scan a valid NanWallet chat QR code or a Nano address", duration: 4000});
                        }
                    }
                  }}
            >Scan QR Code</Scanner> },
          ]}
        //   placement='left'
          onAction={(node) => {
            if (node.key === 'new_chat') {
              setIsNewChatVisible(true);
                // add open true param allow to fix newchat popup iphone when navigating back by creating a new route
                navigate(`${location.pathname}?open=true`);
            }
            if (node.key === 'invite') {
              inviteFriends();
            }
            if (node.key === 'my_qr') {
              showAccountQRCode(me);
            }
            if (node.key === 'scan_qr') {
                return
              Modal.show({
                showCloseButton: false,
                closeOnMaskClick: true,
                content: (
                      <Scanner
                      defaultOpen
                      onClose={() => {
                        Modal.clear();
                      }}
      onScan={(result) => {
        if (result){
          let address = false
            if (result.includes('https://app.nanwallet.com/chat/')) {
                address = result.split('https://app.nanwallet.com/chat/')[1];
            }
            else if (result.startsWith('nano_') && isValid(result)){
                address = result;
            }
            else if (result.startsWith('nano:') && isValid(result.split('nano:')[1])){
                address = result.split('nano:')[1];
            }
            if (address){
              Modal.clear();
              onChatSelect(address);
            }
            else{
              Toast.show({content: "Invalid QR Code. Please scan a valid NanWallet chat QR code or a Nano address"});
            }
        }
      }}
    />
                )
              })
        }}}

          trigger='click'
        >
          <Space style={{ '--gap': '16px' }}>
              <AddCircleOutline  style={{cursor: "pointer"}} className="hoverable" />
            {/* <AiOutlinePlusCircle  onClick={() => setIsNewChatVisible(true)} style={{cursor: "pointer"}} /> */}
          </Space>
        </Popover.Menu>
        </div>
      )

      function rowRenderer({
        index,
        key,
        style,
      }: {
        index: number
        key: string
        style: CSSProperties
      }) {
        // console.log("index", index)

        // render footer if index is last
        if (index === chats.length) {
            return <List.Item
            key={key}
            style={{...style, backgroundColor: 'var(--main-background-color)'}}

            ><Footer /></List.Item>
        }
        const chat = filteredChats[index]
        if (!chat) return
    
        let accountTo = activeAccount;
                            let from = chat.participants.find(participant => participant._id !== activeAccount);
                            if (chat.participants[0]?._id === chat.participants[1]?._id) { // chat with self
                                from = chat.participants[0]; 
                            }
                            if (chat.type === 'group') {
                                from = {_id: chat.lastMessageFrom}
                                accountTo = chat.sharedAccount;

                            }
                            const accountFrom = from?._id;
                            const hasName = from?.name;
                            const pfp = from?.profilePicture?.url
        return (
            <List.Item
            style={style}
            key={key}
            arrowIcon={false}
                className={chat.id === account ? 'active' : ''}
                onClick={() => {
                    onChatSelect(chat.id)
                    // local mutate to update unread count
                    mutate(chats.map(chatToMutate => {
                        if (chatToMutate.id === chat.id) {
                            chatToMutate.unreadCount = 0;
                        }
                        return chatToMutate;
                    }), false);
                }}
                extra={
                    <div className="flex flex-col items-end">
                        <div
                        className="text-xs"
                        >{formatTelegramDate(chat.lastMessageTimestamp)}</div>
                            {(chat.unreadCount > 0 && chat.lastMessageFrom !== activeAccount)? (
                            <div>
                                <span 
                                style={{backgroundColor: 'var(--adm-color-primary)', color: 'var(--adm-color-text' }}
                                className="text-xs rounded-full w-5 h-5 flex items-center justify-center mt-1">
                                    {chat.unreadCount}
                                </span>
                            </div>
                        )
                        : // empty div to keep the same height
                        <div>
                            <span className="text-xs rounded-full w-5 h-5 flex items-center justify-center mt-1">
                                {''}
                            </span>
                        </div>
                        }
                    </div>
                }
                prefix={
                    
                    
                    <div style={{paddingTop: 8, paddingBottom: 8}}>
                        <ChatAvatar chat={chat} />
                   
                        </div>
                }
                // Ellipsis component is laggy when there are many messages
                // description={<Ellipsis content={decrypted || '...'} />}
                description={<MessageRaw 
                    key={chat.lastMessageId}
                    message={{
                    content: chat.lastMessage,
                    fromAccount: accountFrom,
                    toAccount: accountTo,
                    _id: chat.lastMessageId,
                    isLocal: chat.isLocal,
                    type: chat.type,
                    chatId: chat.id,
                    height: chat.height,
                }} />}
            >
                <div className="flex items-center gap-2">
                    {
                        chat.type === 'group' ?
                            <>
                                {chat.name || "Group Chat"}
                            </>
                            :
                            <>
                                <ProfileName
                                address={accountFrom}
                                />
                            </>
                    }
                </div>
                <div className="flex justify-between">
                </div>
            </List.Item>
        )
      }
      const listRef = useRef(null);
      const scrollKeyStore = `scrollTop-chat`;
      const [initScrollPosition, setInitScrollPosition] = useState(+(localStorage.getItem(scrollKeyStore) || 0));
      useEffect(() => {
        // restore scroll position
        const scrollTop = localStorage.getItem(scrollKeyStore);
        if (scrollTop) {
            const scrollTopInt = parseInt(scrollTop);
            if (!isNaN(scrollTopInt)) {
                if (listRef.current) {
                    (listRef.current as any).scrollToPosition(scrollTopInt);
                }
            }
        }
        return () => {
        }
        }, [listRef]);
        // Simple debounce implementation without lodash
function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
      // Debounced function to save to localStorage
  const saveScrollPosition = useCallback(
    debounce((position) => {
      try {
        localStorage.setItem(`scrollTop`, position.toString());
        console.log('Scroll position saved:', position);
      } catch (error) {
        console.error('Error saving scroll position to localStorage:', error);
      }
    }, 200), // 200ms debounce time - adjust as needed
    []
  );
    return (
        <div
        // style={isMobile ? {} : { minWidth: 500 }}
        >
            {
                (location.pathname === "/" || location.pathname === "/chat" || width > 768) &&
            <NavBar
            className="app-navbar "
            right={right}
            backArrow={false}>
          <span className="">NanChat </span>
        </NavBar>
        }
            <div className="">
                <div className="">
                   
          <div style={{ }}>

          <List 
            className="chat-list"          
          >
          <div style={{ height:
          isMobile ? "calc(100dvh - 45px - 58px - env(safe-area-inset-bottom) - env(safe-area-inset-top))" : "calc(100dvh - 45px - env(safe-area-inset-bottom) - env(safe-area-inset-top))"
          // 47px for the header, 58px for the menu
          , overflow: "hidden" }}>
            <AutoSizer>
              {({ width, height }) => (
                <VirtualizedList
                    ref={listRef}
                  rowCount={chats.length + 1} // +1 for footer
                  rowRenderer={rowRenderer}
                  width={width}
                  height={height}
                  rowHeight={
                    ({ index }) => {
                      if (index === chats.length) return 236; // footer height
                      return 70;
                    }
                  }
                  overscanRowCount={10}
                //   isScrolling={isScrolling}
                onScroll={({ scrollTop }) => {
                    // setScrollTop(scrollTop);
                    if (initScrollPosition !== undefined) {
                        setInitScrollPosition(undefined); 
                    }
                    // if (scrollTop === 0) {
                    //     return;
                    // }
                    console.log(scrollTop);

                    // localStorage.setItem(scrollKeyStore, scrollTop.toString());
                    saveScrollPosition(scrollTop);
                }}
                    
                  scrollTop={initScrollPosition}
                />
              )}
            </AutoSizer></div>
          </List>
            </div>
          

      

        <NewChatPopup
        onAccountSelect={async (accounts) => {
            if (accounts.length === 1) {
                navigate(`/chat/${accounts[0]}`, { viewTransition: false, replace: true })
            }
            else {
                let r = await fetcherMessagesPost('/chat', {
                    "type": "group",
                    "participants": accounts.concat(activeAccount)
                })
                if (r.error) {
                    Toast.show({icon: 'fail', content: r.error})
                    return
                }
                else {
                    navigate(`/chat/${r.id}`, { viewTransition: false, replace: true })
                    await updateSharedKeys(r.id, r.participants.map(participant => participant._id), activeAccountPk);
                    Toast.show({icon: 'success'})
                }

            }
        }}
          visible={isNewChatVisible} setVisible={setIsNewChatVisible} />
            
                </div>
                
            </div>
        </div>
    );
};

export const AccountAvatar = ({ url, width=48}) => {
    let icon
    if (url == null) {
        // url = "https://i.nanwallet.com/u/plain/https%3A%2F%2Fnatricon.com%2Fapi%2Fv1%2Fnano%3Faddress%3D" + account + "%26outline%3Dtrue"
        icon = <NoAvatar height={width} width={width} />
    }
    else{
        icon = <img style={{borderRadius: 8}} src={url} alt="account-pfp" width={width} />
    }
    return icon
}

export default ChatList;