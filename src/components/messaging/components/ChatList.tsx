import { Avatar, Badge, Button, Card, DotLoading, Ellipsis, Input, List, Modal, NavBar, Popover, SearchBar, Space, Toast } from "antd-mobile";
import { AddCircleOutline, ChatAddOutline, FillinOutline, LockFill, LockOutline, MailOutline, MessageFill, MessageOutline, ScanCodeOutline, SystemQRcodeOutline, TeamOutline, UserCircleOutline, UserContactOutline, UserOutline, UserSetOutline } from "antd-mobile-icons";
import { useContext, useEffect, useState } from "react";
import { FiMoreHorizontal } from "react-icons/fi";
import { AccountIcon } from "../../app/Home";
import { socket } from "../socket";
import { LedgerContext, WalletContext } from "../../Popup";
import { convertAddress, formatAddress } from "../../../utils/format";
import { fetcherAccount, fetcherMessages, fetcherMessagesPost, getNewChatToken } from "../fetcher";
import useSWR from "swr";
import SetName from "./SetName";
import { Link, useNavigate, useParams } from "react-router-dom";
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
    const { data: chats, mutate, error, isLoading: isLoadingChat } = useSWR<Chat[]>(`/chats`, fetcherMessages, {onError: (error) => {
        console.log({error})
        if (error === 401 || error === 403) {
            getNewChatToken(activeAccount, activeAccountPk).then(token => {
            });
        }
    }});
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
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
    const {isMobile} = useWindowDimensions()
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

    
    const ButtonNewChat = () => {
        const actions: Action[] = [
            // { key: 'private_chat', icon: <UserOutline />, text: 'New Private Chat' },
            // { key: 'private_group', icon: <TeamOutline />, text: 'Private Group' },
            { key: 'public_group', icon: <TeamOutline />, text: 'New Public Group' },

        ]
        return (
            <div className="flex justify-center items-center mt-4">
                <Popover.Menu
                    mode='dark'
                    actions={actions}
                    placement='right-start'
                    onAction={node => {
                        if (node.key === 'public_group') {
                            let modal = Modal.show({
                                title: 'Create a new public group',
                                content: (
                                    <div>
                                        <Input
                                            id="group-name"
                                            type="text"
                                            placeholder="Group Name"
                                            className="w-full mt-2 p-2 rounded-lg"
                                        />
                                    </div>
                                ),
                                actions: [
                                    {
                                        key: 'cancel',
                                        text: 'Cancel',
                                        onClick: () => modal.close()
                                    },
                                    {
                                        key: 'create',
                                        text: 'Create',
                                        primary: true,
                                        onClick: async () => {
                                            await fetcherMessagesPost('/chat', {
                                                "type": "group",
                                                "name": (document.getElementById('group-name') as HTMLInputElement).value,
                                                "participants": [activeAccount]
                                            })

                                            Toast.show({
                                                content: 'Group created'
                                            });
                                            modal.close();
                                        }
                                    }
                                ]
                            });
                        }

                    }}
                    trigger='click'
                >
                    <Button><FillinOutline fontSize={24} /></Button>
                </Popover.Menu>
            </div>
        );
    };
    if (ledger) {
        return <LedgerNotCompatible />
    }
    if (!chats || isLoadingChat) {
        return <DotLoading />
    }
    const right = (
        <div style={{ fontSize: 24 }}>
            <Popover.Menu
          mode='dark'
          actions={[
            { key: 'new_chat', icon: <MessageFill />, text: 'New Chat' },
            { key: 'invite', icon: <MailOutline />, text: 'Invite Friends' },
            { key: 'my_qr', icon: <SystemQRcodeOutline />, text: 'My QR Code' },
            { key: 'scan_qr', icon: <ScanCodeOutline />, text: 'Scan QR Code' },

          ]}
          placement='right-start'
          onAction={(node) => {
            if (node.key === 'new_chat') {
              setIsNewChatVisible(true);
            }
            if (node.key === 'invite') {
              navigator.share({
                title: `Hey, I'm using NanWallet for end-to-end encrypted messaging. Install NanWallet and message me at @${me?.username}`,
                url: window.location.href + `/${activeAccount}`
              })  
            }
            if (node.key === 'my_qr') {
              Modal.show({
                showCloseButton: true,
                closeOnMaskClick: true,
                content: (
                  <div className="flex justify-center items-center flex-col">
                    <div className="text-xl mb-1 flex  gap-2">
                    <AccountIcon account={activeAccount} width={32}/>
                      {me?.name}
                    </div>
                    <div className="text-sm mb-2">
                      {formatAddress(activeAccount)}
                    </div>
                    <QRCodeSVG
                      imageSettings={{
                        src: icon,
                        height: 24,
                        width: 24,
                        excavate: false,
                      }}
                      includeMargin
                      value={`https://app.nanwallet.com/chat/${activeAccount}`}
                      size={200}
                      style={{borderRadius: 8}}
                    />
                    <div className="text-sm mt-2 text-center" style={{ color: 'var(--adm-color-text-secondary)' }}>
                      Scan to start an encrypted chat with me
                    </div>
                  </div>
                )
              })
            }
            if (node.key === 'scan_qr') {
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
              <AddCircleOutline  style={{cursor: "pointer"}} />
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
                (location.pathname === "/chat" || !isMobile) &&
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
                            let from = chat.participants.find(participant => participant._id !== activeAccount);
                            if (chat.participants[0]?._id === chat.participants[1]?._id) { // chat with self
                                from = chat.participants[0]; 
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
                            if (!accountFrom) return null;
                            return (
                                <List.Item
                                    className={chat.id === account ? 'active' : ''}
                                    onClick={() => onChatSelect(chat.id)}
                                    key={chat.id}
                                    extra={
                                        <div className="flex flex-col items-end">
                                            <div>{new Date(chat.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            {chat.unreadCount > 0 && (
                                                <div>
                                                    <span className="text-xs text-white bg-blue-500 rounded-full w-5 h-5 flex items-center justify-center mt-1">
                                                        {chat.unreadCount}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    }
                                    prefix={
                                        chat.type === 'group' ?
                                            // round icon with group name initial
                                            <GroupAvatar
                                                groupName={chat.name}
                                                colors="blue"
                                            />
                                            :
                                            <AccountAvatar
                                                url={pfp}
                                                account={accountFrom}
                                                // badgeColor={onlineAccount?.find(account => account._id === accountFrom) ? 'green' : 'gray'}
                                                badgeColor={'gray'}
                                            />
                                    }
                                    // Ellipsis component is laggy when there are many messages
                                    // description={<Ellipsis content={decrypted || '...'} />}
                                    description={<MessageRaw 
                                        key={chat.lastMessageId}
                                        message={{
                                        content: chat.lastMessage,
                                        fromAccount: accountFrom,
                                        toAccount: activeAccount,
                                        _id: chat.lastMessageId,
                                        isLocal: chat.isLocal,
                                    }} />}
                                >
                                    <div className="flex items-center gap-2">
                                        {/* {
                                            chat.type === 'group' ?
                                                <>
                                                    <TeamOutline className="text-gray-500 mr-2" />
                                                    {chat.name}
                                                </>
                                                :
                                                <LockOutline className="text-gray-500 mr-2" />
                                        } */}

                                        {
                                            hasName ? hasName : formatAddress(accountFrom)
                                        }
                                        {
                                            from?.verified && <RiVerifiedBadgeFill />
                                        }
                                    </div>
                                    <div className="flex justify-between">
                                    </div>
                                </List.Item>
                            )
                        })}
                    </List>
        <NewChatPopup  visible={isNewChatVisible} setVisible={setIsNewChatVisible} />
                    
                    
                    
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
                        <LockFill className="mr-2 inline" />Your messages are end-to-end encrypted using nano.
                </div>
                <div className="text-center mb-6 pb-6">
                        <Button 
                            color="primary"
                            onClick={() => {
                                navigator.share({
                                    title: `Hey, I'm using NanWallet for end-to-end encrypted messaging. Install NanWallet and message me at ${activeAccount}`,
                                    url: `https://app.nanwallet.com/chat/${activeAccount}`
                                })  
                            }}
                            className="mt-4"
                            size="middle"
                            shape="rounded"
                            >
                                <Space align="center">
                                <MailOutline />
                                Invite Friends
                                </Space>
                            </Button>
                    </div>
            </div>
        </div>
    );
};

export const AccountAvatar = ({ url, account, badgeColor }) => {
    if (url == null) {
        url = "https://i.nanwallet.com/u/plain/https%3A%2F%2Fnatricon.com%2Fapi%2Fv1%2Fnano%3Faddress%3D" + account
    }

    const icon = <img style={{borderRadius: "100%", padding: 6}} src={url} alt="account-pfp" width={64} />
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