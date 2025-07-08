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
      // console.log(result);
      if (result && 
        !result.includes('_') // export qrocde should not contain underscores (could be a address qrcode)
      ) {
        onWalletSelected(result);
      } else {
        Toast.show({
          content: "Please scan a valid Export to another device QR code",
          duration: 5000,
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