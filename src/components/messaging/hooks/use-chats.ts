import useSWR, { mutate, useSWRConfig } from 'swr';
import { useCallback, useEffect, useRef } from 'react';
import useSWRInfinite from 'swr/infinite';
import { fetcherAccount, fetcherChats, fetcherMessages, fetcherMessagesCache, fetcherMessagesPost, muteChat, unmuteChat } from '../fetcher';
import { useWallet } from '../../Popup';
import { Toast } from 'antd-mobile';
import { saveCache } from '../../Wrapper';

interface UseChatsReturn {
  chats: Chat[] | undefined;
  chat: Chat | undefined;
  isLoading: boolean;
  isLoadingChat: boolean;
  mutateChats: typeof mutate;
  profilePictures: any;
  blockChat: (chatId: string) => Promise<void>;
}

export function useChats(chatIdOrAccount?: string, doSaveCache = false): UseChatsReturn {
  const {activeAccount, activeAccountPk} = useWallet();
    const { cache } = useSWRConfig()

  // Fetch all chats
  const {
    data: chats, 
    isLoading, 
    mutate: mutateChats
  } = useSWR<Chat[]>(
    '/chats-' + activeAccount, 
    () => fetcherChats(chats || [], activeAccount, activeAccountPk, cache),
     {
      revalidateOnFocus: true,
      revalidateOnReconnect: true, // revalidateOnReconnect to false will also prevent any revalidation by socket io on reconnect
      revalidateOnMount: true,
      fallbackData: [],
      dedupingInterval: 10000
    }
  );
  // console.log(chats[0])
  const lastSaveTime = useRef(0);

  // const chat = chats?.find(chat => chat.id === chatId);
  let chatId = chatIdOrAccount
  if (chatId?.startsWith('nano_')){
    chatId = chats.find(chat => chat.type === "private" && 
      ((chat.participants[0]?._id == activeAccount && (chat.participants[1]?._id == chatId)) ||
      (chat.participants[1]?._id == activeAccount && (chat.participants[0]?._id == chatId))))?.id
      // get chat id from the nano adress, usefull for the mutate notification in /chat/[account]/info, eventually  /chat/[chatId]/group route can be used even for private chat to avoid this by directly using the real chatId
  }
  const chat = Array.isArray(chats) ? chats.find(chat => chat.id === chatId) : undefined;

  const profilePictures = {}
  // if (typeof chat !== 'undefined') {
  //   for (const chat of chats) {
  //     for (const participant of chat.participants) {
  //       profilePictures[participant._id] = participant?.profilePicture?.url
  //     }
  //   }
  // }
  // // Fetch specific chat only if chatId is provided
  // const {
  //   data: chat, 
  //   isLoading: isLoadingChat
  // } = useSWR<Chat>(
  //   chatId ? `/chat?chatId=${chatId}` : null, 
  //   fetcherMessages,
  //   {
  //     // Optional: Configure revalidation and caching
  //     revalidateOnFocus: false,
  //   }
  // );
 async function mutateProfileName(chats){
  for (const chat1 of chats) {
    for (const participant of chat1.participants) {
      await mutate(`${participant._id}`, participant, {revalidate: false});
    }
  }
 }
  // useEffect(() => {
  //   if (!chats) return;

  //   chats.forEach((updatedChat) => {
  //     mutate(`/chat?chatId=${updatedChat.id}`, updatedChat, {revalidate: false});
  //   });
  //   mutateProfileName(chats)
    
    
  // }, [chats])

useEffect(() => {
  const now = Date.now();
  if (doSaveCache && (now - lastSaveTime.current) >= 30000) { // force save chats to localstorage cache for improved consistency, fallback if save cache no triggered beforeunload
    lastSaveTime.current = now;
    setTimeout(() => {
      saveCache(cache);
    }, 1000); // add delay for performances
  }
}, [cache, chats]);
  // {onError: async (error) => {
  //         console.log("aze error get chats", error)
  //         if (error === 401 || error === 403) {
  //             // debugger
  //             await getNewChatToken(activeAccount, activeAccountPk)
  //         }
  //     }});

  async function clearCache() {
    sessionStorage.removeItem('app-initialized');
    localStorage.removeItem('lastSync');
    await mutateChats()
  }
  async function blockChat(chatId: string) {
    let r = await fetcherMessagesPost('/block-chat', {
      chatId: chatId
  })

  if (r.success) {
      await mutateChats(
          current => {
              return current.filter((chat) => 
                chat.id !== chatId // group chat
              && !(chat.participants.length === 2 && chat.participants.some(participant => participant._id === chatId)) // 1:1 chat
            )
          }
          , false
      )
  }
  else if (r.error) {
      throw new Error(r.error)
  }
  }
async function muteNotifChat(mute) {
        await mutateChats( // optimistic update
          current => {
              return current.map(chat => 
                  (chat.id === chatId || 
                    (chat.type === "private" && chat.participants.includes(chatId) && chat.participants[0] !== chat.participants[1]))// in case of private chat
                      ? { ...chat, muted: mute }
                      : chat
              )
          }
          , false
      )
  let r
  if (mute){
    r = await muteChat(chatId)
  }
  else{
    r = await unmuteChat(chatId)
  }

  if (r.success) {
    // no need to resync if success
  }
  else if (r.error) {
    await mutateChats()
      throw new Error(r.error)
  }
}
    // console.log(chats[0])

  return { 
    chats, 
    chat, 
    isLoading, 
    profilePictures,
    clearCache,
    mutateChats,
    blockChat,
    muteNotifChat
    // isLoadingChat, 
    
  };
}