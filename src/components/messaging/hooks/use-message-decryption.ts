import { box } from 'multi-nano-web';
import { useContext, useEffect, useState } from 'react';
import { WalletContext } from '../../Popup';
import { fetcherChat } from '../fetcher';
import { decryptGroupMessage, getSharedKey } from '../../../services/sharedkey';
import { isSpecialMessage } from '../utils';

const useMessageDecryption = ({ message }) => {
  const { wallet } = useContext(WalletContext);
  const [decryptedContent, setDecryptedContent] = useState(() => {
    if (message.isLocal && message.redPacket?.message) {
      console.log("local redpacket message", message)
      return message.redPacket?.message;
    }
    // Immediate synchronous checks for cached content
    if (message.isLocal) {
      // console.log("local message", message)
      return message.content;
    }

    if (message.height == -1){
      return ''; // chat created but no messages yet
    }
    if (message.content == "welcome_message") {
      return "Welcome to NanChat!";
    }
    if (wallet.messages[message._id]) {
      return wallet.messages[message._id];
    }

    if (isSpecialMessage(message)) { 
      return message.content;
    }
    const localStorageKey = `message-${message._id}`;
    const cachedContent = localStorage.getItem(localStorageKey);
    if (cachedContent) {
      return cachedContent;
    }

    if (localStorage.getItem("message-" + message.content)) {
      return localStorage.getItem("message-" + message.content)?.replace('message-', '');
    }

    return null;
  });
  
  const activeAccount = wallet.accounts.find(
    (account) => account.accountIndex === wallet.activeIndex
  )?.address;
  const activeAccountPk = wallet.accounts.find(
    (account) => account.accountIndex === wallet.activeIndex
  )?.privateKey;
  const toAccount = message.toAccount;
  const messageId = message.isLocal ? Math.random().toString() : message._id;
  
  const isGroupMessage = message?.type === 'group';
  let targetAccount = message.fromAccount === activeAccount ? toAccount : message.fromAccount;
  if (isGroupMessage) {
    targetAccount = message.fromAccount;
  }
  useEffect(() => {
    // Only proceed with decryption if we don't have cached content
    if (decryptedContent !== null) {
      return;
    }

    const decryptMessage = async () => {
      try {
        let decryptionKey = activeAccountPk;
        if (isGroupMessage) {
          decryptionKey = await getSharedKey(message.chatId, message.toAccount, activeAccountPk);
        }
        if (decryptionKey == null) { // could happen if clicking on the notification New message, when loading directly the chat and wallet not ready yet
          console.error('Decryption key not yet ready');
          return
        }
        let decrypted = box.decrypt(message.content, targetAccount, decryptionKey);
        // message decryption could be done in a worker but need to make sure typing is only hiden after message is shown
        // but message decryption should be already fast enough

        // Store decrypted content
        localStorage.setItem(`message-${message._id}`, decrypted);
        // dispatch({
        //   type: 'ADD_MESSAGE',
        //   payload: { _id: messageId, content: decrypted }
        // });
        setDecryptedContent(decrypted);
        
      } catch (error) {
        console.error('Message decryption failed:', error, message);
        // setDecryptedContent(message.content);
        setDecryptedContent(false);
      }
    };

    decryptMessage();
  }, [activeAccountPk]);

  return decryptedContent;
};

export default useMessageDecryption;