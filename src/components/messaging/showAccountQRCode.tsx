import { Modal } from "antd-mobile";
import { AccountAvatar } from "./AccountAvatar";
import { QRCodeSVG } from "qrcode.react";
import icon from "../../../public/icons/nanchat.svg";
import React, { useEffect, useRef, useState } from "react";
import useLocalStorageState from "use-local-storage-state";
import { fetcherMessagesPost } from "./fetcher";




// The QR embeds a short-lived, single-use secret so a merchant can scan it to
// send a payment request. The secret is valid ~60s, so we refetch a fresh one periodically while the modal is open.
// The value stays a normal chat link, so scanning it to start a chat still works
// (the extra ?pay= param is ignored by the chat route).

// currently only available in developer mode, eventually might need a different "request payment" button to distinguish it from the normal safer "me" QR code.

const SECRET_REFRESH_MS = 50 * 1000;

const AccountQRCode = ({ me }) => {
  const [developerMode] = useLocalStorageState("developer-mode", { defaultValue: false });
  const [secret, setSecret] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!developerMode) {
      setSecret(null);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await fetcherMessagesPost("/payment-request/secret", {});
        if (!cancelled && data?.secret) setSecret(data.secret);
      } catch (e) {
        // Fall back to a plain chat link so the QR still works for chatting.
        console.log("Could not fetch payment request secret", e);
        if (!cancelled) setSecret(null);
      }
    };
    refresh();
    intervalRef.current = setInterval(refresh, SECRET_REFRESH_MS);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [me?._id, developerMode]);

  const value = secret
    ? `https://nanchat.com/chat/${me?._id}?pay=${secret}`
    : `https://nanchat.com/chat/${me?._id}`;

  return (
    <div className="flex justify-start items-center flex-col">
      <div className="text-xl mb-4 flex justify-start gap-2" style={{ width: "200px" }}>
        <AccountAvatar account={me?._id} width={42} />
        {me?.name}
      </div>
      <QRCodeSVG
        id="qrcode"
        imageSettings={{
          src: icon,
          height: 24,
          width: 24,
          excavate: false,
        }}
        includeMargin
        value={value}
        size={200}
        style={{ borderRadius: 8 }}
      />
      <div
        className="text-base mt-4 text-center mb-4"
        style={{ color: "var(--adm-color-text-secondary)" }}
      >
        Scan to start an end-to-end encrypted chat with me
        {secret && ", or to send me a payment request"}
      </div>
    </div>
  );
};

export const showAccountQRCode = (me) => {
  Modal.show({
    showCloseButton: true,
    closeOnMaskClick: true,
    content: <AccountQRCode me={me} />,
  });
};
