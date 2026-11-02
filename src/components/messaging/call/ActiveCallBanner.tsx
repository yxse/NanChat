import React from "react";
import { Button } from "antd-mobile";
import { PhoneFill, VideoOutline } from "antd-mobile-icons";
import { useCall } from "./CallProvider";

// "Join call" bar under a group chat header while a call runs in that chat
const ActiveCallBanner: React.FC<{ chatId: string }> = ({ chatId }) => {
    const { call, activeCalls, joinCall } = useCall();
    const info = activeCalls[chatId];
    if (!info || call?.callId === info.callId) return null;
    const count = info.participants.length;
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "var(--adm-color-background)",
                borderTop: "1px solid var(--adm-color-border)",
            }}
        >
            {info.video ? <VideoOutline fontSize={20} color="#00b578" /> : <PhoneFill fontSize={20} color="#00b578" />}
            <span style={{ flex: 1 }}>
                {info.video ? "Group video call" : "Group call"} · {count} {count === 1 ? "participant" : "participants"}
            </span>
            <Button size="small" color="success" shape="rounded" onClick={() => joinCall(info)}>
                Join
            </Button>
        </div>
    );
};

export default ActiveCallBanner;
