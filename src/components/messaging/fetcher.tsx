import { tools } from "multi-nano-web";
import { getChatToken, setChatToken } from "../../utils/storage";
import { accountIconUrl } from "../app/Home";
import { signMessage } from "../../api-invoke/Sign";
import { Toast } from "antd-mobile";


export const getNewChatToken = async (account, privateKey) => {
    const message = "Login to nanwallet.com chat. Date:" + new Date().toISOString();
    const signature = signMessage(privateKey, message);

    return fetch(import.meta.env.VITE_PUBLIC_BACKEND + '/token', {
        headers: {
            'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({ account, message, signature })
    }).then((res) => res.json()).then(async (data) => {
        if (data.token){
            await setChatToken(account, data.token);
            return data.token;
        }
        else if (data.error){
            Toast.show({content: data.error, icon: 'fail'})
        }
        
        return null;
    });
}

export const fetcherChat = (url) => fetch(import.meta.env.VITE_PUBLIC_BACKEND + url).then((res) => res.json());
export const fetcherMessagesNoAuth = (url) => fetch(import.meta.env.VITE_PUBLIC_BACKEND + url).then((res) => res.json());
export const fetcherMessages = (url) => getChatToken().then(async (token) => {
    return fetch(import.meta.env.VITE_PUBLIC_BACKEND + url, {
        headers: {
            'Content-Type': 'application/json',
            'token': token
        }
    })
    .then((res) => {
        if (res.ok){
            return res.json()
        }
        else {
            return Promise.reject(res.status)
        }
    })
})


export const fetcherMessagesCache = (url) => getChatToken().then(async (token) => {
    console.time('cache')

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
          let cachedData = localStorage.getItem(cacheKey);
          if (cachedData){
              cachedMessages = cachedMessages.concat(JSON.parse(cachedData));
          }
      }
      // if all messages are cached, return them
      debugger
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
                    console.log('cached', cacheKey)
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
export const rejectJoinRequest = (chatId, fromAccount) => fetcherMessagesPost('/join-request-reject', {chatId, fromAccount})
export const deleteMessage = (chatId, height) => fetcherMessagesPost('/delete-message', {chatId, height})

export const fetcherAccount = (account) => fetch(import.meta.env.VITE_PUBLIC_BACKEND + '/account?account=' + account)
.then((res) => res.json()).then((data) => {
    if (data?.profilePicture == null){
        data.profilePicture = {
            url: accountIconUrl(account)
        }
    }
    return data
})
export const fetcherMessagesPost = (url, data) => getChatToken().then(async (token) => {
    return fetch(import.meta.env.VITE_PUBLIC_BACKEND + url, {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'token': token
     },
    body: JSON.stringify(data)
})}).then((res) => res.json());