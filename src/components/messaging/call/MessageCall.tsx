import React from "react";
import { PhoneFill, VideoOutline } from "antd-mobile-icons";
import { useWallet } from "../../useWallet";
import ProfileName from "../components/profile/ProfileName";
import { formatDuration } from "./CallScreen";

// Parses the "call" system message saved by the server:
// `<account> call <private|group> <audio|video> <event> <seconds>`
// private: one summary when the call ends (ended | missed | declined)
// group: started, joined, then ended | missed (nobody joined)
export const parseCallMessage = (content: string) => {
    const [initiator, , chatType, kind, outcome, seconds] = content.split(" ");
    return { initiator, chatType, video: kind === "video", outcome, seconds: Number(seconds) || 0 };
};

const groupCallText = (call: ReturnType<typeof parseCallMessage>) => {
    if (call.outcome === "started") return { text: `started a ${call.video ? "video " : ""}call`, withName: true };
    if (call.outcome === "joined") return { text: "joined the call", withName: true };
    const duration = call.outcome === "ended" ? ` · ${formatDuration(call.seconds * 1000)}` : "";
    return { text: `The call ended${duration}`, withName: false };
};

const callText = (call: ReturnType<typeof parseCallMessage>, outgoing: boolean) => {
    const what = call.video ? "video call" : "call";
    const duration = call.outcome === "ended" ? ` · ${formatDuration(call.seconds * 1000)}` : "";
    if (call.outcome === "ended") return { text: `${outgoing ? "Outgoing" : "Incoming"} ${what}${duration}`, missed: false };
    if (call.outcome === "declined") return { text: outgoing ? `${what[0].toUpperCase()}${what.slice(1)} declined` : `Declined ${what}`, missed: !outgoing };
    return { text: outgoing ? `${what[0].toUpperCase()}${what.slice(1)} not answered` : `Missed ${what}`, missed: !outgoing };
};

const MessageCall: React.FC<{ message: any; raw?: boolean }> = ({ message, raw }) => {
    const { activeAccount } = useWallet();
    const call = parseCallMessage(message.content);
    const isGroup = call.chatType === "group";
    const outgoing = call.initiator === activeAccount;
    const { text, missed, withName } = isGroup ? { ...groupCallText(call), missed: false } : { ...callText(call, outgoing), withName: false };
    // @ts-expect-error ProfileName is untyped
    const name = <ProfileName address={call.initiator} includeVerified={false} />;

    if (raw) return <>{"["}{withName && <>{name} </>}{text}{"]"}</>;

    const Icon = call.video ? VideoOutline : PhoneFill;
    return (
        <div className="text-center" style={{ margin: "8px 16px", color: "var(--adm-color-text-secondary)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: missed ? "var(--adm-color-danger)" : undefined }}>
                {/* svg is display: block in the tailwind base styles */}
                <Icon style={{ flexShrink: 0 }} />
                <span>{withName && <>{name} </>}{text}</span>
            </span>
        </div>
    );
};

export default MessageCall;
