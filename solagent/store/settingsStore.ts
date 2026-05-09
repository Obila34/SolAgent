import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface PriceAlert {
  token: string;
  direction: "above" | "below";
  price: number;
}

interface SettingsState {
  monthlyAiBudgetUsd: number;
  aiSpendUsd: number;
  totalSpentSol: number;
  totalQueries: number;
  x402Enabled: boolean;
  voiceEnabled: boolean;
  alerts: PriceAlert[];
  network: "mainnet-beta" | "devnet";
  customRpcUrl: string;
  balanceAlertsEnabled: boolean;
  largeTxAlertsEnabled: boolean;
  language: string;
  setMonthlyAiBudgetUsd: (amount: number) => void;
  addAiSpend: (amount: number) => void;
  addQueryUsage: (spentSol: number, spentUsd: number) => void;
  setX402Enabled: (enabled: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setLanguage: (language: string) => void;
  setNetwork: (network: "mainnet-beta" | "devnet") => void;
  setCustomRpcUrl: (url: string) => void;
  setBalanceAlertsEnabled: (enabled: boolean) => void;
  setLargeTxAlertsEnabled: (enabled: boolean) => void;
  addAlert: (alert: PriceAlert) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      monthlyAiBudgetUsd: 20,
      aiSpendUsd: 0,
      totalSpentSol: 0,
      totalQueries: 0,
      x402Enabled: process.env.EXPO_PUBLIC_X402_ENABLED === "true",
      voiceEnabled: true,
      alerts: [],
      network: "mainnet-beta",
      customRpcUrl: "",
      balanceAlertsEnabled: true,
      largeTxAlertsEnabled: true,
      language: "English",
      setMonthlyAiBudgetUsd: (monthlyAiBudgetUsd) => set({ monthlyAiBudgetUsd }),
      addAiSpend: (amount) => set((state) => ({ aiSpendUsd: state.aiSpendUsd + amount })),
      addQueryUsage: (spentSol, spentUsd) =>
        set((state) => ({
          totalSpentSol: state.totalSpentSol + spentSol,
          totalQueries: state.totalQueries + 1,
          aiSpendUsd: state.aiSpendUsd + spentUsd,
        })),
      setX402Enabled: (x402Enabled) => set({ x402Enabled }),
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      setLanguage: (language) => set({ language }),
      setNetwork: (network) => set({ network }),
      setCustomRpcUrl: (customRpcUrl) => set({ customRpcUrl }),
      setBalanceAlertsEnabled: (balanceAlertsEnabled) => set({ balanceAlertsEnabled }),
      setLargeTxAlertsEnabled: (largeTxAlertsEnabled) => set({ largeTxAlertsEnabled }),
      addAlert: (alert) => set((state) => ({ alerts: [...state.alerts, alert] })),
    }),
    {
      name: "solagent-settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
