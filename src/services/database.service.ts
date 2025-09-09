import {
    CapgoCapacitorDataStorageSqlite,
    capOpenStorageOptions,
  } from "@capgo/capacitor-data-storage-sqlite";
  
  export let sqlStore = CapgoCapacitorDataStorageSqlite;
  export let inMemoryMap = new Map<string, any>();
  // Call this function before accessing 
  // functions like sqlStore.get sqlStore.set etc...
  export let initSqlStore = async () => {
    console.log("Init capacitor-data-storage-sqlite");
  
    let options: capOpenStorageOptions = {
      database: "nanchat_db",
      table: "cache",
    };
  
    try {
      await sqlStore.openStore(options);
    } catch (err) {
      console.log("Error initialising capacitor-data-storage-sqlite.");
      console.log(err);
    }
  };

  export let setDataString = async (key: string, value: string): Promise<boolean> => {
    await initSqlStore();
    try {
      await sqlStore.set({ key: key, value: value });
      console.log("set data", value)
      inMemoryMap.set(key, value);
      return true;
    } catch (err) {
      console.log(`Error setting ${key}: ${value}`);
      console.log(err);
      return false;
    }
  }
  export let setData = async (key: string, value: any): Promise<boolean> => {
    await initSqlStore();
    let valueJson = JSON.stringify(value);
    try {
      await sqlStore.set({ key: key, value: valueJson });
      console.log("set data", valueJson)
      inMemoryMap.set(key, value);
      return true;
    } catch (err) {
      console.log(`Error setting ${key}: ${valueJson}`);
      console.log(err);
      return false;
    }
  }
  
  export let restoreData = async (key: string): Promise<any> => {
    await initSqlStore();
    try {
        if (inMemoryMap.has(key)) {
            console.log("hit data from memory", key)
            return inMemoryMap.get(key)
        }
      let exists = await sqlStore.iskey({ key: key });
      if (!exists.result) return null;
      let valueJson = await sqlStore.get({ key: key});
      let value = JSON.parse(valueJson.value);
        inMemoryMap.set(key, value)
      return value;
    } catch (err) {
      console.log(`Error restoring key ${key}`);
      console.log(err);
      return null;
    }
  }
  export let restoreDataString = async (key: string): Promise<any> => {
    await initSqlStore();
    try {
        if (inMemoryMap.has(key)) {
            console.log("hit data from memory", key)
            return inMemoryMap.get(key)
        }
      let exists = await sqlStore.iskey({ key: key });
      if (!exists.result) return null;
      let valueSring = (await sqlStore.get({ key: key})).value
        inMemoryMap.set(key, valueSring)
      return valueSring;
    } catch (err) {
      console.log(`Error restoring key ${key}`);
      console.log(err);
      return null;
    }
  }
  
  export async function saveFileInCache(url, meta, base64Data) {
      await initSqlStore();
      // Store the file
      await sqlStore.set({key: url, value: base64Data})
      // store metadata distincly to avoid json parsing the file
      await setData("file-meta-" + url, {type: meta?.type, size: meta?.size, name: meta?.name})
  }
  export  async function retrieveFileFromCache(url) {
      if (retrieveFromMemory(url)) {
          return retrieveFromMemory(url)
      }
      await initSqlStore();
      const [data, metaData] = await Promise.all([
          sqlStore.get({key: url}),
          restoreData("file-meta-" + url)
      ])
      if (!data || data.value == null || data.value == "") return null
      inMemoryMap.set(url, data.value)
      inMemoryMap.set("file-meta-" + url, metaData)
      console.log("hit file from sqlstore", url)
      return {data: data.value, meta: metaData}
  }
  export function retrieveFromMemory(url) {
      if (inMemoryMap.has(url) && inMemoryMap.has("file-meta-" + url)) {
          console.log("hit file from memory", url)
          return {
              data: inMemoryMap.get(url),
              meta: inMemoryMap.get("file-meta-" + url)
          }
      }
      return null
  }