import { box } from 'multi-nano-web';

// decryptWorker.js
self.onmessage = async function(e) {
  const { file, targetAccount, decryptionKey, message } = e.data;
  console.log("web worker Decrypting file", file.url);
  try {
    let fileURL = new URL(file.url);
    let fileID = fileURL.pathname.split('/').pop();
    
    // Note: You'll need to implement cache reading logic for workers
    // or move that to the main thread
    let data = await fetch(file.url);
    let fileData = await data.bytes();
    
    console.log("Decrypting file", file.url);
    console.time("decrypt file");
    let decrypted = box.decryptFile(fileData, targetAccount, decryptionKey);
    
    console.timeEnd("decrypt file");
    console.log("Decrypted file");
    
    // Either save the file in the worker (if possible) or send data back
    // await writeUint8ArrayToFile(fileID, decrypted); // If possible in worker
    
    // Send the decrypted data back to the main thread
    self.postMessage({ 
      status: 'success', 
      fileID: fileID,
      decrypted: decrypted
    });
  } catch (error) {
    self.postMessage({ 
      status: 'error', 
      error: error.message 
    });
  }
};