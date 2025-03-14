import React, { useState } from "react";
import { Button, Form, Input, Toast } from "antd-mobile";
import { toast } from "react-toastify";
import { ResponsivePopup } from "../../Settings";
import { decrypt } from "../../../worker/crypto";

interface PasswordImportProps {
  visible: boolean;
  onClose: () => void;
  encryptedSeed: string;
  onImportSuccess: (seed: string) => Promise<void>;
  mode: "import" | "verify";
}

export const PasswordImport: React.FC<PasswordImportProps> = ({
  visible,
  onClose,
  encryptedSeed,
  onImportSuccess,
  mode = "import"
}) => {
  const [passwordImport, setPasswordImport] = useState<string>("");

  const handleImport = async () => {
    try {
      const seed = await decrypt(encryptedSeed, passwordImport);
      await onImportSuccess(seed);
      onClose();
    } catch (error) {
      console.log(error);
      Toast.show({
        icon: 'fail',
        content: 'Invalid password.',
      });
    }
  };

  return (
    <ResponsivePopup visible={visible} onClose={onClose}>
      <div className="p-4">
        <div className="text-xl text-center">Password</div>
        <div
          className="text-sm text-center"
          style={{ color: "var(--adm-color-text-secondary)" }}
        >
          Enter the password that you used to backup your wallet.
        </div>
        <Form className="form-list high-contrast" mode="card">
          <Form.Item
            className="form-list"
            rules={[{ required: true, message: "Password cannot be empty" }]}
            name={"password"}
            label=""
          >
            <Input
              onChange={(v) => setPasswordImport(v)}
              autoFocus
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Enter password"
              className=""
            />
          </Form.Item>
        </Form>
        <div style={{ margin: 24 }}>
          <Button
            className="w-full"
            color="primary"
            shape="rounded"
            size="large"
            onClick={handleImport}
          >
            {mode === "import" ? "Import" : "Verify"}
          </Button>
        </div>
      </div>
    </ResponsivePopup>
  );
}; 