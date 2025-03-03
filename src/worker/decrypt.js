import { box } from 'multi-nano-web';

// decryptWorker.js
self.onmessage = async function(e) {
  const { targetAccount, decryptionKey, content } = e.data;
  console.log("web worker decrypting message");
  try {
    let decrypted = box.decrypt(content, targetAccount, decryptionKey);
    self.postMessage({ 
      status: 'success', 
      decrypted: decrypted
    });
  } catch (error) {
    self.postMessage({ 
      status: 'error', 
      error: error.message 
    });
  }
};