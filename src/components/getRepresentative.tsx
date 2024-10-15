import storage from "../utils/storage";
import { networks } from "../utils/networks";


export async function getRepresentative(ticker: string) {
  const rep = await storage.get<string>("representative-" + ticker, "local");
  if (rep) return rep;
  return networks[ticker].defaultRep;
}
export async function setRepresentative(ticker: string, rep: string) {
  await storage.set("representative-" + ticker, rep, "local");
}
