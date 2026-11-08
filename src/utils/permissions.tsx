import { Capacitor } from "@capacitor/core";
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { Modal, Toast } from "antd-mobile";
import i18n from "i18next";
import type { CSSProperties } from "react";

export type MediaPermission = "camera" | "microphone";
export type PermissionPurpose = "scan" | "call" | "videoCall" | "voiceMessage";

const DESCRIPTION_KEY: Record<PermissionPurpose, string> = {
    scan: "permissionScanDesc",
    call: "permissionCallDesc",
    videoCall: "permissionVideoCallDesc",
    voiceMessage: "permissionVoiceMessageDesc",
};

// Opens the app page of the OS settings (Android and iOS).
// The barcode scanner plugin exposes it, no need for an extra plugin.
export const openAppSettings = () => BarcodeScanner.openSettings();

// Once denied, the OS never shows the permission prompt again: the only way
// back is the app settings, so explain it instead of failing silently.
export const showPermissionDenied = (permission: MediaPermission, purpose: PermissionPurpose) => {
    const t = i18n.t.bind(i18n);
    const native = Capacitor.isNativePlatform();
    Modal.show({
        closeOnMaskClick: true,
        closeOnAction: true,
        // above the call screen (z-index 2000)
        style: { "--z-index": "3000" } as CSSProperties,
        title: t(permission === "camera" ? "permissionCameraTitle" : "permissionMicrophoneTitle"),
        content: (
            <div className="text-center text-sm" style={{ color: "var(--adm-color-text-secondary)" }}>
                {t(DESCRIPTION_KEY[purpose])}
                <div className="mt-2">{t(native ? "permissionSettingsHint" : "permissionBrowserHint")}</div>
            </div>
        ),
        actions: native
            ? [
                  { key: "settings", text: t("openSettings"), primary: true, onClick: () => openAppSettings() },
                  { key: "cancel", text: t("cancel") },
              ]
            : [{ key: "close", text: t("close") }],
    });
};

// getUserMedia rejects with NotAllowedError when the user (or the OS) refused access
export const isPermissionError = (error: any) =>
    error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError" || error?.name === "SecurityError";

// Camera permission for the native QR code scanner. Returns true when the scan can start.
export const ensureScannerCameraPermission = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return true; // the browser prompts on startScan
    try {
        const { camera } = await BarcodeScanner.checkPermissions();
        if (camera === "granted" || camera === "limited") return true;
        // "denied" means the OS won't prompt anymore (permanently denied on Android, any denial on iOS)
        if (camera === "denied") {
            showPermissionDenied("camera", "scan");
            return false;
        }
        const result = await BarcodeScanner.requestPermissions();
        if (result.camera === "granted" || result.camera === "limited") return true;
        // the user just refused the system prompt: don't push the settings right away
        Toast.show({ content: i18n.t("permissionScanDesc"), icon: "fail" });
        return false;
    } catch (error) {
        console.error("camera permission check failed", error);
        return true; // let startScan try and report its own error
    }
};
