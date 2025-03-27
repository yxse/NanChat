import { AddCircleOutline, MessageOutline, PhoneFill, SendOutline, SmileFill, SmileOutline } from "antd-mobile-icons";
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
import ChatInputFile from "./ChatInputFile";
import ChatInputAdd from "./ChatInputAdd";
import { updateSharedKeys } from "../../../services/sharedkey";
import { useEvent } from "./EventContext";
import { useChats } from "../hooks/use-chats";


const mutateLocal = (mutate, mutateChats, message, account, activeAccount) => {
  const id = Math.random().toString();
  mutate(currentPages => {
      const newPages = [...(currentPages || [])];
      // newPages[0] = [...(newPages[0] || []), { ...message, isLocal: true }];
      // newPages[0] = [{ ...message, isLocal: true, _id: Math.random().toString()
      newPages[0] = [{ ...message, isLocal: true, _id: id}, ...(newPages[0] || [])];
      return newPages;
  }, false);
  mutateChats(currentChats => { // local mutate to update last message in chat list without refetching
      const newChats = [...(currentChats || [])];
      const chatIndex = newChats.findIndex(chat => chat.id === account);
      if (chatIndex !== -1) {
          const newChat = { ...newChats[chatIndex] };
          newChat.lastMessage = message.content;
          newChat.lastMessageTimestamp = new Date().toISOString();
          newChat.lastMessageId = id;
          newChat.isLocal = true;
          newChat.lastMessageFrom = activeAccount;
          newChat.height = newChat.height + 1;
          newChats.splice(chatIndex, 1);
          newChats.unshift(newChat);
      }
      return newChats;
  }, false);
}

