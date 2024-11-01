import { LockFill, LockOutline, MessageOutline, PhoneFill, SendOutline } from "antd-mobile-icons";
import { useContext, useEffect, useRef, useState } from "react";
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
import { Button, DotLoading, Input, List } from "antd-mobile";
import useSWR from "swr";
import { fetcherMessages } from "../fetcher";
import { box } from "multi-nano-web";
import ChatInputMessage from "./ChatInputMessage";

const ChatRoom: React.FC<{}> = ({ onlineAccount }) => {
    const {
        account
    } = useParams();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { wallet } = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
    const { data: messagesHistory } = useSWR<Message[]>(`/messages?fromAccount=${activeAccount}&toAccount=${account}`, fetcherMessages);
    const { data: names } = useSWR<Chat[]>(`/names?accounts=${account}`, fetcherMessages);
    const nameOrAccount = names?.[0]?.name || formatAddress(account);

    useEffect(() => {
        if (messagesHistory) {
            setMessages(messagesHistory);
        }
    }, [messagesHistory, messagesEndRef]);

    useEffect(() => {
        socket.on('message', (message: Message) => {
            setMessages(prev => [...prev, message]);
        });
        return () => {
            socket.off('message');
        };
    }, []);


    const scrollToBottom = () => {
        messagesEndRef.current?.
            scroll({
                top: messagesEndRef.current.scrollHeight,
                behavior: 'instant',
            })
    };

    useEffect(scrollToBottom, [messages]);

    // hide element with class "adm-tab-bar bottom"
    useEffect(() => {
        const admTabBar = document.querySelector('.adm-tab-bar.bottom');
        if (admTabBar) {
            admTabBar.setAttribute('style', 'display: none');
        }
        return () => {
            if (admTabBar) {
                admTabBar.setAttribute('style', 'display: block');
            }
        };
    }, []);

    return (
        <div className="">
            <List.Item

            // prefix={
            //     <AccountIcon account={account} width={48} />
            // }
            >
                <div
                onClick={() => {
                    navigate(`/chat/${account}/info`);
                }}
                    style={{ height: '5vh' }}
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
                            onlineAccount.includes(account) ? (
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
                        <AccountIcon account={account} width={48} />
                    </div>
                </div>
            </List.Item>
            <div
                ref={messagesEndRef}
                style={{ position: 'absolute', top: '0', bottom: '0', overflowY: 'auto', width: '100%', marginTop: '9vh', marginBottom: 64 }}
            >
                {messages.map(message => {
                    let decrypted = false
                    try {
                        decrypted = box.decrypt(message.content,
                            message.fromAccount === activeAccount ? message.toAccount : message.fromAccount
                            , activeAccountPk)
                    } catch (error) {
                        console.log(error);
                    }
                    console.log(message.content);
                    return (
                        <div
                            // style={{marginLeft: '10px', marginRight: '10px'}}
                            key={message._id}
                            className={`flex ${message.fromAccount === activeAccount ? 'justify-end' : 'justify-start'} mb-4 mx-4`}
                        >
                            <div
                                className={`max-w-[70%] p-3 rounded-lg ${message.fromAccount === activeAccount
                                        ? 'bg-blue-500 text-white rounded-br-none'
                                        : 'bg-white text-gray-800 rounded-bl-none'
                                    }`}
                            >
                                <p>{!decrypted && !message.isLocal ?
                                    <span className="text-xs opacity-70">(clear) </span>
                                    : ''}
                                    {decrypted ? decrypted : message.content}</p>
                                <div className="flex items-center justify-end gap-1 mt-1">
                                    <span className="text-xs opacity-70">
                                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {message.fromAccount === activeAccount && (
                                        <BiMessageSquare className="w-4 h-4" />
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <ChatInputMessage
                onSent={(message) => {
                    setMessages(prev => [...prev, { ...message, isLocal: true }]);
                }}
            />
        </div>
    );
};

export default ChatRoom;