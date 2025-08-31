import { tools } from "multi-nano-web";
import { getChatToken, setChatToken } from "../../utils/storage";
import { accountIconUrl } from "../app/Home";
import { signMessage } from "../../api-invoke/Sign";
import { Toast } from "antd-mobile";
import { inMemoryMap } from "../../services/database.service";
import { saveCache } from "../Wrapper";


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
        else if (data.error && !data.error == 'Invalid signature'){ // invalid signature can happen when switching accounts
            Toast.show({content: data.error, icon: 'fail'})
        }
        
        return null;
    });
}

export const fetcherChat = (url) => fetch(import.meta.env.VITE_PUBLIC_BACKEND + url).then((res) => res.json());
export const fetcherMessagesNoAuth = (url) => fetch(import.meta.env.VITE_PUBLIC_BACKEND + url).then((res) => res.json());
export const fetcherChats = async (oldChats, activeAccount, activeAccountPk, cache) => {
    const lastSync = localStorage.getItem('lastSync');
    if (lastSync){
        return fetcherMessages('/chats?ts=' + lastSync, activeAccountPk).then((res) => {
            if (res.error == null){
                // console.log(cache)
                
                // merge chats, the res.chat overwrite the old chats
                let uniqueChats = [];
                let chatIds = new Set();
                res.chats.forEach((chat) => {
                    if (!chatIds.has(chat.id)){
                        chatIds.add(chat.id);
                        uniqueChats.push(chat);
                    }
                });
                // merge with old chats
                oldChats.forEach((chat) => {
                    if (!chatIds.has(chat.id)){
                        uniqueChats.push(chat);
                    }
                });
                // saveCache(cache) // triggfer swr save cache to localstorage to ensure consistency in case savecache no trigger 
                // setTimeout(() => {
                //     // localStorage.setItem('lastSync', res.ts); // prevent bug race condition loading chats on start causing missing updates
                // }, 1000); // to not slow down fetcherchats
                // setTimeout(() => {
                // }, 5000);
                // console.log(uniqueChats[0])
                return uniqueChats;
            }
        })
    }
    else{
        return fetcherMessages('/chats', activeAccountPk).then((res) => {
            if (res.error == null){
                // setTimeout(() => {
                //     saveCache(cache) // triggfer swr save cache to localstorage to ensure consistency in case savecache no trigger 
                //     localStorage.setItem('lastSync', res.ts);
                // }, 1000); // to not slow down fetcherchats
                return res.chats;
            }
        })
    }
}
export const fetcherMessages = (url, activeAccountPk) => getChatToken(activeAccountPk).then(async (token) => {
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

const cacheAllMessagesChat = async (chatId, height) => {
    
    for (let i = 0; i < height; i++){
        let cacheKey = `chat_${chatId}_msg_${i}`;
        let cachedData = localStorage.getItem(cacheKey);
        if (cachedData){
            inMemoryMap.set(cacheKey, JSON.parse(cachedData));
        }
    }

}

export const fetcherMessagesCache = (url) => getChatToken().then(async (token) => {
    console.time('cache')

    console.log("fetch message cache", url)
    // Parse params from the URL
    const urlParams = new URLSearchParams(url.split('?')[1]);
    const requestedHeight = parseInt(urlParams.get('cursor') || '0');
    const requestedLimit = parseInt(urlParams.get('limit') || '20');
    const chatId = urlParams.get('chatId');
    // Generate cache key prefix for this chat
    const cacheKeyPrefix = `chat_${chatId}_msg_`;
  //   const maxHeightKey = `chat_${chatId}_maxHeight`;
  
      // Get the cached messages
      let cachedMessages = [];
      let cachedMaxHeight = 0;
    //   debugger
    
      for (let i = requestedHeight; (i > requestedHeight - requestedLimit) && i >= 0; i--){
          let cacheKey = cacheKeyPrefix + i;
          let cachedData
          if (inMemoryMap.has(cacheKey)){
                cachedData = inMemoryMap.get(cacheKey);
                if (cachedData){
                    cachedMessages = cachedMessages.concat(cachedData);
                }
            }
            else{
                cachedData = localStorage.getItem(cacheKey);
                if (cachedData){
                  let parsed = JSON.parse(cachedData);
                    cachedMessages = cachedMessages.concat(parsed);
                    inMemoryMap.set(cacheKey, parsed);
                }
            }
      }
      // if all messages are cached, return them
    //   debugger
      if (cachedMessages.length == requestedLimit 
        || (cachedMessages.length > 0 && cachedMessages.length == requestedHeight+1)  // for the first page
    ){
        console.timeEnd('cache')
          return cachedMessages;
      }
      // else fetch the missing messages
      return await fetch(import.meta.env.VITE_PUBLIC_BACKEND + url, {
          headers: {
              'Content-Type': 'application/json',
              'token': token
          }
      })
      .then(async (res) => {
          if (res.ok){
                // Cache the messages
                let messages = await res.json();
                if (messages.error) return messages
                messages.forEach((msg) => {
                    let cacheKey = cacheKeyPrefix + msg.height;
                    localStorage.setItem(cacheKey, JSON.stringify(msg));
                    // console.log('cached', cacheKey)
                });
              return messages
          }
          else {
              return Promise.reject(res.status)
          }
      })
  })
export const addParticipants = (chatId, participants) => fetcherMessagesPost('/add-participants', {chatId, participants})
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
export const fetcherMessagesPost = (url, data, activeAccountPk) => getChatToken(activeAccountPk).then(async (token) => {
    return fetch(import.meta.env.VITE_PUBLIC_BACKEND + url, {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'token': token
     },
    body: JSON.stringify(data)
})}).then((res) => res.json());