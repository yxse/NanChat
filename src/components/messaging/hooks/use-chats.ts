import useSWR, { mutate } from 'swr';
import { useCallback, useEffect } from 'react';
import useSWRInfinite from 'swr/infinite';
import { fetcherAccount, fetcherChats, fetcherMessages, fetcherMessagesCache } from '../fetcher';
import { useWallet } from '../../Popup';

interface UseChatsReturn {
  chats: Chat[] | undefined;
  chat: Chat | undefined;
  isLoading: boolean;
  isLoadingChat: boolean;
  mutateChats: typeof mutate;
  profilePictures: any;
}

export function useChats(chatId?: string): UseChatsReturn {
  // Fetch all chats
  const {
    data: chats, 
    isLoading, 
    mutate: mutateChats
  } = useSWR<Chat[]>(
    '/chats', 
    () => fetcherChats(chats), // Pass the chats data to the fetcher
     {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: true,
      revalidateOnMount: false,
      fallbackData: [],
    }
  );
  const chat = chats?.find(chat => chat.id === chatId);
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
    const isFirstLoad = !sessionStorage.getItem('app-initialized');
    mutateChats() // to force refresh
    if (isFirstLoad) { 
      mutateChats() // fetch all chats on first load, then chats should be updated by socket
      sessionStorage.setItem('app-initialized', 'true');
    }
  }, []);
  // {onError: async (error) => {
  //         console.log("aze error get chats", error)
  //         if (error === 401 || error === 403) {
  //             // debugger
  //             await getNewChatToken(activeAccount, activeAccountPk)
  //         }
  //     }});
  return { 
    chats, 
    chat, 
    isLoading, 
    profilePictures,
    mutateChats,
    // isLoadingChat, 
    
  };
}