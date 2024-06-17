import { wallet } from "multi-nano-web";
import type { Account } from "multi-nano-web/dist/lib/address-importer";
import storage from "../utils/storage";
import BigNumber from "bignumber.js";
import { Wallet } from "./wallet";
import { networks } from "../utils/networks";
import { LedgerService } from "../ledger.service";

export function deriveAccounts(
  seed: string,
  startAndEndIndex: [number, number],
) {
  return wallet.accounts(seed, startAndEndIndex[0], startAndEndIndex[1]);
}

export function convertToMulti(accounts: Account[], prefixes: string[]) {
  return accounts.map((account) => {
    const addresses = prefixes.map((prefix) => ({
      [prefix]: account.address.replace("nano", prefix),
    }));
    return {
      privateKey: account.privateKey,
      publicKey: account.publicKey,
      addresses: [{ nano: account.address }, ...addresses],
    };
  });
}
export async function getWalletRPC(ticker) {
  const seed = await storage.get<string>("masterSeed", "session");
  let walletKey = ticker;
  if (global.ledger) walletKey += "ledger"; // create a separate wallet instance for ledger
  if (global.wallet == null) {
    global.wallet = {};
  }
  if (global.wallet[walletKey] == null) {
    global.wallet[walletKey] = new Wallet({
      RPC_URL: import.meta.env.VITE_PUBLIC_RPC_URL + ticker,
      WORK_URL: import.meta.env.VITE_PUBLIC_RPC_URL + ticker,
      WS_URL:
        import.meta.env.VITE_PUBLIC_WS_URL +
        "?ticker=" +
        ticker +
        "&api=" +
        import.meta.env.VITE_PUBLIC_NODES_API_KEY,
      seed: seed,
      defaultRep:
        "nano_1banexkcfuieufzxksfrxqf6xy8e57ry1zdtq9yn7jntzhpwu4pg4hajojmq".replace(
          "nano_",
          networks[ticker].prefix + "_",
        ),
      ticker: ticker,
      decimal: networks[ticker].decimals,
      prefix: networks[ticker].prefix + "_",
    });
    let account = global.wallet[walletKey].createAccounts(1)[0];
    await global.wallet[walletKey].receiveAll(account);
  }
  return global.wallet[walletKey];
}

export async function send(ticker, addressFrom, addressTo, amountMega) {
  let rpcWallet = await getWalletRPC(ticker);
  let hash = await rpcWallet.send({
    source: addressFrom,
    destination: addressTo,
    amount: rpcWallet.megaToRaw(amountMega),
  });
  console.log(hash);
}

export function rawToMega(ticker, amount) {
  const decimals = networks[ticker].decimals;
  if (decimals == null) {
    throw new Error("Decimals not found for ticker: " + ticker);
  }
  let value = new BigNumber(amount.toString());
  return value.shiftedBy(-decimals).toFixed(decimals, 1);
}
/*
export function convertToMulti(accounts: Account[], prefixes: string[]) {
    const Accounts = new Array();
    for (const account of accounts) {
        const addressI = new Array();
        addressI.push({ "nano": account.address });
        for (const prefix of prefixes) {
            addressI.push({ [prefix]: account.address.replace("nano", prefix)});
        }
        Accounts.push({ privateKey: account.privateKey, publicKey: account.privateKey, addresses: addressI });
    }
    return Accounts;
} */
