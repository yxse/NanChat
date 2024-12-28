import { Avatar, Badge, Button, Card, Input, List, Modal, Popover, SearchBar, Space, Toast } from "antd-mobile";
import { FillinOutline, LockFill, LockOutline, MailOutline, SystemQRcodeOutline, TeamOutline, UserCircleOutline, UserContactOutline, UserOutline, UserSetOutline } from "antd-mobile-icons";
import { useContext, useEffect, useState } from "react";
import { FiMoreHorizontal } from "react-icons/fi";
import { AccountIcon } from "../../app/Home";
import { socket } from "../socket";
import { LedgerContext, WalletContext } from "../../Popup";
import { convertAddress, formatAddress } from "../../../utils/format";
import { fetcherMessages, fetcherMessagesPost } from "../fetcher";
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
    const { data: chats, mutate } = useSWR<Chat[]>(`/chats?account=${activeAccount}`, fetcherMessages);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const {ledger, setLedger} = useContext(LedgerContext);

    const { data: accounts } = useSWR<string[]>('/accounts?search=' + activeAccount, fetcherMessages);
    // const onlineAccount = accounts?.online;
    // const offlineAccount = accounts?.offline;
    // const all = onlineAccount?.concat(offlineAccount);
    // const { data: names } = useSWR<Chat[]>(`/names?accounts=${all?.map(account => account._id).join(',')}`, fetcherMessages, {keepPreviousData: true});
    // const filteredChats = chats?.filter(chat =>
    //     chat.name?.toLowerCase().includes(searchQuery?.toLowerCase())
    // );
    const accountData = accounts?.find(name => name._id === activeAccount)
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
        if (localStorage.getItem('name') === null) {
            navigate('/profile/name');
        }
    }
        , []);

    
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
    return (
        <div
        // style={isMobile ? {} : { minWidth: 500 }}
        >
            <div>
                <List style={{ 
                    position: 'sticky', top: 0, zIndex: 1 }} className="">
                    <List.Item
                    description={formatAddress(activeAccount)}
                    onClick={() => {
                        Modal.show({

                            showCloseButton: true,
                            closeOnMaskClick: true,
                            content: (
                                <div className="flex justify-center items-center flex-col">
                                    <div className="text-center text-xl mb-1">
                                        {accountData?.name}                                        
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
                                    value={`${window.location.href}/${activeAccount}`}
                                    size={200}
                                    />
                                    <div className="text-sm mt-2 text-gray-500 text-center">
                                        Scan to start an encrypted chat with me
                                    </div>
                                </div>
                            )
                        })
                    }}
                    extra={<SystemQRcodeOutline 
                        fontSize={24} color="white" style={{cursor: "pointer"}}/>}
                    >
                        {accountData?.name}
                    </List.Item>
                    {/* <div className="flex items-center gap-2 mt-1 align-middle">
            Share your Invitation Link: <CopyToClipboard text={`https://znbfmt6n-4173.euw.devtunnels.ms/messages/${activeAccount}`} />
            </div> */}
                  
                </List>
                <div className="text-gray-500 mt-2 mb-2 ml-2">
                        <LockFill className="mr-2 inline" />Your chats are end-to-end encrypted.
                    </div>
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
                            
                            let decrypted = false
                            try {
                                if (chat.type === 'private') {
                                    decrypted = box.decrypt(chat.lastMessage, accountFrom, activeAccountPk)
                                }
                                else {
                                    decrypted = chat.lastMessage;
                                }
                            } catch (error) {
                                console.log(error);
                            }
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
                                    description={decrypted}
                                >
                                    <div className="flex items-center">
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
                                    </div>
                                    <div className="flex justify-between">
                                    </div>
                                </List.Item>
                            )
                        })}
                    </List>
                    
                    <div className="mt-2">
                        
                        
                        <List className="mt-2">
                            <List.Item
                            onClick={() => {
                                navigator.share({
                                    title: `Hey, I'm using NanWallet for end-to-end encrypted messaging. Install NanWallet and message me at @${accountData?.username}`,
                                    url: window.location.href + `/${activeAccount}`
                                })  
                            }}
                            prefix={<MailOutline />}
                            >
                                Invite friends
                            </List.Item>
                            <NewChatPopup />
                        </List>
                    </div>
                    
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
            </div>
        </div>
    );
};

export const AccountAvatar = ({ url, account, badgeColor }) => {
    if (url == null) {
        url = "https://i.nanswap.com/u/plain/https%3A%2F%2Fnatricon.com%2Fapi%2Fv1%2Fnano%3Faddress%3D" + account
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