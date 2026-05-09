import type { AgentIntent } from "../types/agent";

export function parseIntentLocally(input: string): AgentIntent {
  const text = input.toLowerCase();
  if (text.includes("send")) return "send";
  if (text.includes("swap")) return "swap";
  if (text.includes("portfolio")) return "portfolio";
  if (text.includes("alert")) return "alert";
  if (text.includes("history") || text.includes("transactions")) return "history";
  if (text.includes("balance")) return "balance";
  if (text.includes("solana") || text.includes("defi")) return "info";
  return "unknown";
}
