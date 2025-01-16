import { isTauri } from "@tauri-apps/api/core";
import KeyringService from "../services/tauri-keyring-frontend";
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

interface StorageArea {
  [key: string]: any;
}

export default {
  get: <T>(key: string, storageArea: any): any => {
    return localStorage.getItem(key);
    return new Promise((resolve, reject) => {
      chrome.storage[storageArea].get(key, (items: StorageArea) => {
        const error = chrome.runtime.lastError;
        if (error) return reject(error);
        resolve(items[key]);
      });
    });
  },
  set: (key: string, value: any, storageArea: any): any => {
    return localStorage.setItem(key, value);
    return new Promise((resolve, reject) => {
      chrome.storage[storageArea].set({ [key]: value }, () => {
        const error = chrome.runtime.lastError;
        error ? reject(error) : resolve();
      });
    });
  },
  remove: (key: string, storageArea: any): any => {
    return localStorage.removeItem(key);
    return new Promise((resolve, reject) => {
      chrome.storage[storageArea].remove(key, () => {
        const error = chrome.runtime.lastError;
        error ? reject(error) : resolve();
      });
    });
  }
};

export function resetWallet(): void {
  localStorage.clear();
  // chrome.storage.local.clear();
}

export async function setSeed(seed: string, isPasswordEncrypted: boolean): Promise<void> {
  // localStorage.setItem("seed", seed);
  let valueSeed = JSON.stringify({
    seed: seed,
    isPasswordEncrypted: isPasswordEncrypted
  });
  if (isTauri()) {
    await KeyringService.saveSecret('nanwallet', 'seed', valueSeed);
  }
  else {
    // const retrievedSeed = await KeyringService.getSecret('nanwallet', 'seed');
    // console.log("Keyring seed: ", retrievedSeed);
    SecureStoragePlugin.set({key: "seed", value: valueSeed});
    const value = await SecureStoragePlugin.get({key: "seed"});
    console.log("SecureStorage seed: ", value);
  }
}

const getActiveAccount = () => {
  let activeAddress = localStorage.getItem('activeAddress');
  if (!activeAddress){
      const activeAddresses = JSON.parse(localStorage.getItem('activeAddresses'));
      activeAddress = activeAddresses[0];
      localStorage.setItem('activeAddress', activeAddress);
  }
  return activeAddress
}

export async function getChatToken(): Promise<string> {
  const tokens = await getChatTokens();
  return tokens?.[getActiveAccount()];
}

const keyTokenChat = "chatTokens";
export async function getChatTokens(): Promise<string> {
  try {
    if (isTauri()) {
      const token = await KeyringService.getSecret('nanwallet', keyTokenChat);
      return JSON.parse(token);
    }
    else{
      let token = await SecureStoragePlugin.get({key: keyTokenChat})
      return JSON.parse(token.value);
    }
    
  } catch (error) {
    console.error("Error getting token: ", error);
    return {};
  }
  // return localStorage.getItem("seed");
}

export async function setChatToken(account: string, token: string): Promise<void> {
  let existingTokens = await getChatTokens();
  if (!existingTokens) {
    existingTokens = {};
  }
  existingTokens[account] = token;
  let r
  debugger;
  if (isTauri()) {
    r = 
    await KeyringService.saveSecret('nanwallet', keyTokenChat, JSON.stringify(existingTokens));
  }
  else {
    r = await
    SecureStoragePlugin.set({key: keyTokenChat, value: JSON.stringify(existingTokens)});
  }
  console.log("Saved token: ", r);
}


export async function getSeed(): Promise<string> {
  try {
    if (isTauri()) {
      const seed = await KeyringService.getSecret('nanwallet', 'seed');
      return JSON.parse(seed);
    }
    else{
      let seed = await SecureStoragePlugin.get({key: "seed"})
      return JSON.parse(seed.value);
    }
    
  } catch (error) {
    console.error("Error getting seed: ", error);
    return null
    // return JSON
  }
  // return localStorage.getItem("seed");
}

export function removeSeed(): void {
  try {
    if (isTauri()) {
      KeyringService.deleteSecret('nanwallet', 'seed');
      KeyringService.deleteSecret('nanwallet', keyTokenChat);
    }
    else{
      SecureStoragePlugin.remove({key: "seed"});
      SecureStoragePlugin.remove({key: keyTokenChat});
    }
  }
  catch (error) {
    console.error("Error removing seed: ", error);
  }
}



export function autoLockAfterInactivity(): void {
  let timeout: NodeJS.Timeout;
  window.addEventListener("mousemove", () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      window.location.reload();
    }, 60000);
  });
}
