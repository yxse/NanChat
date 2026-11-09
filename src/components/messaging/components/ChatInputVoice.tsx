import { useEffect, useRef, useState } from "react";
import { Toast } from "antd-mobile";
import { LockOutline } from "antd-mobile-icons";
import { FaArrowUp, FaMicrophone, FaTrash } from "react-icons/fa6";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { isPermissionError, showPermissionDenied } from "../../../utils/permissions";
import { useInCall } from "../call/CallProvider";
import { formatDuration } from "./MessageAudio";
import { useEncryptedFileSender, UploadStartInfo, UploadSuccessInfo } from "../hooks/use-encrypted-file-sender";

const MAX_DURATION_S = 15 * 60;
const MIN_DURATION_S = 0.7;
const LEVEL_BARS = 32;

// AAC first: it plays everywhere (iOS included). Opus/webm is what Chrome/Firefox record when they have no AAC encoder.
const MIME_CANDIDATES: [string, string][] = [
    ["audio/mp4;codecs=mp4a.40.2", "m4a"],
    ["audio/mp4", "m4a"],
    ["audio/webm;codecs=opus", "webm"],
    ["audio/webm", "webm"],
    ["audio/ogg;codecs=opus", "ogg"],
];

const pickFormat = () => {
    for (const [mime, ext] of MIME_CANDIDATES) {
        try {
            if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
        } catch (error) {}
    }
    return { mime: "", ext: "webm" }; // let the browser choose
};

const extensionFor = (mime: string, fallback: string) => {
    if (mime.startsWith("audio/mp4") || mime.startsWith("audio/aac")) return "m4a";
    if (mime.startsWith("audio/webm")) return "webm";
    if (mime.startsWith("audio/ogg")) return "ogg";
    return fallback;
};

const haptic = () => {
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
};

type Recording = {
    stream: MediaStream;
    recorder: MediaRecorder;
    chunks: Blob[];
    startedAt: number;
    audioContext?: AudioContext;
    frame?: number;
    timer?: ReturnType<typeof setInterval>;
    ext: string;
};

