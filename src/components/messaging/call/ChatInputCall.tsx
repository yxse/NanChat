import React from "react";
import { Button } from "antd-mobile";
import { PhoneFill, VideoOutline } from "antd-mobile-icons";
import { t } from "i18next";
import { useCall } from "./CallProvider";

// audio / video call buttons of the chat input (+) panel, same look as the red packet one
const ChatInputCall: React.FC<{ chat: any; toAddress?: string; video: boolean }> = ({ chat, toAddress, video }) => {
    const { startCall } = useCall();
    return (
        <div style={{ textAlign: "center" }}>
            <Button
                style={{ "--border-radius": "12px", "--background-color": "var(--adm-color-border)" } as React.CSSProperties}
                size="large"
                aria-label={video ? t("videoCall") : t("audioCall")}
                onClick={() => startCall({ chatId: chat.id, chatType: chat.type, peer: chat.type === "private" ? toAddress : undefined }, video)}
            >
                <div style={{ fontSize: 34 }}>{video ? <VideoOutline /> : <PhoneFill />}</div>
            </Button>
            <div className="mt-2" style={{ textWrap: "nowrap", textAlign: "center" } as React.CSSProperties}>
                {video ? t("videoCall") : t("audioCall")}
            </div>
        </div>
    );
};

export default ChatInputCall;
