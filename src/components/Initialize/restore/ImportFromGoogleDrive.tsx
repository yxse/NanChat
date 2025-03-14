import React from "react";
import { Button, List, Modal } from "antd-mobile";
import { ResponsivePopup } from "../../Settings";
import { loadWalletsFromGoogleDrive, loadWalletFromGoogleDrive, deleteWalletFromGoogleDrive } from "../../../services/capacitor-chunked-file-writer";

interface ImportFromGoogleDriveProps {
  onWalletSelected: (encryptedSeed: string) => void;
  mode?: "import" | "verify" | "delete";
}

export const ImportFromGoogleDrive: React.FC<ImportFromGoogleDriveProps> = ({
  onWalletSelected,
  mode = "import"
}) => {
  const [wallets, setWallets] = React.useState<any[]>([]);
  const [token, setToken] = React.useState<string>("");
  const [walletsVisible, setWalletsVisible] = React.useState<boolean>(false);

  let textSelect = `Select a backup to ${mode === "import" ? "import" : mode === "verify" ? "verify" : "delete"}`
  let textButton = mode === "import" ? "Google Drive backup" : mode === "verify" ? "Verify Google Drive backup" : "Delete Google Drive backup"
  let colorButton = mode === "verify" ? "primary" : mode === "delete" ? "danger" : "default"
  return (
    <>
      <Button
        onClick={async () => {
          let wallets = await loadWalletsFromGoogleDrive();
          console.log(wallets);
          setWallets(wallets.files);
          setToken(wallets.token);
          setWalletsVisible(true);
        }}
        shape="rounded"
        color={colorButton}
        className="w-full"
        size="large"
      >
        {textButton}
      </Button>

      <ResponsivePopup
        visible={walletsVisible}
        onClose={() => {
          setWalletsVisible(false);
        }}
      >
        <div className="p-4">
          <div className="text-lg text-center">{textSelect}</div>
          <List>
            {wallets.map((walletDrive) => (
              <List.Item
                onClick={async () => {
                    if (mode === "delete") {
                        Modal.confirm({
                            closeOnMaskClick: true,
                            cancelText: "Cancel",
                            confirmText: "Delete",
                            title: "Delete Google Drive backup",
                            content: "Are you sure you want to delete this Google Drive backup? This action cannot be undone but you can backup again later.",
                            onConfirm: async () => {
                                await deleteWalletFromGoogleDrive(walletDrive.id, token);
                                setWalletsVisible(false);
                                onWalletSelected("");
                            },
                            onCancel: () => {
                                Modal.clear();
                                return;
                            }
                        });
                        return;
                    }
                  let text = await loadWalletFromGoogleDrive(walletDrive.id, token);
                  console.log(text);
                  // @ts-ignore - Ignoring TypeScript errors as requested
                  onWalletSelected(text);
                  setWalletsVisible(false);
                }}
                key={walletDrive.id}
                title={walletDrive.name}
              />
            ))}
          </List>
        </div>
      </ResponsivePopup>
    </>
  );
}; 