import useSWR, { useSWRConfig } from "swr";
import useLocalStorageState from "use-local-storage-state";
import { fetcher, fetchFiatRates, fetchPrices } from "../nanswap/swap/service";
import { useContext } from "react";
import { WalletContext } from "../components/Popup";
import { networks } from "../utils/networks";
import { convertAddress } from "../utils/format";
import { fetchBalance } from "../components/app/Network";

export const useWalletMultiBalance = () => {
  // Basic state and context setup
  const [selected] = useLocalStorageState("baseCurrency", { defaultValue: "USD" });
  const { data: fiatRates, isLoading: isLoadingFiat } = useSWR('fiat', fetchFiatRates);
  const { wallet } = useContext(WalletContext);
  const { mutate } = useSWRConfig();

  // Fetch prices
  const { data: prices, isLoading: isLoadingPrices } = useSWR("prices", fetchPrices);

  const accounts = wallet.accounts.map((account) => account?.address.split("_")[1]); // Get all the accounts without the prefix
  const {data: balances,  isLoading: isLoadingBalances} = useSWR("https://api.nanexplorer.com/accounts_balances_estimated?accounts=" + accounts.join(","), fetcher, {fallbackData: {}, dedupingInterval: 60000});


  // Calculate total balance
  // const totalBalance = Object.keys(balances)?.reduce((acc, ticker) => acc + (
  //   +balances[ticker]?.data * +prices?.[ticker]?.usd * +fiatRates?.[selected] 
  //   || 0
  // ), 0);
  const balancesConverted = {};
  for (const account of Object.keys(balances)) {
    for (const ticker of Object.keys(balances[account])) {
      if (!balancesConverted[account]) {
        balancesConverted[account] = 0;
      }
      balancesConverted[account] += +balances[account][ticker] * +prices?.[ticker]?.usd * +fiatRates?.[selected] || 0
    }
  }
  console.log({balancesConverted})
  const totalBalance = Object.keys(balancesConverted)?.reduce((acc, account) => acc + balancesConverted[account], 0);
  return {
    balances,
    balancesConverted,
    totalBalance,
    isLoading: isLoadingPrices || isLoadingBalances || isLoadingFiat,
    selectedCurrency: selected
  };
};