// Mic button of the chat input. While recording, an overlay covers the input row (its parent must be position: relative).
const ChatInputVoice = ({ accountTo, onUploadStart, onUploadSuccess, onUploadCancel, onRecordingChange }: {
    accountTo: string | undefined;
    onUploadStart: (file: UploadStartInfo) => void;
    onUploadSuccess: (file: UploadSuccessInfo) => void;
    onUploadCancel: (localId: string) => void;
    onRecordingChange?: (recording: boolean) => void;
}) => {
    const { t } = useTranslation();
    const inCall = useInCall();
    const { sendFile } = useEncryptedFileSender({ accountTo, onUploadStart, onUploadSuccess, onUploadCancel });
    const recordingRef = useRef<Recording | null>(null);
    const [recording, setRecording] = useState(false);
    const [starting, setStarting] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [levels, setLevels] = useState<number[]>([]);
    const stopRef = useRef<(send: boolean) => void>(() => {});

    const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

    useEffect(() => { onRecordingChange?.(recording); }, [recording]);

    const release = (rec: Recording) => {
        if (rec.frame) cancelAnimationFrame(rec.frame);
        if (rec.timer) clearInterval(rec.timer);
        rec.stream.getTracks().forEach((track) => track.stop());
        rec.audioContext?.close().catch(() => {});
    };

    const stop = (send: boolean) => {
        const rec = recordingRef.current;
        if (!rec) return;
        recordingRef.current = null;
        setRecording(false);
        setLevels([]);
        const duration = (performance.now() - rec.startedAt) / 1000;
        rec.recorder.onstop = () => {
            release(rec);
            if (!send) return;
            if (duration < MIN_DURATION_S) {
                Toast.show({ content: t("voiceMessageTooShort"), position: "bottom" });
                return;
            }
            const type = (rec.recorder.mimeType || rec.chunks[0]?.type || "audio/webm").split(";")[0];
            const ext = extensionFor(type, rec.ext);
            const name = `voice-message-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`;
            const file = new File(rec.chunks, name, { type });
            sendFile(file, async () => file, { duration: Math.round(duration * 10) / 10 });
        };
        if (send) haptic();
        try {
            if (rec.recorder.state !== "inactive") rec.recorder.stop();
            else rec.recorder.onstop?.(new Event("stop"));
        } catch (error) {
            release(rec);
        }
    };
    stopRef.current = stop;

    // leaving the chat discards the recording
    useEffect(() => () => stopRef.current(false), []);

    const start = async () => {
        if (recordingRef.current || starting) return;
        if (!supported) {
            Toast.show({ content: t("voiceMessageUnsupported"), icon: "fail" });
            return;
        }
        if (inCall) {
            Toast.show({ content: t("voiceMessageInCall"), position: "bottom" });
            return;
        }
        if (!accountTo) return;
        setStarting(true);
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        } catch (error: any) {
            setStarting(false);
            if (isPermissionError(error)) showPermissionDenied("microphone", "voiceMessage");
            else Toast.show({ content: t("voiceMessageMicUnavailable"), icon: "fail" });
            return;
        }
        const { mime, ext } = pickFormat();
        let recorder: MediaRecorder;
        try {
            recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined);
        } catch (error) {
            stream.getTracks().forEach((track) => track.stop());
            setStarting(false);
            Toast.show({ content: t("voiceMessageUnsupported"), icon: "fail" });
            return;
        }
        const rec: Recording = { stream, recorder, chunks: [], startedAt: performance.now(), ext };
        recorder.ondataavailable = (e) => { if (e.data?.size) rec.chunks.push(e.data); };
        recorder.start(500);
        recordingRef.current = rec;
        haptic();

        // live level meter
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const audioContext: AudioContext = new AudioCtx();
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 512;
            audioContext.createMediaStreamSource(stream).connect(analyser);
            rec.audioContext = audioContext;
            const data = new Uint8Array(analyser.fftSize);
            let lastPush = 0;
            let peak = 0;
            const loop = (now: number) => {
                analyser.getByteTimeDomainData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i++) {
                    const v = (data[i] - 128) / 128;
                    sum += v * v;
                }
                peak = Math.max(peak, Math.sqrt(sum / data.length));
                if (now - lastPush > 90) { // ~11 bars per second, no need to re-render every frame
                    const level = Math.min(1, peak * 4);
                    setLevels((prev) => [...prev, level].slice(-LEVEL_BARS));
                    peak = 0;
                    lastPush = now;
                }
                rec.frame = requestAnimationFrame(loop);
            };
            rec.frame = requestAnimationFrame(loop);
        } catch (error) {
            console.warn("level meter unavailable", error);
        }

        rec.timer = setInterval(() => {
            const seconds = (performance.now() - rec.startedAt) / 1000;
            setElapsed(seconds);
            if (seconds >= MAX_DURATION_S) stopRef.current(true);
        }, 200);
        setElapsed(0);
        setRecording(true);
        setStarting(false);
    };

    // a call (eg. an accepted incoming ring) takes the mic over: discard the recording
    useEffect(() => {
        if (inCall && recordingRef.current) stopRef.current(false);
    }, [inCall]);

    if (!supported) return null;

    const bars = [...Array(Math.max(0, LEVEL_BARS - levels.length)).fill(0), ...levels];

    return (
        <>
            <div
                onClick={start}
                className="hoverable"
                role="button"
                aria-label={t("voiceMessage")}
                style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, opacity: starting ? 0.5 : 1 }}
            >
                <FaMicrophone style={{ width: 22, height: 22 }} />
            </div>
            {recording && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: "var(--adm-color-background)",
                    }}
                >
                    <div
                        onClick={() => stop(false)}
                        role="button"
                        aria-label={t("cancel")}
                        className="hoverable"
                        style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--adm-color-danger)", flexShrink: 0 }}
                    >
                        <FaTrash style={{ width: 18, height: 18 }} />
                    </div>
                    <div
                        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, borderRadius: 6, background: "var(--adm-color-border)", padding: "0 12px", height: 40 }}
                    >
                        <span className="voice-recording-dot" />
                        <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 36 }}>{formatDuration(Math.floor(elapsed))}</span>
                        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2, height: 24, overflow: "hidden", color: "var(--adm-color-primary)" }}>
                            {bars.map((level, i) => (
                                <div key={i} style={{ width: 3, flexShrink: 0, borderRadius: 2, background: "currentColor", height: Math.max(3, Math.round(level * 24)), opacity: level ? 1 : 0.3 }} />
                            ))}
                        </div>
                        <LockOutline style={{ color: "var(--adm-color-text-secondary)", flexShrink: 0 }} aria-label={t("voiceMessageEncrypted")} />
                    </div>
                    <div
                        onClick={() => stop(true)}
                        role="button"
                        aria-label={t("send")}
                        style={{ height: 32, width: 32, borderRadius: "50%", background: "var(--adm-color-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                    >
                        <FaArrowUp className="w-5 h-5" />
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatInputVoice;
