import { box } from 'multi-nano-web';

// Persistent decryption worker.
// Supports request-id multiplexing so a single worker instance can handle
// many concurrent box.decrypt calls from the main thread.
self.onmessage = function (e) {
  const { id, targetAccount, decryptionKey, content } = e.data || {};
  try {
    const decrypted = box.decrypt(content, targetAccount, decryptionKey);
    self.postMessage({ id, status: 'success', decrypted });
  } catch (error) {
    self.postMessage({
      id,
      status: 'error',
      error: error && error.message ? error.message : String(error),
    });
  }
};