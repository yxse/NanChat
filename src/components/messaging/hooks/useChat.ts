import useSWR, { useSWRConfig } from 'swr';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWRInfinite from 'swr/infinite';
import { fetcherMessages, fetcherMessagesCache } from '../fetcher';
import { useWallet } from "../../useWallet";
import { useChats } from './use-chats';
import { Badge } from '@capawesome/capacitor-badge';
import { LIMIT_MESSAGES, LIMIT_MESSAGES_INITIAL, SeedVerifiedBadge } from '../utils';
import useLocalStorageState from 'use-local-storage-state';
import { Capacitor } from '@capacitor/core';


const sendMessage = async (chatId, content) => {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, content })
  });
  return response.json();
};

export function useUnreadCount() {
  const [seedVerified] = useLocalStorageState('seedVerified', { defaultValue: false })
  const {chats} = useChats();
  const {activeAccount} = useWallet()
  if (chats === undefined || chats?.error) return null;
  const unread = chats?.reduce((acc, chat) => {
    if (chat.lastMessageFrom !== activeAccount) {
      return acc + (chat?.muted ? 0 : chat.unreadCount);
    }
    return acc;
  }, 0)

  useEffect(() => {
    // update badge count
    let total = unread
    if (!seedVerified) {
      total = unread + 1; // if seed not verified, add 1 to badge count
    }
    if (total <= 0){
      Badge.clear().catch((error) => {
        console.error('Error clearing badge count:', error);
      });
      return;
    }
    Badge.set({
      count: total,
    }).catch((error) => {
      console.error('Error setting badge count:', error);
    });
  }, [unread, seedVerified]);
  return unread || null; // null to hide the badge
}
// const LIMIT = Capacitor.getPlatform() === "ios" ? 50 : 25;
// Custom hook for chat functionality

export const getKey = (pageIndex, previousPageData, chatId, height) => {
  // console.log({pageIndex, previousPageData});
  // debugger
  if (previousPageData && previousPageData[previousPageData.length - 1].height == 0) {
    // debugger
    return null;
  }
  if (pageIndex === 0) return `/messages?chatId=${chatId}&limit=${LIMIT_MESSAGES_INITIAL}&cursor=-1`;
  return `/messages?chatId=${chatId}&limit=${LIMIT_MESSAGES}&cursor=${previousPageData[previousPageData.length - 1].height-1}`;
};
export function useChat(chatId) {
  // Get messages using infinite loading
  const {mutateChats, chat, removeChat} = useChats(chatId);

  const {activeAccount, activeAccountPk} = useWallet()

  const fetcherWithAccount = (key) => {
    return fetcherMessagesCache(key, activeAccount, activeAccountPk);
  };
  const {cache} = useSWRConfig()
  const {
    data: pages,
    error,
    size,
    setSize,
    mutate,
    isLoading,
    isValidating 
  } = useSWRInfinite((pageIndex, previousPageData) => getKey(pageIndex, previousPageData, chatId, chat?.height), 
  fetcherWithAccount
  , {
    revalidateFirstPage: false, // should not be needed and cause flickering on scroll
    revalidateOnFocus: true,
    revalidateOnReconnect: true, 
    // revalidateIfStale: true,
    revalidateOnMount: true,
  });
  // const prevSizeRef = useRef(1)

  // Flatten all pages into a single array
  // memoized: a new array on every render would re-render the whole message list on any ChatRoom update
  const messages = useMemo(() => pages ? pages.flat() : [], [pages]);
  // console.log('messages fetch', pages, error)
  // const isLoadingInitial = !pages && !error;
  const isLoadingInitial = isLoading
  // true only while an older page is being fetched (not for any other revalidation)
  const isLoadingMore = isValidating && size > (pages?.length ?? 0)
  const isLoadingNextPage = isLoadingMore
  const isLoadingFirstPage = (isValidating && size <= 1) && !isLoadingInitial
  // const isLoadingNextPage = isValidating && size > prevSizeRef.current
 // Update the ref when validation completes
  // if (!isValidating) {
  //   prevSizeRef.current = size
  // }

  // Get unread count
  // const { data: unreadCount } = useSWR(
  //   `/api/messages/unread?chatId=${chatId}`,
  //   fetcher,
  //   { refreshInterval: 5000 }
  // );
  const unreadCount = 0;


  const reset = async () => { 
    // return
    // we use this function to reduce the number of message loaded
    // for optimization purpose, as when too much messages loaded the DOM becomes slower
    if (Capacitor.getPlatform() === "android") return // android uses the virtualizer, others render every loaded message
  // Keep only the first page of messages
  if (pages && pages.length > 0) {
    // await mutate([pages[0]], false); // Keep only first page, no revalidation
    // messages = messages.slice(0, 20)
    // Reset size back to 1 (first page)
    console.log(cache)
    const keys = cache.keys()
   for (let key of keys){
      if (key.startsWith('/messages') && !key.includes('&page=0')) {
      cache.delete(key)
    }
    if (key.startsWith('$inf$/messages')) { 
      let filteredValue = {...cache.get(key)}
      filteredValue.data = [filteredValue.data[0]]; // only keep first message page
      filteredValue['_l'] = 1; // set length to 1 to prevent swr fetching all pages
      // debugger
      cache.set(key, filteredValue)
    }
    
   }
    if (size > 1){
      // setSize(0);
    }
  } 
  
}
  // Load the next (older) page. setSize resolves once the new page has been fetched.
  // The page size is fixed by getKey, the optional argument is only kept for existing callers.
  const loadMore = useCallback((_limit?: number) => setSize(s => s + 1), [setSize]);

  useEffect(() => {
    // mutate unreadCount to 0 when chat is opened or receives messages while open.
    // Only when needed: every mutation of the chats store notifies all its subscribers (one ProfileName per rendered
    // message), so doing it unconditionally on each page load made loading older messages slower and slower.
    if (chat?.id && chat.unreadCount > 0) {
      mutateChats(currentChats => {
        const newChats = [...(currentChats || [])];
        const chatIndex = newChats.findIndex(c => c.id === chat.id);
        if (chatIndex !== -1) {
          const newChat = { ...newChats[chatIndex] };
          newChat.unreadCount = 0;
          newChats[chatIndex] = newChat
        }
        return newChats;
      }, false);
    }
  }, [pages, chat?.id, chat?.unreadCount]);

  useEffect(() => {
    const handleChatNotFound = async () => {
      if (pages && pages[0]?.error === "Chat not found" && chatId) {
        console.log("remove chat", chatId, error, pages)
        // if chat not found, remove it from the list
        try {
          let r = await fetcherMessages(`/messages?chatId=${chatId}&limit=0&cursor=-1`, activeAccountPk); // recheck if no longer have access to this chat, to prevent issue when switching account
        } catch (error) {
          if (error.message == "Chat not found"){
            removeChat(chatId);
          }
        }
      }
    }
    handleChatNotFound();
  }, [pages])
  
  // 
  const hasMore = pages && pages[pages.length - 1][pages[pages.length - 1].length - 1]?.height > 1;
  return {
    messages,
    error,
    isLoadingInitial,
    isLoadingMore,
    loadMore,
    unreadCount,
    mutate,
    hasMore,
    reset,
    isLoadingNextPage,
    isLoadingFirstPage
  };
}