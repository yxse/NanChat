import React, { useEffect, useMemo, useRef, useState } from "react";
import { AudioMutedOutline, AudioOutline, DownOutline, ExclamationTriangleOutline, LockFill, LoopOutline, PhoneFill, VideoOutline } from "antd-mobile-icons";
import ProfilePicture from "../components/profile/ProfilePicture";
import ProfileName from "../components/profile/ProfileName";
import GroupAvatar from "../components/group-avatar";
import { useChats } from "../hooks/use-chats";
import { formatAddress } from "../../../utils/format";
import { useWallet } from "../../useWallet";
import type { CallState, PeerState } from "./CallProvider";

const END_REASONS: Record<string, string> = {
    declined: "Call declined",
    busy: "Busy",
    timeout: "No answer",
    failed: "Connection lost",
    unavailable: "Unavailable",
    hangup: "Call ended",
};

export const formatDuration = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

const useDuration = (connectedAt?: number) => {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!connectedAt) return;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [connectedAt]);
    return connectedAt ? formatDuration(now - connectedAt) : null;
};

const statusText = (call: CallState, duration: string | null) => {
    const kind = call.video ? "video call" : "audio call";
    switch (call.status) {
        case "outgoing":
            return call.chatType === "group" ? "Ringing the group…" : "Calling…";
        case "incoming":
            return call.chatType === "group" ? `Incoming group ${kind}` : `Incoming ${kind}`;
        case "connecting":
            return "Connecting…";
        case "active":
            if (call.chatType === "group" && Object.keys(call.peers).length === 0) return "Waiting for others to join…";
            return duration;
        case "ended":
            if (call.endReason === "timeout" && call.direction === "incoming") return "Missed call";
            return (call.endReason && END_REASONS[call.endReason]) || "Call ended";
    }
};

const Name: React.FC<{ address: string }> = ({ address }) => (
    // @ts-expect-error ProfileName is an untyped memo component
    <ProfileName address={address} fallback={formatAddress(address)} />
);

// Always muted: remote audio plays through the provider's <audio> elements, so
// it keeps playing while this screen is minimized.
//
// The video fills its frame when both have the same orientation, and is shown
// whole otherwise: cropping a phone held upright to fill a wide screen (or a
// laptop camera to fill a phone) would only leave a strip of it.
const VideoView: React.FC<{
    stream: MediaStream;
    mirrored?: boolean;
    onAspect?: (aspect: number) => void;
    style?: React.CSSProperties;
}> = ({ stream, mirrored, onAspect, style }) => {
    const ref = useRef<HTMLVideoElement>(null);
    const [videoAspect, setVideoAspect] = useState(0);
    const [frameAspect, setFrameAspect] = useState(0);
    useEffect(() => {
        const video = ref.current;
        if (!video) return;
        video.srcObject = stream;
        video.play().catch(() => {});
    }, [stream]);
    useEffect(() => {
        const video = ref.current;
        if (!video) return;
        // "resize": the sender rotated their phone or switched camera
        const onResize = () => {
            if (!video.videoWidth || !video.videoHeight) return;
            const aspect = video.videoWidth / video.videoHeight;
            setVideoAspect(aspect);
            onAspect?.(aspect);
        };
        onResize();
        video.addEventListener("loadedmetadata", onResize);
        video.addEventListener("resize", onResize);
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            if (width && height) setFrameAspect(width / height);
        });
        observer.observe(video);
        return () => {
            video.removeEventListener("loadedmetadata", onResize);
            video.removeEventListener("resize", onResize);
            observer.disconnect();
        };
    }, [onAspect]);
    const sameOrientation = !videoAspect || !frameAspect || (videoAspect >= 1) === (frameAspect >= 1);
    return (
        <video
            ref={ref}
            autoPlay
            playsInline
            muted
            style={{
                objectFit: sameOrientation ? "cover" : "contain",
                background: "#000",
                transform: mirrored ? "scaleX(-1)" : undefined,
                ...style,
            }}
        />
    );
};

const RoundButton: React.FC<{
    onClick: () => void;
    background: string;
    label: string;
    children: React.ReactNode;
}> = ({ onClick, background, label, children }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <button
            aria-label={label}
            onClick={onClick}
            style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                border: "none",
                background,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
            }}
        >
            {children}
        </button>
        <span style={{ fontSize: 13, opacity: 0.9 }}>{label}</span>
    </div>
);

