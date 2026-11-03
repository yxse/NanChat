import { useMemo, useRef, useEffect, useState, useLayoutEffect, useCallback } from 'react';
import Message, { HeaderMessage } from './Message';
import { TEAM_ACCOUNT, LIMIT_MESSAGES } from '../utils';
import { Button, DotLoading, SpinLoading, Toast } from 'antd-mobile';
import { CacheSnapshot, Virtualizer } from "virtua";
import { debounce } from 'lodash';
import { Keyboard } from '@capacitor/keyboard';
import { socket } from '../socket';
import { useEvent } from './EventContext';
import { Capacitor } from '@capacitor/core';
import { DownOutline } from 'antd-mobile-icons';
import { AiOutlineDown } from 'react-icons/ai';
import { DateHeader, shouldShowDate } from './date-header-component';
import { useBreakpoint } from '../../../hooks/use-windows-dimensions';
import NewMessageWarning from './NewMessageWarning';

const PRELOAD_MARGIN = 400; // px from the top at which the next page starts loading
const LOAD_COOLDOWN_MS = 100; // minimum time between two page loads
const LOAD_TIMEOUT_MS = 10000; // give up waiting for a page after this long
const MAX_LOADS_WITHOUT_PROGRESS = 2;

export const VirtualizedMessagesVirtua = ({
  messages, 
  activeAccount, 
  activeAccountPk, 
  chat, 
  hasMore, 
  fetchNextPage, 
  isFetchingNextPage,
  isLoadingFirstPage,
  virtuaRef,
  isNewChat
}) => {
  
  const [mountTimestamp, setMountTimestamp] = useState(null);

  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [inputStickerHeight, setInputStickerHeight] = useState(0)
  const [inputAdditionalHeight, setInputAdditionalHeight] = useState(0)
  const [typingHeight, setTypingHeight] = useState(0)
  const [isCloseToBottomState, setIsCloseToBottomState] = useState(undefined)
  const eventStickerVisible = useEvent("sticker-visible")
  const eventAddVisible = useEvent("add-visible")
  const shouldStickToBottom = useRef(true);
  const {isMobile, isTablet} = useBreakpoint()
  
  // Add these new refs to manage state better
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isRestoringScroll = useRef(false);
  const pendingShouldStick = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const isGoingToMessage = useRef(false);
  
  const displayMessages = useMemo(() => {
    return [...messages].reverse();
  }, [messages]);

  // virtua only reads `shift` on the render where the item count changes, so derive it from the data:
  // older messages were prepended iff the first displayed message changed and the list grew.
  // (a ref toggled by timers was racy, especially when pages come instantly from the local cache)
  const prevFirstId = useRef<string | undefined>(undefined);
  const prevLength = useRef(0);
  const prevChatId = useRef(chat?.id);
  const firstId = displayMessages[0]?._id;
  const shift =
    prevChatId.current === chat?.id &&
    prevLength.current > 0 &&
    displayMessages.length > prevLength.current &&
    firstId !== prevFirstId.current;
  useLayoutEffect(() => {
    prevFirstId.current = firstId;
    prevLength.current = displayMessages.length;
    prevChatId.current = chat?.id;
  });
  const isLoadingMoreRef = useRef(false);

  const isFirstLoadMore = useRef(true);
  const timeoutRef = useRef(null);

  // Refs for stable access inside async goToMessage callback
  const displayMessagesRef = useRef(displayMessages);
  useEffect(() => { displayMessagesRef.current = displayMessages; }, [displayMessages]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages; // updated during render: read right after a page commit by maybeLoadOlder
  const fetchNextPageRef = useRef(fetchNextPage);
  useEffect(() => { fetchNextPageRef.current = fetchNextPage; }, [fetchNextPage]);

  const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null);

  const highlightMessageById = (id: string) => {
    const doHighlight = (el: Element) => {
      el.classList.add('message-highlight');
      el.addEventListener('animationend', () => el.classList.remove('message-highlight'), { once: true });
    };

    const attachObserver = (el: Element) => {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          doHighlight(el);
        }
      }, { threshold: 0.5 });
      observer.observe(el);
      setTimeout(() => observer.disconnect(), 8000);
    };

    const el = document.querySelector(`[data-message-id="${id}"]`);
    if (el) {
      attachObserver(el);
    } else {
      let attempts = 0;
      const poll = setInterval(() => {
        const found = document.querySelector(`[data-message-id="${id}"]`);
        if (found || ++attempts > 80) {
          clearInterval(poll);
          if (found) attachObserver(found);
        }
      }, 100);
    }
  };

  useEffect(() => {
    if (!pendingScrollTarget || !virtuaRef.current) return;
    const displayIndex = displayMessagesRef.current.findIndex(m => m._id === pendingScrollTarget);
    if (displayIndex !== -1) {
      requestAnimationFrame(() => {
        virtuaRef.current?.scrollToIndex(displayIndex, { align: 'center', smooth: true });
        setTimeout(() => { isGoingToMessage.current = false; }, 600);
        highlightMessageById(pendingScrollTarget);
      });
      setPendingScrollTarget(null);
    }
  }, [displayMessages, pendingScrollTarget]);

  const goToMessage = useCallback(async (replyMessage: { _id: string; height: number }) => {
    if (!virtuaRef.current) return;

    isGoingToMessage.current = true;
    shouldStickToBottom.current = false;

    const displayIndex = displayMessagesRef.current.findIndex(m => m._id === replyMessage._id);
    if (displayIndex !== -1) {
      virtuaRef.current.scrollToIndex(displayIndex, { align: 'center', smooth: true });
      setTimeout(() => { isGoingToMessage.current = false; }, 600);
      highlightMessageById(replyMessage._id);
      return;
    }

    const currentMessages = messagesRef.current;
    if (!replyMessage.height || !currentMessages.length) {
      isGoingToMessage.current = false;
      return;
    }
    const lowestLoadedHeight = currentMessages[currentMessages.length - 1]?.height;
    if (lowestLoadedHeight === undefined || replyMessage.height >= lowestLoadedHeight) {
      isGoingToMessage.current = false;
      return;
    }

    const pagesToLoad = Math.ceil((lowestLoadedHeight - replyMessage.height) / LIMIT_MESSAGES) + 1;

    setPendingScrollTarget(replyMessage._id);

    for (let i = 0; i < pagesToLoad; i++) {
      try {
        await fetchNextPageRef.current();
        await new Promise(r => setTimeout(r, 50)); // let React commit and refresh fetchNextPageRef
      } catch (e) {
        break;
      }
    }

    // isGoingToMessage.current is reset by the pendingScrollTarget effect after the scroll completes
  }, []);

  const cacheKey = "list-cache-v2-" + chat?.id; // v2: virtua 0.54 cache snapshot

  const scrollToBottom = () => {
      console.log("scroll to bottom", displayMessages.length)
      const to = displayMessages.length + 999
      requestAnimationFrame(() =>
        virtuaRef.current?.scrollToIndex(to, {
          align: 'end',
          smooth: false
        })
      )
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
      clearTimeout(timeoutRef.current);
      clearTimeout(scrollTimeoutRef.current);
      if (isMobile || isTablet) {
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify([handle.scrollOffset, handle.cache])
        );
      };
    }
  }, [chat?.id]);

  useEffect(() => {
    // Reset state when chat changes
    shouldStickToBottom.current = true;
    isRestoringScroll.current = false;
    isGoingToMessage.current = false;
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
    if (Capacitor.getPlatform() === 'web') return; // Keyboard events are only relevant for native platforms
    const listeners = [
      Keyboard.addListener('keyboardWillShow', info => {
        const safeAreaBottomValue = parseInt(window.getComputedStyle(document.body).getPropertyValue('--android-inset-bottom-buttons').split('px')[0] || 0)
        console.log('keyboard will show with height:', info.keyboardHeight);
        setKeyboardHeight(info.keyboardHeight - safeAreaBottomValue)
        scrollToBottom(false)
      }),
      Keyboard.addListener('keyboardWillHide', () => {
        setKeyboardHeight(0)
      }),
    ];
    return () => listeners.forEach(l => l.then(h => h.remove()));
  }, [])

  // the viewport shrinks/grows with the keyboard, sticker and add panels (and items resize while measuring):
  // keep the bottom in view if we were there, virtua does not do it by itself
  const handleResize = () => {
    if (!shouldStickToBottom.current || isRestoringScroll.current || isGoingToMessage.current) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  // Auto-scroll to bottom for new messages (improved logic)
  useEffect(() => {
    if (!virtuaRef.current) return;
    if (isGoingToMessage.current) return;

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
      setTimeout(() => {
        scrollToBottom()
      }, 10) // on large screens sometimes need a bit more time to have correct scroll
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
    
    // console.log("scroll", offsetScroll - scrollSize + fixedViewPortInitial, isCloseToBottom)
    
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
    
    maybeLoadOlder(offsetScroll);
  }

  // Preload older pages well before the top (a page is ~3000px) so fast scrolls do not hit it, same rules as MessageList:
  // one load at a time, short cooldown, re-check after each page to stay ahead, stop if loads make no progress.
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const lastLoadEnd = useRef(0);
  const loadsWithoutProgress = useRef(0);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout>>();

  const maybeLoadOlder = async (offsetScroll = virtuaRef.current?.scrollOffset) => {
    if (offsetScroll == null || offsetScroll > PRELOAD_MARGIN) return;
    if (!hasMoreRef.current || isLoadingMoreRef.current || isRestoringScroll.current) return;
    if (loadsWithoutProgress.current >= MAX_LOADS_WITHOUT_PROGRESS) return;
    const sinceLastLoad = performance.now() - lastLoadEnd.current;
    if (sinceLastLoad < LOAD_COOLDOWN_MS) {
      clearTimeout(cooldownTimer.current);
      cooldownTimer.current = setTimeout(() => maybeLoadOlder(), LOAD_COOLDOWN_MS - sinceLastLoad);
      return;
    }

    isLoadingMoreRef.current = true;
    isFirstLoadMore.current = false;
    const countBefore = messagesRef.current.length;
    try {
      await Promise.race([fetchNextPageRef.current(), new Promise(r => setTimeout(r, LOAD_TIMEOUT_MS))]);
      await new Promise(r => requestAnimationFrame(r)); // let React commit the new page
    } catch (error) {
      console.log("cannot load next page", error)
    } finally {
      isLoadingMoreRef.current = false;
      lastLoadEnd.current = performance.now();
    }
    if (messagesRef.current.length > countBefore) {
      loadsWithoutProgress.current = 0;
    } else if (++loadsWithoutProgress.current >= MAX_LOADS_WITHOUT_PROGRESS) {
      console.warn("loading older messages made no progress, stop loading until new messages arrive");
    }
    maybeLoadOlder(); // still within the margin (fast scroll): load the next page to stay ahead
  }

  // the list changed (page loaded, new message, hasMore known): allow loading again and check the position.
  // Not while stuck to the bottom (e.g. on open, scrollOffset is still 0 before the initial scroll to bottom),
  // unless the messages do not fill the viewport: then there is no scroll to trigger loading older ones.
  useEffect(() => {
    loadsWithoutProgress.current = 0;
    const handle = virtuaRef.current;
    if (!handle || handle.viewportSize === 0 || isLoadingMoreRef.current) return;
    const fillsViewport = handle.scrollSize > handle.viewportSize;
    if (shouldStickToBottom.current && fillsViewport) return;
    maybeLoadOlder();
  }, [hasMore, messages.length]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      // console.log("cleaning up timeouts");
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      clearTimeout(cooldownTimer.current);
    };
  }, [chat?.id]);

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
      <div
        key={"list" + chat?.id}
        id='vlist'
        ref={scrollerRef}
        style={{overflowY: "auto", contain: "strict", width: "100%", height: "100%", display: "block"}}
      >
      <Virtualizer
        cache={cache}
        ref={virtuaRef}
        scrollRef={scrollerRef}
        shift={shift}
        onScroll={handleScroll}
        onResize={handleResize}
      >
        {displayMessages.map((message, index) => {
          const prevMessage = displayMessages[index + 1];
          const nextMessage = displayMessages[index - 1];
          
          return (
            <div key={message._id + "-vlist"} data-message-id={message._id}>
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
                onGoToMessage={goToMessage}
              />
            </div>
          );
        })}
        <div style={{height: 29}} key={"padding-typing" + chat?.id}>{" "}</div>
      </Virtualizer>
      </div>
    </div>
  );
};