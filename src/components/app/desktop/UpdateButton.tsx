import { Button, ProgressBar, SpinLoading } from "antd-mobile";
import { DownlandOutline } from "antd-mobile-icons";
import { useCallback, useEffect, useState } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
// import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { useTranslation } from "react-i18next";
import { openInBrowser } from "../../messaging/utils";
import { isTauri } from "@tauri-apps/api/core";

type UpdateStatus = "idle" | "checking" | "downloading" | "installing" | "ready";

export const UpdateButton = () => {
  const { t } = useTranslation();
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

  const handleUpdate = useCallback(async () => {
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
      // await relaunch();
    } catch (err) {
      console.error("Update failed:", err);
      setError(String(err));
      setStatus("idle");
    }
  }, [update]);

//   if (status === "checking") {
//     return (
//       <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
//         <SpinLoading style={{ "--size": "18px" }} />
//         <span style={{ fontSize: 13 }}>{t("checkingForUpdates", "Checking for updates…")}</span>
//       </div>
//     );
//   }

  if (!isTauri()) {
    return null;
  }
  if (!update) {
    return currentVersion ? (
      <div
        onClick={() => {
          openInBrowser("https://github.com/yxse/NanChat/releases");
        }}
        style={{ padding: "8px 12px", fontSize: 12, opacity: 0.5, textAlign: "center", cursor: "pointer" }}
      >
        v{currentVersion}
      </div>
    ) : null;
  }

  if (status === "downloading" || status === "installing" || status === "ready") {
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
  }

  return (
    <div style={{ padding: "8px 12px", width: "100%" }}>
      <Button
        block
        color="primary"
        size="small"
        onClick={handleUpdate}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        <DownlandOutline style={{display: "inline"}} /> {t("updateAvailable", "Update to {{version}}", { version: update.version })}
      </Button>
      {error && (
        <div style={{ color: "var(--adm-color-danger)", fontSize: 12, marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
};
