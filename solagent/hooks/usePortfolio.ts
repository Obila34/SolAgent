import { AppState } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { getWalletBalances } from "../services/solana";
import { usePortfolioStore } from "../store/portfolioStore";
import { useWalletStore } from "../store/walletStore";

export function usePortfolio() {
  const address = useWalletStore((state) => state.address);
  const { tokens, totalUsdValue, lastUpdated, setPortfolio } = usePortfolioStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async (): Promise<void> => {
    if (!address) {
      setPortfolio([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const balances = await getWalletBalances(address);
      setPortfolio(balances);
    } catch {
      setError("I'm having trouble connecting. Please check your internet.");
    } finally {
      setIsLoading(false);
    }
  }, [address, setPortfolio]);

  useEffect(() => {
    void fetchPortfolio();
  }, [fetchPortfolio]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void fetchPortfolio();
    });
    const intervalId = setInterval(() => {
      if (AppState.currentState === "active") void fetchPortfolio();
    }, 60000);
    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, [fetchPortfolio]);

  return {
    tokens,
    totalUsdValue,
    isLoading,
    error,
    refetch: () => void fetchPortfolio(),
    lastUpdated,
    fetchPortfolio,
  };
}
