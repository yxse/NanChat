import { useCallback, useSyncExternalStore } from 'react';

// Address -> participant lookup built from the chats list.
//
// ProfileName is rendered for every message, it used to subscribe to the whole chats SWR store and scan every
// chat's participants on each render: any chats update (new message in any chat, unread reset...) then made SWR
// check thousands of subscribers. Here the index is built once per chats update and each name only subscribes to
// its own address, so it re-renders only when that participant actually changes.

let indexedChats: unknown = undefined;
let ready = false;
let index = new Map<string, any>();
let signatures = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();
const pending = new Set<string>();
let pendingAll = false;

// called during useChats render: cheap when the chats array did not change, does not notify (see flush)
export function indexChats(chats: any[] | undefined, isReady: boolean) {
    if (chats === indexedChats && isReady === ready) return;
    if (isReady !== ready) pendingAll = true;
    ready = isReady;
    indexedChats = chats;

    const nextIndex = new Map<string, any>();
    const nextSignatures = new Map<string, string>();
    for (const chat of Array.isArray(chats) ? chats : []) {
        for (const participant of chat?.participants || []) {
            const address = participant?._id;
            if (!address || nextIndex.has(address)) continue; // first chat wins, as before
            const signature = JSON.stringify(participant);
            const unchanged = signatures.get(address) === signature;
            nextIndex.set(address, unchanged ? index.get(address) : participant); // keep identity when unchanged
            nextSignatures.set(address, signature);
            if (!unchanged) pending.add(address);
        }
    }
    for (const address of index.keys()) {
        if (!nextIndex.has(address)) pending.add(address);
    }
    index = nextIndex;
    signatures = nextSignatures;
}

// called from an effect after indexChats: notifies the subscribers of changed addresses
export function flushParticipantChanges() {
    if (pendingAll) {
        pendingAll = false;
        pending.clear();
        listeners.forEach(set => set.forEach(listener => listener()));
        return;
    }
    for (const address of pending) listeners.get(address)?.forEach(listener => listener());
    pending.clear();
}

export function useParticipant(address: string | undefined) {
    const subscribe = useCallback((listener: () => void) => {
        if (!address) return () => { };
        let set = listeners.get(address);
        if (!set) listeners.set(address, set = new Set());
        set.add(listener);
        return () => {
            set!.delete(listener);
            if (set!.size === 0) listeners.delete(address);
        };
    }, [address]);
    const participant = useSyncExternalStore(subscribe, () => (address ? index.get(address) : undefined));
    const isReady = useSyncExternalStore(subscribe, () => ready);
    return { participant, ready: isReady };
}
