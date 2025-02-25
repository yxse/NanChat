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
    const url = `/sharedKey/?chatId=${chatId}&sharedAccount=${sharedAccount}`;
    let sharedKeyEnc
    await initSqlStore();
    let cache = await restoreData(url);
    if (cache) {
        sharedKeyEnc = cache;
    }
    else {
        sharedKeyEnc = await fetcherMessages(url);
        await setData(url, sharedKeyEnc);
    }
    const sharedKey = box.decrypt(sharedKeyEnc.encryptedKey, sharedKeyEnc.fromAccount, activeAccountPk);
    return box.decrypt(content, senderAccount, sharedKey);
  }