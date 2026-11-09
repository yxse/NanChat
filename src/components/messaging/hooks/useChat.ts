import useSWR, { useSWRConfig } from 'swr';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWRInfinite from 'swr/infinite';
import { fetcherMessages } from '../fetcher';
import { fetcherMessagesCache, markChatOpen, markChatRead, onMessagesSynced } from '../message-cache';
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

// unread total per chats array: the badge re-renders on every route change / chats update, the array only changes on
// chats updates (thousands of chats to sum)
const unreadSums = new WeakMap<object, { account: string; sum: number }>();
function sumUnread(chats: any, activeAccount: string): number | null {
  if (!Array.isArray(chats)) return null; // loading, or an { error } body
  const cached = unreadSums.get(chats);
  if (cached && cached.account === activeAccount) return cached.sum;
  let sum = 0;
  for (const chat of chats) {
    if (chat.lastMessageFrom !== activeAccount) sum += chat?.muted ? 0 : chat.unreadCount || 0;
  }
  unreadSums.set(chats, { account: activeAccount, sum });
  return sum;
}

export function useUnreadCount() {
  const [seedVerified] = useLocalStorageState('seedVerified', { defaultValue: false })
  const {chats} = useChats();
  const {activeAccount} = useWallet()
  const unread = sumUnread(chats, activeAccount);

  useEffect(() => {
    if (unread == null) return;
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

export const getKey = (pageIndex, previousPageData, chatId, height?) => {
  // console.log({pageIndex, previousPageData});
  // debugger
  if (pageIndex === 0) return `/messages?chatId=${chatId}&limit=${LIMIT_MESSAGES_INITIAL}&cursor=-1`;
  if (!isMorePages(previousPageData)) return null;
  return `/messages?chatId=${chatId}&limit=${LIMIT_MESSAGES}&cursor=${previousPageData[previousPageData.length - 1].height-1}`;
};
// whether messages exist before this page (an { error } object or an empty page: no)
const isMorePages = (page) => {
  if (!Array.isArray(page) || page.length === 0) return false;
  const oldest = page[page.length - 1];
  return oldest?.height > 1 && oldest._prevHeight !== -1; // first message is height 1; _prevHeight -1: start of the history (message-cache)
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
    // only rewrite entries holding more than one page: every cache.set is also an IndexedDB write (swr-idb-cache), and
    // the cache can hold an entry per chat
    const keys = [...cache.keys()]
   for (let key of keys){
      if (key.startsWith('/messages') && !key.includes('&page=0')) {
      cache.delete(key)
    }
    if (key.startsWith('$inf$/messages')) {
      const current = cache.get(key) as any
      if (!Array.isArray(current?.data) || (current.data.length <= 1 && current._l === 1)) continue
      let filteredValue = {...current}
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
  // Load the next `count` older pages (page size fixed by getKey). setSize resolves once they have been fetched.
  // Counted from the pages actually shown: reset() trims the cached size without re-rendering, and counting from that
  // smaller size would re-fetch pages already shown instead of loading older ones.
  const shownPages = useRef(0);
  shownPages.current = pages?.length ?? 0;
  const loadMore = useCallback(
    (count: number = 1) => setSize(s => Math.max(s, shownPages.current) + Math.max(1, Math.floor(count) || 1)),
    [setSize],
  );

  useEffect(() => {
    // mutate unreadCount to 0 when chat is opened or receives messages while open.
    // Only when needed: every mutation of the chats store notifies all its subscribers (one ProfileName per rendered
    // message), so doing it unconditionally on each page load made loading older messages slower and slower.
    if (chat?.id && chat.unreadCount > 0) {
      // also server side, else the count comes back with the next chats fetch (e.g. messages received while the
      // socket was not in the chat room, or a newest page served from the message store without a request)
      markChatRead(chat.id, activeAccountPk);
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
  // the background sync stored new messages of this chat: show them
  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;
  useEffect(() => {
    if (!chatId) return;
    const unmarkOpen = markChatOpen(chatId); // closed chats get their newest page preloaded instead (ChatSocket)
    const unsubscribe = onMessagesSynced((syncedChatId) => {
      if (syncedChatId === chatId) mutateRef.current();
    });
    return () => {
      unmarkOpen();
      unsubscribe();
    };
  }, [chatId]);

  // the chats list knows a newer message than the newest one shown (chats fetched on launch / resume / notification
  // tap): refresh now rather than after the background sync (1s delay + a batch request). Once per chat height: the
  // height can stay above the newest visible message (deleted messages, join requests), that must not loop.
  const refreshedForHeight = useRef<string | null>(null);
  const newestShown: number | undefined = Array.isArray(pages?.[0]) ? pages[0][0]?.height : undefined;
  const chatHeight: number | undefined = (chat as any)?.height; // not in the Chat type, sent by the server
  useEffect(() => {
    if (!chatId || !Number.isInteger(chatHeight) || !Number.isInteger(newestShown)) return;
    if (chatHeight! <= newestShown!) return;
    const marker = chatId + ':' + chatHeight;
    if (refreshedForHeight.current === marker) return;
    refreshedForHeight.current = marker;
    mutateRef.current();
  }, [chatId, chatHeight, newestShown]);

  const hasMore = !!pages && isMorePages(pages[pages.length - 1]);
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