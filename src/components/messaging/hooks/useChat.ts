import useSWR, { } from 'swr';
import { useCallback } from 'react';
import useSWRInfinite from 'swr/infinite';
import { fetcherMessages } from '../fetcher';

// API functions
const fetcher = fetcherMessages;

const sendMessage = async (chatId, content) => {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, content })
  });
  return response.json();
};

// Custom hook for chat functionality
export function useChat(chatId) {
  // Get messages using infinite loading
  const getKey = (pageIndex, previousPageData) => {
    console.log({pageIndex, previousPageData});
    if (previousPageData && previousPageData.length == 0) return null;
    return `/messages?chatId=${chatId}&page=${pageIndex}&limit=50`;
  };

  const {
    data: pages,
    error,
    size,
    setSize,
    mutate,
    isLoading,
    isValidating 
  } = useSWRInfinite(getKey, fetcher, {
    revalidateFirstPage: true ,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    revalidateOnMount: true
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

  // Send message function
  const sendNewMessage = useCallback(async (content) => {
    try {
      // Optimistic update
      const optimisticMessage = {
        id: Date.now(),
        content,
        status: 'sending',
        timestamp: new Date().toISOString()
      };

      // Update local data immediately
      mutate(currentPages => {
        const newPages = [...(currentPages || [])];
        newPages[0] = [optimisticMessage, ...(newPages[0] || [])];
        return newPages;
      }, false);

      // Send the actual message
      const newMessage = await sendMessage(chatId, content);

      // Update with the real message
      mutate(currentPages => {
        const newPages = [...(currentPages || [])];
        newPages[0] = newPages[0].map(msg => 
          msg.id === optimisticMessage.id ? newMessage : msg
        );
        return newPages;
      }, false);

      return newMessage;
    } catch (error) {
      // Revert optimistic update on error
      mutate();
      throw error;
    }
  }, [chatId, mutate]);

  // Load more messages
  const loadMore = useCallback(() => {
    setSize(size + 1);
  }, [setSize, size]);

  const hasMore = pages && pages[pages.length - 1]?.length === 50;
  return {
    messages,
    error,
    isLoadingInitial,
    isLoadingMore,
    loadMore,
    sendMessage: sendNewMessage,
    unreadCount,
    mutate,
    hasMore
  };
}