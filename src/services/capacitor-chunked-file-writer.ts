import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { restoreData, setData } from './database.service';

async function writeFileChunked(path, blob, directory = Directory.Data, recursive = true) {
  // Initialize the file with empty data
  await Filesystem.writeFile({
    directory,
    path,
    recursive,
    data: ""
  });

  // Now write the file incrementally so that we do not exhaust our memory in
  // attempting to Base64 encode the entire Blob at once.
  if (blob.size === 0) {
    return;
  }

  // By choosing a chunk size which is a multiple of 3, we avoid a bug in
  // Filesystem.appendFile, only on the web platform, which corrupts files by
  // inserting Base64 padding characters within the file. See
  // https://github.com/ionic-team/capacitor-plugins/issues/649.
  const chunk_size = 3 * 128 * 1024;

  // Recursive async function to consume the blob in chunks
  async function consume_blob() {
    if (blob.size === 0) {
      return;
    }
    
    const chunk_blob = blob.slice(0, chunk_size);
    blob = blob.slice(chunk_size);
    
    // Read the Blob as an ArrayBuffer, then append it to the file on disk.
    const buffer = await new Response(chunk_blob).arrayBuffer();
    await Filesystem.appendFile({
      directory,
      path,
      data: arrayBufferToBase64(buffer)
    });
    
    // Process the next chunk
    return consume_blob();
  }

  // Start consuming the blob
  return consume_blob();
}

export let fileIDsBeingSaved = new Set();
/**
 * Writes a Uint8Array to a file in chunks using base64 encoding with Capacitor
 * 
 * @param {string} fileName - Name of the file to save
 * @param {Uint8Array} data - Binary data to write
 * @param {Directory} directory - Capacitor directory to save in (default: Directory.Documents)
 * @param {number} chunkSize - Size of each chunk in bytes (default: 512KB)
 * @returns {Promise<string>} - Path to the saved file
 */
export async function writeUint8ArrayToFile(
  fileID, 
  data, 
  meta,
  chunkSize = 1024 * 1024 * 8 // 8MB
) {
  if (fileIDsBeingSaved.has(fileID)) {
    throw new Error('File is already being saved: ' + fileID);
  }
  fileIDsBeingSaved.add(fileID);
  if (!(data instanceof Uint8Array)) {
    throw new Error('Data must be a Uint8Array, received: ' + typeof data);
  }
  if (Capacitor.getPlatform() === 'web') {
    let blob = new Blob([data]);
   let r =  
    await Filesystem.writeFile({
      path: fileID,
      data: blob,
      directory: Directory.Data,
      recursive: true
    });
    fileIDsBeingSaved.delete(fileID);
    // return r.uri;
  }
  else{
    await writeFileChunked(fileID, new Blob([data]), directory);
  }
  fileIDsBeingSaved.delete(fileID);
  await setData(fileID, {
    ...meta, 
    size: data.length
  })
  return fileID;
}

/**
 * Reads a base64-encoded file and converts it to blob URL using Capacitor
 * 
 * @param {string} fileName - Name of the file to read
 * @param {Directory} directory - Capacitor directory to read from (default: Directory.Documents)
 * @returns {Promise<String>} - Blob URL of the file
 */
export async function readFileToBlobUrl(fileId) {
  try {
    if (Capacitor.getPlatform() === 'web') {
      try {
        const fileInfo = await Filesystem.readFile({
          directory: Directory.Data,
          path: fileId
        });
        let url = URL.createObjectURL(fileInfo.data);
        return url;
      } catch (error) {
        return null; 
      }
    }
    try {
      let exist = await Filesystem.stat({ path: fileId, directory: Directory.Data });
    } catch (error) {
      return null;      
    }
    const uri = `${(await Filesystem.getUri({ path: fileId, directory: Directory.Data })).uri}`;
    let converted = await Capacitor.convertFileSrc(uri);
    
    converted = converted.replace(import.meta.env.VITE_PUBLIC_SERVER_URL, 'https://localhost'); // only usefull when using dev server
    console.log('File read successfully:', uri, converted);
    return converted
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
}

/**
 * Helper function to convert ArrayBuffer to base64 string
 * 
 * @param {ArrayBuffer} buffer - The ArrayBuffer to convert
 * @returns {string} - base64 string
 */
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return btoa(binary);
}

/**
 * Lists all files in a directory and returns their sizes.
 *
 * @param {Directory} directory - The directory to list files from.
 * @returns {Promise<Array<{name: string, size: number}>>} - List of files with their sizes.
 */
export async function listFilesWithSize(directory: Directory = Directory.Data): Promise<Array<{name: string, size: number}>> {
  try {
    const files = await Filesystem.readdir({ directory, path: '' });
    const fileSizes = await Promise.all(files.files.map(async (file: { name: string }) => {
      const stat = await Filesystem.stat({ directory, path: file.name });
      return { size: stat.size, meta: await restoreData(file.name), name: file.name}
    }));
    return fileSizes;
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
}

/**
 * Deletes a file from the specified directory.
 *
 * @param {string} fileName - The name of the file to delete.
 * @param {Directory} directory - The directory from which to delete the file.
 * @returns {Promise<void>} - Resolves when the file is deleted.
 */
export async function deleteFile(fileName: string, directory: Directory = Directory.Data): Promise<void> {
  try {
    await Filesystem.deleteFile({ directory, path: fileName });
    console.log(`File ${fileName} deleted successfully.`);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}
