import { LIMIT_MESSAGES } from './utils';

// Shared "go to message" logic of the message lists (reply quote click, search result):
// 1. load older pages until the message is loaded (if it no longer exists, e.g. deleted, use the closest one)
// 2. scroll to it, highlight it as soon as it is on screen
// 3. keep it in view while the messages around it settle: their sizes were only estimated (virtualized list) and
//    their images load afterwards, both can push it away. Stops as soon as the user touches the list.

const MAX_PAGES_PER_BATCH = 10; // heights are not consecutive: the page estimate is an upper bound, cap the overshoot
const IDLE_GRACE_MS = 1500; // a load whose fetch stopped this long ago without adding messages: nothing more to load
const CHECK_MS = 100; // position check interval while settling
const SMOOTH_MS = 500; // a smooth scroll is left alone this long before correcting it
const SETTLE_CHECKS = 3; // done once in view for this many checks in a row
const SETTLE_MAX_MS = 3000;

const nextFrame = () => new Promise(r => requestAnimationFrame(() => r(null)));
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Asks for older pages and waits until they are actually shown. The promise of the load (SWR setSize) is not enough:
// while another revalidation of the chat is in flight (e.g. right after opening it, which is when a search result
// jumps) it resolves right away and the pages only arrive with that revalidation.
// Resolves with whether messages were added.
export async function loadAndWait({ load, getCount, isFetching, timeoutMs }: {
    load: () => Promise<unknown>;
    getCount: () => number;
    isFetching: () => boolean;
    timeoutMs: number;
}) {
    const before = getCount();
    const start = performance.now();
    let settled = false;
    load().catch(error => console.log("cannot load next page", error)).finally(() => { settled = true; });
    let idleSince: number | null = null;
    while (performance.now() - start < timeoutMs) {
        await nextFrame();
        if (getCount() > before) {
            await nextFrame(); // let the list render them
            return true;
        }
        if (settled && !isFetching()) {
            idleSince ??= performance.now();
            if (performance.now() - idleSince >= IDLE_GRACE_MS) return false;
        } else idleSince = null;
    }
    return getCount() > before;
}

type LoadOptions = {
    target: { _id: string; height?: number };
    getMessages: () => any[]; // loaded messages, newest first (latest render)
    hasMore: () => boolean;
    isBusy: () => boolean; // another page load is in progress
    loadPages: (count: number) => Promise<boolean>; // resolves with whether messages were added
    isCancelled: () => boolean; // a newer go-to started, or the list unmounted
};

// id of the loaded message closest to `height` (the newer one on a tie)
const closestByHeight = (messages: any[], height: number): string | null => {
    let best: any = null;
    for (const m of messages) {
        if (!Number.isInteger(m?.height)) continue;
        const d = Math.abs(m.height - height);
        const bestD = best ? Math.abs(best.height - height) : Infinity;
        if (d < bestD || (d === bestD && m.height > best.height)) best = m;
    }
    return best?._id ?? null;
};

// loads pages until the target is in the list, resolves with the id to go to (the target or its closest replacement)
async function loadUntilLoaded({ target, getMessages, hasMore, isBusy, loadPages, isCancelled }: LoadOptions) {
    const height = Number.isInteger(target.height) && target.height! > 0 ? target.height! : null;
    while (!isCancelled()) {
        const messages = getMessages();
        if (messages.some(m => m._id === target._id)) return target._id;
        if (height == null) return null; // unknown position: cannot tell which page holds it
        if (isBusy()) { // a scroll-triggered load is in progress: wait for it, then check again
            await nextFrame();
            continue;
        }
        const oldest = messages[messages.length - 1]?.height;
        if (!Number.isInteger(oldest) || oldest <= height || !hasMore()) return closestByHeight(messages, height);
        const pages = Math.min(MAX_PAGES_PER_BATCH, Math.ceil((oldest - height) / LIMIT_MESSAGES));
        if (!await loadPages(pages)) return null;
    }
    return null;
}

const highlight = (el: Element) => {
    el.classList.remove('message-highlight');
    void (el as HTMLElement).offsetWidth; // restart the animation if it was already highlighted
    el.classList.add('message-highlight');
    el.addEventListener('animationend', () => el.classList.remove('message-highlight'), { once: true });
};

// resolves once done: in view, given up, cancelled, or the user took over
export async function goToMessage({ root, scrollTo, ...options }: LoadOptions & {
    root: () => HTMLElement | null;
    // centers the message, smoothly if allowed and close by. 'smooth' / 'instant': how it scrolled, false: not in the list
    scrollTo: (messageId: string, allowSmooth: boolean) => false | 'instant' | 'smooth';
}) {
    const id = await loadUntilLoaded(options);
    const scroller = root();
    if (!id || !scroller || options.isCancelled()) return;
    const scrolled = scrollTo(id, true);
    if (!scrolled) return;

    let userScrolled = false;
    const onUser = () => { userScrolled = true; };
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    events.forEach(e => scroller.addEventListener(e, onUser, { passive: true }));
    try {
        const start = performance.now();
        let highlighted = false;
        let inView = 0;
        await nextFrame();
        while (!userScrolled && !options.isCancelled() && performance.now() - start < SETTLE_MAX_MS) {
            const el = scroller.querySelector(`[data-message-id="${CSS.escape(id)}"]`);
            const box = scroller.getBoundingClientRect();
            const rect = el?.getBoundingClientRect();
            // at least half of it shown (or half of the view, for a message taller than it)
            const visible = !!rect && Math.min(rect.bottom, box.bottom) - Math.max(rect.top, box.top) >= Math.min(rect.height, box.height) / 2;
            if (visible && !highlighted) {
                highlight(el!);
                highlighted = true;
            }
            if (visible) {
                if (++inView >= SETTLE_CHECKS) break;
            } else if (scrolled === 'instant' || performance.now() - start >= SMOOTH_MS) {
                scrollTo(id, false); // not rendered yet, or pushed away by the messages around it settling
                inView = 0;
            }
            await sleep(CHECK_MS);
        }
    } finally {
        events.forEach(e => scroller.removeEventListener(e, onUser));
    }
}
