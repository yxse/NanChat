import { box } from "multi-nano-web";
import { convertAddress } from "../../../utils/convertAddress";

// Every signaling payload (offer, answer, ICE candidates) is box-encrypted with
// our private key to the peer's address, the same scheme as private messages.
// box is authenticated, so a payload that decrypts was written by the peer:
// the server relaying it can neither read the SDP nor swap the DTLS
// fingerprints inside it, which is what keeps the DTLS-SRTP media end to end.

export type SignalType = "offer" | "answer" | "ice";

export type Signal = {
    v: 1;
    type: SignalType;
    callId: string;
    ts: number;
    sdp?: string;
    candidate?: RTCIceCandidateInit;
};

const SIGNAL_TYPES: SignalType[] = ["offer", "answer", "ice"];

// an offer older than this is a replay
const MAX_OFFER_AGE_MS = 60 * 1000;

export const encryptSignal = (
    signal: Omit<Signal, "v" | "ts">,
    peerAddress: string,
    activeAccountPk: string,
): string => {
    const payload: Signal = { v: 1, ts: Date.now(), ...signal };
    return box.encrypt(JSON.stringify(payload), peerAddress, activeAccountPk);
};

export const decryptSignal = (
    data: string,
    callId: string,
    peerAddress: string,
    activeAccountPk: string,
): Signal | null => {
    try {
        const signal: Signal = JSON.parse(box.decrypt(data, peerAddress, activeAccountPk));
        // bound to this call, so a relayed blob from another call can't be replayed here
        if (signal?.v !== 1 || !SIGNAL_TYPES.includes(signal.type) || signal.callId !== callId) {
            return null;
        }
        if (signal.type === "offer" && Math.abs(Date.now() - signal.ts) > MAX_OFFER_AGE_MS) {
            return null;
        }
        return signal;
    } catch (error) {
        console.error("call signal decryption failed", error);
        return null;
    }
};

export const newCallId = (): string => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

// relay-only connections hide our IP address from the peer, which needs a TURN server
export const hasTurnServer = (iceServers: RTCIceServer[]) =>
    iceServers.some((server) =>
        [server.urls].flat().some((url) => url.startsWith("turn:") || url.startsWith("turns:"))
    );

type Contact = { addresses?: { address: string }[] };

export const isSavedContact = (contacts: Contact[] | undefined, address: string) => {
    if (!address || !Array.isArray(contacts)) return false;
    const target = convertAddress(address, "XNO");
    return contacts.some((contact) =>
        contact.addresses?.some((a) => a?.address && convertAddress(a.address, "XNO") === target)
    );
};

// "Who can call me" (stored on the server, `contacts` is enforced by our app)
// and "Peer to peer" (local) call privacy settings
export type CallAudience = "everyone" | "contacts" | "nobody";
export const P2P_SETTING_KEY = "call-peer-to-peer";
export const P2P_DEFAULT: CallAudience = "contacts";

export const audienceIncludes = (audience: CallAudience | undefined, isContact: boolean) =>
    audience === "everyone" || (audience === "contacts" && isContact);
