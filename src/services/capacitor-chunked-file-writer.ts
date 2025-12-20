import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { restoreData, setData } from './database.service';
import { FileOpener } from '@capacitor-community/file-opener';
import { Toast } from 'antd-mobile';
import {GenericOAuth2} from "@capacitor-community/generic-oauth2";
import CloudStorage from 'capacitor-icloud-drive';

const path = `${Directory.Data}/downloads`;

const optionGoogleAuth = {
  authorizationBaseUrl: "https://accounts.google.com/o/oauth2/auth",
  accessTokenEndpoint: "https://www.googleapis.com/oauth2/v4/token",
  scope: "email profile https://www.googleapis.com/auth/drive.file",
  resourceUrl: "https://www.googleapis.com/userinfo/v2/me",
  web: {
    appId: import.meta.env.VITE_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    responseType: "token", // implicit flow
    accessTokenEndpoint: "", // clear the tokenEndpoint as we know that implicit flow gets the accessToken from the authorizationRequest
    redirectUrl: import.meta.env.VITE_PUBLIC_REDIRECT_URL,
    windowOptions: "height=600,left=0,top=0"
  },
  android: {
    appId: import.meta.env.VITE_PUBLIC_GOOGLE_ANDROID_APP_ID,
    responseType: "code", // if you configured a android app in google dev console the value must be "code"
    redirectUrl: "com.nanchat.app:/", 
  },
  ios: {
    appId: import.meta.env.VITE_PUBLIC_GOOGLE_ANDROID_APP_ID,
    responseType: "code", // if you configured a ios app in google dev console the value must be "code"
    redirectUrl: "com.nanchat.app:/", 
  },
}
const DIRECTORY_WALLET_BACKUP = "nanchat-wallet-backups";
// First, search for the folder to see if it exists
async function getFolderOrCreate(token) {
  // Check if folder exists first
  const searchResponse = await fetch(
    'https://www.googleapis.com/drive/v3/files?q=name%3D%27NanChatWalletBackups%27%20and%20mimeType%3D%27application/vnd.google-apps.folder%27%20and%20trashed%3Dfalse',
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const searchData = await searchResponse.json();
  
  // If folder exists, return its ID
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }
  
  // If folder doesn't exist, create it
  const folderResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: DIRECTORY_WALLET_BACKUP,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  
  const folderData = await folderResponse.json();
  return folderData.id;
}


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
export async function loadWalletsFromICloud() {
  const result = await CloudStorage.listFilesFromiCloudDrive();
  console.log(result.files);
  return result.files.map(file => {
    return {
      name: file.name,
      size: file.size
    }
  });
  const file = await Filesystem.readdir({
    directory: Directory.Documents,
    path: DIRECTORY_WALLET_BACKUP
  })
  return file.files.map(file => {
    return {
      name: file.name,
      id: file.name
    }
  })
}

export async function loadWalletFromICloud(filename) {
  const file = await CloudStorage.readFromiCloudDrive({
    fileName: filename
  });
  return file.data;
  // const file = await Filesystem.readFile({
  //   directory: Directory.Documents,
  //   path: `${DIRECTORY_WALLET_BACKUP}/${filename}`
  // })
  // return file.data;
}

export async function deleteWalletFromICloud(filename) {
  await CloudStorage.deleteFromiCloudDrive({
    fileName: filename
  });
}

export async function deleteWalletFromGoogleDrive(fileId, token) {
  return fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
}
export async function loadWalletFromGoogleDrive(fileId, token) {
  return fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    return response.text();
  })
}

export async function loadWalletsFromGoogleDrive() {
  let token: string;
  return GenericOAuth2.authenticate(optionGoogleAuth)
  .then(async resourceUrlResponse => {
    console.log('Google OAuth success', resourceUrlResponse);
    token = resourceUrlResponse.access_token;
  })
  .then(async () => { 
    return fetch(`https://www.googleapis.com/drive/v3/files`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
  })
  .then(response => {
    return response.json();
  })
  .then(data => {
    console.log('Google Drive folder contents', data);
    return {
      files: data.files,
      token: token
    }
  })
}

export async function backupWalletGoogleDrive(encryptedWalletTxt, filename) {
  let token: string;
  return GenericOAuth2.authenticate(optionGoogleAuth).then(async resourceUrlResponse => {
    console.log('Google OAuth success', resourceUrlResponse);
    token = resourceUrlResponse.access_token;
    return getFolderOrCreate(token);
  }).then(folderId => {
    const metadata = {
      name: filename,
      mimeType: 'text/plain',
      parents: [folderId]
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([encryptedWalletTxt], { type: 'text/plain' }));
    return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: form
    });
  }).then(response => {
    if (!response.ok) {
      return response.json().then(err => { throw err; });
    }
    return response.json();
  }).then(data => {
    console.log('Google Drive upload success', data);
    return data;
  }).catch(error => {
    console.error('Google Drive upload failed', error);
    throw error;
  });
}

