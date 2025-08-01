import storage from "../utils/storage";
import { networks } from "../utils/networks";
import { convertAddress } from "../utils/format";


export async function getRepresentative(ticker: string) {
  const rep = await storage.get<string>("representative-" + ticker, "local");
  if (rep) return rep;
  if (networks[ticker].defaultRep == null) return convertAddress(networks["XNO"].defaultRep, 'XNO') // if no default rep (eg: for custom network), default to nano rep
  return networks[ticker].defaultRep;
}
export async function setRepresentative(ticker: string, rep: string) {
  await storage.set("representative-" + ticker, rep, "local");
}
