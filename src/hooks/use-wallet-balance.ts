import useSWR, { useSWRConfig } from "swr";
import useLocalStorageState from "use-local-storage-state";
import { fetchFiatRates, fetchPrices } from "../nanswap/swap/service";
import { useContext, useMemo } from "react";
import { WalletContext } from "../components/useWallet";
import { networks } from "../utils/networks";
import { MIN_USD_SWAP } from "../utils/format";
import { convertAddress } from "../utils/convertAddress";
import { fetchBalance } from "../components/app/Network";
import { Capacitor } from "@capacitor/core";

export const useWalletBalance = () => {
  // Basic state and context setup
  const [selected] = useLocalStorageState("baseCurrency", { defaultValue: "USD" });
  const { data: fiatRates, isLoading: isLoadingFiat } = useSWR('fiat', fetchFiatRates);
  const { wallet } = useContext(WalletContext);
  const { mutate } = useSWRConfig();

  // Fetch prices
  const { data: prices, isLoading: isLoadingPrices } = useSWR("prices", fetchPrices);

  // Get current account address - moved to useMemo
  const currentAccount = useMemo(() => 
    wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex),
    [wallet.accounts, wallet.activeIndex]
  );

  // Create an array of network tickers
  const networkTickers = useMemo(() => Object.keys(networks), []);

  // Create a single SWR hook call for all balances
  const { data: allBalances, isLoading: isLoadingBalances } = useSWR(
    currentAccount ? `all-balances-${currentAccount.address}-${networkTickers.join(",")}` : null,
    async () => {
      const results = {};
      for (const ticker of networkTickers) {
        const address = convertAddress(currentAccount?.address, ticker);
        results[ticker] = await fetchBalance(ticker, address);
      }
      return results;
    }
  );

  // Calculate total balance using useMemo
  const totalBalance = useMemo(() => {
    if (!allBalances || !prices || !fiatRates || !selected) return 0;
    
    return networkTickers.reduce((acc, ticker) => {
      const balance = allBalances[ticker] || 0;
      const price = prices[ticker]?.usd || 0;
      const fiatRate = fiatRates[selected] || 0;
      return acc + (+balance * +price * +fiatRate);
    }, 0);
  }, [allBalances, prices, fiatRates, selected, networkTickers]);

  const totalBalanceUSD = useMemo(() => {
    if (!allBalances || !prices) return 0;
    return networkTickers.reduce((acc, ticker) => {
      const balance = allBalances[ticker] || 0;
      const price = prices[ticker]?.usd || 0;
      return acc + (+balance * +price);
    }, 0);
  }, [allBalances, prices, networkTickers]);

  // Format balances object to match original API
  const balances = useMemo(() => {
    return networkTickers.reduce((acc, ticker) => {
      acc[ticker] = {
        data: allBalances?.[ticker] || 0,
        isLoading: isLoadingBalances
      };
      return acc;
    }, {});
  }, [networkTickers, allBalances, isLoadingBalances]);

  // Refresh function
  const refreshBalances = async () => {
    await mutate((key) => key === 'all-balances' || key === "prices");
  };

  const lowBalanceUsd = (totalBalanceUSD < MIN_USD_SWAP && Capacitor.getPlatform() === "ios");

  return {
    totalBalance,
    lowBalanceUsd,
    balances,
    isLoading: isLoadingPrices || isLoadingBalances || isLoadingFiat,
    refreshBalances,
    currentAccount,
    selectedCurrency: selected
  };
};