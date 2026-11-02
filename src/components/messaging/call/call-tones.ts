// Ringtone / ringback synthesized with WebAudio, so calls need no audio assets.

type Tone = "ringtone" | "ringback";

// D major arpeggio climbing in octave leaps (D, F#, A, D), notes ringing into each other
const RING = {
    period: 2600,
    beeps: [
        { freqs: [293.66], at: 0, duration: 0.8 },
        { freqs: [587.33], at: 0.09, duration: 0.8 },
        { freqs: [369.99], at: 0.24, duration: 0.8 },
        { freqs: [739.99], at: 0.33, duration: 0.8 },
        { freqs: [440], at: 0.48, duration: 0.8 },
        { freqs: [880], at: 0.57, duration: 0.8 },
        { freqs: [587.33], at: 0.72, duration: 1 },
        { freqs: [1174.66], at: 0.81, duration: 1.4 },
    ],
};

// same tone for incoming and outgoing calls
const PATTERNS: Record<Tone, typeof RING> = { ringtone: RING, ringback: RING };

export const createTonePlayer = () => {
    let ctx: AudioContext | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    // marimba-like: warm fundamental plus a bright 4th partial that dies out quickly
    const PARTIALS = [
        { ratio: 1, level: 0.1, decay: 1 },
        { ratio: 4, level: 0.04, decay: 0.15 },
    ];

    const beep = (freqs: number[], at: number, duration: number) => {
        if (!ctx) return;
        const start = ctx.currentTime + at;
        for (const freq of freqs) {
            for (const { ratio, level, decay } of PARTIALS) {
                const end = start + duration * decay;
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.0001, start);
                gain.gain.exponentialRampToValueAtTime(level, start + 0.005);
                gain.gain.exponentialRampToValueAtTime(0.0001, end);
                gain.connect(ctx.destination);
                const osc = ctx.createOscillator();
                osc.frequency.value = freq * ratio;
                osc.connect(gain);
                osc.start(start);
                osc.stop(end);
            }
        }
    };

    const stop = () => {
        if (interval) clearInterval(interval);
        interval = null;
        navigator.vibrate?.(0);
        ctx?.close().catch(() => {});
        ctx = null;
    };

    const play = (tone: Tone) => {
        stop();
        try {
            ctx = new AudioContext();
            // may stay suspended without a user gesture (incoming call): vibration still works
            ctx.resume().catch(() => {});
        } catch (error) {
            console.error("tone player unavailable", error);
        }
        const pattern = PATTERNS[tone];
        const tick = () => {
            pattern.beeps.forEach(({ freqs, at, duration }) => beep(freqs, at, duration));
            if (tone === "ringtone") navigator.vibrate?.([90, 150, 90, 150, 90, 150, 500]);
        };
        tick();
        interval = setInterval(tick, pattern.period);
    };

    return { play, stop };
};
