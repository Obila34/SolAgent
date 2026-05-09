import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { TokenBalance } from "../types/solana";

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isDevMode: boolean;
  solBalance: number;
  usdBalance: number;
  tokens: TokenBalance[];
  setWallet: (address: string) => void;
  setDevWallet: (address: string) => void;
  setBalances: (sol: number, usd: number) => void;
  setTokens: (tokens: TokenBalance[]) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      isConnected: false,
      isDevMode: false,
      solBalance: 0,
      usdBalance: 0,
      tokens: [],
      setWallet: (address) => set({ address, isConnected: true, isDevMode: false }),
      setDevWallet: (address) => set({ address, isConnected: true, isDevMode: true }),
      setBalances: (solBalance, usdBalance) => set({ solBalance, usdBalance }),
      setTokens: (tokens) => set({ tokens }),
      disconnect: () =>
        set({
          address: null,
          isConnected: false,
          isDevMode: false,
          solBalance: 0,
          usdBalance: 0,
          tokens: [],
        }),
    }),
    {
      name: "solagent-wallet",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
