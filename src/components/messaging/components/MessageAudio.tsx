import { memo, useEffect, useRef, useState } from "react";
import { SpinLoading, Toast } from "antd-mobile";
import { FaPause, FaPlay } from "react-icons/fa6";
import { MdOutlineSubtitles } from "react-icons/md";
import { useTranslation } from "react-i18next";
import {
    Transcript,
    TranscriptionDeclinedError,
    getCachedTranscript,
    isAutoTranscribeEnabled,
    isModelDownloaded,
    isTranscriptionSupported,
    resolveModel,
    transcribe,
    useTranscriptionState,
} from "../../../services/transcription.service";
import { languageName } from "../../../services/translation.service";

const BAR_COUNT = 36;
const MAX_DECODE_SIZE = 20 * 1024 * 1024; // above this, decoding the whole file just to draw bars isn't worth it
const SPEEDS = [1, 1.5, 2];

// Peaks are computed locally from the decrypted audio, nothing about the recording is sent in clear.
type Waveform = { peaks: number[]; duration: number };
const waveformCache = new Map<string, Promise<Waveform | null>>();

const computeWaveform = async (src: string): Promise<Waveform | null> => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    const buffer = await (await fetch(src)).arrayBuffer();
    if (buffer.byteLength > MAX_DECODE_SIZE) return null;
    const ctx = new AudioCtx();
    try {
        // callback form: old Safari doesn't return a promise
        const audio: AudioBuffer = await new Promise((resolve, reject) => {
            const p = ctx.decodeAudioData(buffer, resolve, reject);
            p?.catch?.(reject);
        });
        const data = audio.getChannelData(0);
        const bucket = Math.max(1, Math.floor(data.length / BAR_COUNT));
        const peaks: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
            let sum = 0;
            const start = i * bucket;
            const end = Math.min(data.length, start + bucket);
            for (let j = start; j < end; j += 4) sum += data[j] * data[j];
            peaks.push(Math.sqrt(sum / Math.max(1, (end - start) / 4)));
        }
        const max = Math.max(...peaks, 0.0001);
        return { peaks: peaks.map((p) => p / max), duration: audio.duration };
    } finally {
        ctx.close?.().catch(() => {});
    }
};

export const getWaveform = (key: string, src: string) => {
    if (!waveformCache.has(key)) {
        waveformCache.set(key, computeWaveform(src).catch((error) => {
            console.warn("Could not compute waveform", error);
            return null;
        }));
    }
    return waveformCache.get(key)!;
};

export const formatDuration = (seconds: number | undefined) => {
    if (!seconds || !isFinite(seconds) || seconds < 0) seconds = 0;
    const s = Math.round(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// only one message plays at a time
let currentAudio: HTMLAudioElement | null = null;
let preferredSpeed = 1;

export const WaveformBars = ({ peaks, progress = 0, height = 28, onSeek }: { peaks?: number[] | null; progress?: number; height?: number; onSeek?: (ratio: number) => void }) => {
    const bars = peaks || Array(BAR_COUNT).fill(0.15);
    const seek = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!onSeek) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onSeek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
    };
    return (
        <div
            onPointerDown={(e) => { e.stopPropagation(); seek(e); }}
            onPointerMove={(e) => { if (e.buttons === 1) seek(e); }}
            style={{ display: "flex", alignItems: "center", gap: 2, height, cursor: onSeek ? "pointer" : "default", touchAction: "none", width: "100%", flexShrink: 0 }} // fixed height: placeholder and real bars take the same space
        >
            {bars.map((peak, i) => (
                <div
                    key={i}
                    style={{
                        flex: 1,
                        minWidth: 2,
                        maxWidth: 4,
                        borderRadius: 2,
                        height: Math.max(3, Math.round(peak * height)),
                        background: "currentColor",
                        opacity: (i + 0.5) / bars.length <= progress ? 1 : 0.35,
                        transition: "opacity 0.1s",
                    }}
                />
            ))}
        </div>
    );
};

type Props = {
    src: string | null; // decrypted file url, null while loading
    cacheKey: string;
    duration?: number; // from the message meta, known before the file is decrypted
    isFromCurrentUser: boolean;
    onError?: () => void;
};

