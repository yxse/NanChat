import useSWR, { useSWRConfig } from 'swr';
import { useCallback, useEffect, useState } from 'react';
import useSWRInfinite from 'swr/infinite';
import { fetcherMessages, fetcherMessagesCache } from '../fetcher';
import { useWallet } from "../../useWallet";
import { useChats } from './use-chats';
import { Badge } from '@capawesome/capacitor-badge';
import { SeedVerifiedBadge } from '../utils';
import useLocalStorageState from 'use-local-storage-state';


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
const LIMIT = 20;
// Custom hook for chat functionality

export const getKey = (pageIndex, previousPageData, chatId, height) => {
  // console.log({pageIndex, previousPageData});
  // debugger
  if (previousPageData && previousPageData[previousPageData.length - 1].height == 0) {
    // debugger
    return null;
  }
  if (pageIndex === 0) return `/messages?chatId=${chatId}&limit=${LIMIT}&cursor=-1`;
  return `/messages?chatId=${chatId}&limit=${LIMIT}&cursor=${previousPageData[previousPageData.length - 1].height-1}`;
};
export function useChat(chatId) {
  // Get messages using infinite loading
  const {mutateChats, chat} = useChats(chatId);

  const {activeAccount, activeAccountPk} = useWallet()

  const fetcherWithAccount = (key) => {
    return fetcherMessagesCache(key, activeAccount, activeAccountPk);
  };

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

  // Flatten all pages into a single array
  const messages = pages ? pages.flat() : [];
  const isLoadingInitial = !pages && !error;
  // const isLoadingMore = size > 0 && pages && pages[size - 1] === "undefined";
  const isLoadingMore = isValidating

  // Get unread count
  // const { data: unreadCount } = useSWR(
  //   `/api/messages/unread?chatId=${chatId}`,
  //   fetcher,
  //   { refreshInterval: 5000 }
  // );
  const unreadCount = 0;


  const reset = () => { 
    // we use this function to reduce the number of message loaded
    // for optimization purpose, as when too much messages loaded the DOM becomes slower
    // todo: use virtualize list instead

    // return
  // Keep only the first page of messages
  if (pages && pages.length > 0) {
    mutate([pages[0]], false); // Keep only first page, no revalidation
    // Reset size back to 1 (first page)
    if (size > 1){
      setSize(1);
    }
  } 
  
}
  // Load more messages
  const loadMore = useCallback(() => {
    setSize(size + 1);
  }, [setSize, size]);

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
  // debugger
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
    reset
  };
}