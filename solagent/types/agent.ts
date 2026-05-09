import type { TxPreview } from "./chat";

export type AgentIntent =
  | "send"
  | "swap"
  | "portfolio"
  | "alert"
  | "history"
  | "info"
  | "balance"
  | "unknown";

export interface AgentAction {
  type: AgentIntent;
  txPreview?: TxPreview;
  metadata?: Record<string, string | number | boolean>;
}

export interface AgentResponse {
  message: string;
  intent: AgentIntent;
  action: AgentAction | null;
  requiresConfirmation: boolean;
}
