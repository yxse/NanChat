import { Avatar, Badge, Button, Card, DotLoading, Ellipsis, Input, List, Modal, NavBar, Popover, SearchBar, Space, Toast } from "antd-mobile";
import { AddCircleOutline, ChatAddOutline, FillinOutline, LockFill, LockOutline, MailOutline, MessageFill, MessageOutline, ScanCodeOutline, SystemQRcodeOutline, TeamOutline, UserCircleOutline, UserContactOutline, UserOutline, UserSetOutline } from "antd-mobile-icons";
import { useContext, useEffect, useState } from "react";
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
    // const { data: names } = useSWR<Chat[]>(`/names?accounts=${all?.map(account => account._id).join(',')}`, fetcherMessages, {keepPreviousData: true});
    // const filteredChats = chats?.filter(chat =>
    //     chat.name?.toLowerCase().includes(searchQuery?.toLowerCase())
    // );
    // const accountData = accounts?.find(name => name._id === activeAccount)
    const filteredChats = chats
    const {isMobile, width} = useWindowDimensions()
    const {inviteFriends} = useInviteFriends()
    useEffect(() => {
        socket.on('chat', (chat: string) => {
            mutate();
        });

        return () => {
            socket.off('chat');
        };
    }, []);


    useEffect(() => {
        if (!isLoading && activeAccount && !me?.name) {
            navigate('/profile/name'); 
        }
        if (!activeAccountPk) {
            return;
        }
        // getNewChatToken(activeAccount, activeAccountPk).then(token => {
        //     // socket.auth = { token };
        //     // socket.connect();
        //     console.log('token', token);
        // });

    }
    , [activeAccountPk, me]);

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
    return (
        <div
        // style={isMobile ? {} : { minWidth: 500 }}
        >
            {
                (location.pathname === "/chat" || width > 768) &&
            <NavBar
            className="app-navbar "
            right={right}
            backArrow={false}>
          <span className="">NanChat </span>
        </NavBar>
        }
            <div className="">
                <div className="">
                    <List>
                        {filteredChats?.map(chat => {
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
                            // const decrypted = useMessageDecryption({
                            //     message: {
                            //         content: chat.lastMessage,
                            //         fromAccount: accountFrom,
                            //         toAccount: activeAccount,
                            //         _id: chat.lastMessageId,
                            //     }})
                            // if (!accountFrom) return null;
                            return (
                                <List.Item
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
                                    key={chat.id}
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
                                                    {
                                                        hasName ? hasName : formatAddress(accountFrom)
                                                    }
                                                    {
                                                        from?.verified && <RiVerifiedBadgeFill />
                                                    }
                                                </>
                                        }
                                    </div>
                                    <div className="flex justify-between">
                                    </div>
                                </List.Item>
                            )
                        })}
                    </List>
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
                    mutate()
                    navigate(`/chat/${r.id}`, { viewTransition: false, replace: true })
                    Toast.show({icon: 'success'})
                }

            }
        }}
          visible={isNewChatVisible} setVisible={setIsNewChatVisible} />
                    
                    
                    
                    {/* <div className="text-center text-gray-500 mt-4 flex items-center justify-start ml-2">
                        Online - {onlineAccount?.length}
                    </div>
                    <div className="mt-2">
                        <List>
                            <AccountListItems accounts={onlineAccount} badgeColor="green" />
                        </List>
                    </div>
                    <div className="text-center text-gray-500 mt-4 flex items-center justify-start ml-2">
                        Offline - {offlineAccount?.length}
                    </div>
                    <div className="mt-2">
                        <List>
                            <AccountListItems accounts={offlineAccount} badgeColor="gray" />
                        </List>
                    </div> */}
                </div>
                <div className="mt-6 pt-4 mb-4 ml-2 text-center" style={{ color: 'var(--adm-color-text-secondary)' }}>
                        <LockFill className="mr-2 inline" />Your chats are end-to-end encrypted using nano.
                </div>
                <div className="text-center mb-6 pb-6">
                        <Button 
                            color="primary"
                            onClick={() => {
                                inviteFriends()
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
                    </div>
            </div>
        </div>
    );
};

export const AccountAvatar = ({ url, account, badgeColor }) => {
    if (url == null) {
        url = "https://i.nanwallet.com/u/plain/https%3A%2F%2Fnatricon.com%2Fapi%2Fv1%2Fnano%3Faddress%3D" + account + "%26outline%3Dtrue"
    }

    const icon = <img style={{borderRadius: 8}} src={url} alt="account-pfp" width={48} />
    if (badgeColor == "gray"){ // show only active icon
        return icon
    }
    return (
        <Badge
            color={badgeColor}
            content={Badge.dot}
            style={{ '--top': '80%', '--right': '20%' }}
        >
            {icon}
    </Badge>
    );
}

export default ChatList;