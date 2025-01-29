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
import { FaArrowUp, FaKeyboard } from "react-icons/fa6";
import { useChat } from "../hooks/useChat";
import ChatInputTip from "./ChatInputTip";
import EmitTyping from "./EmitTyping";
import ChatInputStickers from "./ChatInputStickers";
import { useWindowDimensions } from "../../../hooks/use-windows-dimensions";

const ChatInputMessage: React.FC<{ }> = ({ onSent, messageInputRef }) => {
    const {
        account
    } = useParams();
    const [stickerVisible, setStickerVisible] = useState(false);
    const {isMobile} = useWindowDimensions()
    const [lastEmitTime, setLastEmitTime] = useState(0);
    const [lastTypingTimeReceived, setLastTypingTimeReceived] = useState(0);
    const [newMessage, setNewMessage] = useState('');
    const [dateNow, setDateNow] = useState(Date.now());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const {wallet} = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
    const {data: messagesHistory} = useSWR<Message[]>(`/messages?chatId=${account}`, fetcherMessages);
    // const {data: names} = useSWR<Chat[]>(`/names?accounts=${account}`, fetcherMessages);
    const {data: chats, mutate} = useSWR<Chat[]>(`/chats`, fetcherMessages);
    const chat = chats?.find(chat => chat.id === account);
    const names = chat?.participants;
    let address = names?.find(participant => participant._id !== activeAccount)?._id;
    let participant = names?.find(participant => participant._id !== activeAccount)
    if (account?.startsWith('nano_')) {
        address = account;
    }
    if (chat?.participants && chat?.participants[0]?._id === chat?.participants[1]?._id) { // chat with self
        address = chat?.participants[0]?._id;
    }
    const nameOrAccount = participant?.name || formatAddress(address);
    
    useEffect(() => {
        if (messagesHistory) {
            // setMessages(messagesHistory);
        }
    }, [messagesHistory, messagesEndRef]);

    useEffect(() => {
        socket.on('typing', (account: string) => {
            console.log('typing', account);
            // setTimeout(() => {
            //   window.scrollTo(0, document.body.scrollHeight);
            // }
            // , 10);
        });
        socket.on('message', (message: Message) => {
          setLastTypingTimeReceived(0);
        });

      return () => {
                socket.off('message');
      };
    }, [address, chat]);

   
    useEffect(() => {
        if (newMessage.trim() && Date.now() - lastEmitTime > 1000) { // send typing event every 1s at most
          socket.emit('typing', address);
          setLastEmitTime(Date.now());
        }
    }
    , [newMessage]);
    // , []);

    useEffect(() => {
        socket.on('typing', (account: string) => {
            // console.log('typing', account, address);
            // if (account !== address) return;
            // setLastTypingTimeReceived(Date.now());
            // messageInputRef.current?.blur();
            // messageInputRef.current?.focus();
        });

        return () => {
            socket.off('typing');
        };
    }, [address]);

    const scrollToBottom = () => {
      messagesEndRef.current?.
      scroll({
        top: messagesEndRef.current.scrollHeight,
        behavior: 'instant',
      })
    };
  
    // useEffect(scrollToBottom, [messages]);
  
    const sendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      let chatId = account;
      if (!newMessage.trim()) return;
      if (messagesHistory.length === 0 && account.startsWith('nano_')) {
        let r = await fetcherMessagesPost(`/chat`, {
          type: "private",
          participants: [activeAccount, account],
        })
        
        chatId = r.id;
      }
      const message: Message = {
        content: newMessage,
        fromAccount: activeAccount,
        // toAccount: account,
        timestamp: new Date(),
        chatId: chatId,
      };
      onSent(message);
     const messageEncrypted = { ...message };
     if (chat === undefined || chat.type === "private") { // chat can be undefined when sending first message
      messageEncrypted['content'] = box.encrypt(newMessage, address, activeAccountPk);
      localStorage.setItem(messageEncrypted['content'], newMessage); // save decrypted message cache, encrypted content is the key
      }
      else {
        messageEncrypted['content'] = newMessage;
      }

     socket.emit('message', messageEncrypted);
     setNewMessage('');
     messageInputRef.current?.focus();
     if (account !== chatId){
      // redirect to chat id when initial message
       mutate()
       navigate(`/chat/${chatId}`); 
     }

    };

    const sendTipMessage = async (ticker: string, hash: string) => {
      let chatId = account;
      // let messageTip = 'Tip ' + ticker + ' ' + hash;
      const message: Message = {
        content: "tip",
        fromAccount: activeAccount,
        // toAccount: account,
        timestamp: new Date(),
        chatId: chatId,
        tip: {ticker, hash}
      };
      onSent(message);
     const messageEncrypted = { ...message };
     messageEncrypted['content'] = box.encrypt(message.content, address, activeAccountPk);
     socket.emit('message', messageEncrypted);
     messageInputRef.current?.focus();
    };

    const sendStickerMessage = async (stickerId: string) => {
      let chatId = account;
      // let messageTip = 'Tip ' + ticker + ' ' + hash;
      const message: Message = {
        content: "Sticker",
        fromAccount: activeAccount,
        // toAccount: account,
        timestamp: new Date(),
        chatId: chatId,
        stickerId: stickerId
      };
      onSent(message);
     const messageEncrypted = { ...message };
     if (chat.type === "private") {
      messageEncrypted['content'] = box.encrypt(message.content, address, activeAccountPk);
     }
      else {
        messageEncrypted['content'] = message.content;
      }
     socket.emit('message', messageEncrypted);
    }

    const iconRisibank =  <img style={{filter: 'grayscale(0)', width: '36px'}} src="https://risibank.fr/favicon.svg" alt="Stickers" className="w-5 h-5" />
    const iconRisibankGray =  <img style={{filter: 'grayscale(1)', width: '36px'}} src="https://risibank.fr/favicon.svg" alt="Stickers" className="w-5 h-5" />


    console.log("message input render")
    return (
        <div 
        style={{
          // position: 'relative',
          //  bottom: '0',
           width: '100%',
           // flexDirection: 'row',
          //  alignItems: 'center',
          //  touchAction: 'none',
          //  display: 'flex',
          //  gap: '1rem',
        }}
        onSubmit={sendMessage} className="mb-4 px-4">
       
            <EmitTyping 
            messageInputRef={messageInputRef}
            newMessage={newMessage} />
            <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              width: '100%',
            }}
            >
            
            <ChatInputTip toAddress={address} onTipSent={(ticker, hash) => {
              sendTipMessage(ticker, hash);
            }} />
          <div 
          style={{borderRadius: 32, width: '100%', borderColor: 'var(--adm-color-border)', filter: 'brightness(0.9)'}}
          className="flex items-center gap-2 border border-solid input-message">
            <TextArea 
            onFocus={() => {
              if (isMobile){
                // setStickerVisible(false) // close sticker when keyboard open on mobile
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e);
              }}
            }
            ref={messageInputRef}
              autoSize={{ minRows: 1, maxRows:5 }}
              rows={1}
              // style={{focus}}
              className="m-2 rounded-lg "
              placeholder="Message"
              value={newMessage}
              onChange={(e) => setNewMessage(e)}
            />
            <Button
              onClick={sendMessage}
              className="p-1 rounded-full bg-blue-500 text-white mr-1"
              disabled={!newMessage.trim()}
              style={ !newMessage.trim() ? {display: 'none'} : {}}
            >
              <FaArrowUp className="w-5 h-5" />
            </Button>
          </div>
          <Button
          style={{display: "none"}}
          onClick={() => {
            if (stickerVisible){
              setStickerVisible(false);
              messageInputRef.current?.focus();
            }
            else {
              setStickerVisible(true);
              messageInputRef.current?.blur();
            }
          }}
        className=""
        shape="rounded"
        size="large"
        >
          {
            stickerVisible ? 
              (isMobile ? <FaKeyboard className="w-5 h-5" /> : iconRisibank)
            :
            iconRisibankGray
        }
        </Button>
          </div>
          {
            stickerVisible && <ChatInputStickers onStickerSelect={(stickerId) => {
              sendStickerMessage(stickerId);
            }} />
          }

        </div>
    );
  };

export default ChatInputMessage;