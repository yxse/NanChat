import { box } from 'multi-nano-web';

// Persistent decrypt worker.
// Supports request-id multiplexing so a single worker instance can handle
// many concurrent calls from the main thread.
self.onmessage = function (e) {
  const { id, action } = e.data || {};

  if (!action || action === 'decrypt') {
    const { targetAccount, decryptionKey, content } = e.data;
    try {
      const decrypted = box.decrypt(content, targetAccount, decryptionKey);
      self.postMessage({ id, status: 'success', decrypted });
    } catch (error) {
      self.postMessage({ id, status: 'error', error: error?.message ?? String(error) });
    }
  }
};
