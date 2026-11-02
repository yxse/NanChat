import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImpactStyle } from "@capacitor/haptics";
import ProfilePicture from "../messaging/components/profile/ProfilePicture";
import { HapticsImpact } from "../../utils/haptic";
import { InAppNotificationData, setInAppNotificationListener } from "../../utils/in-app-notification";

const AUTO_HIDE_MS = 4500;
const DISMISS_DRAG_PX = 30;

// Native-like banner sliding from the top, shown with showInAppNotification() while the app is open
// (new message push, crypto received). Tap opens its url, swipe up dismisses, auto hides after a few seconds.
const InAppNotification: React.FC<{
  onOpen: (notification: InAppNotificationData) => void;
}> = ({ onOpen }) => {
  const [notification, setNotification] = useState<InAppNotificationData | null>(null);
  const [visible, setVisible] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const hide = () => {
    clearTimeout(timer.current);
    setVisible(false);
    setTimeout(() => setNotification(null), 250); // wait for the slide out animation
  };

  useEffect(() => {
    setInAppNotificationListener(setNotification);
    return () => setInAppNotificationListener(null);
  }, []);

  const scheduleHide = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(hide, AUTO_HIDE_MS);
  };

  useEffect(() => {
    if (!notification) return;
    setDragY(0);
    // next frame so the slide in transition runs when mounting
    requestAnimationFrame(() => setVisible(true));
    HapticsImpact({ style: ImpactStyle.Light });
    scheduleHide();
    return () => clearTimeout(timer.current);
  }, [notification?.id]);

  if (!notification) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    clearTimeout(timer.current); // keep it while the user holds it
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current == null) return;
    const delta = e.clientY - startY.current;
    setDragY(delta < 0 ? delta : delta / 4); // resist pulling down
  };
  const onPointerUp = () => {
    if (startY.current == null) return;
    startY.current = null;
    if (dragY < -DISMISS_DRAG_PX) {
      hide();
    } else if (Math.abs(dragY) < 5) {
      hide();
      onOpen(notification);
    } else {
      setDragY(0);
      scheduleHide();
    }
  };

  const dragging = startY.current != null;
  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        display: "flex",
        justifyContent: "center",
        paddingTop: "calc(var(--safe-area-inset-top, 0px) + 8px)",
        paddingLeft: 8,
        paddingRight: 8,
        pointerEvents: "none",
      }}
    >
      <div
        role="alert"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          pointerEvents: "auto",
          touchAction: "none",
          userSelect: "none",
          cursor: "pointer",
          width: "100%",
          maxWidth: 420,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          borderRadius: 20,
          background: "color-mix(in srgb, var(--adm-color-background) 82%, transparent)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "0.5px solid var(--adm-color-border)",
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.18)",
          transform: visible ? `translateY(${dragY}px)` : "translateY(calc(-100% - 60px))",
          opacity: visible ? 1 : 0,
          transition: dragging
            ? "none"
            : "transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.15), opacity 0.25s ease",
        }}
      >
        <div style={{ flexShrink: 0 }}>
          {notification.address ? (
            <ProfilePicture address={notification.address} width={38} clickable={false} />
          ) : (
            <img src={notification.icon || "/icons/nanchat.svg"} width={38} height={38} style={{ borderRadius: 10 }} alt="" />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 15,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--adm-color-text)",
            }}
          >
            {notification.title}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "var(--adm-color-text-secondary)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
            }}
          >
            {notification.body}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export { showInAppNotification } from "../../utils/in-app-notification";
export default InAppNotification;