const HANGUP_RED = "#ff3141";
const ACCEPT_GREEN = "#00b578";
const WARNING_ORANGE = "#ff8f1f";
const IDLE_BUTTON = "rgba(255,255,255,0.18)";
const TEXT_SHADOW = "0 1px 4px rgba(0,0,0,0.6)";
const fill: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };

const peerHasVideo = (call: CallState, peer: PeerState | undefined, stream: MediaStream | undefined) =>
    call.video && !!peer?.camera && !!stream?.getVideoTracks().length;

const peerStatusText = (peer: PeerState) =>
    peer.status === "connecting" ? "Connecting…" : peer.status === "reconnecting" ? "Reconnecting…" : null;

// one participant of a group call (us included)
const Tile: React.FC<{
    account: string;
    stream: MediaStream | null;
    mirrored?: boolean;
    muted: boolean;
    label: React.ReactNode;
    status?: string | null;
}> = ({ account, stream, mirrored, muted, label, status }) => (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: 12, background: "rgba(255,255,255,0.06)" }}>
        {stream ? (
            <VideoView stream={stream} mirrored={mirrored} style={{ ...fill, background: "transparent" }} />
        ) : (
            <div style={{ ...fill, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ProfilePicture address={account} width={72} />
            </div>
        )}
        <div style={{ position: "absolute", left: 8, bottom: 8, right: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 4, textShadow: TEXT_SHADOW }}>
            {muted && <AudioMutedOutline />}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
            {status && <span style={{ opacity: 0.8 }}>· {status}</span>}
        </div>
    </div>
);

const GRID_GAP = 8;

// Number of columns giving the biggest tiles: a phone in portrait stacks two
// participants, a wide screen puts them side by side.
const bestColumns = (count: number, width: number, height: number) => {
    const aspect = width >= height ? 4 / 3 : 3 / 4; // usual tile shape on such a screen
    let best = 1;
    let bestWidth = 0;
    for (let columns = 1; columns <= count; columns++) {
        const rows = Math.ceil(count / columns);
        const tileWidth = Math.min(
            (width - GRID_GAP * (columns - 1)) / columns,
            ((height - GRID_GAP * (rows - 1)) / rows) * aspect,
        );
        if (tileWidth > bestWidth) {
            best = columns;
            bestWidth = tileWidth;
        }
    }
    return best;
};

const CallGrid: React.FC<{ tiles: React.ReactElement[] }> = ({ tiles }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    const columns = bestColumns(tiles.length, size.width, size.height);
    const rows = Math.ceil(tiles.length / columns);
    // explicit sizes rather than a CSS grid, so an incomplete last row is centered
    const tileWidth = Math.floor((size.width - GRID_GAP * (columns - 1)) / columns);
    const tileHeight = Math.floor((size.height - GRID_GAP * (rows - 1)) / rows);
    return (
        <div
            ref={ref}
            style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", flexWrap: "wrap", justifyContent: "center", alignContent: "center", gap: GRID_GAP }}
        >
            {size.width > 0 && tiles.map((tile) => (
                <div key={tile.key} style={{ width: tileWidth, height: tileHeight }}>{tile}</div>
            ))}
        </div>
    );
};

// our own camera in a corner: its real shape, bigger on large screens
const pipSize = (aspect: number): React.CSSProperties => {
    if (aspect >= 1) {
        const width = "clamp(120px, 20vw, 320px)";
        return { width, height: `calc(${width} / ${aspect})` };
    }
    const height = "clamp(140px, 22vh, 280px)";
    return { height, width: `calc(${height} * ${aspect})` };
};

type CallScreenProps = {
    call: CallState;
    minimized: boolean;
    localVideoTrack: MediaStreamTrack | null;
    remoteStreams: Record<string, MediaStream>;
    canSwitchCamera: boolean;
    unknownCaller: boolean;
    ipHidden: boolean;
    onMinimize: (minimized: boolean) => void;
    onAccept: (withCamera: boolean) => void;
    onDecline: () => void;
    onHangUp: () => void;
    onToggleMute: () => void;
    onToggleCamera: () => void;
    onSwitchCamera: () => void;
};

const CallScreen: React.FC<CallScreenProps> = ({
    call,
    minimized,
    localVideoTrack,
    remoteStreams,
    canSwitchCamera,
    unknownCaller,
    ipHidden,
    onMinimize,
    onAccept,
    onDecline,
    onHangUp,
    onToggleMute,
    onToggleCamera,
    onSwitchCamera,
}) => {
    const { chats } = useChats();
    const { activeAccount } = useWallet();
    const [localAspect, setLocalAspect] = useState(3 / 4);
    const chat = call.chatType === "group" ? chats?.find((c) => c.id === call.chatId) : undefined;
    const groupName = (chat as any)?.name || "Group call";
    const duration = useDuration(call.connectedAt);
    const status = statusText(call, duration);
    const localStream = useMemo(() => (localVideoTrack ? new MediaStream([localVideoTrack]) : null), [localVideoTrack]);
    const mirrorLocal = call.facingMode === "user";

    const peerAccounts = Object.keys(call.peers);
    const isGroup = call.chatType === "group";
    const showGrid = isGroup && call.status === "active" && peerAccounts.length > 0;
    // 1:1 layout: the other person fills the screen
    const soloPeer = !isGroup ? (peerAccounts[0] ?? call.peer) : undefined;
    const showRemoteVideo = !!soloPeer && call.status === "active" &&
        peerHasVideo(call, call.peers[soloPeer], remoteStreams[soloPeer]);
    // while ringing, our own camera fills the screen, then it moves to a corner
    const localFullScreen = !!localStream && !showRemoteVideo && !showGrid && call.status !== "active";
    const localPip = !!localStream && !localFullScreen && !showGrid; // in a group we're a tile of the grid
    const inCall = call.status === "outgoing" || call.status === "connecting" || call.status === "active";
    const title = isGroup ? groupName : <Name address={soloPeer ?? call.from} />;

    if (minimized && call.status !== "incoming") {
        return (
            <div
                onClick={() => onMinimize(false)}
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 2000,
                    paddingTop: "calc(var(--safe-area-inset-top, 0px) + 6px)",
                    paddingBottom: 6,
                    background: ACCEPT_GREEN,
                    color: "#fff",
                    textAlign: "center",
                    fontSize: 14,
                    cursor: "pointer",
                }}
            >
                {call.video ? (
                    <VideoOutline style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                ) : (
                    <PhoneFill style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                )}
                {title}
                {" · "}
                {status}
            </div>
        );
    }

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 2000,
                overflow: "hidden",
                background: "linear-gradient(180deg, #1f2a44 0%, #0d1117 100%)",
                color: "#fff",
            }}
        >
            {showRemoteVideo && <VideoView stream={remoteStreams[soloPeer!]} style={fill} />}
            {localFullScreen && (
                <>
                    <VideoView stream={localStream!} mirrored={mirrorLocal} style={fill} />
                    <div style={{ ...fill, background: "rgba(0,0,0,0.35)" }} />
                </>
            )}
            {localPip && (
                <VideoView
                    stream={localStream!}
                    mirrored={mirrorLocal}
                    onAspect={setLocalAspect}
                    style={{
                        position: "absolute",
                        zIndex: 1,
                        top: "calc(var(--safe-area-inset-top, 0px) + 64px)",
                        right: 16,
                        ...pipSize(localAspect),
                        borderRadius: 12,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                    }}
                />
            )}

            <div
                style={{
                    position: "relative",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "calc(var(--safe-area-inset-top, 0px) + 16px) 16px calc(var(--safe-area-inset-bottom, 0px) + 48px)",
                    boxSizing: "border-box",
                    textShadow: TEXT_SHADOW,
                }}
            >
                <div style={{ width: "100%", display: "flex", alignItems: "center", minHeight: 32 }}>
                    {call.status !== "incoming" && call.status !== "ended" && (
                        <DownOutline
                            aria-label="Minimize"
                            fontSize={24}
                            style={{ cursor: "pointer" }}
                            onClick={() => onMinimize(true)}
                        />
                    )}
                    <div style={{ flex: 1, textAlign: "center", fontSize: 13, opacity: 0.8 }}>
                        <LockFill style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                        End-to-end encrypted
                    </div>
                    <div style={{ width: 24 }} />
                </div>

                {showGrid ? (
                    <div style={{ width: "100%", flex: 1, display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
                        <div style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
                            <div style={{ fontSize: 18, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{groupName}</div>
                            <div style={{ fontSize: 14, opacity: 0.9 }}>{status} · {peerAccounts.length + 1} participants</div>
                        </div>
                        <CallGrid
                            tiles={[
                                <Tile key="self" account={activeAccount} stream={localStream} mirrored={mirrorLocal} muted={call.muted} label="You" />,
                                ...peerAccounts.map((account) => {
                                    const peer = call.peers[account];
                                    const stream = remoteStreams[account];
                                    return (
                                        <Tile
                                            key={account}
                                            account={account}
                                            stream={peerHasVideo(call, peer, stream) && peer.status === "connected" ? stream : null}
                                            muted={peer.muted}
                                            label={<Name address={account} />}
                                            status={peerStatusText(peer)}
                                        />
                                    );
                                }),
                            ]}
                        />
                    </div>
                ) : showRemoteVideo ? (
                    <div style={{ alignSelf: "flex-start", marginTop: 8 }}>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
                        <div style={{ fontSize: 14, opacity: 0.9 }}>
                            {status}
                            {call.peers[soloPeer!]?.muted && " · Muted"}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, maxWidth: 400 }}>
                        {isGroup && chat ? <GroupAvatar chat={chat} /> : <ProfilePicture address={soloPeer ?? call.from} width={112} />}
                        <div style={{ fontSize: 24, fontWeight: 600, textAlign: "center" }}>{title}</div>
                        {isGroup && call.status === "incoming" && (
                            <div style={{ fontSize: 15, opacity: 0.85 }}>
                                <Name address={call.from} /> is calling
                            </div>
                        )}
                        <div style={{ fontSize: 16, opacity: 0.85, minHeight: 22 }}>{status}</div>
                        {!isGroup && soloPeer && call.status === "active" && (call.peers[soloPeer]?.muted || (call.video && !call.peers[soloPeer]?.camera)) && (
                            <div style={{ fontSize: 13, opacity: 0.7 }}>
                                {[call.video && !call.peers[soloPeer]?.camera && "Camera off", call.peers[soloPeer]?.muted && "Muted"].filter(Boolean).join(" · ")}
                            </div>
                        )}
                        {unknownCaller && call.status === "incoming" && (
                            <div
                                style={{
                                    marginTop: 8,
                                    padding: 12,
                                    borderRadius: 12,
                                    background: "rgba(255,143,31,0.15)",
                                    border: `1px solid ${WARNING_ORANGE}`,
                                    textShadow: "none",
                                    fontSize: 13,
                                    lineHeight: 1.4,
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: WARNING_ORANGE, marginBottom: 4 }}>
                                    <ExclamationTriangleOutline fontSize={16} />
                                    {isGroup ? "The caller is not in your contacts" : "Not in your contacts"}
                                </div>
                                Never share your secret phrase or send funds because someone asks during a call.
                                Scammers may pretend to be someone you know.
                                {ipHidden && " Your IP address is hidden from this caller."}
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: "flex", gap: call.video || call.status === "incoming" ? 20 : 64, justifyContent: "center", flexWrap: "wrap", minHeight: 88 }}>
                    {call.status === "incoming" && (
                        <>
                            <RoundButton label="Decline" background={HANGUP_RED} onClick={onDecline}>
                                <PhoneFill fontSize={28} style={{ transform: "rotate(135deg)" }} />
                            </RoundButton>
                            {call.video && (
                                <RoundButton label="Audio only" background={IDLE_BUTTON} onClick={() => onAccept(false)}>
                                    <PhoneFill fontSize={28} />
                                </RoundButton>
                            )}
                            <RoundButton label="Accept" background={ACCEPT_GREEN} onClick={() => onAccept(true)}>
                                {call.video ? <VideoOutline fontSize={28} /> : <PhoneFill fontSize={28} />}
                            </RoundButton>
                        </>
                    )}
                    {inCall && (
                        <>
                            <RoundButton
                                label={call.muted ? "Unmute" : "Mute"}
                                background={call.muted ? "#fff" : IDLE_BUTTON}
                                onClick={onToggleMute}
                            >
                                {call.muted ? <AudioMutedOutline fontSize={28} color="#000" /> : <AudioOutline fontSize={28} />}
                            </RoundButton>
                            {call.video && (
                                <RoundButton
                                    label={call.cameraOn ? "Camera" : "Camera off"}
                                    background={call.cameraOn ? IDLE_BUTTON : "#fff"}
                                    onClick={onToggleCamera}
                                >
                                    <VideoOutline fontSize={28} color={call.cameraOn ? undefined : "#000"} />
                                </RoundButton>
                            )}
                            {call.video && call.cameraOn && canSwitchCamera && (
                                <RoundButton label="Flip" background={IDLE_BUTTON} onClick={onSwitchCamera}>
                                    <LoopOutline fontSize={28} />
                                </RoundButton>
                            )}
                            <RoundButton label={isGroup ? "Leave" : "End"} background={HANGUP_RED} onClick={onHangUp}>
                                <PhoneFill fontSize={28} style={{ transform: "rotate(135deg)" }} />
                            </RoundButton>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CallScreen;
