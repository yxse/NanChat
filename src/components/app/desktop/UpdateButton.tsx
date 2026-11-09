import { Button, ProgressBar } from "antd-mobile";
import { DownlandOutline } from "antd-mobile-icons";
import { useCallback, useEffect, useState } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { useTranslation } from "react-i18next";
import { openInBrowser } from "../../messaging/utils";
import { isTauri } from "@tauri-apps/api/core";
import { APP_VERSION } from "../../../utils/client-version";
import { ApkRelease, getLatestApk, getUpdateChannel, isNewerVersion, openExternal, RELEASES_URL } from "../../../utils/app-update";

type UpdateStatus = "idle" | "checking" | "downloading" | "installing" | "ready";

// Shown in the sidebar / profile: desktop (Tauri updater) and Android APK installs (GitHub releases).
export const UpdateButton = () => {
  const [apk, setApk] = useState(false);
  useEffect(() => {
    if (!isTauri()) getUpdateChannel().then((c) => setApk(c === "apk"));
  }, []);
  if (isTauri()) return <TauriUpdateButton />;
  if (apk) return <ApkUpdateButton />;
  return null;
};

export const useTauriUpdate = () => {
  const [update, setUpdate] = useState<Update | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVersion().then((v) => { if (!cancelled) setCurrentVersion(v); });
    setStatus("checking");
    check()
      .then((result) => {
        if (!cancelled) {
          setUpdate(result);
          setStatus("idle");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Update check failed:", err);
          setStatus("idle");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const install = useCallback(async () => {
    if (!update) return;
    setError(null);
    setStatus("downloading");
    setProgress(0);

    try {
      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case "Finished":
            setProgress(100);
            setStatus("installing");
            break;
        }
      });

      setStatus("ready");
      await relaunch();
    } catch (err) {
      console.error("Update failed:", err);
      setError(String(err));
      setStatus("idle");
    }
  }, [update]);

  return { update, currentVersion, status, progress, error, install };
};

export const TauriUpdateProgress = ({ status, progress }: { status: UpdateStatus; progress: number }) => {
  const { t } = useTranslation();
  return (
    <div style={{ padding: "8px 12px", width: "100%" }}>
      <div style={{ fontSize: 13, marginBottom: 4 }}>
        {status === "downloading"
          ? t("downloading", "Downloading update…")
          : status === "installing"
            ? t("installing", "Installing…")
            : t("relaunching", "Relaunching…")}
      </div>
      <ProgressBar
        percent={progress}
        style={{
          "--fill-color": "var(--adm-color-primary, #1677ff)",
          "--track-width": "6px",
        }}
      />
    </div>
  );
};

const VersionLabel = ({ version }: { version: string }) => (
  <div
    onClick={() => openInBrowser(RELEASES_URL, "NanChat releases")}
    style={{ padding: "8px 12px", fontSize: 12, opacity: 0.5, textAlign: "center", cursor: "pointer" }}
  >
    v{version}
  </div>
);

const UpdateToButton = ({ version, onClick, error }: { version: string; onClick: () => void; error?: string | null }) => {
  const { t } = useTranslation();
  return (
    <div style={{ padding: "8px 12px", width: "100%" }}>
      <Button
        block
        color="primary"
        size="small"
        onClick={onClick}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        <DownlandOutline style={{display: "inline"}} /> {t("updateAvailable", "Update to {{version}}", { version })}
      </Button>
      {error && (
        <div style={{ color: "var(--adm-color-danger)", fontSize: 12, marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
};

const TauriUpdateButton = () => {
  const { update, currentVersion, status, progress, error, install } = useTauriUpdate();

  if (!update) {
    return currentVersion ? <VersionLabel version={currentVersion} /> : null;
  }
  if (status === "downloading" || status === "installing" || status === "ready") {
    return <TauriUpdateProgress status={status} progress={progress} />;
  }
  return <UpdateToButton version={update.version} onClick={install} error={error} />;
};

export const useLatestApk = () => {
  const [apk, setApk] = useState<ApkRelease | null>(null);
  useEffect(() => {
    let cancelled = false;
    getLatestApk().then((r) => { if (!cancelled) setApk(r); });
    return () => { cancelled = true; };
  }, []);
  return apk && isNewerVersion(apk.version) ? apk : null;
};

// The browser downloads the APK and hands it to the system installer, which updates in place
// (same signing key as the GitHub APK the user installed).
const ApkUpdateButton = () => {
  const apk = useLatestApk();
  if (!apk) return <VersionLabel version={APP_VERSION} />;
  return <UpdateToButton version={apk.version} onClick={() => openExternal(apk.url)} />;
};
