import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Toast } from "antd-mobile";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import useLocalStorageState from "use-local-storage-state";
import { useSWRConfig } from "swr";
import { socket } from "../socket";
import { useWallet } from "../../useWallet";
import { sendNotificationTauri } from "../../../nano/notifications";
import { fetcherMessages } from "../fetcher";
import {
    audienceIncludes, CallAudience, decryptSignal, encryptSignal, hasTurnServer, isSavedContact, newCallId,
    P2P_DEFAULT, P2P_SETTING_KEY, Signal,
} from "./call-signaling";
import { createTonePlayer } from "./call-tones";
import CallScreen from "./CallScreen";
import { isPermissionError, showPermissionDenied } from "../../../utils/permissions";

export type CallStatus = "outgoing" | "incoming" | "connecting" | "active" | "ended";
export type ChatType = "private" | "group";

export type PeerState = {
    status: "connecting" | "connected" | "reconnecting";
    // reported by the peer over the (end-to-end encrypted) control data channel
    muted: boolean;
    camera: boolean;
};

export type CallState = {
    callId: string;
    chatId: string;
    chatType: ChatType;
    video: boolean;
    direction: "outgoing" | "incoming";
    status: CallStatus;
    from: string; // who started the call
    peer?: string; // the other person, for private calls
    muted: boolean;
    cameraOn: boolean;
    facingMode: "user" | "environment";
    peers: Record<string, PeerState>; // other participants in the call
    connectedAt?: number;
    endReason?: string;
};

// a call running in one of our chats, joinable from the chat banner
export type ActiveCallInfo = {
    callId: string;
    chatId: string;
    chatType: ChatType;
    video: boolean;
    participants: string[];
};

type CallContextValue = {
    call: CallState | null;
    activeCalls: Record<string, ActiveCallInfo>;
    startCall: (target: { chatId: string; chatType: ChatType; peer?: string }, video: boolean) => Promise<void>;
    joinCall: (info: ActiveCallInfo) => Promise<void>;
};

const CallContext = createContext<CallContextValue>({
    call: null,
    activeCalls: {},
    startCall: async () => {},
    joinCall: async () => {},
});
export const useCall = () => useContext(CallContext);
// ringing or on a call: screens showing wallet secrets hide them (scammers ask for them on calls)
export const useInCall = () => {
    const { call } = useCall();
    return !!call && call.status !== "ended";
};

type Ack = { ok?: boolean; error?: string; iceServers?: RTCIceServer[] } & Partial<ActiveCallInfo>;
type RingEvent = { callId: string; chatId: string; chatType: ChatType; video: boolean; fromAccount: string; fromAccountName?: string };

type Peer = {
    pc: RTCPeerConnection;
    control: RTCDataChannel;
    pendingIce: RTCIceCandidateInit[];
    disconnectTimer: ReturnType<typeof setTimeout> | null;
};

const ENDED_SCREEN_MS = 1500;
const DISCONNECTED_GRACE_MS = 15000; // ICE "disconnected" often recovers on network handover
const ACK_TIMEOUT_MS = 10000;

const AUDIO_CONSTRAINTS: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const VIDEO_CONSTRAINTS: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };

const callErrorMessage = (error?: string) => {
    if (error === "offline") return "This contact is offline";
    if (error === "busy") return "Already on another call";
    if (error === "full") return "This call is full";
    if (error === "unavailable") return "This user doesn't accept calls";
    return error || "Unable to start the call";
};

const getCamera = async (facingMode: CallState["facingMode"]) => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { ...VIDEO_CONSTRAINTS, facingMode } });
    return stream.getVideoTracks()[0];
};

// both ends create the video transceiver as sendrecv, so turning the camera
// on/off or flipping it is a replaceTrack, with no renegotiation
const videoTransceiver = (pc: RTCPeerConnection | undefined) =>
    pc?.getTransceivers().find((t) => t.receiver.track?.kind === "video");

const unsupported = () => !navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined";

