import { useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';

// "Pop up from the bottom" animation for messages sent / received while the chat is open (see .message-enter in app.css).
//
// Only messages that show up at the newest end of an already loaded list animate: not the first page, not older pages,
// not a refetch that brings many messages at once, not a switch to another chat.
// The ids are computed during render so the class is there on the very first paint of the new row (no flash), and
// they expire after the animation so a row virtua unmounts and mounts again while scrolling does not replay it.

export const MESSAGE_ENTER_MS = 200; // keep in sync with .message-enter in app.css
const MAX_ANIMATED = 3; // more new messages at once (reconnect / refetch): show them without animation

// a sent message is replaced by its server copy (new _id) when the server acknowledges it: `localId` keeps the row
// key and the animation going across that swap
export const messageRowKey = (message: any): string => message.localId ?? message._id;

export function useNewMessageAnimation(messages: any[], chatId: string | undefined): Set<string> {
    const prev = useRef<{ chatId: string | undefined; ids: Set<string> } | null>(null);
    const active = useRef(new Map<string, number>()); // row key -> time its animation ends
    const [version, expire] = useReducer((x: number) => x + 1, 0);

    const animated = useMemo(() => {
        const p = prev.current;
        if (p && p.chatId !== chatId) active.current.clear();
        if (p && p.chatId === chatId && p.ids.size > 0) {
            const fresh: string[] = [];
            for (const m of messages) { // newest first
                if (p.ids.has(m._id) || (m.localId && p.ids.has(m.localId))) break;
                fresh.push(messageRowKey(m));
            }
            if (fresh.length <= MAX_ANIMATED) {
                const until = performance.now() + MESSAGE_ENTER_MS;
                for (const key of fresh) active.current.set(key, until);
            }
        }
        const now = performance.now();
        for (const [key, until] of active.current) if (until <= now) active.current.delete(key);
        return new Set(active.current.keys());
    }, [messages, chatId, version]);

    useLayoutEffect(() => {
        const ids = new Set<string>();
        for (const m of messages) {
            ids.add(m._id);
            if (m.localId) ids.add(m.localId);
        }
        prev.current = { chatId, ids };
    }, [messages, chatId]);

    // drop the class once done (re-render), so a remounted row does not animate again
    useEffect(() => {
        if (animated.size === 0) return;
        const timer = setTimeout(expire, MESSAGE_ENTER_MS + 50);
        return () => clearTimeout(timer);
    }, [animated]);

    return animated;
}

export const MESSAGE_ENTER_CLASS = 'message-enter'; // fades the new row in, the slide is done by slideListUp

// How far down the list content is currently drawn by a running slide (0 if none).
// The transform also grows the scroller's scrollHeight by this much: subtract it when checking for / scrolling to the
// bottom, otherwise the list looks scrolled up during a slide and stops sticking to the bottom.
export function slideOffset(content: Element | null | undefined): number {
    if (!(content instanceof HTMLElement) || content.getAnimations().length === 0) return 0;
    const transform = getComputedStyle(content).transform;
    return transform && transform !== 'none' ? new DOMMatrixReadOnly(transform).m42 : 0;
}

// Stops a running slide, returns how far down the content was still drawn (to continue from there).
export function stopSlide(content: Element | null | undefined): number {
    const offset = slideOffset(content);
    if (content instanceof HTMLElement) content.getAnimations().forEach(a => a.cancel());
    return offset;
}

// The list just jumped up to make room for new rows at the bottom: draw its content `distance` px lower and slide it
// back, so the older messages scroll up smoothly while the new one rises from the bottom.
// Call before paint, in the same frame as the jump. To continue a running slide, stop it first (before measuring the
// jump, see slideOffset) and add what was left of it to the distance.
export function slideListUp(content: Element | null | undefined, distance: number) {
    if (!(content instanceof HTMLElement) || !(distance > 0)) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    content.animate(
        [{ transform: `translateY(${distance}px)` }, { transform: 'translateY(0)' }],
        { duration: MESSAGE_ENTER_MS, easing: 'linear' },
    );
}
