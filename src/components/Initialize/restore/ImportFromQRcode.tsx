import React, { Dispatch, SetStateAction } from "react";
import { Button, Input, Toast } from "antd-mobile";
import { toast } from "react-toastify";
import { ResponsivePopup } from "../../Settings";
import { decrypt } from "../../../worker/crypto";
import { Scanner } from "../../app/Scanner";

interface ImportFromFileProps {
  onWalletSelected: (encryptedSeed: string) => void;
}


export const ImportFromQRcode: React.FC<ImportFromFileProps> = ({
    onWalletSelected,
}) => {

  return (
    <>
    <Scanner
    onScan={(result) => {
      console.log(result);
      if (result) {
        onWalletSelected(result);
      } else {
        Toast.show({
          content: "Invalid QR code",
          duration: 1000,
        });
      }
    }}>
      <Button
        onClick={async () => {
         
        }}
        shape="rounded"
        color={"default"}
        className="w-full"
        size="large"
      >
        Scan Export QR Code
      </Button>
      </Scanner>
    </>
  );
}; 