const RemoteAudio: React.FC<{ stream: MediaStream }> = ({ stream }) => {
    const ref = useRef<HTMLAudioElement>(null);
    useEffect(() => {
        const audio = ref.current;
        if (!audio) return;
        audio.srcObject = stream;
        audio.play().catch((e) => console.error("remote audio play failed", e));
    }, [stream]);
    return <audio ref={ref} autoPlay playsInline style={{ display: "none" }} />;
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { activeAccount, activeAccountPk } = useWallet();
    const { cache, mutate } = useSWRConfig();
    const [contacts] = useLocalStorageState<any[]>("contacts", { defaultValue: [] });
    const [peerToPeer] = useLocalStorageState<CallAudience>(P2P_SETTING_KEY, { defaultValue: P2P_DEFAULT });
    const [call, setCallState] = useState<CallState | null>(null);
    const [activeCalls, setActiveCalls] = useState<Record<string, ActiveCallInfo>>({});
    const [minimized, setMinimized] = useState(false);
    const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const [canSwitchCamera, setCanSwitchCamera] = useState(false);
    const [relayAvailable, setRelayAvailable] = useState<boolean | null>(null); // null: not joined yet

    // socket handlers are registered once, so they read the live call from refs
    const callRef = useRef<CallState | null>(null);
    const joinedRef = useRef(false); // the server counts us in the call
    const peersRef = useRef(new Map<string, Peer>());
    const queuesRef = useRef(new Map<string, Promise<void>>());
    const iceServersRef = useRef<RTCIceServer[] | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const contactsRef = useRef(contacts);
    contactsRef.current = contacts;
    const peerToPeerRef = useRef(peerToPeer);
    peerToPeerRef.current = peerToPeer;
    const refreshedMembersRef = useRef(new Set<string>());
    const cameraBusy = useRef(false);
    const tones = useMemo(() => createTonePlayer(), []);

    const setCall = useCallback((update: CallState | null | ((c: CallState | null) => CallState | null)) => {
        const next = typeof update === "function" ? update(callRef.current) : update;
        callRef.current = next;
        setCallState(next);
    }, []);

    const isCurrent = (callId: string) => callRef.current?.callId === callId && callRef.current.status !== "ended";

    const updatePeer = (account: string, update: Partial<PeerState>) =>
        setCall((c) => {
            if (!c || c.status === "ended") return c;
            const previous = c.peers[account] ?? { status: "connecting", muted: false, camera: c.video };
            return { ...c, peers: { ...c.peers, [account]: { ...previous, ...update } } };
        });

    // "Peer to peer" setting: who may connect to us directly and so learn our IP address
    const allowsPeerToPeer = (account: string) =>
        audienceIncludes(peerToPeerRef.current, isSavedContact(contactsRef.current, account));

    // box proves who wrote a signal, not that they belong in the call: the server
    // names the participants, so a compromised one could add an account of its
    // own and receive our media. We only connect to members of the call's chat
    // as listed in our own chat list (in a private chat: the peer).
    const isChatMember = async (chatId: string, account: string) => {
        const check = () => {
            const chats = cache.get("/chats-" + activeAccount)?.data;
            const chat = Array.isArray(chats) ? chats.find((c) => c.id === chatId) : undefined;
            return !!chat?.participants?.some((p: any) => (p?._id ?? p) === account);
        };
        if (check()) return true;
        // they may have joined the group since our last sync: refresh once
        const key = `${chatId}:${account}`;
        if (refreshedMembersRef.current.has(key)) return false;
        refreshedMembersRef.current.add(key);
        await mutate("/chats-" + activeAccount);
        return check();
    };
    const isCallPeer = async (callId: string, account: string) => {
        const current = callRef.current;
        if (!current || current.callId !== callId || account === activeAccount) return false;
        if (current.chatType === "private" && current.peer && account !== current.peer) return false;
        const member = await isChatMember(current.chatId, account);
        if (!member) console.warn("call: ignoring a participant who isn't in this chat", account);
        return member;
    };

    // TURN credentials only come with the call:start / call:join acks
    const applyIceServers = (iceServers: RTCIceServer[] | undefined) => {
        iceServersRef.current = iceServers ?? [];
        setRelayAvailable(hasTurnServer(iceServersRef.current));
    };

    // Whether this call must hide our IP address. In a group, anyone may join
    // later, so only "Everybody" connects directly.
    const needsRelay = (chatType: ChatType, peer: string | undefined) =>
        chatType === "group" ? peerToPeerRef.current !== "everyone" : !!peer && !allowsPeerToPeer(peer);

    // With `requireRelay`, the server refuses a call it can't relay through TURN
    // instead of letting it connect directly and reveal our IP address: ask
    // whether to go ahead anyway. Resolves { error: "cancelled" } if not.
    const emitCall = async (event: "call:start" | "call:join", payload: { callId: string } & Record<string, unknown>, requireRelay: boolean): Promise<Ack> => {
        const send = (requireRelay: boolean): Promise<Ack> =>
            socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, { ...payload, requireRelay });
        const res = await send(requireRelay);
        if (res?.error !== "relay-unavailable") return res;
        const confirmed = await Modal.confirm({
            title: "Your IP address can't be hidden",
            content: "The NanChat relay is unavailable right now. If you continue, this call connects directly and the other participants can see your IP address. The call stays end-to-end encrypted.",
            confirmText: "Continue anyway",
            cancelText: "Cancel",
            style: { "--z-index": "3000" } as React.CSSProperties, // over the call screen
        });
        if (!confirmed || !isCurrent(payload.callId)) return { error: "cancelled" };
        return send(false);
    };

    // signals of one peer are handled strictly in order: an ICE candidate must
    // never be processed before the offer that creates the connection
    const enqueue = (account: string, task: () => Promise<void>) => {
        const next = (queuesRef.current.get(account) ?? Promise.resolve())
            .then(task)
            .catch((error) => console.error("call signal handling failed", account, error));
        queuesRef.current.set(account, next);
        return next;
    };

    const sendControlState = (peer: Peer | undefined) => {
        const current = callRef.current;
        if (!current || peer?.control.readyState !== "open") return;
        peer.control.send(JSON.stringify({ type: "state", muted: current.muted, camera: current.cameraOn }));
    };
    const broadcastControlState = () => peersRef.current.forEach(sendControlState);

    const closePeer = (account: string) => {
        const peer = peersRef.current.get(account);
        if (!peer) return;
        if (peer.disconnectTimer) clearTimeout(peer.disconnectTimer);
        peer.control.close();
        peer.pc.close();
        peersRef.current.delete(account);
        setRemoteStreams(({ [account]: _removed, ...rest }) => rest);
    };

    const cleanupMedia = useCallback(() => {
        tones.stop();
        [...peersRef.current.keys()].forEach(closePeer);
        queuesRef.current.clear();
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        iceServersRef.current = null;
        setRelayAvailable(null);
        refreshedMembersRef.current.clear();
        joinedRef.current = false;
        setLocalVideoTrack(null);
        setRemoteStreams({});
    }, [tones]);

    const finish = useCallback((reason: string, notifyServer: boolean) => {
        const current = callRef.current;
        if (!current || current.status === "ended") return;
        if (notifyServer) {
            if (joinedRef.current) socket.emit("call:leave", { callId: current.callId, reason });
            else if (current.status === "incoming") socket.emit("call:decline", { callId: current.callId, reason });
        }
        cleanupMedia();
        setMinimized(false);
        setCall({ ...current, status: "ended", endReason: reason });
        setTimeout(() => setCall((c) => (c?.callId === current.callId ? null : c)), ENDED_SCREEN_MS);
    }, [cleanupMedia, setCall]);

    // the call stopped ringing here (answered on another device, declined elsewhere, ring timeout)
    const dismiss = (callId: string) => {
        if (callRef.current?.callId !== callId || callRef.current.status !== "incoming") return;
        cleanupMedia();
        setCall(null);
    };

    // Returns the local stream: microphone, plus the camera when `withCamera`.
    // A missing / denied camera falls back to audio (it can be retried from the
    // call screen), a missing microphone fails the call.
    const getLocalMedia = async (withCamera: boolean) => {
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
        } catch (error) {
            if (isPermissionError(error)) showPermissionDenied("microphone", "call");
            else Toast.show({ content: "Microphone unavailable", icon: "fail" });
            throw error;
        }
        localStreamRef.current = stream;
        if (withCamera) {
            try {
                const track = await getCamera(callRef.current?.facingMode ?? "user");
                stream.addTrack(track);
                setLocalVideoTrack(track);
                setCall((c) => (c ? { ...c, cameraOn: true } : c));
            } catch (error) {
                console.error("camera unavailable", error);
                if (isPermissionError(error)) showPermissionDenied("camera", "videoCall");
                else Toast.show({ content: "Camera unavailable, continuing with audio only" });
            }
        }
        navigator.mediaDevices.enumerateDevices()
            .then((devices) => setCanSwitchCamera(devices.filter((d) => d.kind === "videoinput").length > 1))
            .catch(() => setCanSwitchCamera(false));
        return stream;
    };

    const createPeer = (callId: string, account: string): Peer => {
        closePeer(account);
        const iceServers = iceServersRef.current ?? [];
        // Without peer to peer, the peer never learns our IP address: every
        // packet goes through TURN (which only sees encrypted DTLS-SRTP).
        const relayOnly = !allowsPeerToPeer(account) && hasTurnServer(iceServers);
        const pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: relayOnly ? "relay" : "all" });

        // pre-negotiated on both ends, so it doesn't depend on who creates it first
        const control = pc.createDataChannel("control", { negotiated: true, id: 0 });
        const peer: Peer = { pc, control, pendingIce: [], disconnectTimer: null };
        peersRef.current.set(account, peer);
        control.onopen = () => sendControlState(peer);
        control.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg?.type !== "state" || !isCurrent(callId)) return;
                updatePeer(account, { muted: msg.muted === true, camera: msg.camera === true });
            } catch (error) {
                console.error("invalid control message", error);
            }
        };

        pc.onicecandidate = (event) => {
            if (!event.candidate || !isCurrent(callId)) return;
            const data = encryptSignal({ type: "ice", callId, candidate: event.candidate.toJSON() }, account, activeAccountPk);
            socket.emit("call:signal", { callId, to: account, data });
        };
        pc.ontrack = (event) => {
            // rebuilt rather than mutated, so the <video>/<audio> elements re-render
            setRemoteStreams((streams) => {
                const tracks = streams[account]?.getTracks().filter((t) => t.kind !== event.track.kind) ?? [];
                return { ...streams, [account]: new MediaStream([...tracks, event.track]) };
            });
        };
        pc.oniceconnectionstatechange = () => {
            if (!isCurrent(callId) || peersRef.current.get(account) !== peer) return;
            const state = pc.iceConnectionState;
            if (state === "connected" || state === "completed") {
                if (peer.disconnectTimer) clearTimeout(peer.disconnectTimer);
                peer.disconnectTimer = null;
                updatePeer(account, { status: "connected" });
                setCall((c) => (c && c.status !== "ended" && c.status !== "active"
                    ? { ...c, status: "active", connectedAt: c.connectedAt ?? Date.now() }
                    : c));
            } else if (state === "disconnected") {
                updatePeer(account, { status: "reconnecting" });
                if (!peer.disconnectTimer) peer.disconnectTimer = setTimeout(() => onPeerFailed(callId, account), DISCONNECTED_GRACE_MS);
            } else if (state === "failed") {
                onPeerFailed(callId, account);
            }
        };
        return peer;
    };

    const onPeerFailed = (callId: string, account: string) => {
        if (!isCurrent(callId)) return;
        if (callRef.current?.chatType === "private") {
            finish("failed", true);
            return;
        }
        // group: rebuild that one connection, the other participants are unaffected.
        // Only one side offers again, so both don't race each other.
        updatePeer(account, { status: "reconnecting" });
        if (activeAccount < account) enqueue(account, () => sendOffer(callId, account));
    };

    const addLocalTracks = (pc: RTCPeerConnection, asOfferer: boolean) => {
        const stream = localStreamRef.current;
        if (!stream) return;
        // as answerer, addTrack reuses the audio transceiver created by the offer
        stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));
        if (!callRef.current?.video) return;
        const track = stream.getVideoTracks()[0];
        if (asOfferer) {
            pc.addTransceiver(track ?? "video", { direction: "sendrecv", streams: [stream] });
            return;
        }
        const transceiver = videoTransceiver(pc);
        if (!transceiver) return;
        // sendrecv even with the camera off, so it can be turned on later
        transceiver.direction = "sendrecv";
        if (track) transceiver.sender.replaceTrack(track);
    };

    const flushIce = (peer: Peer) => {
        const queued = peer.pendingIce;
        peer.pendingIce = [];
        queued.forEach((candidate) => peer.pc.addIceCandidate(candidate).catch((e) => console.error("addIceCandidate failed", e)));
    };

    const sendOffer = async (callId: string, account: string) => {
        if (!isCurrent(callId)) return;
        const { pc } = createPeer(callId, account);
        addLocalTracks(pc, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (!isCurrent(callId)) return;
        socket.emit("call:signal", { callId, to: account, data: encryptSignal({ type: "offer", callId, sdp: offer.sdp }, account, activeAccountPk) });
    };

    const handleSignal = async (callId: string, account: string, signal: Signal) => {
        if (!isCurrent(callId)) return;
        if (signal.type === "offer" && signal.sdp) {
            // a new participant, or a peer rebuilding a failed connection
            updatePeer(account, { status: "connecting" });
            const peer = createPeer(callId, account);
            await peer.pc.setRemoteDescription({ type: "offer", sdp: signal.sdp });
            flushIce(peer);
            addLocalTracks(peer.pc, false);
            const answer = await peer.pc.createAnswer();
            await peer.pc.setLocalDescription(answer);
            if (!isCurrent(callId)) return;
            socket.emit("call:signal", { callId, to: account, data: encryptSignal({ type: "answer", callId, sdp: answer.sdp }, account, activeAccountPk) });
            return;
        }
        const peer = peersRef.current.get(account);
        if (!peer) return;
        if (signal.type === "answer" && signal.sdp) {
            if (peer.pc.signalingState !== "have-local-offer") return;
            await peer.pc.setRemoteDescription({ type: "answer", sdp: signal.sdp });
            flushIce(peer);
        } else if (signal.type === "ice" && signal.candidate) {
            if (!peer.pc.remoteDescription) peer.pendingIce.push(signal.candidate);
            else await peer.pc.addIceCandidate(signal.candidate);
        }
    };

    const startCall = useCallback(async ({ chatId, chatType, peer }: { chatId: string; chatType: ChatType; peer?: string }, video: boolean) => {
        if (callRef.current && callRef.current.status !== "ended") {
            Toast.show({ content: "You are already on a call" });
            return;
        }
        if (unsupported()) {
            Toast.show({ content: "Calls are not supported on this device", icon: "fail" });
            return;
        }
        cleanupMedia();
        const callId = newCallId();
        setCall({
            callId, chatId, chatType, video, peer,
            direction: "outgoing", status: "outgoing", from: activeAccount,
            muted: false, cameraOn: false, facingMode: "user", peers: {},
        });
        try {
            await getLocalMedia(video);
            if (!isCurrent(callId)) return cleanupMedia(); // hung up while the permission prompt was open
            let res: Ack;
            try {
                res = await emitCall("call:start", { callId, chatId, video }, needsRelay(chatType, peer));
            } catch (error) {
                if (isCurrent(callId)) {
                    Toast.show({ content: "Unable to reach the server" });
                    finish("unavailable", false);
                }
                return;
            }
            if (!isCurrent(callId)) {
                // hung up before the server registered the call: make sure it stops ringing
                if (res?.ok) socket.emit("call:leave", { callId, reason: "hangup" });
                return;
            }
            if (res?.error === "exists" && res.callId) {
                // they called us at the same time, or the group call already runs: join it
                cleanupMedia();
                setCall(null);
                joinCall({ callId: res.callId, chatId, chatType, video: !!res.video, participants: res.participants ?? [] });
                return;
            }
            if (res?.error === "cancelled") return finish("hangup", false);
            if (res?.error) {
                Toast.show({ content: callErrorMessage(res.error) });
                finish(res.error === "busy" ? "busy" : "unavailable", false);
                return;
            }
            applyIceServers(res.iceServers);
            joinedRef.current = true;
            tones.play("ringback");
        } catch (error) {
            console.error("start call failed", error);
            finish("failed", false);
        }
    }, [activeAccount, activeAccountPk, cleanupMedia, finish, setCall, tones]);

    // join a ringing call (accept) or a running group call (banner)
    const joinCall = async (info: ActiveCallInfo, withCamera = true) => {
        const current = callRef.current;
        const accepting = current?.callId === info.callId && current.status === "incoming";
        if (current && current.status !== "ended" && !accepting) {
            Toast.show({ content: "You are already on a call" });
            return;
        }
        if (unsupported()) {
            Toast.show({ content: "Calls are not supported on this device", icon: "fail" });
            return;
        }
        if (!accepting) cleanupMedia();
        tones.stop();
        const { callId, chatId, chatType, video } = info;
        setCall({
            muted: false, cameraOn: false, facingMode: "user",
            from: info.participants[0] ?? activeAccount,
            ...(accepting ? current : {}),
            callId, chatId, chatType, video,
            // checked against our chat list before connecting to them (isCallPeer)
            peer: accepting ? current?.peer : chatType === "private" ? info.participants.find((p) => p !== activeAccount) : undefined,
            direction: accepting ? "incoming" : "outgoing",
            status: "connecting",
            peers: {},
        });
        try {
            await getLocalMedia(video && withCamera);
            if (!isCurrent(callId)) return cleanupMedia();
            let res: Ack;
            try {
                res = await emitCall("call:join", { callId }, needsRelay(chatType, info.participants.find((p) => p !== activeAccount)));
            } catch (error) {
                if (isCurrent(callId)) {
                    Toast.show({ content: "Unable to reach the server" });
                    finish("unavailable", false);
                }
                return;
            }
            if (!isCurrent(callId)) {
                if (res?.ok) socket.emit("call:leave", { callId, reason: "hangup" });
                return;
            }
            if (res?.error === "cancelled") {
                // rather not reveal our IP address: stop it ringing instead of leaving it to time out
                if (accepting) socket.emit("call:decline", { callId });
                finish(accepting ? "declined" : "hangup", false);
                return;
            }
            if (res?.error) {
                Toast.show({ content: res.error === "Call not found" ? "This call has ended" : callErrorMessage(res.error) });
                finish("unavailable", false);
                return;
            }
            applyIceServers(res.iceServers);
            joinedRef.current = true;
            const participants = (res.participants ?? []).filter((p) => p !== activeAccount);
            if (participants.length === 0) {
                // everyone else left meanwhile: wait in the call
                setCall((c) => (c ? { ...c, status: "active", connectedAt: c.connectedAt ?? Date.now() } : c));
            }
            participants.forEach((account) => {
                enqueue(account, async () => {
                    if (!(await isCallPeer(callId, account))) return;
                    updatePeer(account, { status: "connecting" });
                    await sendOffer(callId, account);
                });
            });
        } catch (error) {
            console.error("join call failed", error);
            finish("failed", true);
        }
    };

    const toggleMute = () => {
        const current = callRef.current;
        if (!current) return;
        const muted = !current.muted;
        localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
        setCall({ ...current, muted });
        broadcastControlState();
    };

    // Turning the camera off stops the track (camera light goes off) instead of
    // just sending black frames.
    const setCamera = async (on: boolean, facingMode?: CallState["facingMode"]) => {
        const current = callRef.current;
        if (!current?.video || cameraBusy.current) return;
        cameraBusy.current = true;
        const { callId } = current;
        const senders = () => [...peersRef.current.values()].map((p) => videoTransceiver(p.pc)?.sender).filter(Boolean) as RTCRtpSender[];
        try {
            const previous = localStreamRef.current?.getVideoTracks()[0];
            if (previous) {
                // stopped before opening the next one: most phones can't open two cameras at once
                await Promise.all(senders().map((s) => s.replaceTrack(null)));
                previous.stop();
                localStreamRef.current?.removeTrack(previous);
                setLocalVideoTrack(null);
            }
            const nextFacing = facingMode ?? current.facingMode;
            let track: MediaStreamTrack | null = null;
            if (on) {
                try {
                    track = await getCamera(nextFacing);
                } catch (error) {
                    console.error("camera unavailable", error);
                    if (isPermissionError(error)) showPermissionDenied("camera", "videoCall");
                    else Toast.show({ content: "Camera unavailable", icon: "fail" });
                }
            }
            if (!isCurrent(callId)) {
                track?.stop();
                return;
            }
            if (track) {
                localStreamRef.current?.addTrack(track);
                await Promise.all(senders().map((s) => s.replaceTrack(track)));
                setLocalVideoTrack(track);
            }
            setCall((c) => (c ? { ...c, cameraOn: track != null, facingMode: nextFacing } : c));
            broadcastControlState();
        } finally {
            cameraBusy.current = false;
        }
    };

    const toggleCamera = () => setCamera(!callRef.current?.cameraOn);
    const switchCamera = () => {
        const current = callRef.current;
        if (!current?.cameraOn) return;
        setCamera(true, current.facingMode === "user" ? "environment" : "user");
    };

    // keep the screen awake during video calls
    const wantsWakeLock = !!call?.video && call.status !== "ended" && call.status !== "incoming";
    useEffect(() => {
        if (!wantsWakeLock) return;
        let lock: { release: () => Promise<void> } | null = null;
        let released = false;
        const request = () => {
            (navigator as any).wakeLock?.request("screen")
                .then((l: typeof lock) => {
                    if (released) l?.release();
                    else lock = l;
                })
                .catch(() => {});
        };
        // the lock is dropped whenever the page is hidden
        const onVisible = () => document.visibilityState === "visible" && request();
        request();
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            released = true;
            document.removeEventListener("visibilitychange", onVisible);
            lock?.release().catch(() => {});
        };
    }, [wantsWakeLock]);

    useEffect(() => {
        if (!activeAccount || !activeAccountPk) return;

        const pendingRings = new Set<string>();
        const onRing = async (ring: RingEvent) => {
            const { callId, chatId, chatType, video, fromAccount, fromAccountName } = ring;
            if (callRef.current?.callId === callId || pendingRings.has(callId)) return; // re-sent on reconnect
            if (callRef.current && callRef.current.status !== "ended") {
                socket.emit("call:decline", { callId, reason: "busy" });
                return;
            }
            if (unsupported()) {
                socket.emit("call:decline", { callId, reason: "busy" });
                return;
            }
            pendingRings.add(callId);
            // the caller (who becomes the peer of a private call) must be in that chat
            const validCaller = fromAccount !== activeAccount && await isChatMember(chatId, fromAccount);
            if (!validCaller) {
                pendingRings.delete(callId);
                console.warn("call: ignoring a ring from outside its chat", fromAccount);
                return;
            }
            // "Who can call me": the server refuses calls for `nobody`, but only
            // we know our contacts. Fetched per ring so it's never stale.
            const audience: CallAudience = await fetcherMessages("/config-privacy", activeAccountPk)
                .then((privacy) => privacy?.calls ?? "everyone")
                .catch(() => "everyone")
                .finally(() => pendingRings.delete(callId));
            if (!audienceIncludes(audience, isSavedContact(contactsRef.current, fromAccount))) {
                socket.emit("call:decline", { callId, reason: "unavailable" });
                return;
            }
            if (callRef.current?.callId === callId) return;
            if (callRef.current && callRef.current.status !== "ended") {
                socket.emit("call:decline", { callId, reason: "busy" });
                return;
            }
            cleanupMedia();
            setMinimized(false);
            setCall({
                callId, chatId, chatType, video,
                direction: "incoming", status: "incoming", from: fromAccount,
                peer: chatType === "private" ? fromAccount : undefined,
                muted: false, cameraOn: false, facingMode: "user", peers: {},
            });
            tones.play("ringtone");
            if (isTauri() && !(await getCurrentWindow().isFocused())) {
                sendNotificationTauri(fromAccountName || "NanChat", video ? "Incoming video call" : "Incoming call", chatId); // click: back to the app, on the chat
            }
        };
        const onSignal = ({ callId, from, data }: { callId: string; from: string; data: string }) => {
            if (!isCurrent(callId) || !joinedRef.current) return;
            const signal = decryptSignal(data, callId, from, activeAccountPk);
            if (!signal) return;
            enqueue(from, async () => {
                if (await isCallPeer(callId, from)) await handleSignal(callId, from, signal);
            });
        };
        const onJoined = async ({ callId, account }: { callId: string; account: string }) => {
            if (!isCurrent(callId) || !(await isCallPeer(callId, account)) || !isCurrent(callId)) return;
            tones.stop();
            setCall((c) => (c && c.status === "outgoing" ? { ...c, status: "connecting" } : c));
            updatePeer(account, { status: "connecting" }); // they send us an offer
        };
        const onLeft = ({ callId, account }: { callId: string; account: string }) => {
            if (!isCurrent(callId)) return;
            closePeer(account);
            setCall((c) => {
                if (!c) return c;
                const { [account]: _left, ...peers } = c.peers;
                return { ...c, peers };
            });
        };
        const onEnd = ({ callId, reason }: { callId: string; reason: string }) => {
            if (isCurrent(callId)) finish(reason, false);
        };
        const onDismiss = ({ callId }: { callId: string }) => dismiss(callId);
        const onState = (state: ActiveCallInfo & { ended?: boolean }) => {
            setActiveCalls(({ [state.chatId]: _previous, ...rest }) => (state.ended ? rest : { ...rest, [state.chatId]: state }));
        };
        const onConnect = () => {
            socket.emit("call:sync"); // running calls, and a call ringing us (opened from its notification)
            const current = callRef.current;
            if (!current || current.status === "ended" || !joinedRef.current) return;
            // signaling socket came back: the media kept flowing peer to peer
            socket.timeout(ACK_TIMEOUT_MS).emit("call:resume", { callId: current.callId }, (err: Error | null, res: Ack) => {
                if (!isCurrent(current.callId)) return;
                if (!err && res?.error) finish("failed", false);
            });
        };

        socket.on("call:ring", onRing);
        socket.on("call:signal", onSignal);
        socket.on("call:joined", onJoined);
        socket.on("call:left", onLeft);
        socket.on("call:end", onEnd);
        socket.on("call:dismiss", onDismiss);
        socket.on("call:state", onState);
        socket.on("connect", onConnect);
        if (socket.connected) socket.emit("call:sync");
        const onUnload = () => finish("hangup", true);
        window.addEventListener("beforeunload", onUnload);
        return () => {
            socket.off("call:ring", onRing);
            socket.off("call:signal", onSignal);
            socket.off("call:joined", onJoined);
            socket.off("call:left", onLeft);
            socket.off("call:end", onEnd);
            socket.off("call:dismiss", onDismiss);
            socket.off("call:state", onState);
            socket.off("connect", onConnect);
            window.removeEventListener("beforeunload", onUnload);
            // switching account (or locking the wallet) hangs up
            finish("hangup", true);
            setActiveCalls({});
        };
    }, [activeAccount, activeAccountPk]);

    const unknownCaller = !!call && call.direction === "incoming" && call.from !== activeAccount && !isSavedContact(contacts, call.from);
    // before joining it's unknown, but a call that needs the relay never connects
    // directly without asking (see emitCall)
    const ipHidden = !!call && relayAvailable !== false && !audienceIncludes(peerToPeer, isSavedContact(contacts, call.from));

    return (
        <CallContext.Provider value={{ call, activeCalls, startCall, joinCall }}>
            {children}
            {Object.entries(remoteStreams).map(([account, stream]) => (
                <RemoteAudio key={account} stream={stream} />
            ))}
            {call && (
                <CallScreen
                    call={call}
                    minimized={minimized}
                    localVideoTrack={localVideoTrack}
                    remoteStreams={remoteStreams}
                    canSwitchCamera={canSwitchCamera}
                    unknownCaller={unknownCaller}
                    ipHidden={ipHidden}
                    onMinimize={setMinimized}
                    onAccept={(withCamera) => joinCall(
                        { callId: call.callId, chatId: call.chatId, chatType: call.chatType, video: call.video, participants: [call.from] },
                        withCamera,
                    )}
                    onDecline={() => finish("declined", true)}
                    onHangUp={() => finish("hangup", true)}
                    onToggleMute={toggleMute}
                    onToggleCamera={toggleCamera}
                    onSwitchCamera={switchCamera}
                />
            )}
        </CallContext.Provider>
    );
};
