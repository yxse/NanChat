import { useCallback, useRef, useState } from "react";

/**
 * Tracks the rendered height of an element (callback ref, so it also works for an element mounted conditionally).
 * Used by the translucent headers overlaying a scroll list, the list reserves this height as top padding.
 */
export function useElementHeight<T extends HTMLElement = HTMLDivElement>() {
    const [height, setHeight] = useState(0);
    const observer = useRef<ResizeObserver | null>(null);
    const ref = useCallback((node: T | null) => {
        observer.current?.disconnect();
        observer.current = null;
        if (!node) {
            setHeight(0);
            return;
        }
        const update = () => setHeight(node.offsetHeight);
        update();
        observer.current = new ResizeObserver(update);
        observer.current.observe(node);
    }, []);
    return [ref, height] as const;
}
