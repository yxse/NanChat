import { wallet } from "multi-nano-web";
import storage from "../utils/storage";


export async function getPk(index = 0) {
  return
  // const mK = await storage.get<string>("masterSeed", "session");
  const mK = getSeed();
  return wallet.accounts(mK, index, index)[0].privateKey;
}
