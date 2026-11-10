import { tools } from "multi-nano-web";
import { getChatToken, setChatToken } from "../../utils/storage";
import { accountIconUrl } from "../app/Home";
import { Toast } from "antd-mobile";
import { scheduleMessageSync } from "./message-cache";


export const signMessage = (privateKey, message) => {
  let messageToSign = "Signed Message: " + message // Add prefix to message as a security measure to prevent to sign a block by mistake / from an attacker request
  const signed = tools.sign(privateKey, messageToSign)
  return signed
}

export const getNewChatToken = async (account, privateKey) => {
    if (!account){
        console.log("Cannot get token: no account provided")
        return null
    }
    if (!privateKey){
        console.log("Cannot get token: no private key provided")
        return null
    }
    const message = "Login to nanwallet.com chat. Date:" + new Date().toISOString();
    const signature = signMessage(privateKey, message);
    // debugger
    return fetch(import.meta.env.VITE_PUBLIC_BACKEND + '/token', {
        headers: {
            'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({ account, message, signature })
    }).then((res) => res.json()).then(async (data) => {
        if (data.token){
            await setChatToken(account, data.token, data.expiresAt);
            return data.token;
        }
        else if (data.error && data.error != 'Invalid signature'){ // invalid signature can happen when switching accounts
            if (window.location.pathname != '/me/settings' && window.location.pathname != '/settings/change-secret-phrase'){
                 // to prevent multiple toasts 
            Toast.show({content: data.error, icon: 'fail'})
            }
        }
        
        return null;
    });
}

export const fetcherChat = (url) => fetch(import.meta.env.VITE_PUBLIC_BACKEND + url).then((res) => res.json());
export const fetcherMessagesNoAuth = (url) => fetch(import.meta.env.VITE_PUBLIC_BACKEND + url).then((res) => res.json());
export const fetcherChats = async (oldChats, activeAccount, activeAccountPk, cache) => {
    // lastSyncChat is saved together with the persisted chats (see saveChatsLastSync in Popup.tsx),
    // so only the chats updated since then are fetched and merged into the cached list
    const lastSync = localStorage.getItem('lastSyncChat-' + activeAccount)
    let chats
    if (lastSync){
        const res = await fetcherMessages('/chats?ts=' + lastSync, activeAccountPk)
        // merge chats, the updated chats overwrite the old ones
        const chatIds = new Set();
        chats = [];
        for (const chat of [...res.chats, ...(oldChats || [])]) {
            if (!chatIds.has(chat.id)){
                chatIds.add(chat.id);
                chats.push(chat);
            }
        }
    }
    else{
        const res = await fetcherMessages('/chats', activeAccountPk)
        chats = res.chats
    }
    // download the new messages of every chat in the background, so they open instantly (and offline)
    scheduleMessageSync(chats, activeAccount, activeAccountPk)
    return chats
}
export const fetcherMessages = (url, activeAccountPk?) => getChatToken(activeAccountPk).then(async (token) => {
    if (token == null){
        throw new Error('Chat token not available')
    }
    return fetch(import.meta.env.VITE_PUBLIC_BACKEND + url, {
        headers: {
            'Content-Type': 'application/json',
            'token': token
        }
    })
    .then((res) => res.json()).then((data) => {
        if (data?.error) throw new Error(data.error)
        return data
    }).catch(async (err) => {
        if (
            err.message == 'Invalid token.' ||
            err.message == 'Token expired.' ){
            // Token invalid, fetch a new one and retry once
            console.log("Token invalid, fetching a new one")
            const newToken = await getChatToken(activeAccountPk, true);
            if (newToken == null) {
                throw new Error('Chat token not available');
            }
            const res = await fetch(import.meta.env.VITE_PUBLIC_BACKEND + url, {
                headers: {
                    'Content-Type': 'application/json',
                    'token': newToken
                }
            });
            const data_1 = await res.json();
            if (data_1.error) throw new Error(data_1.error);
            return data_1;
        }
        console.log("error fetch messages", err)
        throw err
    })
})

export const addParticipants = (chatId, participants, notification = true) => fetcherMessagesPost('/add-participants', {chatId, participants, notification})
export const removeParticipants = (chatId, participants) => fetcherMessagesPost('/remove-participants', {chatId, participants})
export const joinRequest = (chatId) => fetcherMessagesPost('/join-request', {chatId})
export const acceptJoinRequest = (chatId, fromAccount) => fetcherMessagesPost('/join-request-accept', {chatId, fromAccount})
export const muteChat = (chatId) => fetcherMessagesPost('/mute', {chatId})
export const unmuteChat = (chatId) => fetcherMessagesPost('/unmute', {chatId})
export const rejectJoinRequest = (chatId, fromAccount) => fetcherMessagesPost('/join-request-reject', {chatId, fromAccount})
export const deleteMessage = (chatId, height) => fetcherMessagesPost('/delete-message', {chatId, height})
export const deleteAccount = () => fetcherMessagesPost('/delete-account', {})
export const setMinReceive = (minReceive) => fetcherMessagesPost('/min-receive', {minReceive})
export const fetcherAccount = (account) => fetch(import.meta.env.VITE_PUBLIC_BACKEND + '/account?account=nano_' + account?.split('_')[1])
.then((res) => res.json()).then((data) => {
    return data
})

export const openRedPacket = ({id}) => fetcherMessagesPost('/redpacket/open', {id})
export const fetcherMessagesPost = (url, data, activeAccountPk?) => getChatToken(activeAccountPk).then(async (token) => {
    return fetch(import.meta.env.VITE_PUBLIC_BACKEND + url, {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'token': token
     },
    body: JSON.stringify(data)
})}).then((res) => res.json());