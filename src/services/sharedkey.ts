import { box, tools, wallet } from "multi-nano-web";
import { fetcherChat, fetcherMessages, fetcherMessagesPost } from "../components/messaging/fetcher";
import { initSqlStore, inMemoryMap, restoreData, setData } from "./database.service";

export async function updateSharedKeys(chatId: string, participants: string[], fromPk: string) {
    // 64 bytes shared key hex encoded
    const sharedWallet = wallet.generate();
    const account = sharedWallet.accounts[0];
    const pk = account.privateKey;
    const address = account.address;
    const sharedKeys = participants.map((participant) => {
        return {
            sharedAccount: address,
            encryptedKey: box.encrypt(pk, participant, fromPk),
            toAccount: participant
        }
    });
    await fetcherMessagesPost('/sharedKeys', { sharedKeys: sharedKeys, chatId: chatId });
    return account;
}

export async function decryptGroupMessage(content, chatId, sharedAccount, senderAccount, activeAccountPk) {
    if (content === "Sticker") return content;
    const sharedKey = await getSharedKey(chatId, sharedAccount, activeAccountPk);
    return box.decrypt(content, senderAccount, sharedKey);
  }

// Create a map to track in-progress requests
const pendingRequests = new Map<string, Promise<any>>();

export async function getSharedKey(chatId: string, sharedAccount: string, activeAccountPk: string) {
    if (sharedAccount == null){
        console.error("sharedAccount is null", chatId);
        return null;
    }
    const url = `/sharedKey/?chatId=${chatId}&sharedAccount=${sharedAccount}`;
    // Check if there's already a pending request for this URL
    if (pendingRequests.has(url)) {
        // If there is, wait for that request to complete
        return pendingRequests.get(url);
    }
    try {
        // Create a new promise for this request and store it in the map
        const requestPromise = (async () => {
            await initSqlStore();
            let cache = await restoreData(url);
            if (cache) {
                return cache;
            } else {
                let sharedKeyEnc = await fetcherMessages(url);
                let sharedKey = box.decrypt(sharedKeyEnc?.encryptedKey, sharedKeyEnc?.fromAccount, activeAccountPk);
                await setData(url, sharedKey);
                return sharedKey;
            }
        })();
        
        // Store the promise in the map
        pendingRequests.set(url, requestPromise);
        
        // Wait for the request to complete
        const result = await requestPromise;
        return result;
    } finally {
        // Clean up by removing the promise from the map when done
        pendingRequests.delete(url);
    }
}