const MessageAudio = ({ src, cacheKey, duration: metaDuration, isFromCurrentUser, onError }: Props) => {
    const { t } = useTranslation();
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [waveform, setWaveform] = useState<Waveform | null>(null);
    const [elementDuration, setElementDuration] = useState<number | null>(null);
    const [speed, setSpeed] = useState(preferredSpeed);
    const [transcript, setTranscript] = useState<Transcript | null>(null);
    const [transcribing, setTranscribing] = useState(false);
    const [transcriptVisible, setTranscriptVisible] = useState(true);
    const transcriptionState = useTranscriptionState();
    useEffect(() => {
        if (!src) return;
        let mounted = true;
        getWaveform(cacheKey, src).then((w) => mounted && setWaveform(w));
        return () => { mounted = false; };
    }, [src, cacheKey]);

    const runTranscription = async (interactive: boolean) => {
        if (!src) return;
        setTranscribing(true);
        try {
            const result = await transcribe(cacheKey, src, { interactive });
            setTranscript(result);
            setTranscriptVisible(true);
        } catch (error) {
            if (interactive && !(error instanceof TranscriptionDeclinedError)) {
                console.error("transcription failed", error);
                Toast.show({ icon: "fail", content: t("transcriptionFailed") });
            }
        } finally {
            setTranscribing(false);
        }
    };

    // already transcribed in this session, or auto transcription of received messages
    useEffect(() => {
        if (!src || !isTranscriptionSupported()) return;
        let mounted = true;
        const cached = getCachedTranscript(cacheKey);
        if (cached) {
            setTranscribing(true);
            cached.then((result) => mounted && setTranscript(result)).catch(() => {}).finally(() => mounted && setTranscribing(false));
        } else if (!isFromCurrentUser && isAutoTranscribeEnabled()) {
            resolveModel().then(isModelDownloaded).then((downloaded) => {
                if (downloaded && mounted) runTranscription(false);
            });
        }
        return () => { mounted = false; };
    }, [src, cacheKey]);

    const onTranscribeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (transcribing) return;
        if (transcript) setTranscriptVisible(!transcriptVisible);
        else runTranscription(true);
    };

    // smooth progress while playing (timeupdate only fires ~4 times per second)
    useEffect(() => {
        if (!playing) return;
        let frame: number;
        const tick = () => {
            if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [playing]);

    useEffect(() => () => {
        if (currentAudio === audioRef.current) currentAudio = null;
    }, []);

    // webm recordings report an Infinity duration: prefer the decoded one, then the sender's
    const duration = (elementDuration && isFinite(elementDuration) ? elementDuration : null) || waveform?.duration || metaDuration || 0;
    const progress = duration ? Math.min(1, currentTime / duration) : 0;

    const togglePlay = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio || !src) return;
        if (!audio.paused) {
            audio.pause();
            return;
        }
        if (currentAudio && currentAudio !== audio) currentAudio.pause();
        currentAudio = audio;
        audio.playbackRate = speed;
        try {
            await audio.play();
        } catch (error) {
            console.error("Could not play audio", error);
        }
    };

    const seek = (ratio: number) => {
        const audio = audioRef.current;
        if (!audio || !duration) return;
        audio.currentTime = ratio * duration;
        setCurrentTime(audio.currentTime);
    };

    const cycleSpeed = (e: React.MouseEvent) => {
        e.stopPropagation();
        const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
        preferredSpeed = next;
        setSpeed(next);
        if (audioRef.current) audioRef.current.playbackRate = next;
    };

    const showTranscribeButton = isTranscriptionSupported() && !!src;
    const downloading = transcribing && transcriptionState.status === "downloading";

    return (
        <div
            className={`chat-message ${isFromCurrentUser ? "to" : "from"}`}
            style={{ borderRadius: 8, padding: "8px 10px", width: 260, maxWidth: "100%", userSelect: "none", WebkitUserSelect: "none" }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {src && (
                    <audio
                        ref={audioRef}
                        src={src}
                        preload="metadata"
                        onLoadedMetadata={(e) => setElementDuration(e.currentTarget.duration)}
                        onDurationChange={(e) => setElementDuration(e.currentTarget.duration)}
                        onPlay={() => setPlaying(true)}
                        onPause={() => { setPlaying(false); if (audioRef.current) setCurrentTime(audioRef.current.currentTime); }}
                        onEnded={() => { setPlaying(false); setCurrentTime(0); if (audioRef.current) audioRef.current.currentTime = 0; }}
                        onError={() => onError?.()}
                    />
                )}
                <div
                    onClick={togglePlay}
                    aria-label={playing ? "Pause" : "Play"}
                    role="button"
                    style={{
                        width: 38,
                        height: 38,
                        flexShrink: 0,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: src ? "pointer" : "default",
                        background: isFromCurrentUser ? "var(--adm-color-background)" : "var(--adm-color-primary)",
                        color: isFromCurrentUser ? "var(--adm-color-primary)" : "#fff",
                    }}
                >
                    {!src ? <SpinLoading color="currentColor" style={{ "--size": "18px" } as any} /> :
                        playing ? <FaPause size={15} /> : <FaPlay size={14} style={{ marginLeft: 2 }} />}
                </div>
                <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 2 }}>
                    <WaveformBars peaks={waveform?.peaks} progress={progress} onSeek={src ? seek : undefined} />
                    {/* fixed height: the speed badge (with its border) replaces the label without moving anything */}
                    <div className="text-xs" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.75, height: 16 }}>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatDuration(playing || currentTime > 0 ? currentTime : duration)}</span>
                        {(playing || currentTime > 0 || speed !== 1) ?
                            <span onClick={cycleSpeed} style={{ cursor: "pointer", fontWeight: 600, padding: "0 6px", borderRadius: 8, border: "1px solid currentColor", lineHeight: "14px" }}>
                                {speed}×
                            </span>
                            : <span>{t("voiceMessage")}</span>}
                    </div>
                </div>
                {showTranscribeButton && (
                    <div
                        onClick={onTranscribeClick}
                        role="button"
                        aria-label={t("transcribe")}
                        title={t("transcribe")}
                        style={{ flexShrink: 0, display: "flex", alignItems: "center", cursor: transcribing ? "default" : "pointer", opacity: transcript && transcriptVisible ? 1 : 0.7 }}
                    >
                        {transcribing ? <SpinLoading color="currentColor" style={{ "--size": "18px" } as any} /> : <MdOutlineSubtitles size={20} />}
                    </div>
                )}
            </div>
            {transcribing && !transcript && (
                <div className="text-xs" style={{ marginTop: 6, opacity: 0.75 }}>
                    {downloading
                        ? t("downloadingSpeechModel", { percent: Math.round(transcriptionState.progress * 100) })
                        : t("transcribing")}
                </div>
            )}
            {transcript && transcriptVisible && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid color-mix(in srgb, currentColor 25%, transparent)", userSelect: "text", WebkitUserSelect: "text" }}>
                    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {transcript.text || <span style={{ opacity: 0.6 }}>{t("transcriptEmpty")}</span>}
                    </div>
                    <div className="text-xs flex items-center gap-1" style={{ opacity: 0.6, marginTop: 2 }}>
                        <MdOutlineSubtitles /> {t("transcript")}{transcript.language ? ` · ${languageName(transcript.language)}` : ""}
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(MessageAudio);
