import { create } from "zustand";
import type { TokenBalance } from "../types/solana";

interface PortfolioState {
  tokens: TokenBalance[];
  totalUsdValue: number;
  lastUpdated: Date | null;
  setPortfolio: (tokens: TokenBalance[]) => void;
  clear: () => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  tokens: [],
  totalUsdValue: 0,
  lastUpdated: null,
  setPortfolio: (tokens) =>
    set({
      tokens,
      totalUsdValue: tokens.reduce((sum, token) => sum + token.usdValue, 0),
      lastUpdated: new Date(),
    }),
  clear: () => set({ tokens: [], totalUsdValue: 0, lastUpdated: null }),
}));
