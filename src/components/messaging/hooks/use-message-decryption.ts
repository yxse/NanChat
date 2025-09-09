import { box } from 'multi-nano-web';
import { useContext, useEffect, useMemo, useState } from 'react';
import { WalletContext } from '../../Popup';
import { fetcherChat } from '../fetcher';
import { decryptGroupMessage, getSharedKey } from '../../../services/sharedkey';
import { isSpecialMessage } from '../utils';
import { restoreDataString, setData, setDataString } from '../../../services/database.service';

export const decryptChatMessage = async (message, activeAccount, activeAccountPk) => {
   if (isSpecialMessage(message) && !message.redPacket) { 
      return {decrypted: message.content}
    }
  const toAccount = message.toAccount;
  let targetAccount = message.fromAccount === activeAccount ? toAccount : message.fromAccount;
  const isGroupMessage = message?.type === 'group';
  if (isGroupMessage) {
    targetAccount = message.fromAccount;
  }
      try {
        let decryptionKey = activeAccountPk;
        if (isGroupMessage) {
          decryptionKey = await getSharedKey(message.chatId, message.toAccount, activeAccountPk);
        }
        if (decryptionKey == null) { // could happen if clicking on the notification New message, when loading directly the chat and wallet not ready yet
          console.error('Decryption key not yet ready');
          return
        }
        console.log("decrypt message", message._id)
        if (message.redPacket){
                return {
                decrypted: message.content,
                decryptedRedPacket: box.decrypt(message.redPacket.message, targetAccount, decryptionKey),
              }
        }
        let decrypted = box.decrypt(message.content, targetAccount, decryptionKey);
        let decryptedRedPacket, decryptedReply
        
        if (message.replyMessage){
            decryptedReply = (await decryptChatMessage(message.replyMessage, activeAccount, activeAccountPk)).decrypted
        }
        return {
          decrypted: decrypted,
          decryptedRedPacket: decryptedRedPacket,
          decryptedReply: decryptedReply
        }
        setDataString(`message-${message._id}`, decrypted)
      } catch (error) {
        console.error('Message decryption failed:', error, message);
        return false
      }
  };

const useMessageDecryption = ({ message }) => {
  const { wallet } = useContext(WalletContext);
  const localStorageKey = `message-${message._id}`;

  const [decryptedContent, setDecryptedContent] = useState(() => {
    if (message.decrypted) return message.decrypted
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
    return null;
  });
    // Start cache retrieval immediately
  const cachePromise = useMemo(() => {
    if (decryptedContent !== null) {
      return Promise.resolve(decryptedContent);
    }
    return restoreDataString(localStorageKey);
  }, [localStorageKey, decryptedContent]);

  const activeAccount = wallet.accounts.find(
    (account) => account.accountIndex === wallet.activeIndex
  )?.address;
  const activeAccountPk = wallet.accounts.find(
    (account) => account.accountIndex === wallet.activeIndex
  )?.privateKey;
  const toAccount = message.toAccount;
  
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
        const cache = await cachePromise;
        if (cache) {
          setDecryptedContent(cache);
          return;
        }
        let decryptionKey = activeAccountPk;
        if (isGroupMessage) {
          decryptionKey = await getSharedKey(message.chatId, message.toAccount, activeAccountPk);
        }
        if (decryptionKey == null) { // could happen if clicking on the notification New message, when loading directly the chat and wallet not ready yet
          console.error('Decryption key not yet ready');
          return
        }
        console.log("useeffect decrypted message", message.id)
        let decrypted = box.decrypt(message.content, targetAccount, decryptionKey);
        setDecryptedContent(decrypted);
        setDataString(`message-${message._id}`, decrypted)
      } catch (error) {
        console.error('Message decryption failed:', error, message);
        // setDecryptedContent(message.content);
        setDecryptedContent(false);
      }
    };

    decryptMessage();
  }, [cachePromise, activeAccountPk]);

  return decryptedContent;
};

export default useMessageDecryption;