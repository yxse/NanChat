import { SpinLoading } from 'antd-mobile';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import Message from '../Message';
import { useWallet } from '../../../useWallet';
import { goToMessage as goToMessageShared, loadAndWait } from '../../go-to-message';
import { ScrollIndicator, ScrollIndicatorHandle } from '../ScrollIndicator';
import { MESSAGE_ENTER_CLASS, messageRowKey, slideListUp, stopSlide, useNewMessageAnimation } from '../../hooks/use-new-message-animation';

// Non-virtualized chat message list.
//
// The scroller is a `flex-direction: column-reverse` container: scrollTop is 0 at the bottom and negative when
// scrolled up, and the browser keeps the offset relative to the bottom. So prepending older pages never moves
// the viewport, and no scroll compensation is needed.
//
// Older pages are preloaded by an IntersectionObserver on a sentinel at the top of the list, with these rules:
// - start well ahead of the top (a page is ~3000px), also while scrolling, so fast scrolls do not hit the top
// - after each page, check again right away so the list stays about one page ahead
// - one load at a time, with a short cooldown between loads
// - if loads stop adding messages, stop trying (prevents an infinite load loop at the top)

const LOAD_MORE_MARGIN = 1000; // px above the viewport at which the next page starts loading
const SCROLL_IDLE_MS = 150; // scroll position saved after this long without scroll events
const LOAD_COOLDOWN_MS = 100; // minimum time between two page loads
const LOAD_TIMEOUT_MS = 10000; // give up waiting for a page after this long
const MAX_LOADS_WITHOUT_PROGRESS = 2;

const scrollKey = (chatId: string) => `chat-scroll-${chatId}`;

export type MessageListHandle = {
    scrollToBottom: () => void;
};

// Props are kept primitive/stable on purpose: every re-render of the list runs the memo check of every message,
// which adds up with hundreds of loaded messages.
type Props = {
    messages: any[]; // newest first, as returned by useChat
    hasMore: boolean | undefined;
    isLoadingMore: boolean;
    loadMore: (count?: number) => Promise<unknown>;
    chatId: string;
    chatType: string | undefined;
    isFromTeam: boolean;
    restoreScroll: boolean; // restore the last scroll position of this chat instead of opening at the bottom
    onOpenAtBottom: () => void; // called on mount when the chat opens at the bottom (used to trim loaded pages)
    initialTarget?: { _id: string; height: number } | null; // message to scroll to once loaded (search result)
    topInset?: number; // height of the glass header overlaying the list, where the scroll indicator starts
};

// separate memoized rows so that toggling the loading spinner does not re-render them
const MessageRows = memo(({ displayMessages, chatType, isFromTeam, hasMore, onGoToMessage, animated }: {
    displayMessages: any[], chatType: string | undefined, isFromTeam: boolean, hasMore: boolean | undefined,
    onGoToMessage: (replyMessage: { _id: string; height: number }) => void,
    animated: Set<string>, // row keys of the new messages to animate in
}) => {
    const { activeAccount, activeAccountPk } = useWallet();
    return <>
        {displayMessages.map((message, index) => (
            <div
                key={messageRowKey(message)}
                data-message-id={message._id}
                className={animated.has(messageRowKey(message)) ? MESSAGE_ENTER_CLASS : undefined}
            >
                <Message
                    key={`${message._id}-${message.status}`}
                    message={message}
                    prevMessage={displayMessages[index + 1]}
                    nextMessage={displayMessages[index - 1]}
                    activeAccount={activeAccount}
                    activeAccountPk={activeAccountPk}
                    type={chatType}
                    hasMore={hasMore}
                    isFromTeam={isFromTeam}
                    onGoToMessage={onGoToMessage}
                />
            </div>
        ))}
    </>;
});

