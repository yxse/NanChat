import { SpinLoading } from 'antd-mobile';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import Message from '../Message';
import { useWallet } from '../../../useWallet';
import { LIMIT_MESSAGES } from '../../utils';

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

const nextFrame = () => new Promise(r => requestAnimationFrame(() => r(null)));
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
    loadMore: () => Promise<unknown>;
    chatId: string;
    chatType: string | undefined;
    isFromTeam: boolean;
    restoreScroll: boolean; // restore the last scroll position of this chat instead of opening at the bottom
    onOpenAtBottom: () => void; // called on mount when the chat opens at the bottom (used to trim loaded pages)
};

// separate memoized rows so that toggling the loading spinner does not re-render them
const MessageRows = memo(({ displayMessages, chatType, isFromTeam, hasMore, onGoToMessage }: {
    displayMessages: any[], chatType: string | undefined, isFromTeam: boolean, hasMore: boolean | undefined,
    onGoToMessage: (replyMessage: { _id: string; height: number }) => void,
}) => {
    const { activeAccount, activeAccountPk } = useWallet();
    return <>
        {displayMessages.map((message, index) => (
            <div key={message._id} data-message-id={message._id}>
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

const MessageList = forwardRef<MessageListHandle, Props>(({ messages, hasMore, isLoadingMore, loadMore, chatId, chatType, isFromTeam, restoreScroll, onOpenAtBottom }, ref) => {
    const displayMessages = useMemo(() => [...messages].reverse(), [messages]); // oldest first
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

    // loads one older page, resolves with whether it added messages
    const loadOlderPage = useCallback(async () => {
        const countBefore = messagesRef.current.length;
        isLoading.current = true;
        try {
            await Promise.race([loadMoreRef.current(), new Promise(r => setTimeout(r, LOAD_TIMEOUT_MS))]);
            await nextFrame(); // let React commit the new page
        } catch (error) {
            console.log("cannot load next page", error);
        } finally {
            isLoading.current = false;
            lastLoadEnd.current = performance.now();
        }
        return messagesRef.current.length > countBefore;
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

        if (previousNewest && messages[0]?._id !== previousNewest && root.scrollTop < -1) {
            const index = messages.findIndex(m => m._id === previousNewest);
            if (index > 0) root.scrollTop -= heightOf(messages.slice(0, index));
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

    // scroll to a replied message, loading older pages until it is rendered
    const goToMessage = useCallback(async (replyMessage: { _id: string; height: number }) => {
        const scrollToElement = () => {
            const el = scrollerRef.current?.querySelector(`[data-message-id="${replyMessage._id}"]`);
            if (!el) return false;
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    observer.disconnect();
                    el.classList.add('message-highlight');
                    el.addEventListener('animationend', () => el.classList.remove('message-highlight'), { once: true });
                }
            }, { threshold: 0.5 });
            observer.observe(el);
            setTimeout(() => observer.disconnect(), 8000);
            return true;
        };

        if (scrollToElement()) return;

        const current = messagesRef.current;
        const lowestLoadedHeight = current[current.length - 1]?.height;
        if (!lowestLoadedHeight || !replyMessage.height || replyMessage.height >= lowestLoadedHeight) return;

        const pagesToLoad = Math.ceil((lowestLoadedHeight - replyMessage.height) / LIMIT_MESSAGES) + 1;
        for (let i = 0; i < pagesToLoad && hasMoreRef.current; i++) {
            while (isLoading.current) await nextFrame(); // wait for a sentinel load in progress
            const progressed = await loadOlderPage();
            if (scrollToElement() || !progressed) return;
        }
    }, [loadOlderPage]);

    return (
        <div
            ref={scrollerRef}
            id="scrollableDiv"
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
            <div style={{ display: 'flex', flexDirection: 'column', userSelect: 'none', paddingBottom: 28.4 }}>
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
                />
            </div>
        </div>
    );
});

export default memo(MessageList);
