import { box } from 'multi-nano-web';
import { useContext, useEffect, useState } from 'react';
import { WalletContext } from '../../Popup';

const useMessageDecryption = ({
  message,
}) => {
  const { wallet, dispatch } = useContext(WalletContext);
  const activeAccount = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address
  const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
  const toAccount = message.toAccount;
  const messageId = message.isLocal ? Math.random().toString() : message._id;
  // const [decrypted, setDecrypted] = useState(null);
 // Decrypt message

//  useEffect(() => {

//   let decrypted = null;
//   if (message.isLocal) {
//     decrypted = message.content;
//   } else if (wallet.messages[message._id]) {
//     return
//   } else if (localStorage.getItem(`message-${message._id}`)) {
//     decrypted = localStorage.getItem(`message-${message._id}`);
//   } else if (localStorage.getItem(message.content)) {
//     decrypted = localStorage.getItem(message.content);
//   } else {
//     try {
//       decrypted = box.decrypt(
//         message.content,
//         message.fromAccount === activeAccount ? toAccount : message.fromAccount,
//         activeAccountPk
//       );
//     } catch (error) {
//       console.error('Message decryption failed:', error);
//       decrypted = message.content;
//     }
//   }

//   dispatch({
//     type: 'ADD_MESSAGE',
//     payload: { _id: messageId, content: decrypted }
//   });
// }
// , []);

 if (message.isLocal) {
  return message.content;
}
 const targetAccount = message.fromAccount === activeAccount 
 ? toAccount 
 : message.fromAccount;

 if (wallet.messages[message._id]) {
  console.log('Message form cache memory');
  return wallet.messages[message._id];
}
if (localStorage.getItem(`message-${message._id}`)) {
  console.log('Message form local storage');
  return localStorage.getItem(`message-${message._id}`);
}
if (localStorage.getItem(message.content)) {
  console.log('Message form local storage');
  return localStorage.getItem(message.content);
}
 try {
    console.log('Decrypting message:', message);  
   const decrypted = box.decrypt(
     message.content,
     targetAccount,
     activeAccountPk
    );
    localStorage.setItem(`message-${message._id}`, decrypted);
    return decrypted;
  } catch (error) {
    console.error('Message decryption failed:', error);
    return message.content;
  } 

};

export default useMessageDecryption;
