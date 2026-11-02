import { useSyncExternalStore } from 'react';

// Progress of files being sent, keyed by the local message id.
// Kept outside SWR so progress ticks only re-render the uploading bubble, not the whole chat.

export type UploadStage = 'preparing' | 'encrypting' | 'uploading' | 'error';

export interface UploadState {
    stage: UploadStage;
    progress: number; // 0..1, only meaningful while uploading
    error?: string;
    cancel?: () => void;
    retry?: () => void;
}

const uploads = new Map<string, UploadState>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

export const setUploadState = (id: string, patch: Partial<UploadState>) => {
    uploads.set(id, { ...(uploads.get(id) as UploadState), ...patch });
    notify();
};

export const clearUploadState = (id: string) => {
    uploads.delete(id);
    notify();
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const useUploadState = (id: string) => useSyncExternalStore(subscribe, () => uploads.get(id));
