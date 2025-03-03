import { box } from 'multi-nano-web';
import { useContext, useEffect, useState } from 'react';
import { WalletContext } from '../../Popup';
import { fetcherChat } from '../fetcher';
import { decryptGroupMessage, getSharedKey } from '../../../services/sharedkey';
import { isSpecialMessage } from '../utils';

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
        let decrypted = box.decrypt(message.content, targetAccount, decryptionKey);
        // message decryption could be done in a worker but need to make sure typing is only hiden after message is shown
        // but message decryption should be already fast enough

        // Store decrypted content
        localStorage.setItem(`message-${message._id}`, decrypted);
        dispatch({
          type: 'ADD_MESSAGE',
          payload: { _id: messageId, content: decrypted }
        });
        setDecryptedContent(decrypted);
        
      } catch (error) {
        console.error('Message decryption failed:', error);
        setDecryptedContent(message.content);
      }
    };

    decryptMessage();
  }, []);

  return decryptedContent;
};

export default useMessageDecryption;