const MessageList = forwardRef<MessageListHandle, Props>(({ messages, hasMore, isLoadingMore, loadMore, chatId, chatType, isFromTeam, restoreScroll, onOpenAtBottom, initialTarget, topInset = 0 }, ref) => {
    const indicatorRef = useRef<ScrollIndicatorHandle>(null);
    const displayMessages = useMemo(() => [...messages].reverse(), [messages]); // oldest first
    const animated = useNewMessageAnimation(messages, chatId);
    const onOpenAtBottomRef = useRef(onOpenAtBottom);
    onOpenAtBottomRef.current = onOpenAtBottom;

    const scrollerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // latest values for async callbacks
    const messagesRef = useRef(messages);
    messagesRef.current = messages;
    const hasMoreRef = useRef(!!hasMore);
    hasMoreRef.current = !!hasMore;
    const loadMoreRef = useRef(loadMore);
    loadMoreRef.current = loadMore;

    const isLoading = useRef(false);
    const lastLoadEnd = useRef(0);
    const loadsWithoutProgress = useRef(0);
    const cooldownTimer = useRef<ReturnType<typeof setTimeout>>();

    // IntersectionObserver only fires on changes: re-observe to get a fresh callback for the current position
    const recheck = useCallback(() => {
        const observer = observerRef.current;
        const sentinel = sentinelRef.current;
        if (!observer || !sentinel) return;
        observer.unobserve(sentinel);
        observer.observe(sentinel);
    }, []);

    // loads older pages (one by default), resolves with whether it added messages
    const isLoadingMoreRef = useRef(isLoadingMore);
    isLoadingMoreRef.current = isLoadingMore;
    const loadOlderPage = useCallback(async (count = 1) => {
        isLoading.current = true;
        try {
            return await loadAndWait({
                load: () => loadMoreRef.current(count),
                getCount: () => messagesRef.current.length,
                isFetching: () => isLoadingMoreRef.current,
                timeoutMs: Math.min(LOAD_TIMEOUT_MS * count, 60000),
            });
        } finally {
            isLoading.current = false;
            lastLoadEnd.current = performance.now();
        }
    }, []);

    const onSentinel = useCallback(async (entry: IntersectionObserverEntry) => {
        if (!entry.isIntersecting) return;
        if (!hasMoreRef.current || isLoading.current) return;
        if (loadsWithoutProgress.current >= MAX_LOADS_WITHOUT_PROGRESS) return;

        const sinceLastLoad = performance.now() - lastLoadEnd.current;
        if (sinceLastLoad < LOAD_COOLDOWN_MS) {
            clearTimeout(cooldownTimer.current);
            cooldownTimer.current = setTimeout(recheck, LOAD_COOLDOWN_MS - sinceLastLoad);
            return;
        }

        const progressed = await loadOlderPage();
        if (progressed) {
            loadsWithoutProgress.current = 0;
        } else {
            loadsWithoutProgress.current++;
            if (loadsWithoutProgress.current >= MAX_LOADS_WITHOUT_PROGRESS) {
                console.warn("loading older messages made no progress, stop loading until new messages arrive");
            }
        }
        recheck(); // still within the margin (fast scroll): load the next page to stay ahead
    }, [loadOlderPage, recheck]);

    useEffect(() => {
        const root = scrollerRef.current;
        const sentinel = sentinelRef.current;
        if (!root || !sentinel) return;
        const observer = new IntersectionObserver(
            entries => { if (entries[0]) onSentinel(entries[0]); },
            { root, rootMargin: `${LOAD_MORE_MARGIN}px 0px 0px 0px` }
        );
        observerRef.current = observer;
        observer.observe(sentinel);
        return () => {
            observer.disconnect();
            observerRef.current = null;
            clearTimeout(cooldownTimer.current);
        };
    }, [onSentinel]);

    // the list changed (page loaded, new message, hasMore known): allow loading again and check the sentinel
    useEffect(() => {
        loadsWithoutProgress.current = 0;
        if (!isLoading.current) recheck();
    }, [hasMore, messages.length, recheck]);

    // per-chat scroll position, saved once scrolling settles
    useEffect(() => {
        const root = scrollerRef.current;
        if (!root) return;
        let idleTimer: ReturnType<typeof setTimeout> | undefined;
        const onScroll = () => {
            indicatorRef.current?.update(root.scrollTop, root.scrollHeight, root.clientHeight);
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                try {
                    sessionStorage.setItem(scrollKey(chatId), String(root.scrollTop));
                } catch (e) { }
            }, SCROLL_IDLE_MS);
        };
        root.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            root.removeEventListener('scroll', onScroll);
            clearTimeout(idleTimer);
        };
    }, [chatId]);

    // open at the saved position, or at the bottom (column-reverse: scrollTop 0)
    useLayoutEffect(() => {
        const root = scrollerRef.current;
        if (!root) return;
        let saved: number | null = null;
        try {
            saved = restoreScroll ? parseFloat(sessionStorage.getItem(scrollKey(chatId)) || '') : null;
        } catch (e) { }
        if (saved != null && saved < 0) {
            root.scrollTop = saved;
        } else {
            root.scrollTop = 0;
            onOpenAtBottomRef.current();
        }
    }, []);

    // Scroll corrections when messages are added, applied before paint. column-reverse keeps the offset from the bottom, except:
    // - new messages at the bottom push the content up while the user reads older messages
    // - when scrolled exactly to the top, chrome keeps the view pinned to the top when older messages are prepended,
    //   so the sentinel stays visible and pages would load in an endless loop
    const contentRef = useRef<HTMLDivElement>(null);
    const animatedRef = useRef(animated);
    animatedRef.current = animated;
    const prevNewestId = useRef(messages[0]?._id);
    const prevOldestId = useRef(messages[messages.length - 1]?._id);
    useLayoutEffect(() => {
        const root = scrollerRef.current;
        const previousNewest = prevNewestId.current;
        const previousOldest = prevOldestId.current;
        prevNewestId.current = messages[0]?._id;
        prevOldestId.current = messages[messages.length - 1]?._id;
        if (!root) return;
        const heightOf = (list: any[]) => list.reduce((sum, m) =>
            sum + ((root.querySelector(`[data-message-id="${m._id}"]`) as HTMLElement | null)?.offsetHeight || 0), 0);

        if (previousNewest && messages[0]?._id !== previousNewest) {
            const index = messages.findIndex(m => m._id === previousNewest);
            if (index > 0 && root.scrollTop < -1) {
                root.scrollTop -= heightOf(messages.slice(0, index));
            } else if (index > 0) {
                // at the bottom: the new rows pushed the list up, slide it up instead of jumping
                const fresh = messages.slice(0, index).filter(m => animatedRef.current.has(messageRowKey(m)));
                if (fresh.length > 0) slideListUp(contentRef.current, heightOf(fresh) + stopSlide(contentRef.current));
            }
        }

        if (previousOldest && messages[messages.length - 1]?._id !== previousOldest) {
            const pinnedToTop = root.scrollHeight - root.clientHeight + root.scrollTop <= 1;
            const index = messages.findIndex(m => m._id === previousOldest);
            if (pinnedToTop && index !== -1 && index < messages.length - 1) {
                root.scrollTop += heightOf(messages.slice(index + 1));
            }
        }
    }, [messages]);

    const scrollToBottom = useCallback(() => {
        const root = scrollerRef.current;
        if (root) root.scrollTop = 0;
    }, []);

    useImperativeHandle(ref, () => ({ scrollToBottom }), [scrollToBottom]);

    // scroll to a replied message / search result, loading older pages until it is rendered
    const goToToken = useRef(0);
    useEffect(() => () => { goToToken.current++; }, []); // cancel on unmount
    const goToMessage = useCallback(async (target: { _id: string; height: number }) => {
        const token = ++goToToken.current;
        await goToMessageShared({
            target,
            getMessages: () => messagesRef.current,
            hasMore: () => hasMoreRef.current,
            isBusy: () => isLoading.current,
            loadPages: loadOlderPage,
            isCancelled: () => token !== goToToken.current,
            root: () => scrollerRef.current,
            scrollTo: (id, allowSmooth) => {
                const root = scrollerRef.current;
                const el = root?.querySelector(`[data-message-id="${CSS.escape(id)}"]`);
                if (!root || !el) return false;
                // scrollIntoView is unreliable in a column-reverse scroller on webkit: set scrollTop to center it instead
                const box = root.getBoundingClientRect();
                const rect = el.getBoundingClientRect();
                const delta = (rect.top + rect.height / 2) - (box.top + box.height / 2);
                // smooth only when close: a long smooth scroll is slow on webkit and can be cut short by momentum
                const smooth = allowSmooth && Math.abs(delta) <= root.clientHeight * 3;
                root.scrollTo({ top: root.scrollTop + delta, behavior: smooth ? 'smooth' : 'auto' });
                return smooth ? 'smooth' : 'instant';
            },
        });
    }, [loadOlderPage]);

    // opened from a search result: go to that message once the chat is loaded
    const initialTargetDone = useRef<string | null>(null);
    useEffect(() => {
        if (!initialTarget?._id || initialTargetDone.current === initialTarget._id || messages.length === 0) return;
        const timer = setTimeout(() => { // let the chat open (initial scroll to the bottom) first
            initialTargetDone.current = initialTarget._id;
            goToMessage(initialTarget);
        }, 100);
        return () => clearTimeout(timer);
    }, [initialTarget?._id, messages.length > 0, goToMessage]);

    return (
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
        <ScrollIndicator ref={indicatorRef} top={topInset} reversed />
        <div
            ref={scrollerRef}
            id="scrollableDiv"
            className="scroll-under-header"
            style={{
                height: '100%',
                width: '100%',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column-reverse',
                // column-reverse already keeps the position when older messages are prepended; chrome's scroll anchoring
                // on top of it kept the view pinned at the top, which made pages load in an endless loop
                overflowAnchor: 'none',
            }}
        >
            <div ref={contentRef} style={{ display: 'flex', flexDirection: 'column', userSelect: 'none', paddingBottom: 28.4, paddingTop: 'var(--chat-header-height, 0px)' }}>
                <div ref={sentinelRef} style={{ height: 1 }} />
                {hasMore && isLoadingMore && (
                    <div style={{ display: "flex", justifyContent: "center", marginTop: 32, marginBottom: 32 }}>
                        <SpinLoading />
                    </div>
                )}
                <MessageRows
                    displayMessages={displayMessages}
                    chatType={chatType}
                    isFromTeam={isFromTeam}
                    hasMore={hasMore}
                    onGoToMessage={goToMessage}
                    animated={animated}
                />
            </div>
        </div>
        </div>
    );
});

export default memo(MessageList);
