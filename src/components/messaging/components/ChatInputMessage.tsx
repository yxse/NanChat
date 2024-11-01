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
import { fetcherMessages } from "../fetcher";
import { box } from "multi-nano-web";
import { SlArrowUpCircle } from "react-icons/sl";
import { FaArrowUp } from "react-icons/fa6";

const ChatInputMessage: React.FC<{ }> = ({ onSent }) => {
    const {
        account
    } = useParams();
    const [lastEmitTime, setLastEmitTime] = useState(0);
    const [lastTypingTimeReceived, setLastTypingTimeReceived] = useState(0);
    const [newMessage, setNewMessage] = useState('');
    const [dateNow, setDateNow] = useState(Date.now());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);
    const navigate = useNavigate();
    const {wallet} = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
    const {data: messagesHistory} = useSWR<Message[]>(`/messages?fromAccount=${activeAccount}&toAccount=${account}`, fetcherMessages);
    const {data: names} = useSWR<Chat[]>(`/names?accounts=${account}`, fetcherMessages);
    const nameOrAccount = names?.[0]?.name || formatAddress(account);

    useEffect(() => {
        if (messagesHistory) {
            // setMessages(messagesHistory);
        }
    }, [messagesHistory, messagesEndRef]);

    useEffect(() => {
        socket.on('typing', (account: string) => {
            console.log('typing', account);
        });
        socket.on('message', (message: Message) => {
          setLastTypingTimeReceived(0);
        });

      return () => {
                socket.off('message');
      };
    }, []);

   
    useEffect(() => {
        if (newMessage.trim() && Date.now() - lastEmitTime > 1000) { // send typing event every 1s at most
          socket.emit('typing', account);
          setLastEmitTime(Date.now());
        }
    }
    , [newMessage]);
    // , []);

    useEffect(() => {
        socket.on('typing', (account: string) => {
            console.log('typing', account);
            setLastTypingTimeReceived(Date.now());
        });

        return () => {
            socket.off('typing');
        };
    }, []);

    useEffect(() => {
    // todo this in separate component as it is refresh the whole component every second
        const interval = setInterval(() => {
            setDateNow(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);
    
    const scrollToBottom = () => {
      messagesEndRef.current?.
      scroll({
        top: messagesEndRef.current.scrollHeight,
        behavior: 'instant',
      })
    };
  
    // useEffect(scrollToBottom, [messages]);
  
    const sendMessage = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim()) return;
      const message: Message = {
        content: newMessage,
        fromAccount: activeAccount,
        toAccount: account,
        timestamp: new Date(),
      };
      onSent(message);
     const messageEncrypted = { ...message };
     messageEncrypted['content'] = box.encrypt(newMessage, account, activeAccountPk);
     socket.emit('message', messageEncrypted);
     setNewMessage('');
     messageInputRef.current?.focus();
    };

  
    return (
        <form 
        style={{position: 'fixed', bottom: '0', width: '100%'}}
        onSubmit={sendMessage} className="p-4  ">
              {
                  lastTypingTimeReceived > (dateNow - 4000) && (
                      <div className="flex items-center gap-2 mb-1">
                          <span>
                            <DotLoading />
                            {
                                nameOrAccount
                            } is typing...
                            </span>
                      </div>
                      )
                }
          <div 
          style={{borderRadius: 32}}
          className="flex items-center gap-2 border border-solid border-gray-800 input-message">
            <TextArea 
            ref={messageInputRef}
              autoSize={{ minRows: 1, maxRows:5 }}
              rows={1}
              style={{focus}}
              className="flex-1 p-2 rounded-lg "
              placeholder="Message"
              value={newMessage}
              onChange={(e) => setNewMessage(e)}
            />
            <Button
              type="submit"
              className="p-1 rounded-full bg-blue-500 text-white mr-1"
              disabled={!newMessage.trim()}
              style={ !newMessage.trim() ? {display: 'none'} : {}}
            >
              <FaArrowUp className="w-5 h-5" />
            </Button>
          </div>
        </form>
    );
  };

export default ChatInputMessage;