const ChatInputMessage: React.FC<{ }> = ({ onSent, messageInputRef, defaultNewMessage, defaultChatId = undefined }) => {
    let {
        account
    } = useParams();
    if (account === undefined && defaultChatId !== undefined) {
      account = defaultChatId;
    }
    const [stickerVisible, setStickerVisible] = useState(false);
    const [inputAdditionVisible, setInputAdditionVisible] = useState(false);
    const {isMobile} = useWindowDimensions()
    const [lastEmitTime, setLastEmitTime] = useState(0);
    const [lastTypingTimeReceived, setLastTypingTimeReceived] = useState(0);
    const [newMessage, setNewMessage] = useState(defaultNewMessage || '');
    const [dateNow, setDateNow] = useState(Date.now());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const {wallet} = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
    const {data: messagesHistory} = useSWR<Message[]>(`/messages?chatId=${account}`, fetcherMessages);
    // const {data: names} = useSWR<Chat[]>(`/names?accounts=${account}`, fetcherMessages);
    const {chat, mutateChats} = useChats(account);
    const { mutate: mutateMessages} = useChat(account);

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
    const welcomeButtonClick = useEvent("open-input-plus");

    useEffect(() => {
      console.log("welcomeButtonClick", welcomeButtonClick)
      if (welcomeButtonClick) {
        setInputAdditionVisible(true);
      }
    }, [welcomeButtonClick]);
    
    useEffect(() => {
        if (messagesHistory) {
            // setMessages(messagesHistory);
        }
    }, [messagesHistory, messagesEndRef]);

    useEffect(() => {
        // socket.on('typing', (account: string) => {
        //     console.log('typing', account);
        //     // setTimeout(() => {
        //     //   window.scrollTo(0, document.body.scrollHeight);
        //     // }
        //     // , 10);
        // });
        socket.on('message', (message: Message) => {
          setLastTypingTimeReceived(0);
        });

      // return () => {
      //           socket.off('message');
      // };
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
        height: chat?.height + 1, // only used for the local mutate, it might be not always accurate
      };
      if (defaultNewMessage){
        message.nanoApp = new URL(defaultNewMessage).hostname; // for nano app sharing
      }
      onSent(message);
      mutateLocal(mutateMessages, mutateChats, message, account, activeAccount);
     const messageEncrypted = { ...message };
     if (chat === undefined || chat.type === "private") { // chat can be undefined when sending first message
      messageEncrypted['content'] = box.encrypt(newMessage, address, activeAccountPk);
      localStorage.setItem("message-" + messageEncrypted['content'], newMessage); // save decrypted message cache, encrypted content is the key, because we don't have yet the message id, eventually we could refact with a POST
      }
      else if (chat.type === "group") {
        let sharedAccount = chat.sharedAccount;
        if (sharedAccount == null){
          sharedAccount = await updateSharedKeys(chatId, chat.participants.map(participant => participant._id), activeAccountPk);
        }
        messageEncrypted['content'] = box.encrypt(newMessage, sharedAccount, activeAccountPk);
        localStorage.setItem("message-" + messageEncrypted['content'], newMessage);
      }
      else{
        console.error("Chat type not supported", chat.type);
        return;
      }

     socket.emit('message', messageEncrypted);
     setNewMessage('');
     if (!defaultNewMessage){ // defautlNewMessage is used to share from webiew popup, don't need to open keyboard by focus
         messageInputRef.current?.focus();
      }
     if (account !== chatId){
      // redirect to chat id when initial message
      mutateChats()
       navigate(`/chat/${chatId}`); 
     }

    };
    messageInputRef.send = sendMessage;

    const sendTipMessage = async (ticker: string, hash: string) => {
      let chatId = account;
      // let messageTip = 'Tip ' + ticker + ' ' + hash;
      const message: Message = {
        content: "tip",
        fromAccount: activeAccount,
        // toAccount: account,
        timestamp: new Date(),
        chatId: chatId,
        height: chat?.height + 1,
        tip: {ticker, hash}
      };
      onSent(message);
      mutateLocal(mutateMessages, mutateChats, message, account, activeAccount);
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
        height: chat?.height + 1,
        stickerId: stickerId
      };
      onSent(message);
      mutateLocal(mutateMessages, mutateChats, message, account, activeAccount);
     const messageEncrypted = { ...message };
     if (chat.type === "private") {
      messageEncrypted['content'] = box.encrypt(message.content, address, activeAccountPk);
     }
      else {
        messageEncrypted['content'] = message.content;
      }
     socket.emit('message', messageEncrypted);
    }
    const sendFileMessage = async (file) => {
      let chatId = account;
      // let messageTip = 'Tip ' + ticker + ' ' + hash;
      const message: Message = {
        content: "File",
        fromAccount: activeAccount,
        // toAccount: account,
        timestamp: new Date(),
        chatId: chatId,
        height: chat?.height + 1,
        file: {
          url: file.url,
          meta: {
            name: file.name,
            type: file.type,
            size: file.size,
          }
        }
      };
      onSent(message);
      mutateLocal(mutateMessages, mutateChats, message, account, activeAccount);
      socket.emit('message', message);
    }

    // const iconRisibank =  <img style={{filter: 'grayscale(0)', width: '36px'}} src="https://risibank.fr/favicon.svg" alt="Stickers" className="w-5 h-5" />
    // const iconRisibankGray =  <img style={{filter: 'grayscale(1)', width: '36px'}} src="https://risibank.fr/favicon.svg" alt="Stickers" className="w-5 h-5" />
    const iconRisibankGray =  <SmileOutline style={{width: 32, height: 32}} />
    const iconRisibank =  <SmileFill style={{width: 32, height: 32}} />


    // console.log("message input render")
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
          paddingBottom: 8,
          paddingTop: 4,
          backgroundColor: 'var(--adm-color-background)',
          display: defaultNewMessage ? 'none' : 'block', // hide input when sharing from webview
        }}
        onSubmit={sendMessage} className=" px-4">
       
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
            
            {/* <ChatInputTip toAddress={address} onTipSent={(ticker, hash) => {
              sendTipMessage(ticker, hash);
            }} /> */}
               <div 
        onClick={() => {
          if (!inputAdditionVisible && stickerVisible) {
            setStickerVisible(false);
          }
          setInputAdditionVisible(!inputAdditionVisible)
        }}
        >
          <AddCircleOutline 
          style={{width: 32, height: 32, cursor: 'pointer'}} className="hoverable" />
        </div>
          <div 
          style={{
            borderRadius: 6, width: '100%',
             borderColor: 'transparent',
             backgroundColor: 'var(--adm-color-border)',
            //  filter: 'brightness(0.9)'
          }}
          className="flex items-center gap-2 border border-solid input-message">
            <TextArea 
            enterKeyHint="send"
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
              className="m-2  "
              placeholder="Message"
              value={newMessage}
              onChange={(e) => setNewMessage(e)}
            />
            {/* <Button
              onClick={sendMessage}
              className="p-1 rounded-full bg-blue-500 text-white mr-1"
              disabled={!newMessage.trim()}
              style={ !newMessage.trim() ? {display: 'none'} : {}}
            >
              <FaArrowUp className="w-5 h-5" />
            </Button> */}
          </div>
          <div
          style={{}}
          onClick={() => {
            if (!stickerVisible && inputAdditionVisible) {
              setInputAdditionVisible(false);
            }
            if (stickerVisible){
              setStickerVisible(false);
              messageInputRef.current?.focus();
            }
            else {
              setStickerVisible(true);
              messageInputRef.current?.blur();
            }
          }}
          className="hoverable"
          >
          {
            stickerVisible ? 
              (isMobile ? <FaKeyboard className="w-5 h-5" /> : iconRisibank)
            :
            iconRisibankGray
        }
        </div>
     
          </div>
          {
            stickerVisible && <ChatInputStickers onStickerSelect={(stickerId) => {
              sendStickerMessage(stickerId);
            }} />
          }
          
        <ChatInputAdd 
        visible={inputAdditionVisible}
        toAddress={
          chat?.type === "private" ?
          address :
          chat?.type === "group" ?
          chat?.sharedAccount :
          undefined 
        }
        onUploadSuccess={(file) => {
          sendFileMessage(file);
        }}
        onTipSent={(ticker, hash) => {
          sendTipMessage(ticker, hash);
        }} />

          

        </div>
    );
  };

export default ChatInputMessage;