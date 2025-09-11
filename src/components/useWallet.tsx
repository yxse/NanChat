import { createContext, useContext } from "react";
import { convertAddress } from "./messaging/utils";


export const WalletContext = createContext(null);
export const useWallet = () => {
  const { wallet, dispatch } = useContext(WalletContext);
  const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
  const activeAccountPk = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.privateKey;
  return { wallet, activeAccount, activeAccountPk, dispatch };
};

