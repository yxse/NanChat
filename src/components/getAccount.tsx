import { wallet } from "multi-nano-web";
import storage from "../utils/storage";
import { networks } from "../utils/networks";


export async function getAccount(ticker: string) {
  return
  if (global.ledger) {
    return global.account.replace("nano_", networks[ticker].prefix + "_");
  }
  const accI = (await storage.get<number>("account_index", "local")) || 0;
  // const mK = await storage.get<string>("masterSeed", "session");
  const mK = getSeed();
  if (mK.length === 128){
    return wallet
      .accounts(mK, accI, accI)[0]
      .address.replace("nano_", networks[ticker].prefix + "_");
  }
  return wallet
    .legacyAccounts(mK, accI, accI)[0]
    .address.replace("nano_", networks[ticker].prefix + "_");
}export async function getAccounts() {
  let accounts = [];
  let nanoAddress = await getAccount('XNO');
  for (const ticker in networks) {
    accounts.push({
      ticker: ticker,
      address: nanoAddress.replace("nano_", networks[ticker].prefix + "_")
    });
  }
  return accounts;
}

