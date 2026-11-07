import { Button, Modal } from "antd-mobile";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@tauri-apps/api/core";
import { getSecureStorageStatus, SecureStorageStatus } from "../../../services/tauri-keyring-frontend";
import { getSeed } from "../../../utils/storage";

// Desktop: checks at launch that secrets (seed, PIN) can be stored. Without
// this, a missing or locked keyring (common on Linux) looks like "no wallet":
// onboarding seems to work but nothing is saved, and the PIN/password set
// seconds ago is rejected.
export const SecureStorageCheck = () => {
  if (!isTauri()) return null;
  return <SecureStorageCheckInner />;
};

// "unavailable": no storage usable at all
// "walletInKeyring": the app had a wallet, but the keyring that may hold it
// failed, so the file fallback is empty. Offer to unlock and retry before the
// user starts over.
type Problem = { kind: "unavailable" | "walletInKeyring"; message: string };

async function findProblem(status: SecureStorageStatus): Promise<Problem | null> {
  if (status.error) {
    return { kind: "unavailable", message: status.error };
  }
  if (status.backend === "file" && status.keyringError && localStorage.getItem("hasWallet") === "true") {
    const seed: any = await getSeed().catch(() => null);
    if (!seed?.seed) {
      return { kind: "walletInKeyring", message: status.keyringError };
    }
  }
  return null;
}

const SecureStorageCheckInner = () => {
  const { t } = useTranslation();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    getSecureStorageStatus().then(async (status) => {
      const found = await findProblem(status);
      if (found) {
        setProblem(found);
        return;
      }
      if (status.backend === "file") {
        // e.g. seed migrated from 1.x into the file without a password
        const seed: any = await getSeed().catch(() => null);
        if (seed?.seed && !seed.isPasswordEncrypted) {
          Modal.alert({
            title: t("noSystemKeyringTitle"),
            content: <div style={{ textAlign: "start" }}>{t("noSystemKeyringEnablePassword")}</div>,
            confirmText: t("close"),
          });
        }
      }
    });
  }, []);

  const retry = async () => {
    setChecking(true);
    const status = await getSecureStorageStatus(true);
    const found = await findProblem(status);
    setChecking(false);
    if (found) {
      setProblem(found);
      return;
    }
    // reload so the wallet is loaded from the storage that's now available
    window.location.reload();
  };

  // the wallet can't be reached: start over (restore with the secret phrase),
  // it will be saved in the password-protected file
  const useFile = () => {
    localStorage.removeItem("hasWallet");
    window.location.reload();
  };

  return (
    <Modal
      visible={!!problem}
      closeOnMaskClick={false}
      title={problem?.kind === "walletInKeyring" ? t("keyringWalletUnreachableTitle") : t("secureStorageUnavailableTitle")}
      content={
        <div style={{ textAlign: "start" }}>
          <div>{problem?.kind === "walletInKeyring" ? t("keyringWalletUnreachableDesc") : t("secureStorageErrorDesc")}</div>
          <div className="text-sm mt-2" style={{ color: "var(--adm-color-text-secondary)", wordBreak: "break-word" }}>
            {problem?.message}
          </div>
          <Button
            block
            color="primary"
            shape="rounded"
            size="large"
            className="mt-4"
            loading={checking}
            onClick={retry}
          >
            {t("retry")}
          </Button>
          {problem?.kind === "walletInKeyring" && (
            <Button block shape="rounded" size="large" fill="none" className="mt-2" onClick={useFile}>
              {t("keyringWalletUseFile")}
            </Button>
          )}
        </div>
      }
    />
  );
};
