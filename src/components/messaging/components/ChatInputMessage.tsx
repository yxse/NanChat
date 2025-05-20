import { AddCircleOutline } from "antd-mobile-icons";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { socket } from "../socket";
import { useWallet } from "../../Popup";
import { Button, TextArea, Toast } from "antd-mobile";
import useSWR, { useSWRConfig } from "swr";
import { fetcherMessages, fetcherMessagesPost } from "../fetcher";
import { box } from "multi-nano-web";
import { FaArrowUp, FaKeyboard } from "react-icons/fa6";
import { getKey, useChat } from "../hooks/useChat";
import EmitTyping from "./EmitTyping";
import ChatInputStickers from "./ChatInputStickers";
import { useWindowDimensions } from "../../../hooks/use-windows-dimensions";
import ChatInputAdd from "./ChatInputAdd";
import { useEmit, useEvent } from "./EventContext";
import { useChats } from "../hooks/use-chats";
import { PiStickerFill, PiStickerLight } from "react-icons/pi";
import MessageReply from "./MessageReply";
import { unstable_serialize } from 'swr/infinite';
import { Capacitor } from "@capacitor/core";
import useLocalStorageState from "use-local-storage-state";


const mutateLocal = async (mutate, mutateChats, message, account, activeAccount) => {
  const id = message._id;
  await mutate(currentPages => {
      const newPages = [...(currentPages || [])];
      newPages[0] = [{ ...message, isLocal: true, _id: id, status: "sent_local"}, ...(newPages[0] || [])];
      return newPages;
  }, false);




  await mutateChats(currentChats => { // local mutate to update last message in chat list without refetching
      const newChats = [...(currentChats || [])];
      const chatIndex = newChats.findIndex(chat => chat.id === account);
      if (chatIndex !== -1) {
          const newChat = { ...newChats[chatIndex] };
          newChat.lastMessage = message.content;
          newChat.lastMessageTimestamp = new Date().toISOString();
          newChat.lastMessageId = id;
          newChat.isLocal = true;
          newChat.lastMessageFrom = activeAccount;
          newChat.height = message.height
          newChats.splice(chatIndex, 1);
          newChats.unshift(newChat);
      }
      return newChats;
  }, false);
}

