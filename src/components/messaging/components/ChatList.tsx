import { Badge, Button, Card, Input, List, Modal, Popover, SearchBar, Toast } from "antd-mobile";
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

const ChatList: React.FC = ({ onChatSelect , onlineAccount}) => {
    const {wallet} = useContext(WalletContext)
    const {account} = useParams();
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
    const {data: chats, mutate} = useSWR<Chat[]>(`/chats?account=${activeAccount}`, fetcherMessages);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const {data: names} = useSWR<Chat[]>(`/names?accounts=${onlineAccount.join(',')}`, fetcherMessages);
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
                                await fetcherMessagesPost('/chats', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        name: (document.getElementById('group-name') as HTMLInputElement).value,
                                        type: 'public',
                                        participants: [activeAccount]
                                    })
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
            <List style={{position: 'sticky', top: 0, zIndex: 1}} className="">
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
                            decrypted = box.decrypt(chat.lastMessage, accountFrom, activeAccountPk)
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
                                <AccountIcon
                                    account={accountFrom}
                                    width={64}
                                />
                            }
                            description={decrypted}
                        >
                            <div className="flex items-center">
                            <LockOutline className="text-gray-500 mr-2" />
                            {
                                hasName ? hasName : formatAddress(accountFrom)
                            }
                            </div>
                            <div className="flex justify-between">
                            </div>
                        </List.Item>
                    )})}
                </List>
                <div className="text-center text-gray-500 mt-4 flex items-center justify-start ml-2">
                        Online
                    <Badge content={onlineAccount.length} className="ml-2" color="green" />
                </div>
                <div className="mt-2">
                    <List>

                    {
                        onlineAccount.map((account: string) => (
                            // List.Item
                            <List.Item
                            onClick={() => onChatSelect(account)}
                                key={account}
                                extra={
                                    <div className="flex flex-col items-end">
                                        <div>
                                            {formatAddress(account)}
                                        </div>
                                    </div>
                                }
                                prefix={
                                    <AccountIcon
                                        account={account}
                                        width={64}
                                    />
                                }
                            >
                                {
                                    names?.find(name => name._id === account)?.name || formatAddress(account)
                                }
                            </List.Item>
                        ))
                        }
                    </List>
                </div>
            </div>
        </div>
        </div>
    );
};
export default ChatList;