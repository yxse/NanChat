import useSWR, { useSWRConfig } from "swr";
import useLocalStorageState from "use-local-storage-state";
import { fetchFiatRates, fetchPrices } from "../nanswap/swap/service";
import { useContext } from "react";
import { WalletContext } from "../components/Popup";
import { networks } from "../utils/networks";
import { convertAddress } from "../utils/format";
import { fetchBalance } from "../components/app/Network";

export const useWalletBalance = () => {
  // Basic state and context setup
  const [selected] = useLocalStorageState("baseCurrency", { defaultValue: "USD" });
  const { data: fiatRates, isLoading: isLoadingFiat } = useSWR('fiat', fetchFiatRates);
  const { wallet } = useContext(WalletContext);
  const { mutate } = useSWRConfig();

  // Fetch prices
  const { data: prices, isLoading: isLoadingPrices } = useSWR("prices", fetchPrices);

  // Get current account address
  const currentAccount = wallet.accounts.find(
    (account) => account.accountIndex === wallet.activeIndex
  );

  // Fetch balances for each network
  const balances = {};
  for (const ticker of Object.keys(networks)) {
    const address = convertAddress(currentAccount?.address, ticker);
    balances[ticker] = useSWR(
      `balance-${ticker}-${address}`,
      () => fetchBalance(ticker, address)
    );
  }

  // Check if any balance is still loading
  const isLoadingBalances = Object.keys(balances).some(
    (ticker) => balances[ticker]?.isLoading
  );

  // Calculate total balance
  const totalBalance = Object.keys(balances)?.reduce((acc, ticker) => acc + (
    +balances[ticker]?.data * +prices?.[ticker]?.usd * +fiatRates?.[selected] 
    || 0
  ), 0);

  // Refresh function
  const refreshBalances = async () => {
    await mutate((key) => key.startsWith("balance-") || key === "prices");
  };

  return {
    totalBalance,
    balances,
    isLoading: isLoadingPrices || isLoadingBalances || isLoadingFiat,
    refreshBalances,
    currentAccount,
    selectedCurrency: selected
  };
};
