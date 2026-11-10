import { Button, Modal } from "antd-mobile";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUpdateRequired, onUpdateRequired } from "../../utils/client-version";
import { getUpdateChannel, openExternal, openStoreListing, UpdateChannel } from "../../utils/app-update";
import { TauriUpdateProgress, useLatestApk, useTauriUpdate } from "./desktop/UpdateButton";

// Shown when the backend refuses this app version (426 on HTTP, or a socket handshake refusal):
// messages are no longer delivered until the user updates. "Later" hides it for this session only.
export const UpdateRequiredModal = () => {
  const [state, setState] = useState(getUpdateRequired);
  const [dismissed, setDismissed] = useState(false);
  const [channel, setChannel] = useState<UpdateChannel | null>(null);

  useEffect(() => onUpdateRequired(setState), []);
  useEffect(() => {
    if (state.required) getUpdateChannel().then(setChannel);
  }, [state.required]);

  const visible = state.required && !dismissed && channel !== null;
  return (
    <Modal
      visible={visible}
      closeOnMaskClick={false}
      destroyOnClose
      content={visible && <UpdateRequiredContent channel={channel} minVersion={state.minVersion} onLater={() => setDismissed(true)} />}
    />
  );
};

const UpdateRequiredContent = ({ channel, minVersion, onLater }: { channel: UpdateChannel; minVersion?: string; onLater: () => void }) => {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{t("updateRequiredTitle", "Update required")}</div>
      <div style={{ color: "var(--adm-color-text-secondary)", fontSize: 14 }}>
        {minVersion
          ? t("updateRequiredDescriptionVersion", "This version of NanChat is no longer supported. Update to {{version}} or later to keep receiving messages.", { version: minVersion })
          : t("updateRequiredDescription", "This version of NanChat is no longer supported. Update to keep receiving messages.")}
      </div>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
        {channel === "tauri" ? <TauriAction /> : channel === "apk" ? <ApkAction /> : <StoreAction channel={channel} />}
        <Button block fill="none" onClick={onLater}>{t("later", "Later")}</Button>
      </div>
    </div>
  );
};

const TauriAction = () => {
  const { t } = useTranslation();
  const { update, status, progress, error, install } = useTauriUpdate();
  if (status === "downloading" || status === "installing" || status === "ready") {
    return <TauriUpdateProgress status={status} progress={progress} />;
  }
  return (
    <>
      <Button block color="primary" loading={status === "checking"} disabled={!update && status !== "checking"} onClick={install}>
        {update ? t("updateAvailable", "Update to {{version}}", { version: update.version }) : t("update", "Update")}
      </Button>
      {!update && status !== "checking" && <StoreAction channel="tauri" label={t("downloadLatestVersion", "Download latest version")} />}
      {error && <div style={{ color: "var(--adm-color-danger)", fontSize: 12 }}>{error}</div>}
    </>
  );
};

const ApkAction = () => {
  const { t } = useTranslation();
  const apk = useLatestApk();
  if (!apk) return <StoreAction channel="apk" label={t("downloadLatestVersion", "Download latest version")} />;
  return (
    <>
      <Button block color="primary" onClick={() => openExternal(apk.url)}>
        {t("downloadApk", "Download APK {{version}}", { version: apk.version })}
      </Button>
      <div style={{ color: "var(--adm-color-text-secondary)", fontSize: 12 }}>
        {t("downloadApkHint", "Open the downloaded file to install the update. Your wallet and chats are kept.")}
      </div>
    </>
  );
};

const StoreAction = ({ channel, label }: { channel: UpdateChannel; label?: string }) => {
  const { t } = useTranslation();
  const defaultLabel = channel === "play" ? t("openGooglePlay", "Update on Google Play")
    : channel === "appstore" ? t("openAppStore", "Update on the App Store")
    : channel === "web" ? t("reload", "Reload")
    : t("update", "Update");
  return (
    <Button block color={label ? "default" : "primary"} onClick={() => openStoreListing(channel)}>
      {label ?? defaultLabel}
    </Button>
  );
};
