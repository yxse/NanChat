import { Avatar, Badge, Button, Card, Input, List, Modal, Popover, SearchBar, Toast } from "antd-mobile";
import { FillinOutline, LockOutline, TeamOutline, UserCircleOutline, UserOutline, UserSetOutline } from "antd-mobile-icons";
import { useContext, useEffect, useState } from "react";
import { FiMoreHorizontal } from "react-icons/fi";
import { AccountIcon } from "../../app/Home";
import { socket } from "../socket";
import { WalletContext } from "../../Popup";
import { convertAddress, formatAddress } from "../../../utils/format";
import { fetcherMessages, fetcherMessagesPost } from "../fetcher";
import useSWR from "swr";
import SetName from "./SetName";
import { useNavigate, useParams } from "react-router-dom";
import { box } from "multi-nano-web";
import GroupAvatar from "./group-avatar";

const ChatList: React.FC = ({ onChatSelect }) => {
    const { wallet } = useContext(WalletContext)
    const { account } = useParams();
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
    const { data: chats, mutate } = useSWR<Chat[]>(`/chats?account=${activeAccount}`, fetcherMessages);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const { data: accounts } = useSWR<string[]>('/accounts', fetcherMessages);
    const onlineAccount = accounts?.online;
    const offlineAccount = accounts?.offline;
    const all = onlineAccount?.concat(offlineAccount);
    const { data: names } = useSWR<Chat[]>(`/names?accounts=${all?.map(account => account._id).join(',')}`, fetcherMessages);
    // const filteredChats = chats?.filter(chat =>
    //     chat.name?.toLowerCase().includes(searchQuery?.toLowerCase())
    // );
    const filteredChats = chats

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
            navigate('/chat/set-name');
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
    return (
        <div>
            <div>
                <List style={{ position: 'sticky', top: 0, zIndex: 1 }} className="">
                    <div className="flex justify-between items-center m-4">
                        <h1>Chats</h1>
                        <ButtonNewChat />
                    </div>
                    {/* <div className="flex items-center gap-2 mt-1 align-middle">
            Share your Invitation Link: <CopyToClipboard text={`https://znbfmt6n-4173.euw.devtunnels.ms/messages/${activeAccount}`} />
            </div> */}
                    <Input
                        type="text"
                        placeholder="Search chats..."
                        className="w-full mt-2 p-2 rounded-lg"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </List>
                <div className="">
                    <List>
                        {filteredChats?.map(chat => {
                            const from = chat.participants.find(participant => participant._id !== activeAccount);
                            const accountFrom = from?._id;
                            const hasName = from?.name;

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
                                                account={accountFrom}
                                                badgeColor={onlineAccount?.find(account => account._id === accountFrom) ? 'green' : 'gray'}
                                            />
                                    }
                                    description={decrypted}
                                >
                                    <div className="flex items-center">
                                        {
                                            chat.type === 'group' ?
                                                <>
                                                    <TeamOutline className="text-gray-500 mr-2" />
                                                    {chat.name}
                                                </>
                                                :
                                                <LockOutline className="text-gray-500 mr-2" />
                                        }

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
                    <div className="text-center text-gray-500 mt-4 flex items-center justify-start ml-2">
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
                    </div>
                </div>
            </div>
        </div>
    );
};

const AccountAvatar = ({ account, badgeColor }) => {
    return (
        <Badge
            color={badgeColor}
            content={Badge.dot}
            style={{ '--top': '80%', '--right': '20%' }}
        >
            <AccountIcon
                account={account}
                width={64}
            /></Badge>
    );
}
const AccountListItems = ({ accounts, badgeColor }) => {
    const navigate = useNavigate();
    return (
        <List>
            {
                accounts?.map(account => (
                    <List.Item
                        onClick={() => {
                            // document.startViewTransition(() => {
                            //     navigate(`/chat/${account._id}`, {unstable_viewTransition: true})
                            // })
                            navigate(`/chat/${account._id}`, { unstable_viewTransition: false })
                        }}
                        key={account._id + badgeColor}
                        extra={
                            <div className="flex flex-col items-end">
                                <div>
                                    {formatAddress(account._id)}
                                </div>
                            </div>
                        }
                        prefix={
                            <AccountAvatar
                                account={account._id}
                                badgeColor={badgeColor}
                            />
                        }
                    >
                        {
                            account.name
                        }
                    </List.Item>
                ))
            }
        </List>
    );
}
export default ChatList;