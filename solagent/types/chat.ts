export type Role = "user" | "agent" | "system";

export interface TxPreview {
  type: "send" | "swap";
  recipient?: string;
  fromToken?: string;
  toToken?: string;
  amount: number;
  estimatedFeeSol: number;
  usdValue: number;
  priceImpactPct?: number;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  txPreview?: TxPreview;
  requiresConfirmation?: boolean;
}
