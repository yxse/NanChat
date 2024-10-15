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

export function autoLockAfterInactivity(): void {
  let timeout: NodeJS.Timeout;
  window.addEventListener("mousemove", () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      window.location.reload();
    }, 60000);
  });
}