async function saveToiCloudDrive(fileName, data) {
  try {
    const result = await CloudStorage.saveToiCloudDrive({
      fileName: fileName, 
      data: data
    });
    console.log('File saved to iCloud Drive successfully:', result);
    return result;
  } catch (error) {
    console.error('Error saving to iCloud Drive:', error);
    throw error;
  }
}

export async function backupWalletICloud(encryptedWalletTxt, filename) {
  const file = await saveToiCloudDrive(filename, encryptedWalletTxt);
  // const file = await Filesystem.writeFile({
  //   directory: Directory.Documents,
  //   data: encryptedWalletTxt,
  //   path: `${DIRECTORY_WALLET_BACKUP}/${filename}`,
  //   recursive: true
  // });
  if (file.uri) {
    return file.uri;
  }
  return null;
}

const safeMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'text/plain',
]
export let fileIDsBeingDecrypted = new Set();
export let fileIDsBeingSaved = new Set();
/**
 * Writes a Uint8Array to a file in chunks using base64 encoding with Capacitor
 * 
 * @param {string} fileName - Name of the file to save
 * @param {Uint8Array} data - Binary data to write
 * @param {Directory} directory - Capacitor directory to save in (default: Directory.Data)
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
  const safeType = safeMimeTypes.includes(meta.type) ? meta.type : 'application/octet-stream'; 
  // octet-stream allows the browser to choose a safe way to handle the file
  // without it, a svg with javascript could be interpreted if opened in a new tab
  meta.type = safeType;
  if (Capacitor.getPlatform() === 'web') {
    let blob = new Blob([data], {type: meta.type});
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
    await writeFileChunked(fileID, new Blob([data], {type: meta.type}), Directory.Data);
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
 * @param {Directory} directory - Capacitor directory to read from (default: Directory.Data)
 * @returns {Promise<String>} - Blob URL of the file
 */
let blobUrlCache = new Map()
export async function readFileToBlobUrl(fileId) {
  if (blobUrlCache.has(fileId)){
    console.log('hit file blob from cache')
    return blobUrlCache.get(fileId)
  }
  try {
    if (Capacitor.getPlatform() === 'web') {
      try {
        const fileInfo = await Filesystem.readFile({
          directory: Directory.Data,
          path: fileId
        });
        let url = URL.createObjectURL(fileInfo.data);
        console.log('File read successfully from filesystem:', url);
        blobUrlCache.set(fileId, url)
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
    let converted = Capacitor.convertFileSrc(uri);
    
    converted = converted.replace(import.meta.env.VITE_PUBLIC_SERVER_URL, 'https://localhost'); // only usefull when using dev server
    console.log('File read successfully from filesystem:', uri, converted);
    blobUrlCache.set(fileId, converted)
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
 * Lists all files in a directory recursively and returns their sizes.
 *
 * @param {Directory} directory - The directory to list files from.
 * @param {string} path - The path to list files from.
 * @returns {Promise<Array<{name: string, size: number}>>} - List of files with their sizes.
 */
export async function listFilesWithSize(directory: Directory = Directory.Data, path: string = ''): Promise<Array<{name: string, size: number}>> {


  try {
    const files = await Filesystem.readdir({ directory, path });
    let fileSizes = [];

    for (const file of files.files) {
      const filePath = `${path}/${file.name}`;
      if (file.type === 'directory') {
        const nestedFiles = await listFilesWithSize(directory, filePath);
        fileSizes = fileSizes.concat(nestedFiles);
      } else {
        const stat = await Filesystem.stat({ directory, path: filePath });
        const meta = await restoreData(filePath.substring(1)); // remove the first / to get the correct path
        fileSizes.push({ size: stat.size, meta: meta, name: filePath });
      }
    }

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
