import { Capacitor, PluginListenerHandle, registerPlugin } from "@capacitor/core";
import { Modal } from "antd-mobile";
import { useEffect, useRef, useState } from "react";
import i18n from "../i18n";

interface SensitiveScreenPlugin {
  enable(): Promise<void>;
  disable(): Promise<void>;
  addListener(eventName: "screenshotTaken", listener: (data: { blocked: boolean }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: "captureChanged", listener: (data: { captured: boolean }) => void): Promise<PluginListenerHandle>;
}

const SensitiveScreen = registerPlugin<SensitiveScreenPlugin>("SensitiveScreen");

const platform = Capacitor.getPlatform();
const isSupported = platform === "android" || platform === "ios";

// Module-level state so the alert is shown once even when several sensitive components are mounted.
let screenshotAlertOpen = false;
let captured = false;
const screenshotListeners = new Set<() => void>();
const captureListeners = new Set<(captured: boolean) => void>();

if (isSupported) {
  // Android: the screenshot was blocked by FLAG_SECURE (event only available on Android 14+).
  // iOS: screenshots can't be blocked, the image is already saved in Photos.
  SensitiveScreen.addListener("screenshotTaken", ({ blocked }) => {
    screenshotListeners.forEach((listener) => listener());
    if (screenshotAlertOpen) return;
    screenshotAlertOpen = true;
    Modal.alert({
      title: i18n.t(blocked ? "screenshotBlocked" : "screenshotDetected"),
      content: i18n.t(blocked ? "screenshotBlockedWarning" : "screenshotDetectedWarning"),
      confirmText: i18n.t("iUnderstand"),
      onClose: () => {
        screenshotAlertOpen = false;
      },
    });
  }).catch((e) => console.error("SensitiveScreen.addListener failed", e));

  // iOS only: screen is being recorded or mirrored.
  SensitiveScreen.addListener("captureChanged", (data) => {
    captured = data.captured;
    captureListeners.forEach((listener) => listener(captured));
  }).catch((e) => console.error("SensitiveScreen.addListener failed", e));
}

// While mounted (and active), protects the screen displaying wallet secrets:
// - Android: blocks screenshots/recording, hides content from non-tool AccessibilityServices,
//   and explains to the user why the screenshot was blocked.
// - iOS: warns the user after a screenshot and reports screen recording/mirroring.
// Returns whether the screen is currently being captured (iOS), so secrets can be hidden.
export function useSensitiveScreen({ active = true, onScreenshot }: { active?: boolean; onScreenshot?: () => void } = {}) {
  const [isCaptured, setIsCaptured] = useState(captured);
  const onScreenshotRef = useRef(onScreenshot);
  onScreenshotRef.current = onScreenshot;

  useEffect(() => {
    if (!active || !isSupported) return;
    const screenshotListener = () => onScreenshotRef.current?.();
    screenshotListeners.add(screenshotListener);
    captureListeners.add(setIsCaptured);
    SensitiveScreen.enable().catch((e) => console.error("SensitiveScreen.enable failed", e));
    return () => {
      screenshotListeners.delete(screenshotListener);
      captureListeners.delete(setIsCaptured);
      SensitiveScreen.disable().catch((e) => console.error("SensitiveScreen.disable failed", e));
    };
  }, [active]);

  return { isCaptured: active && isCaptured };
}
