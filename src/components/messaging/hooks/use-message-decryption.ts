import { box } from 'multi-nano-web';
import { useContext, useEffect, useState } from 'react';
import { WalletContext } from '../../Popup';
import { fetcherChat } from '../fetcher';
import { decryptGroupMessage } from '../../../services/sharedkey';

const useMessageDecryption = ({ message }) => {
  const { wallet, dispatch } = useContext(WalletContext);
  const [decryptedContent, setDecryptedContent] = useState(() => {
    // Immediate synchronous checks for cached content
    if (message.isLocal) {
      return message.content;
    }

    if (wallet.messages[message._id]) {
      return wallet.messages[message._id];
    }

    const localStorageKey = `message-${message._id}`;
    const cachedContent = localStorage.getItem(localStorageKey);
    if (cachedContent) {
      return cachedContent;
    }

    if (localStorage.getItem(message.content)) {
      return localStorage.getItem(message.content);
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
  const targetAccount = message.fromAccount === activeAccount ? toAccount : message.fromAccount;

  useEffect(() => {
    // Only proceed with decryption if we don't have cached content
    if (decryptedContent !== null) {
      return;
    }

    const decryptMessage = async () => {
      try {
        let decrypted;
        
        if (isGroupMessage) {
          decrypted = await decryptGroupMessage(message.content, message.chatId, message.toAccount, message.fromAccount, activeAccountPk);
        } else {
          decrypted = box.decrypt(message.content, targetAccount, activeAccountPk);
        }

        // Store decrypted content
        localStorage.setItem(`message-${message._id}`, decrypted);
        dispatch({
          type: 'ADD_MESSAGE',
          payload: { _id: messageId, content: decrypted }
        });
        setDecryptedContent(decrypted);
      } catch (error) {
        console.error('Message decryption failed:', error);
        setDecryptedContent("Encrypted message");
      }
    };

    decryptMessage();
  }, [message, activeAccount, activeAccountPk, targetAccount, messageId, decryptedContent]);

  return decryptedContent;
};

export default useMessageDecryption;