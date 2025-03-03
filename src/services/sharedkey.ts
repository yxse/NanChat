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

export async function getSharedKey(chatId: string, sharedAccount: string, activeAccountPk: string) {
    const url = `/sharedKey/?chatId=${chatId}&sharedAccount=${sharedAccount}`;
    let sharedKey
    await initSqlStore();
    let cache = await restoreData(url);
    if (cache) {
        sharedKey = cache;
    }
    else {
        let sharedKeyEnc = await fetcherMessages(url);
        sharedKey = box.decrypt(sharedKeyEnc?.encryptedKey, sharedKeyEnc?.fromAccount, activeAccountPk);
        await setData(url, sharedKey);
    }
    return sharedKey;
}