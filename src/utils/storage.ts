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

export async function setSeed(seed: string): Promise<void> {
  // localStorage.setItem("seed", seed);
  if (isTauri()) {
    await KeyringService.saveSecret('nanwallet', 'seed', seed);
  }
  else {
    // const retrievedSeed = await KeyringService.getSecret('nanwallet', 'seed');
    // console.log("Keyring seed: ", retrievedSeed);
    SecureStoragePlugin.set({key: "seed", value: seed});
    const value = await SecureStoragePlugin.get({key: "seed"});
    console.log("SecureStorage seed: ", value);
  }
}

export async function getSeed(): Promise<string> {
  try {
    if (isTauri()) {
      const seed = await KeyringService.getSecret('nanwallet', 'seed');
      return seed
    }
    else{
      let seed = await SecureStoragePlugin.get({key: "seed"})
      return seed.value;
    }
    
  } catch (error) {
    console.error("Error getting seed: ", error);
    return localStorage.getItem("seed");
  }
  // return localStorage.getItem("seed");
}

export function removeSeed(): void {
  localStorage.removeItem("seed");
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
