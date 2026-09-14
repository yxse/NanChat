import { Modal } from "antd-mobile";
import { QRCodeSVG } from "qrcode.react";
import icon from "../../../public/icons/nanchat.svg";
import React, { useEffect, useRef, useState } from "react";
import { fetcherMessagesPost } from "./fetcher";

// The payment code QR contains only a short-lived, single-use secret. A merchant
// scans it and posts it to /payment-request in the backend, which pushes the
// request to this account (see the payment-request handler in socket.tsx).
// The secret is valid ~60s, so we refetch a fresh one periodically while the modal is open.

// currently only available in developer mode.

const SECRET_REFRESH_MS = 50 * 1000;

const PaymentCode = () => {
  const [secret, setSecret] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await fetcherMessagesPost("/payment-request/secret", {});
        if (!cancelled && data?.secret) setSecret(data.secret);
      } catch (e) {
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
  }, []);

  return (
    <div className="flex justify-start items-center flex-col">
      <div className="text-xl mb-4 text-center">My Payment Code</div>
      {secret ? (
        <QRCodeSVG
          id="payment-qrcode"
          imageSettings={{
            src: icon,
            height: 24,
            width: 24,
            excavate: false,
          }}
          includeMargin
          value={secret}
          size={200}
          style={{ borderRadius: 8 }}
        />
      ) : (
        <div
          style={{
            width: 200,
            height: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--adm-color-text-secondary)",
          }}
        >
          Loading...
        </div>
      )}
      <div
        className="text-base mt-4 text-center mb-4"
        style={{ color: "var(--adm-color-text-secondary)" }}
      >
        Show this code to a merchant to receive a payment request. It expires after a
        minute and can only be used once.
      </div>
    </div>
  );
};

export const showPaymentCode = () => {
  Modal.show({
    showCloseButton: true,
    closeOnMaskClick: true,
    content: <PaymentCode />,
  });
};
