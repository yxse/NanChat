import useSWR, { useSWRConfig } from 'swr';
import { useCallback, useEffect, useRef, useState } from 'react';
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
      return acc + chat.unreadCount;
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
  const {mutateChats, chat} = useChats(chatId);

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
  let messages = pages ? pages.flat() : [];
  // const isLoadingInitial = !pages && !error;
  const isLoadingInitial = isLoading
  // const isLoadingMore = size > 0 && pages && pages[size - 1] === "undefined";
  const isLoadingMore = isValidating
  const isLoadingNextPage = isValidating
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
    // we use this function to reduce the number of message loaded
    // for optimization purpose, as when too much messages loaded the DOM becomes slower
    // todo: use virtualize list instead
    // if (Capacitor.getPlatform() !== "ios") return // we reset only for ios since not using virtualizer
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
  // // Load more messages
  // const loadMore = useCallback(() => {
  //   setSize(size + 1);
  // }, [setSize, size]);
 // Store pending load promises
  const loadPromisesRef = useRef(new Map());
  
  // Effect to resolve load promises when new pages arrive
  useEffect(() => {
    if (pages) {
      const currentPageCount = pages.length;
      // Check for any pending promises that can now be resolved
      loadPromisesRef.current.forEach((resolve, expectedSize) => {
        if (currentPageCount >= expectedSize) {
          resolve(true);
          loadPromisesRef.current.delete(expectedSize);
        }
      });
    }
  }, [pages]);

  // Effect to reject promises on error
  useEffect(() => {
    if (error) {
      // Reject all pending promises
      loadPromisesRef.current.forEach((resolve, expectedSize) => {
        resolve(Promise.reject(error));
        loadPromisesRef.current.delete(expectedSize);
      });
    }
  }, [error]);
    // Load more messages - now async and resolves when the new page is loaded
  const loadMore = useCallback(async (limit) => {
    const newSize = size + 1;
    
    // Create promise for this specific load
    const loadPromise = new Promise((resolve, reject) => {
      loadPromisesRef.current.set(newSize, resolve);
      
      // If we already have enough pages, resolve immediately
      if (pages && pages.length >= newSize) {
        resolve(true);
        loadPromisesRef.current.delete(newSize);
        return;
      }
      
      // If there's already an error, reject immediately
      if (error) {
        reject(error);
        loadPromisesRef.current.delete(newSize);
        return;
      }
    });
    
    // Trigger the fetch
    setSize(newSize);
    
    return loadPromise;
  }, [setSize, size, pages, error]);

  useEffect(() => {
    // mutate unreadCount to 0 when chat is opened
    if (chatId) {
      mutateChats(currentChats => {
        const newChats = [...(currentChats || [])];
        const chatIndex = newChats.findIndex(chat => chat.id === chatId);
        if (chatIndex !== -1) {
          const newChat = { ...newChats[chatIndex] };
          newChat.unreadCount = 0;
          newChats[chatIndex] = newChat
        }
        return newChats;
      }, false);
    }
  }, [pages]);
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