// Client wrapper around the persistent decrypt worker.
// Lazily spawns one worker and multiplexes requests over it via request ids.

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (value: string) => void; reject: (err: Error) => void }
>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./decrypt.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const { id, status, decrypted, error } = e.data || {};
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (status === 'success') {
      entry.resolve(decrypted);
    } else {
      entry.reject(new Error(error || 'decrypt worker error'));
    }
  };
  worker.onerror = (e) => {
    // Fail every pending request so callers don't hang.
    const err = new Error(e.message || 'decrypt worker crashed');
    for (const { reject } of pending.values()) reject(err);
    pending.clear();
    worker = null;
  };
  return worker;
}

export function boxDecryptInWorker(
  content: string,
  targetAccount: string,
  decryptionKey: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, action: 'decrypt', content, targetAccount, decryptionKey });
  });
}
