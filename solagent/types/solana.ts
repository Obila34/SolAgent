export interface TokenBalance {
  mint: string;
  symbol: string;
  decimals: number;
  amount: number;
  usdValue: number;
}

export interface Portfolio {
  totalUsd: number;
  change24hPct: number;
  tokens: TokenBalance[];
  solBalance: number;
}

export interface WalletContext {
  address: string;
  balanceSol: number;
  balanceUsd: number;
  network: string;
}

export interface ParsedTransaction {
  signature: string;
  slot: number;
  timestamp: number;
  status: "success" | "failed";
  summary: string;
}
