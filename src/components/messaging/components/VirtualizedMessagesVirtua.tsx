import { useMemo, useRef, useEffect, useState, useLayoutEffect, useCallback } from 'react';
import Message, { HeaderMessage } from './Message';
import { firstMessageId, TEAM_ACCOUNT } from '../utils';
import { Button, DotLoading, SpinLoading, Toast } from 'antd-mobile';
import { CacheSnapshot, VList, VListHandle } from "virtua";
import { debounce } from 'lodash';
import { Keyboard } from '@capacitor/keyboard';
import { socket } from '../socket';
import { useEvent } from './EventContext';
import { Capacitor } from '@capacitor/core';
import { DownOutline } from 'antd-mobile-icons';
import { AiOutlineDown } from 'react-icons/ai';
import { DateHeader, shouldShowDate } from './date-header-component';
import { useWindowDimensions } from '../../../hooks/use-windows-dimensions';
import NewMessageWarning from './NewMessageWarning';

export const VirtualizedMessagesVirtua = ({ 
  messages, 
  activeAccount, 
  activeAccountPk, 
  chat, 
  hasMore, 
  fetchNextPage, 
  isFetchingNextPage,
  saveScrollPosition,
  isLoadingFirstPage,
  virtuaRef,
  isNewChat
}) => {
  
  const isPrepend = useRef(false);
  const [mountTimestamp, setMountTimestamp] = useState(null);

  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [inputStickerHeight, setInputStickerHeight] = useState(0)
  const [inputAdditionalHeight, setInputAdditionalHeight] = useState(0)
  const [typingHeight, setTypingHeight] = useState(0)
  const [isCloseToBottomState, setIsCloseToBottomState] = useState(undefined)
  const eventStickerVisible = useEvent("sticker-visible")
  const eventAddVisible = useEvent("add-visible")
  const shouldStickToBottom = useRef(true);
  const {isMobile, isTablet} = useWindowDimensions()
  
  // Add these new refs to manage state better
  const isRestoringScroll = useRef(false);
  const pendingShouldStick = useRef(null);
  const scrollTimeoutRef = useRef(null);
  
  const displayMessages = useMemo(() => {
    return [...messages].reverse();
  }, [messages]);
  
  const isFirstLoadMore = useRef(true);
  const timeoutRef = useRef(null);

  const cacheKey = "list-cache-" + chat?.id;

  const scrollToBottom = (force = true) => {
    if (true){
      console.log("scroll to bottom", displayMessages.length)
      const to = displayMessages.length + 999
      requestAnimationFrame(() =>
        virtuaRef.current?.scrollToIndex(to, {
          align: 'end',
          smooth: false
        })
      )
    }
    else{
        virtuaRef.current?.scrollToIndex(displayMessages.length - 1, {
          align: 'end',
          smooth: false
        })
    }
  }

  const [offset, cache] = useMemo(() => {
    const serialized = sessionStorage.getItem(cacheKey);
    if (!serialized) return [];
    try {
      return JSON.parse(serialized) as [number, CacheSnapshot];
    } catch (e) {
      return [];
    }
  }, [chat?.id]);

  const [hasRestored, setHasRestored] = useState(false)
  
  useLayoutEffect(() => {
    if (!virtuaRef.current) return;
    const handle = virtuaRef.current;

    if (offset) {
      isRestoringScroll.current = true;
      // Toast.show({content: "Restoring scroll" + offset})
      console.log("restoring scroll", offset)
      shouldStickToBottom.current = false
      setHasRestored(true)
      
      // Multiple attempts to ensure restoration works
      const attemptRestore = () => {
        if (handle) {
          handle.scrollTo(offset);
        }
      };
      
      // Immediate attempt
      attemptRestore();
      
      // Backup attempts with delays
      setTimeout(attemptRestore, 50);
      setTimeout(attemptRestore, 100);
      
      // Clear the restoration flag after all attempts
      setTimeout(() => {
        isRestoringScroll.current = false;
      }, 500);
    } else {
      // No restoration needed, allow normal behavior immediately
      isRestoringScroll.current = false;
      setHasRestored(true);
    }

    return () => {
      // if (isMobile || isTablet) {
        clearTimeout(timeoutRef.current);
        clearTimeout(scrollTimeoutRef.current);
        isPrepend.current = false
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify([handle.scrollOffset, handle.cache])
        );
      }
    // };
  }, [chat?.id]);

  useEffect(() => {
    // Reset state when chat changes
    shouldStickToBottom.current = true;
    isRestoringScroll.current = false;
    pendingShouldStick.current = null;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  }, [chat?.id])

  useEffect(() => {
    if (eventStickerVisible == undefined) return
    if (eventStickerVisible){
      setInputStickerHeight(eventStickerVisible)
      scrollToBottom(false)
    }
    else{
      setInputStickerHeight(0)
    }
  }, [eventStickerVisible])
  
  useEffect(() => {
    if (eventAddVisible == undefined) return
    if (eventAddVisible){
      setInputAdditionalHeight(eventAddVisible)
      scrollToBottom(false)
    }
    else{
      setInputAdditionalHeight(0)
    }
  }, [eventAddVisible])

  useEffect(() => {
    Keyboard.addListener('keyboardWillShow', info => {
      const safeAreaBottomValue = parseInt(window.getComputedStyle(document.body).getPropertyValue('--android-inset-bottom-buttons').split('px')[0] || 0)
      console.log('keyboard will show with height:', info.keyboardHeight);
      setKeyboardHeight(info.keyboardHeight - safeAreaBottomValue)
      scrollToBottom(false)
    })
    
    Keyboard.addListener('keyboardWillHide', info => {
      setKeyboardHeight(0)
    })
  }, [virtuaRef, displayMessages.length])

  // Auto-scroll to bottom for new messages (improved logic)
  useEffect(() => {
    if (!virtuaRef.current) return;
    
    // Don't auto-scroll if we're restoring scroll position
    if (isRestoringScroll.current) {
      console.log("Skipping auto-scroll during restoration");
      return;
    }
    
    // Don't auto-scroll if we have an offset to restore and haven't restored yet
    if (offset && !hasRestored) {
      console.log("Skipping auto-scroll - waiting for restoration");
      return;
    }
    
    // Always scroll to bottom when there are new messages and we should stick to bottom
    if (shouldStickToBottom.current) {
      console.log("Auto-scrolling to bottom for new messages");
      scrollToBottom()
      firstMessageId[chat?.id] = displayMessages[displayMessages.length - 1]?._id
    }
  }, [displayMessages, virtuaRef, hasRestored, offset, chat?.id]);

  const handleScroll = async (offsetScroll) => {
    if (!virtuaRef.current) return;
    
    // Skip scroll handling during restoration
    if (isRestoringScroll.current) {
      console.log("Skipping scroll handling during restoration");
      return;
    }
    
    const { scrollSize, viewportSize } = virtuaRef.current;
    if (viewportSize == 0) return;
    
    let fixedViewPortInitial = viewportSize
    let isCloseToBottom = offsetScroll - scrollSize + fixedViewPortInitial >= -100;
    
    console.log("scroll", offsetScroll, scrollSize, viewportSize, isCloseToBottom, fixedViewPortInitial)
    
    // Clear any pending timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Update shouldStickToBottom immediately for better responsiveness
    // but also set a delayed update for stability
    shouldStickToBottom.current = isCloseToBottom;
    pendingShouldStick.current = isCloseToBottom;
    
    scrollTimeoutRef.current = setTimeout(() => {
      // Only apply the pending update if it hasn't been overridden
      if (pendingShouldStick.current !== null) {
        shouldStickToBottom.current = pendingShouldStick.current;
        pendingShouldStick.current = null;
      }
      scrollTimeoutRef.current = null;
    }, 100);
    
    if (isCloseToBottom){
      isPrepend.current = false
    }

    let threshold = 500
    if (scrollSize < 2000){
      threshold = 100
    }
    
    if (offsetScroll < threshold && hasMore && !isFetchingNextPage) { 
      isPrepend.current = true;
  
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      console.log("loading more at top via scroll");
      isFirstLoadMore.current = false;
      
      try {
        await fetchNextPage(100);
        timeoutRef.current = setTimeout(() => {
          isPrepend.current = false
          timeoutRef.current = null;
        }, 1000)
      } catch (error) {
        console.log("cannot load next page", error)        
      }
    }
  }

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`chat-container`}
      style={{
        height: 
        `calc(
        100vh - 45px - 57px - 3px - ${keyboardHeight}px - var(--safe-area-inset-top) 
        - ${inputStickerHeight}px - ${inputAdditionalHeight}px - ${(keyboardHeight <= 0)? `var(--safe-area-inset-bottom)`: `0px`} - ${isTablet ? '57.8px' : '0px'}
        - ${isNewChat ? '202px' : '0px'}
        )`,
        overflowAnchor: "none"
      }}
    >
      <VList
        key={"list" + chat?.id}
        id='vlist'
        cache={cache}
        overscan={4}
        ref={virtuaRef}
        reverse
        shift={isPrepend.current}
        onScroll={handleScroll}
        style={{overflow: "auto", display: "block"}}
      >
        {displayMessages.map((message, index) => {
          const prevMessage = displayMessages[index + 1];
          const nextMessage = displayMessages[index - 1];
          
          return (
            <div key={message._id + "-vlist"}>
              <Message
                key={`${message._id}-${message.status}`}
                message={message}
                prevMessage={prevMessage}
                nextMessage={nextMessage}
                activeAccount={activeAccount}
                activeAccountPk={activeAccountPk}
                type={chat?.type}
                hasMore={hasMore}
                isFromTeam={chat?.creator === TEAM_ACCOUNT}
              />
            </div>
          );
        })}
        <div style={{height: 29}} key={"padding-typing" + chat?.id}>{" "}</div>
      </VList>
    </div>
  );
};