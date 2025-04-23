import { isTauri } from "@tauri-apps/api/core";
import KeyringService from "../services/tauri-keyring-frontend";
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { mutate } from "swr";
import { getNewChatToken } from "../components/messaging/fetcher";
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
const PIN_DELAYS = [
  // based on iOS delay https://support.apple.com/guide/security/sec20230a10d/web
  5000, 


  // 0, 
  // 0,
  // 0, 
  // 0, 
  // 1000 * 60, // 1 minute
  // 1000 * 60 * 5, // 5 minutes
  // 1000 * 60 * 15, // 15 minutes
  // 1000 * 60 * 60, // 1 hour
  // 1000 * 60 * 60 * 3, // 3 hours
  // 1000 * 60 * 60 * 8, // 8 hours
];
const PIN_MAX_ATTEMPTS = 100;
export async function setPin(pin: string): Promise<void> {
  // localStorage.setItem("pin", pin);
  const pinValue = JSON.stringify({
    pin: pin,
    attemptsRemaining: PIN_MAX_ATTEMPTS,
    nextAttempt: 0,
  });
  await saveInSecureStorage('pin', pinValue);
}



export async function verifyPin(pin: string): Promise<{error: string, nextAttempt: number, valid: boolean, attemptsRemaining?: number}> {
  const pinValue = await getFromSecureStorage('pin');
  const pinObj = JSON.parse(pinValue);
  if (pinObj.nextAttempt > Date.now()) {
    return {
      error: `Please wait ${Math.ceil((pinObj.nextAttempt - Date.now()) / 1000)} seconds before trying again`,
      nextAttempt: pinObj.nextAttempt,
      attemptsRemaining: pinObj.attemptsRemaining,
      valid: false
    }
  }
  if (pinObj.pin === pin) {
    pinObj.attemptsRemaining = PIN_MAX_ATTEMPTS;
    pinObj.nextAttempt = 0;
    await saveInSecureStorage('pin', JSON.stringify(pinObj));
    return {
      valid: true,
    }
  }
  else{
    pinObj.attemptsRemaining -= 1;
    const failedAttempts = PIN_MAX_ATTEMPTS - pinObj.attemptsRemaining;
    const delay = failedAttempts < PIN_DELAYS.length ? PIN_DELAYS[failedAttempts] : PIN_DELAYS[PIN_DELAYS.length - 1]; 
    if (delay > 0) {
      pinObj.nextAttempt = Date.now() + delay;
    }
    if (pinObj.attemptsRemaining <= 0) {
      console.log("Erasing wallet after too many failed pin attempts");
      await removeSeed();
      window.location.reload();
      return;
    }
    await saveInSecureStorage('pin', JSON.stringify(pinObj));
    return {
      error: "Incorrect, try again",
      nextAttempt: pinObj.nextAttempt,
      attemptsRemaining: pinObj.attemptsRemaining,
      valid: false
    }
  }
}
export async function getPinInfo(): Promise<{nextAttempt: number, attemptsRemaining: number}> {
  const pinValue = await getFromSecureStorage('pin');
  const pinObj = JSON.parse(pinValue);
  return {
    nextAttempt: pinObj.nextAttempt,
    attemptsRemaining: pinObj.attemptsRemaining
  }
}
export async function getIsPasswordEncrypted(): Promise<boolean> {
  const seed = await getSeed();
  return seed?.isPasswordEncrypted;
}
export async function setSeed(seed: string, isPasswordEncrypted: boolean, pin: string = ""): Promise<void> {
  // localStorage.setItem("seed", seed);
  const listSeeds = [{
    seed: seed,
    isPasswordEncrypted: isPasswordEncrypted
  }] // to support multiple seeds eventually
  let valueSeed = JSON.stringify(listSeeds);
  await saveInSecureStorage('seed', valueSeed);
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

export async function getChatToken(activeAccountPk): Promise<string> {
  const tokens = await getChatTokens();
  const activeAccount = getActiveAccount();
  let token = tokens?.[activeAccount]?.token;
  let expiresAt = tokens?.[activeAccount]?.expiresAt;
  if (!token){
    console.log("No cached token, fetching new one");
   return await getNewChatToken(activeAccount, activeAccountPk);
  }
  if (expiresAt && new Date(expiresAt) < new Date()) {
    console.log("Token expired, fetching new one");
    return await getNewChatToken(activeAccount, activeAccountPk);
  }
  return token;
}

const keyTokenChat = "chatTokens";
// Simple cache variable to store the tokens, prevent hitting secure storage multiple times which can be slow
let tokensCache: string | null = null;

export async function getChatTokens(): Promise<string> {
  try {
    // Return cached value if available
    if (tokensCache !== null) {
      return tokensCache;
    }
// debugger
    // No cache, fetch the actual value
    if (isTauri()) {
      const token = await KeyringService.getSecret('nanwallet', keyTokenChat);
      tokensCache = JSON.parse(token);
    } else {
      let token = await SecureStoragePlugin.get({key: keyTokenChat});
      tokensCache = JSON.parse(token.value);
    }

    return tokensCache;

  } catch (error) {
    console.error("Error getting token: ", error);
    return {};
  }
  // return localStorage.getItem("seed");
}

// Add a function to invalidate the cache if needed
export function invalidateChatTokensCache(): void {
  tokensCache = null;
}

export async function saveInSecureStorage(key: string, value: string): Promise<void> {
  if (isTauri()) {
    await KeyringService.saveSecret('nanwallet', key, value);
  }
  else {
    await SecureStoragePlugin.set({key: key, value: value});
  }
}
export async function getFromSecureStorage(key: string): Promise<string> {
  if (isTauri()) {
    return await KeyringService.getSecret('nanwallet', key);
  }
  else {
    const value = await SecureStoragePlugin.get({key: key});
    return value.value;
  }
}
export async function setChatToken(account: string, token: string, expiresAt: number): Promise<void> {
  let existingTokens = await getChatTokens();
  if (!existingTokens) {
    existingTokens = {};
  }
  existingTokens[account] = {
    token: token,
    expiresAt: expiresAt
  };
  await saveInSecureStorage(keyTokenChat, JSON.stringify(existingTokens));
}


export async function getSeed(): Promise<string> {
  try {
    const seed = await getFromSecureStorage('seed');
    const json = JSON.parse(seed)
    if (Array.isArray(json) && json.length > 0) {
      return json[0]
    }
    return json
  } catch (error) {
    console.error("Error getting seed: ", error);
    return null
    // return JSON
  }
  // return localStorage.getItem("seed");
}

export async function removeSeed(): Promise<void> {
  // reset wallet
  try {
    localStorage.clear();
    if (isTauri()) {
      await KeyringService.deleteSecret('nanwallet', 'seed');
      await KeyringService.deleteSecret('nanwallet', keyTokenChat);
      await KeyringService.deleteSecret('nanwallet', 'pin');
    }
    else{
      await SecureStoragePlugin.clear();
    }
    mutate(key => true, undefined, {revalidate: false}); // clear all swr caches
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
