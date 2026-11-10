import { Capacitor, registerPlugin } from "@capacitor/core";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const IS_IOS = Capacitor.getPlatform() === "ios";

interface ScrollIndicatorInsetsPlugin {
    setTopInset(options: { x: number; y: number; width: number; height: number; top: number }): Promise<{ found: boolean }>;
}
const ScrollIndicatorInsets = registerPlugin<ScrollIndicatorInsetsPlugin>("ScrollIndicatorInsets");

// iOS app binaries shipping the native plugin (MyViewController.swift) inset the real indicator. Older binaries
// fall back to an indicator drawn in html, with the native one hidden (body.custom-scroll-indicator in app.css)
const NATIVE = IS_IOS && Capacitor.isPluginAvailable("ScrollIndicatorInsets");
if (IS_IOS && !NATIVE) {
    document.body.classList.add("custom-scroll-indicator");
}
// throttle of the native calls while scrolling
const NATIVE_APPLY_INTERVAL_MS = 300;

export type ScrollIndicatorHandle = {
    /** call on every scroll of the list it represents */
    update: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
};

/**
 * Scroll indicator starting below the glass header (`top`) of the lists scrolling behind it, on iOS (elsewhere the
 * native scrollbar is inset with ::-webkit-scrollbar-track, see .scroll-under-header in app.css).
 * The iOS indicator of an overflow element spans the whole element and css cannot inset it:
 * - native: the UIScrollView WebKit creates for the scroller (the `.scroll-under-header` element in the same
 *   positioned parent) gets its indicator inset. Re-applied while scrolling, as WebKit only creates that view
 *   once the element overflows and may recreate it.
 * - fallback: an indicator drawn in html. Updates the DOM directly, no re-render on scroll.
 * `reversed`: flex column-reverse scroller (scrollTop is 0 at the bottom and negative upward).
 */
export const ScrollIndicator = forwardRef<ScrollIndicatorHandle, { top: number; bottom?: number; reversed?: boolean }>(
    ({ top, bottom = 0, reversed = false }, ref) => {
        const thumbRef = useRef<HTMLDivElement>(null);
        const hideTimer = useRef<ReturnType<typeof setTimeout>>();
        const insets = useRef({ top, bottom, reversed });
        insets.current = { top, bottom, reversed };

        // native mode
        const lastApply = useRef(0);
        const trailingApply = useRef<ReturnType<typeof setTimeout>>();
        const applyNative = useRef(() => {
            lastApply.current = Date.now();
            const scroller = thumbRef.current?.parentElement?.querySelector<HTMLElement>(".scroll-under-header");
            if (!scroller) return;
            const rect = scroller.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            ScrollIndicatorInsets.setTopInset({
                x: rect.left + window.scrollX,
                y: rect.top + window.scrollY,
                width: rect.width,
                height: rect.height,
                top: insets.current.top,
            }).catch(() => { });
        });
        const scheduleNative = useRef(() => {
            clearTimeout(trailingApply.current);
            const wait = NATIVE_APPLY_INTERVAL_MS - (Date.now() - lastApply.current);
            if (wait <= 0) applyNative.current();
            else trailingApply.current = setTimeout(applyNative.current, wait);
        });

        useEffect(() => {
            if (!NATIVE) return;
            // after layout: the header height is measured in an effect, the list may still be settling
            const timer = setTimeout(applyNative.current, 50);
            return () => clearTimeout(timer);
        }, [top]);

        useImperativeHandle(ref, () => ({
            update(scrollTop, scrollHeight, clientHeight) {
                if (NATIVE) {
                    scheduleNative.current();
                    return;
                }
                const thumb = thumbRef.current;
                if (!thumb) return;
                const max = scrollHeight - clientHeight;
                if (max <= 1) {
                    thumb.style.opacity = "0";
                    return;
                }
                const { top, bottom, reversed } = insets.current;
                const offset = Math.min(max, Math.max(0, reversed ? max + scrollTop : scrollTop));
                const track = clientHeight - top - bottom;
                const thumbHeight = Math.max(36, track * (clientHeight / scrollHeight));
                const y = top + (track - thumbHeight) * (offset / max);
                thumb.style.height = `${thumbHeight}px`;
                thumb.style.transform = `translateY(${y}px)`;
                thumb.style.transition = "opacity 0.1s";
                thumb.style.opacity = "1";
                clearTimeout(hideTimer.current);
                hideTimer.current = setTimeout(() => {
                    thumb.style.transition = "opacity 0.4s";
                    thumb.style.opacity = "0";
                }, 700);
            },
        }), []);

        useEffect(() => () => {
            clearTimeout(hideTimer.current);
            clearTimeout(trailingApply.current);
        }, []);

        if (!IS_IOS) return null;
        // native: only an anchor to find the scroller next to it
        if (NATIVE) return <div ref={thumbRef} aria-hidden style={{ display: "none" }} />;
        return (
            <div
                ref={thumbRef}
                aria-hidden
                style={{
                    position: "absolute",
                    top: 0,
                    right: 3,
                    width: 3,
                    borderRadius: 3,
                    backgroundColor: "rgba(218, 218, 218, 0.55)", // neutral gray, readable on light and dark themes
                    pointerEvents: "none",
                    zIndex: 11, // above the glass header
                    willChange: "transform, opacity",
                }}
            />
        );
    }
);