const ChatInputMessage: React.FC<{ }> = ({ onSent, messageInputRef, defaultNewMessage, defaultChatId = undefined, hideInput = false }) => {
    let {
        account
    } = useParams();
    if (defaultChatId !== undefined) {
      account = defaultChatId;
    }
    const [stickerVisible, setStickerVisible] = useState(false);
    const [enterToSend, setEnterToSend] = useLocalStorageState("enterToSend", { defaultValue: false })
    const [inputAdditionVisible, setInputAdditionVisible] = useState(false);
    const {isMobile} = useWindowDimensions()
    const [newMessage, setNewMessage] = useState(defaultNewMessage || '');
    const navigate = useNavigate();
    const {activeAccount, activeAccountPk} = useWallet()
    const {data: messagesHistory} = useSWR<Message[]>(`/messages?chatId=${account}&limit=1`, fetcherMessages);
    const {chat, mutateChats} = useChats(account);
    const { mutate: mutateMessages} = useChat(account);
    const [replyMessage, setReplyMessage] = useState<Message | null>(null);
    const replyEvent = useEvent("reply-message");
    const {mutate: mutateInifinite} = useSWRConfig();
    const emit = useEmit()
    const names = chat?.participants;
    let address = names?.find(participant => participant._id !== activeAccount)?._id;
    if (account?.startsWith('nano_')) {
        address = account;
    }
    if (chat?.participants && chat?.participants[0]?._id === chat?.participants[1]?._id) { // chat with self
        address = chat?.participants[0]?._id;
    }
    const welcomeButtonClick = useEvent("open-input-plus");

    useEffect(() => {
      console.log("welcomeButtonClick", welcomeButtonClick)
      if (welcomeButtonClick) {
        setInputAdditionVisible(true);
      }
    }, [welcomeButtonClick]);

    const resetReply = () => {
      setReplyMessage(null);
      emit("reply-message", null);
    }
    useEffect(() => {

      if (! (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android')) {
        messageInputRef.current?.focus();
      }

      console.log("replyEvent", replyEvent)
      if (replyEvent) {
        setReplyMessage(replyEvent?.message);
        messageInputRef.current?.focus();
      }

      // clear reply message when changing chat

      if (replyEvent?.message?.chatId !== account) {
        setReplyMessage(null);
      }
    }
    , [replyEvent, account]);
    

  const callbackSocket = (response: any, message) => {
      console.log("message sent", response, {"local Id": message._id}, message);
      if (response.success !== true) {
        messageInputRef.current?.focus();
        setNewMessage(newMessage);
        Toast.show({
          content: response.error,
          icon: 'fail', 
        });
      }
      else{
        mutateMessages(currentPages => {
          const newPages = [...(currentPages || [])];
          // remove local message with id
          const messageIndex = newPages[0].findIndex(m => m._id === message._id);
          if (messageIndex !== -1) {
              newPages[0].splice(messageIndex, 1);
          }
          newPages[0] = [{ ...message, status: "sent", _id: response.messageId, isLocal: true}, ...(newPages[0] || [])];
          console.log(newPages)
          return newPages;
      }, false);

        return
      }
   }
    // useEffect(scrollToBottom, [messages]);
    const sendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      let chatId = account;
      // debugger
      let height = chat?.height + 1 // only used for the local mutate, it might be not always accurate
      if (!newMessage.trim()) return;
      if (messagesHistory?.length === 0 && account.startsWith('nano_')) {
        let r = await fetcherMessagesPost('/chat', {
          type: "private",
          participants: [activeAccount, account],
        })
        console.log("created chat", r);
        await mutateChats( currentChats => {
          const newChats = [...(currentChats || [])];
          newChats.unshift(r);
          return newChats;
        }, false);
        chatId = r.id;
        height = 0;
      }
      const message: Message = {
        content: newMessage,
        fromAccount: activeAccount,
        // toAccount: account,
        timestamp: new Date(),
        chatId: chatId,
        height: height,
        _id: Math.random().toString(), // only local id
      };
      if (defaultNewMessage){
        message.nanoApp = new URL(defaultNewMessage).hostname; // for nano app sharing
      }
      if (replyMessage) {
        message.replyMessage = replyMessage;
        resetReply();
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
        messageEncrypted['content'] = box.encrypt(newMessage, sharedAccount, activeAccountPk);
        messageEncrypted['toAccount'] = sharedAccount;
        localStorage.setItem("message-" + messageEncrypted['content'], newMessage);
      }
      else{
        console.error("Chat type not supported", chat.type);
        return;
      }
      if (replyMessage) {
        messageEncrypted['replyMessage'] = {_id: replyMessage._id}; 
      }
     socket.emit('message', messageEncrypted, (response) => callbackSocket(response, message));
     setNewMessage('');
     if (!defaultNewMessage){ // defautlNewMessage is used to share from webiew popup, don't need to open keyboard by focus
         messageInputRef.current?.focus();
      }
     if (account !== chatId){
      // redirect to chat id when initial message
      // mutateChats()
       navigate(`/chat/${chatId}`); 
     }

    };
    messageInputRef.send = sendMessage;

    const sendTipMessage = async (ticker: string, hash: string, destinationAddress: string) => {
      let chatId = account;
      // let messageTip = 'Tip ' + ticker + ' ' + hash;
      const message: Message = {
        content: "tip",
        fromAccount: activeAccount,
        // toAccount: account,
        timestamp: new Date(),
        chatId: chatId,
        height: chat?.height + 1,
        tip: {ticker, hash, toAccount: destinationAddress},
        _id: Math.random().toString()
      };
      if (replyMessage) {
        message.replyMessage = replyMessage;
        resetReply();
      }
      onSent(message);
      mutateLocal(mutateMessages, mutateChats, message, account, activeAccount);
     const messageEncrypted = { ...message };
     messageEncrypted['content'] = box.encrypt(message.content, address, activeAccountPk);
     socket.emit('message', messageEncrypted,  (response) => callbackSocket(response, message));
     messageInputRef.current?.focus();
    };
    messageInputRef.sendTip = sendTipMessage;

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
        stickerId: stickerId,
        _id: Math.random().toString()
      };
      if (replyMessage) {
        message.replyMessage = replyMessage;
        resetReply();
      }
      onSent(message);
      mutateLocal(mutateMessages, mutateChats, message, account, activeAccount);
     const messageEncrypted = { ...message };
     if (chat.type === "private") {
      messageEncrypted['content'] = box.encrypt(message.content, address, activeAccountPk);
     }
      else {
        messageEncrypted['content'] = message.content;
      }
     socket.emit('message', messageEncrypted,  (response) => callbackSocket(response, message));
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
        _id: Math.random().toString(),
        file: {
          url: file.url,
          meta: {
            name: file.name,
            type: file.type,
            size: file.size,
          }
        }
      };
      if (chat?.type === "group") {
        message.toAccount = chat.sharedAccount;
      }
      if (replyMessage) {
        message.replyMessage = replyMessage;
        resetReply();
      }
      onSent(message);
      mutateLocal(mutateMessages, mutateChats, message, account, activeAccount);
      socket.emit('message', message, (response) => callbackSocket(response, message));
    }

    const iconRisibankGray =  <PiStickerLight style={{width: 32, height: 32}} className="hoverable"  />
    const iconRisibank =  <PiStickerFill style={{width: 32, height: 32}} className="hoverable" />


    const StickerButton = () => <div
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
          style={{}}
          >
          {
            stickerVisible ? 
              (isMobile ? <FaKeyboard className="w-5 h-5" 
                 /> : iconRisibank)
            :
            iconRisibankGray
        }
        </div>
    // console.log("message input render")
    return (
        <div 
        style={{
          borderTop: '1px solid var(--adm-color-border)',
           width: '100%',
          paddingBottom: 8,
          paddingTop: 4,
          backgroundColor: 'var(--adm-color-background)',
          display: hideInput ? 'none' : 'block', // hide input when sharing from webview and for tranfer from account info
        }}
        onSubmit={sendMessage} className=" px-4">
          {replyMessage && <MessageReply message={replyMessage} onClose={() => {
            messageInputRef.current?.focus();
            setReplyMessage(null)
          }} />}
            <EmitTyping 
            account={account}
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
              <StickerButton />
          <div 
          style={{
            borderRadius: 6, width: '100%',
             borderColor: 'transparent',
             backgroundColor: 'var(--adm-color-border)',
            //  filter: 'brightness(0.9)'
          }}
          className="flex items-center gap-2 border border-solid input-message">
            <TextArea 
            enterKeyHint={enterToSend ? "send" : "enter"}
            onFocus={() => {
              if (isMobile){
                setStickerVisible(false) // close sticker when keyboard open on mobile
                setInputAdditionVisible(false);
              }
            }}
            onKeyDown={(e) => {
              
              if (
                !e.ctrlKey && e.key === 'Enter' && e.shiftKey && Capacitor.getPlatform() === 'web') {
                return;  // On web/desktop, allow new line on shift + enter 
              }
              else if (e.key === 'Enter' && (enterToSend || e.ctrlKey)) { // on desktop, still send message if enterToSend is disabled but ctrl is pressed
                e.preventDefault();
                sendMessage(e);
              }
            }}
            ref={messageInputRef}
              autoSize={{ minRows: 1, maxRows:5 }}
              rows={1}
              // style={{focus}}
              className="m-2  "
              placeholder="Message"
              value={newMessage}
              onChange={(e) => setNewMessage(e)}
            />
          
          </div>    
          {
            (enterToSend || !newMessage.trim()) && 
          <div 
        onClick={() => {
          if (!inputAdditionVisible && stickerVisible) {
            setStickerVisible(false);
          }
          setInputAdditionVisible(!inputAdditionVisible)
        }}
        >
          <AddCircleOutline 
          style={ {width: 32, height: 32, cursor: 'pointer'}}
          className="hoverable" />
        </div> }
        {
          (!enterToSend && newMessage.trim()) &&
       <Button
            shape="rounded"
            // size="small"
            color="primary"
              onClick={sendMessage}
              // className="rounded-full"
              style={{height: 32, width: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}
            >
                            <FaArrowUp className="w-5 h-5" />
            </Button>
        }
          </div>
          
          {
            stickerVisible && <ChatInputStickers // showing stickers list
            onStickerSelect={(stickerId) => {
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
        chat={chat}
        onUploadSuccess={(file) => {
          sendFileMessage(file);
        }}
        onTipSent={(ticker, hash, destinationAddress) => {
          sendTipMessage(ticker, hash, destinationAddress);
        }} />

          

        </div>
    );
  };

export default ChatInputMessage;