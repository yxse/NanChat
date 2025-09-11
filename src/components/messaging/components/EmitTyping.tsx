import { MessageOutline, PhoneFill, SendOutline } from "antd-mobile-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { BiChevronLeft, BiMessageSquare } from "react-icons/bi";
import { FiMoreHorizontal } from "react-icons/fi";
import { IoSendOutline } from "react-icons/io5";
import { useNavigate, useParams } from "react-router-dom";
import { socket } from "../socket";
import { WalletContext } from "../../useWallet";
import { formatAddress } from "../../../utils/format";
import { convertAddress } from "../../../utils/convertAddress";
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
import ProfileName from "./profile/ProfileName";
import { useChats } from "../hooks/use-chats";

const EmitTyping: React.FC<{ newMessage, messageInputRef }> = ({ newMessage, messageInputRef, account }) => {
    const isKeyboardOpen = useDetectKeyboardOpen(); // used to fix scroll bottom android when keyboard open and new message sent
    const [lastTypingTimeReceived, setLastTypingTimeReceived] = useState(0);
    const [dateNow, setDateNow] = useState(Date.now());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { wallet } = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
    // const { data: messagesHistory } = useSWR<Message[]>(`/messages?chatId=${account}`, fetcherMessages);
    // const {data: names} = useSWR<Chat[]>(`/names?accounts=${account}`, fetcherMessages);
    const {chats} = useChats();
    const chat = chats?.find(chat => chat.id === account);
    const names = chat?.participants;
    let address = names?.find(participant => participant._id !== activeAccount)?._id;
    const lastEmitTimeRef = useRef(0); // important to use useRef instead of useState to prevent race condition that can happen on low cpu simulation

    const [participantsTyping, setParticipantsTyping] = useState<string[]>([]);
    if (account?.startsWith('nano_')) {
        address = account;
    }

    useEffect(() => {
        if (newMessage.trim() && Date.now() - lastEmitTimeRef.current > 1000) { // send typing event every 1s at most
            lastEmitTimeRef.current = Date.now();
            socket.emit('typing', chat?.id);
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
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        socket.on('typing', (typing) => {
            const { chatId, account: accountTyping} = typing;
            // setTimeout(() => {
            //     // window.scrollTo(0, document.body.scrollHeight);
            //   }
            //   , 10);
            console.log('typing', chatId, accountTyping, address);
            if (chatId !== account) return // show typing only for current chat
            setParticipantsTyping(
                prev => {
                    if (prev.find(participant => participant.account === accountTyping)) {
                        return prev.map(participant => {
                            if (participant.account === accountTyping) {
                                return { account: accountTyping, time: Date.now() }
                            }
                            return participant;
                        });
                    }
                    return [...prev, { account: accountTyping, time: Date.now() }];
                }
            );

            setLastTypingTimeReceived(Date.now());
            if (document.activeElement === messageInputRef.current?.nativeElement && isKeyboardOpen) {
                messageInputRef.current?.blur(); // fix content shift android when typing & keyboard open
                messageInputRef.current?.focus();
            }
        });

        return () => {
            socket.off('typing');
            setParticipantsTyping([]);
        };
    }, [address, isKeyboardOpen, chat, account]);

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

        // return () => {
        //     socket.off('message');
        // };
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
            className="flex items-center">
                <div
                    // style={{position: 'fixed', bottom: '128px', width: '100%'}}
                    className="flex items-center gap-2 mb-1"
                >
                    <AccountsAreTyping participantsTyping={participantsTyping} />
                </div>
        </div>
    )
};

const AccountsAreTyping = ({ participantsTyping }) => {

    if (participantsTyping.length === 0) {
        return null;
    }
    if (participantsTyping.length > 2) {
        return (
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <TypingDots /><span>Several people are typing…</span>
            </div>
        )
    }
    return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <TypingDots />
            <span>
            {
                participantsTyping.map((participant, index) => (
                    <span key={participant.account}>
                        <ProfileName address={participant.account} />
                        {index !== participantsTyping.length - 1 ? ', ' : ''}
                    </span>
                ))
            }

            {participantsTyping.length > 1 ? ' are typing…' : ' is typing…'}</span>
        </div>
    )
}

const TypingDots = () => {
    return (
        <span style={{ display: 'inline-block' }}>
            <svg height="20" width="40" className="loader">
                <circle className="dot" cx="10" cy="10" r="3" style={{ fill: 'grey' }} />
                <circle className="dot" cx="20" cy="10" r="3" style={{ fill: 'grey' }} />
                <circle className="dot" cx="30" cy="10" r="3" style={{ fill: 'grey' }} />
            </svg>
        </span>
    )
}

export default EmitTyping;