import React from "react";
import { Button, List, Modal } from "antd-mobile";
import { ResponsivePopup } from "../../Settings";
import { loadWalletsFromICloud, loadWalletFromICloud, deleteWalletFromICloud } from "../../../services/capacitor-chunked-file-writer";

interface ImportFromICloudProps {
  onWalletSelected: (encryptedSeed: string) => void;
  mode?: "import" | "verify" | "delete";
}

export const ImportFromICloud: React.FC<ImportFromICloudProps> = ({
  onWalletSelected,
    mode = "import"
}) => {
  const [wallets, setWallets] = React.useState<any[]>([]);
  const [walletsVisible, setWalletsVisible] = React.useState<boolean>(false);

  let textSelect = `Select a backup to ${mode === "import" ? "import" : mode === "verify" ? "verify" : "delete"}`
  let textButton = mode === "import" ? "iCloud backup" : mode === "verify" ? "Verify iCloud backup" : "Delete iCloud backup"
  let colorButton = mode === "verify" ? "primary" : mode === "delete" ? "danger" : "default"
  return (
    <>
      <Button
        onClick={async () => {
          let wallets = await loadWalletsFromICloud();
          console.log(wallets);
          setWallets(wallets);
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
                      title: "Delete iCloud backup",
                      content: "Are you sure you want to delete this iCloud backup? This action cannot be undone but you can backup again later.",
                      onConfirm: async () => {
                        await deleteWalletFromICloud(walletDrive.name);
                        setWalletsVisible(false);
                        onWalletSelected("");
                      },
                      onCancel: () => {
                        Modal.clear();
                        return;
                      }
                    })
                    return;
                  }
                  else {

                      let text = await loadWalletFromICloud(walletDrive.name);
                      console.log(text);
                      // @ts-ignore - Ignoring TypeScript errors as requested
                      onWalletSelected(text);
                      setWalletsVisible(false);
                    }
                }}
                key={walletDrive.name}
                title={walletDrive.name}
              />
            ))}
          </List>
        </div>
      </ResponsivePopup>
    </>
  );
}; 