import { useState } from "react";
import { Button, Divider, Form, Input, Toast } from "antd-mobile";
import { tools, wallet as walletLib } from "multi-nano-web";
import { MnemonicInput } from "../Initialize/restore/MnemonicInput";
import { ImportFromFile } from "../Initialize/restore/ImportFromFile";
import { ImportFromGoogleDrive } from "../Initialize/restore/ImportFromGoogleDrive";
import { ImportFromICloud } from "../Initialize/restore/ImportFromICloud";
import { ImportFromQRcode } from "../Initialize/restore/ImportFromQRcode";
import { PasswordImport } from "../Initialize/restore/PasswordImport";
import { ResponsivePopup } from "../Settings";
import { appendWalletSeed, getActiveSeedIndex, getSeeds, setActiveSeedIndex } from "../../utils/storage";
import { decrypt, encrypt } from "../../worker/crypto";
import { useTranslation } from "react-i18next";

// Store a newly imported wallet and switch to it
async function saveAndSwitch(seedToStore: string, isPasswordEncrypted: boolean) {
  Toast.show({ icon: "loading", duration: 0 });
  const index = await appendWalletSeed(seedToStore, isPasswordEncrypted, true);
  setActiveSeedIndex(index);

  // reset the per-wallet state so accounts are derived again from the new seed
  localStorage.removeItem("lastAccountIndex");
  localStorage.setItem("activeIndex", "0");
  localStorage.removeItem("activeAddresses");
  localStorage.removeItem("hiddenIndexes");

  Toast.clear();
  window.location.replace("/");
}

// Asks for the password protecting the existing wallets, so the new seed is stored with the same password
function EncryptWithPassword({
  visible,
  onClose,
  seed,
}: {
  visible: boolean;
  onClose: () => void;
  seed: string;
}) {
  const [password, setPassword] = useState("");

  const handleConfirm = async () => {
    if (!password) return;
    const seeds = await getSeeds();
    const activeEntry = seeds[Math.min(getActiveSeedIndex(), seeds.length - 1)];
    let isValid = false;
    try {
      isValid = !!(await decrypt(activeEntry.seed, password));
    } catch {
      isValid = false;
    }
    if (!isValid) {
      Toast.show({ icon: "fail", content: "Invalid password." });
      return;
    }
    // the encrypted wallets can only be compared once decrypted with the password
    for (const entry of seeds) {
      if (!entry.isPasswordEncrypted) continue;
      try {
        if ((await decrypt(entry.seed, password)) === seed) {
          Toast.show({ icon: "fail", content: "This wallet is already added." });
          return;
        }
      } catch { /* encrypted with another password */ }
    }
    const encryptedSeed = await encrypt(seed, password);
    await saveAndSwitch(encryptedSeed, true);
  };

  return (
    <ResponsivePopup visible={visible} onClose={onClose} closeOnMaskClick showCloseButton destroyOnClose>
      <div className="p-4">
        <div className="text-xl text-center">Password</div>
        <div className="text-sm text-center" style={{ color: "var(--adm-color-text-secondary)" }}>
          Enter your current password, it will also protect the wallet you are adding.
        </div>
        <Form className="form-list high-contrast" mode="card">
          <Form.Item className="form-list" label="">
            <Input
              onChange={(v) => setPassword(v)}
              autoFocus
              type="password"
              autoComplete="current-password"
              placeholder="Enter password"
            />
          </Form.Item>
        </Form>
        <div style={{ margin: 24 }}>
          <Button className="w-full" color="primary" shape="rounded" size="large" onClick={handleConfirm}>
            Add Wallet
          </Button>
        </div>
      </div>
    </ResponsivePopup>
  );
}

export function AddWalletPopup({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [encryptedSeed, setEncryptedSeed] = useState<string>("");
  const [passwordMode, setPasswordMode] = useState<"import" | "import-qr">("import");
  const [importFileVisible, setImportFileVisible] = useState(false);
  const [seedToEncrypt, setSeedToEncrypt] = useState<string | null>(null);

  const addWallet = async (seed: string) => {
    const seeds = await getSeeds();
    if (seeds.some((s) => !s.isPasswordEncrypted && s.seed === seed)) {
      Toast.show({ icon: "fail", content: "This wallet is already added." });
      return;
    }
    const activeEntry = seeds[Math.min(getActiveSeedIndex(), seeds.length - 1)];
    if (activeEntry?.isPasswordEncrypted) {
      // existing wallets are password protected, the new one must be protected too
      setSeedToEncrypt(seed);
      return;
    }
    await saveAndSwitch(seed, false);
  };

  const handleWalletSelected = (encrypted: string) => {
    setEncryptedSeed(encrypted);
    setImportFileVisible(true);
  };

  return (
    <>
      <ResponsivePopup
        visible={visible}
        onClose={onClose}
        closeOnMaskClick
        showCloseButton
        destroyOnClose
        bodyStyle={{ maxHeight: "90dvh", overflowY: "auto" }}
      >
        <div className="p-4">
          <div className="text-xl font-semibold text-center mb-2">Add Wallet</div>
          <div className="text-sm text-center mb-2" style={{ color: "var(--adm-color-text-secondary)" }}>
            Import another secret phrase. Your current wallet stays available in Switch Wallet.
          </div>
          <MnemonicInput
            mode="import"
            onImport={async (mnemonicInputs: string[]) => {
              let seed: string;
              if (mnemonicInputs[0].length === 64 || mnemonicInputs[0].length === 128) {
                seed = mnemonicInputs[0];
              } else if (tools.validateMnemonic(mnemonicInputs.join(" "))) {
                seed = walletLib.fromLegacyMnemonic(mnemonicInputs.join(" ")).seed;
              } else {
                Toast.show({ icon: "fail", content: t("invalidMnemonic") });
                return;
              }
              await addWallet(seed);
            }}
          />
          <Divider>{t("or")}</Divider>
          <div className="flex flex-col gap-2">
            <ImportFromQRcode
              onWalletSelected={(encrypted) => {
                handleWalletSelected(encrypted);
                setPasswordMode("import-qr");
              }}
            />
            <ImportFromFile onWalletSelected={handleWalletSelected} />
            <ImportFromGoogleDrive onWalletSelected={handleWalletSelected} />
            <ImportFromICloud onWalletSelected={handleWalletSelected} />
          </div>
        </div>
      </ResponsivePopup>

      <PasswordImport
        mode={passwordMode}
        visible={importFileVisible}
        onClose={() => setImportFileVisible(false)}
        encryptedSeed={encryptedSeed}
        onImportSuccess={async (seed) => {
          await addWallet(seed);
        }}
      />

      {seedToEncrypt && (
        <EncryptWithPassword
          visible={!!seedToEncrypt}
          onClose={() => setSeedToEncrypt(null)}
          seed={seedToEncrypt}
        />
      )}
    </>
  );
}
