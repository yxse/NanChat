import { MessageOutline, PhoneFill, SendOutline } from "antd-mobile-icons";
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
import { Button, DotLoading, Input, List, TextArea } from "antd-mobile";
import useSWR from "swr";
import { fetcherMessages, fetcherMessagesPost } from "../fetcher";
import { box } from "multi-nano-web";
import { SlArrowUpCircle } from "react-icons/sl";
import { FaArrowUp } from "react-icons/fa6";
import { useChat } from "../hooks/useChat";
import ChatInputTip from "./ChatInputTip";
import useDetectKeyboardOpen from "../../../hooks/use-keyboard-open";

const EmitTyping: React.FC<{ newMessage, messageInputRef }> = ({ newMessage, messageInputRef }) => {
    const {
        account
    } = useParams();
    const isKeyboardOpen = useDetectKeyboardOpen(); // used to fix scroll bottom android when keyboard open and new message sent
    const [lastEmitTime, setLastEmitTime] = useState(0);
    const [lastTypingTimeReceived, setLastTypingTimeReceived] = useState(0);
    const [dateNow, setDateNow] = useState(Date.now());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { wallet } = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
    const { data: messagesHistory } = useSWR<Message[]>(`/messages?chatId=${account}`, fetcherMessages);
    // const {data: names} = useSWR<Chat[]>(`/names?accounts=${account}`, fetcherMessages);
    const { data: chats, mutate } = useSWR<Chat[]>(`/chats?account=${activeAccount}`, fetcherMessages);
    const chat = chats?.find(chat => chat.id === account);
    const names = chat?.participants;
    let address = names?.find(participant => participant._id !== activeAccount)?._id;
    let participant = names?.find(participant => participant._id !== activeAccount)
    const [participantsTyping, setParticipantsTyping] = useState<string[]>([]);
    if (account?.startsWith('nano_')) {
        address = account;
    }
    const nameOrAccount = participant?.name || formatAddress(address);

    useEffect(() => {
        if (newMessage.trim() && Date.now() - lastEmitTime > 1000) { // send typing event every 1s at most
            socket.emit('typing', address || chat?.id);
            setLastEmitTime(Date.now());
        }
    }
        , [newMessage, chat]);
    // , []);

    useEffect(() => {
        // todo this in separate component as it is refresh the whole component every second
        const interval = setInterval(() => {
            setDateNow(Date.now());
            setParticipantsTyping(prev => {
                return prev.filter(participant => {
                    return Date.now() - participant.time < 4000;
                });
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        socket.on('typing', (account: string) => {
            setTimeout(() => {
                // window.scrollTo(0, document.body.scrollHeight);
              }
              , 10);
            console.log('typing', account, address);
            if (account !== address && chat?.type === 'private') return
            setParticipantsTyping(
                prev => {
                    if (prev.find(participant => participant.account === account)) {
                        return prev.map(participant => {
                            if (participant.account === account) {
                                return { account, time: Date.now() }
                            }
                            return participant;
                        });
                    }
                    return [...prev, { account, time: Date.now() }];
                }
            );

            setLastTypingTimeReceived(Date.now());
            if (document.activeElement === messageInputRef.current.nativeElement && isKeyboardOpen) {
                messageInputRef.current?.blur(); // fix content shift android when typing & keyboard open
                messageInputRef.current?.focus();
            }
        });

        return () => {
            socket.off('typing');
        };
    }, [address, isKeyboardOpen]);

    useEffect(() => {
        socket.on('message', (message: Message) => {
            if (chat?.type === "private"){
                setLastTypingTimeReceived(0);
            }
            console.log('message', message);
            console.log('participantsTyping', participantsTyping);
            setParticipantsTyping((prev) => {
                console.log('prev', prev);
                return prev.filter(participant => participant.account !== message.fromAccount)
            })
        });

        return () => {
            socket.off('message');
        };
    }, [address, chat]);

    // console.log("typing render")
    // return null
    return (
        <div
            style={{
                // boxShadow: '0px 5px 34px 25px rgba(0,0,0,0.75)',
                // position: 'fixed', bottom: '128px', width: '100%'
                position: "relative",
            }}
            className="flex items-center  mb-1">
            {lastTypingTimeReceived > (dateNow - 4000) ? (
                <div
                    // style={{position: 'fixed', bottom: '128px', width: '100%'}}
                    className="flex items-center gap-2 mb-1"
                >
                    {
                        chat?.type === 'private' ? 
                        <span>
                        <TypingDots />
                        <b>
                            {
                                nameOrAccount
                            }</b> is typing…
                    </span>
                    :
                    <AccountsAreTyping participantsTyping={participantsTyping} />
                }
                </div>
            )
                : <div
                // style={{height: '21px'}}
                >
                    {/* <span><>&nbsp;</></span>  */}
                    {/* placeholder to prevent content shift on typing */}
                </div>

            }
        </div>
    )
};

const AccountName = ({ account }) => {
    const { data: accountData } = useSWR<Chat[]>(`/name?account=${account}`, fetcherMessages, {
        dedupingInterval: 60000,
    });

    return (
            <b>{accountData?.name}</b>
    )
}
const AccountsAreTyping = ({ participantsTyping }) => {

    if (participantsTyping.length === 0) {
        return null;
    }
    if (participantsTyping.length > 2) {
        return (
            <span>
                    Several people are typing…
            </span>
        )
    }
    return (
        <div>
            <TypingDots />
            {
                participantsTyping.map((participant, index) => (
                    <span key={participant.account}>
                        <AccountName account={participant.account} />
                        {index !== participantsTyping.length - 1 ? ', ' : ''}
                    </span>
                ))
            }

            {participantsTyping.length > 1 ? ' are typing…' : ' is typing…'}
        </div>
    )
}

const TypingDots = () => {
    return (
        <span style={{ display: 'inline-block' }}>
            <svg height="25" width="40" className="loader">
                <circle className="dot" cx="10" cy="20" r="3" style={{ fill: 'grey' }} />
                <circle className="dot" cx="20" cy="20" r="3" style={{ fill: 'grey' }} />
                <circle className="dot" cx="30" cy="20" r="3" style={{ fill: 'grey' }} />
            </svg>
        </span>
    )
}

export default EmitTyping;