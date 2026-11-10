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
import { goToMessage as goToMessageShared, loadAndWait } from '../go-to-message';
import { MESSAGE_ENTER_CLASS, messageRowKey, slideListUp, slideOffset, stopSlide, useNewMessageAnimation } from '../hooks/use-new-message-animation';

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
  isNewChat,
  initialTarget = null, // message to scroll to once loaded (search result)
  topInset = 0, // height of the translucent chat header overlaying the top of the list
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
  const animated = useNewMessageAnimation(messages, chat?.id);

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
  const messagesRef = useRef(messages);
  messagesRef.current = messages; // updated during render: read right after a page commit by maybeLoadOlder
  const fetchNextPageRef = useRef(fetchNextPage);
  useEffect(() => { fetchNextPageRef.current = fetchNextPage; }, [fetchNextPage]);

  // scroll to a replied message / search result, loading older pages until it is loaded.
  // While going there, scroll-triggered page loads are paused: a page prepended during the scroll shifts the indexes
  // and virtua would land on the wrong message.
  // whether the list is scrolled to (near) the bottom, from the scroller itself: virtua's viewportSize is only updated
  // by its ResizeObserver, so it is stale on the scroll event fired when the viewport grows (sticker / add panel
  // closed: the browser clamps scrollTop). With it the list looked ~300px above the bottom and stopped sticking.
  const isAtBottom = (): boolean | null => {
    const el = scrollerRef.current;
    if (!el || el.clientHeight === 0) return null;
    // minus the slide of a new message in progress, which temporarily grows scrollHeight
    return el.scrollHeight - slideOffset(el.lastElementChild) - el.scrollTop - el.clientHeight <= 100;
  }

  const goToToken = useRef(0);
  const goToMessage = useCallback(async (target: { _id: string; height: number }) => {
    if (!virtuaRef.current) return;
    const token = ++goToToken.current;
    isGoingToMessage.current = true;
    shouldStickToBottom.current = false;
    const isCancelled = () => token !== goToToken.current;
    try {
      await goToMessageShared({
        target,
        getMessages: () => messagesRef.current,
        hasMore: () => hasMoreRef.current,
        isBusy: () => isLoadingMoreRef.current,
        loadPages: loadOlderPages,
        isCancelled,
        root: () => scrollerRef.current,
        scrollTo: (id, allowSmooth) => {
          const handle = virtuaRef.current;
          const list = messagesRef.current;
          const i = list.findIndex((m: any) => m._id === id);
          if (!handle || i === -1) return false;
          const index = list.length - 1 - i; // displayMessages is oldest first
          // smooth only when close: the sizes of the items in between are only estimated, a long smooth scroll over
          // them lands off target
          const current = handle.findItemIndex(handle.scrollOffset + handle.viewportSize / 2);
          const smooth = allowSmooth && Math.abs(current - index) <= 30;
          handle.scrollToIndex(index, { align: 'center', smooth });
          return smooth ? 'smooth' : 'instant';
        },
      });
    } finally {
      if (!isCancelled()) {
        // page loads at the bottom marked the list as stuck there: recompute from where it actually is now, otherwise
        // the next page load / resize would scroll back to the bottom
        const atBottom = isAtBottom();
        if (atBottom != null) {
          shouldStickToBottom.current = atBottom;
          pendingShouldStick.current = null;
          clearTimeout(scrollTimeoutRef.current);
        }
        isGoingToMessage.current = false; // auto-scroll and page loads back on
        maybeLoadOlder();
      }
    }
  }, []);

  // opened from a search result: go to that message once the chat is loaded
  const initialTargetDone = useRef(null);
  useEffect(() => {
      if (!initialTarget?._id || initialTargetDone.current === initialTarget._id || messages.length === 0) return;
      const timer = setTimeout(() => { // let the chat open (initial scroll to the bottom) first
          initialTargetDone.current = initialTarget._id;
          goToMessage(initialTarget);
      }, 100);
      return () => clearTimeout(timer);
  }, [initialTarget?._id, messages.length > 0, goToMessage]);

  const cacheKey = "list-cache-v2-" + chat?.id; // v2: virtua 0.54 cache snapshot

  // Not virtua's scrollToIndex: it keeps re-applying its target (the end of the last item at the time of the call) on
  // every layout update until things settle, which with stickers / images still loading lasted long enough to pull
  // the list away from a message sent meanwhile (scrolled up, or fought the new message slide). The bottom is simply
  // the end of the scroller; handleResize keeps it there while items are measured, and when the viewport shrinks
  // right after (sticker / add panel, keyboard opening): stuck to the bottom from now on.
  const scrollToBottom = () => {
      shouldStickToBottom.current = true;
      pendingShouldStick.current = null;
      requestAnimationFrame(() => {
        const el = scrollerRef.current;
        if (el) el.scrollTop = el.scrollHeight - slideOffset(el.lastElementChild) - el.clientHeight;
      })
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

  // Reset state when switching to another chat. Not when chat goes from undefined to its id (the chats list loads after
  // the messages, e.g. opened from a search result): that would cancel a go to message in progress and stick to the bottom.
  const lastChatId = useRef(chat?.id);
  useEffect(() => {
    if (!chat?.id || chat.id === lastChatId.current || !lastChatId.current) {
      if (chat?.id) lastChatId.current = chat.id;
      return;
    }
    lastChatId.current = chat.id;
    shouldStickToBottom.current = true;
    isRestoringScroll.current = false;
    isGoingToMessage.current = false;
    goToToken.current++; // cancel a go to message of the previous chat
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

  // The sticker / add panel or the keyboard just changed the list height: if stuck to the bottom, stay there, before
  // paint. A scroll done earlier (opening the panel scrolls to the bottom of the still full height list) is reported
  // by a scroll event only after the list shrank, which then looked scrolled up and stopped sticking.
  useLayoutEffect(() => {
    if (!shouldStickToBottom.current || isRestoringScroll.current || isGoingToMessage.current) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight - slideOffset(el.lastElementChild) - el.clientHeight;
  }, [inputStickerHeight, inputAdditionalHeight, keyboardHeight]);

  // the viewport shrinks/grows with the keyboard, sticker and add panels (and items resize while measuring):
  // keep the bottom in view if we were there, virtua does not do it by itself
  const handleResize = () => {
    if (!shouldStickToBottom.current || isRestoringScroll.current || isGoingToMessage.current) return;
    if (performance.now() < enteringUntil.current) return slideToBottom();
    const el = scrollerRef.current;
    // the real bottom: during a slide scrollHeight includes the transform, scrolling there would overshoot
    if (el) el.scrollTop = el.scrollHeight - slideOffset(el.lastElementChild) - el.clientHeight;
  }

  // New message at the bottom while stuck there: slide the list up to it instead of jumping.
  // Not right away: virtua lays the new row out with an estimated size (and a received message is empty until
  // decrypted), scrolling then and correcting once measured made the list jump down and up. The row is added below
  // the bottom (out of view), and the list slides up once virtua measured it (handleResize -> slideToBottom).
  const ENTERING_MAX_MS = 1000; // waiting for the measurement at most this long
  const enteringUntil = useRef(0);
  const enteringFallback = useRef<ReturnType<typeof setTimeout>>();
  // Where the list was last painted (scrollTop minus the slide in progress), recorded at the start of each frame while
  // a message enters. The slide starts from there: virtua moves the scroll by itself when it measures the new row
  // (size estimate correction) before handleResize runs, measuring from the current scrollTop missed that part.
  const paintedOffset = useRef<number | null>(null);
  const trackPainted = () => {
    const el = scrollerRef.current;
    if (!el || performance.now() > enteringUntil.current) {
      paintedOffset.current = null;
      return;
    }
    paintedOffset.current = el.scrollTop - slideOffset(el.lastElementChild);
    requestAnimationFrame(trackPainted);
  }
  const slideToBottom = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const content = el.lastElementChild; // the Virtualizer's container
    const from = paintedOffset.current ?? el.scrollTop - slideOffset(content);
    stopSlide(content);
    el.scrollTop = el.scrollHeight - el.clientHeight;
    const distance = el.scrollTop - from;
    // from further up (sent while scrolled up): jump, sliding would show the unrendered rows in between
    if (distance <= el.clientHeight) slideListUp(content, distance);
  }
  const prevNewestKey = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const newest = displayMessages[displayMessages.length - 1];
    const previous = prevNewestKey.current;
    prevNewestKey.current = newest && messageRowKey(newest);
    if (!newest || !previous || previous === messageRowKey(newest)) return;
    if (newest.isLocal && newest.status === 'sent_local') {
      // a message we just sent: always go to it, even when scrolled up
      shouldStickToBottom.current = true;
      pendingShouldStick.current = null;
    }
    if (!animated.has(messageRowKey(newest))) return; // not animated (many at once): the auto-scroll below jumps there
    if (!shouldStickToBottom.current || isRestoringScroll.current || isGoingToMessage.current) return;
    const tracking = paintedOffset.current !== null;
    enteringUntil.current = performance.now() + ENTERING_MAX_MS;
    if (!tracking) trackPainted(); // the commit is not painted yet: this is the position on screen
    // in case virtua reports no resize (measured size equal to the estimate)
    clearTimeout(enteringFallback.current);
    enteringFallback.current = setTimeout(() => {
      if (shouldStickToBottom.current && !isGoingToMessage.current && isAtBottom() === false) slideToBottom();
    }, 100);
  }, [displayMessages]);
  useEffect(() => () => clearTimeout(enteringFallback.current), []);

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
      // a new message slides in once measured (see slideToBottom): scrolling now would jump past the slide
      if (performance.now() < enteringUntil.current) return;
      console.log("Auto-scrolling to bottom for new messages");
      scrollToBottom()
      setTimeout(() => {
        if (shouldStickToBottom.current && !isGoingToMessage.current) scrollToBottom()
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
    
    const isCloseToBottom = isAtBottom() ?? offsetScroll - scrollSize + viewportSize >= -100;
    
    // Clear any pending timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Update shouldStickToBottom immediately for better responsiveness
    // but also set a delayed update for stability
    // while going to a message the list passes the bottom (pages load there): do not stick to it meanwhile
    const stick = isCloseToBottom && !isGoingToMessage.current;
    shouldStickToBottom.current = stick;
    pendingShouldStick.current = stick;
    
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

  // loads older pages (one by default), resolves with whether it added messages
  const isFetchingRef = useRef(isFetchingNextPage);
  isFetchingRef.current = isFetchingNextPage;
  const loadOlderPages = async (count = 1) => {
    isLoadingMoreRef.current = true;
    try {
      return await loadAndWait({
        load: () => fetchNextPageRef.current(count),
        getCount: () => messagesRef.current.length,
        isFetching: () => !!isFetchingRef.current,
        timeoutMs: Math.min(LOAD_TIMEOUT_MS * count, 60000),
      });
    } finally {
      isLoadingMoreRef.current = false;
      lastLoadEnd.current = performance.now();
    }
  }

  const maybeLoadOlder = async (offsetScroll = virtuaRef.current?.scrollOffset) => {
    if (offsetScroll == null || offsetScroll > PRELOAD_MARGIN) return;
    if (!hasMoreRef.current || isLoadingMoreRef.current || isRestoringScroll.current || isGoingToMessage.current) return;
    if (loadsWithoutProgress.current >= MAX_LOADS_WITHOUT_PROGRESS) return;
    const sinceLastLoad = performance.now() - lastLoadEnd.current;
    if (sinceLastLoad < LOAD_COOLDOWN_MS) {
      clearTimeout(cooldownTimer.current);
      cooldownTimer.current = setTimeout(() => maybeLoadOlder(), LOAD_COOLDOWN_MS - sinceLastLoad);
      return;
    }

    isFirstLoadMore.current = false;
    if (await loadOlderPages()) {
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
        100vh - 57px - 3px - ${keyboardHeight}px - var(--app-top-spacer, var(--safe-area-inset-top))
        - ${inputStickerHeight}px - ${inputAdditionalHeight}px - ${(keyboardHeight <= 0)? `var(--safe-area-inset-bottom)`: `0px`} - ${isTablet ? '57.8px' : '0px'}
        - ${isNewChat ? '202px' : '0px'}
        )`,
        overflowAnchor: "none"
      }}
    >
      <div
        key={"list" + chat?.id}
        id='vlist'
        className="scroll-under-header"
        ref={scrollerRef}
        style={{overflowY: "auto", contain: "strict", width: "100%", height: "100%", display: "block"}}
      >
      {/* the header overlays the list (messages scroll behind it), this spacer keeps the oldest message reachable */}
      <div style={{height: topInset}} />
      <Virtualizer
        cache={cache}
        ref={virtuaRef}
        scrollRef={scrollerRef}
        startMargin={topInset}
        shift={shift}
        onScroll={handleScroll}
        onResize={handleResize}
      >
        {displayMessages.map((message, index) => {
          const prevMessage = displayMessages[index + 1];
          const nextMessage = displayMessages[index - 1];
          
          return (
            <div
              key={messageRowKey(message) + "-vlist"}
              data-message-id={message._id}
              className={animated.has(messageRowKey(message)) ? MESSAGE_ENTER_CLASS : undefined}
            >
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