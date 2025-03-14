import React, { Dispatch, SetStateAction } from "react";
import { Button, Input } from "antd-mobile";
import { toast } from "react-toastify";
import { ResponsivePopup } from "../../Settings";
import { decrypt } from "../../../worker/crypto";

interface ImportFromFileProps {
  onWalletSelected: (encryptedSeed: string) => void;
  mode?: "import" | "verify";
}


export const ImportFromFile: React.FC<ImportFromFileProps> = ({
    onWalletSelected,
    mode = "import"
}) => {

  return (
    <>
      <Button
        onClick={async () => {
          let file = document.createElement('input');
          file.type = 'file';
          file.accept = '.txt';
          file.onchange = async (e) => {
            // @ts-ignore - Ignoring TypeScript errors as requested
            let file = e.target.files[0];
            let reader = new FileReader();
            reader.onload = (e) => {
              // @ts-ignore - Ignoring TypeScript errors as requested
              let encryptedSeed = e.target?.result;
              console.log(encryptedSeed);
              // @ts-ignore - Ignoring TypeScript errors as requested
              onWalletSelected(encryptedSeed);
            };
            reader.readAsText(file);
          };
          file.click();
        }}
        shape="rounded"
        color={mode === "verify" ? "primary" : "default"}
        className="w-full"
        size="large"
      >
        {mode === "import" ? "Backup file" : "Verify backup file"}
      </Button>
    </>
  );
}; 