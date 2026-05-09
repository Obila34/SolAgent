import Anthropic from "@anthropic-ai/sdk";
import { buildTransferTransaction, getTransactionHistory, getWalletBalances, resolveWalletName } from "./solana";
import { getSwapQuote, type JupiterQuote } from "./jupiter";
import { chargeAiQuery } from "./x402";
import type { AgentIntent } from "../types/agent";
import type { Message } from "../types/chat";
import type { EnrichedTransaction, TransferParams } from "./solana";

export type PendingActionType = "send_sol" | "send_spl_token" | "swap_tokens";

export interface PendingAction {
  type: PendingActionType;
  fromAddress: string;
  toAddress?: string;
  mintAddress?: string;
  inputMint?: string;
  outputMint?: string;
  amount: number;
  amountUsd: number;
  estimatedFeeSol: number;
  quote?: JupiterQuote;
}

export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "tool_call"; tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool: string; result: Record<string, unknown> }
  | { type: "action_required"; action: PendingAction }
  | { type: "error"; message: string };

const TOOL_ACTIONS = new Set<PendingActionType>(["send_sol", "send_spl_token", "swap_tokens"]);
const TOOL_SCHEMA = [
  {
    name: "get_wallet_balance",
    description: "Get wallet token balances with USD values.",
    input_schema: { type: "object", properties: { walletAddress: { type: "string" } }, required: ["walletAddress"] },
  },
  {
    name: "send_sol",
    description: "Prepare SOL transfer action that requires user confirmation.",
    input_schema: {
      type: "object",
      properties: { toAddress: { type: "string" }, amount: { type: "number" }, amountUsd: { type: "number" } },
      required: ["toAddress", "amount"],
    },
  },
  {
    name: "send_spl_token",
    description: "Prepare SPL transfer action requiring user confirmation.",
    input_schema: {
      type: "object",
      properties: {
        toAddress: { type: "string" },
        mintAddress: { type: "string" },
        amount: { type: "number" },
        amountUsd: { type: "number" },
      },
      required: ["toAddress", "mintAddress", "amount"],
    },
  },
  {
    name: "swap_tokens",
    description: "Prepare token swap action requiring confirmation.",
    input_schema: {
      type: "object",
      properties: {
        inputMint: { type: "string" },
        outputMint: { type: "string" },
        amount: { type: "number" },
      },
      required: ["inputMint", "outputMint", "amount"],
    },
  },
  {
    name: "get_token_price",
    description: "Get USD token price for mint.",
    input_schema: { type: "object", properties: { mintAddress: { type: "string" } }, required: ["mintAddress"] },
  },
  {
    name: "resolve_wallet_name",
    description: "Resolve SNS domain or validate wallet address.",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "get_transaction_history",
    description: "Get recent enriched transaction history.",
    input_schema: {
      type: "object",
      properties: { walletAddress: { type: "string" }, limit: { type: "number" } },
      required: ["walletAddress"],
    },
  },
] as const;

const SYSTEM_PROMPT = `
You are SolAgent, an AI assistant that helps users manage their Solana wallet.
You have access to the user's wallet address and can prepare transactions for their approval.

<capabilities>
- Send SOL or SPL tokens to any address or .sol domain
- Get swap quotes via Jupiter and prepare swap transactions
- Fetch and summarize portfolio holdings
- Explain transactions in plain English
- Set price alerts
- Answer questions about Solana, DeFi, and their wallet
</capabilities>

<rules>
- ALWAYS show a transaction preview and wait for explicit user confirmation before any on-chain action
- NEVER execute transactions without confirmation
- If an address looks invalid, ask the user to double-check
- Keep responses concise and jargon-free
- When showing amounts, always show both SOL and USD value
- If you cannot do something, say so clearly and suggest an alternative
</rules>

<output_format>
Always respond with valid JSON matching this schema:
{
  "message": string,
  "intent": string,
  "action": object | null,
  "requiresConfirmation": boolean
}
</output_format>

<wallet_context>
Address: {{WALLET_ADDRESS}}
Balance: {{SOL_BALANCE}} SOL ({{USD_VALUE}} USD)
Network: {{NETWORK}}
</wallet_context>
`;

function inferIntent(toolName: string): AgentIntent {
  if (toolName.includes("send")) return "send";
  if (toolName.includes("swap")) return "swap";
  if (toolName.includes("history")) return "history";
  if (toolName.includes("balance")) return "balance";
  return "info";
}

async function runTool(tool: string, input: Record<string, unknown>, walletAddress: string): Promise<Record<string, unknown>> {
  if (tool === "get_wallet_balance") return { balances: await getWalletBalances(String(input.walletAddress ?? walletAddress)) };
  if (tool === "resolve_wallet_name") return { address: await resolveWalletName(String(input.name ?? "")) };
  if (tool === "get_transaction_history") {
    const txs = await getTransactionHistory(String(input.walletAddress ?? walletAddress), Number(input.limit ?? 5));
    return { transactions: txs as EnrichedTransaction[] };
  }
  if (tool === "get_token_price") {
    const quote = await getSwapQuote({
      inputMint: String(input.mintAddress),
      outputMint: "So11111111111111111111111111111111111111112",
      amount: 1_000_000,
      slippageBps: 50,
    });
    return { price: Number(quote.outAmount) / 1_000_000_000 };
  }
  return { ok: true };
}

async function callClaudeProxy(payload: Record<string, unknown>, paymentProof?: string): Promise<Anthropic.Messages.Message> {
  const proxyUrl = process.env.EXPO_PUBLIC_CLAUDE_PROXY_URL;
  if (!proxyUrl) throw new Error("Missing EXPO_PUBLIC_CLAUDE_PROXY_URL");
  const response = await fetch(`${proxyUrl}/api/claude`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(paymentProof ? { "X-PAYMENT": paymentProof } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Claude proxy request failed");
  return (await response.json()) as Anthropic.Messages.Message;
}

export async function* sendMessage(
  userMessage: string,
  history: Message[],
  walletAddress: string,
): AsyncGenerator<AgentEvent, void, void> {
  try {
    const toolMessages: Anthropic.Messages.MessageParam[] = [
      ...history.map((msg) => {
        const role: "assistant" | "user" = msg.role === "agent" ? "assistant" : "user";
        return { role, content: msg.content };
      }),
      { role: "user", content: userMessage },
    ];

    const charge = process.env.EXPO_PUBLIC_X402_ENABLED === "true" ? await chargeAiQuery() : { charged: false, amount: 0 };
    const paymentProof = charge.charged ? `x402-${charge.amount}` : undefined;

    for (let loop = 0; loop < 6; loop += 1) {
      const response = await callClaudeProxy(
        {
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: SYSTEM_PROMPT.replace("{{WALLET_ADDRESS}}", walletAddress)
            .replace("{{SOL_BALANCE}}", "0")
            .replace("{{USD_VALUE}}", "0")
            .replace("{{NETWORK}}", process.env.EXPO_PUBLIC_SOLANA_NETWORK ?? "mainnet-beta"),
          tools: TOOL_SCHEMA,
          messages: toolMessages,
        },
        paymentProof,
      );

      const assistantContent: Anthropic.Messages.ContentBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "text") {
          assistantContent.push({ type: "text", text: block.text });
          for (const token of block.text.split(" ")) {
            yield { type: "text", content: `${token} ` };
          }
        }
        if (block.type === "tool_use") {
          const input = block.input as Record<string, unknown>;
          yield { type: "tool_call", tool: block.name, input };
          if (TOOL_ACTIONS.has(block.name as PendingActionType)) {
            const pendingAction: PendingAction = {
              type: block.name as PendingActionType,
              fromAddress: walletAddress,
              toAddress: String(input.toAddress ?? ""),
              mintAddress: String(input.mintAddress ?? ""),
              inputMint: String(input.inputMint ?? ""),
              outputMint: String(input.outputMint ?? ""),
              amount: Number(input.amount ?? 0),
              amountUsd: Number(input.amountUsd ?? 0),
              estimatedFeeSol: 0.000005,
            };
            yield { type: "action_required", action: pendingAction };
            return;
          }
          const result = await runTool(block.name, input, walletAddress);
          yield { type: "tool_result", tool: block.name, result };
          assistantContent.push({ type: "tool_use", id: block.id, name: block.name, input });
          toolMessages.push(
            { role: "assistant", content: assistantContent },
            { role: "user", content: [{ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) }] },
          );
        }
      }
      if (response.stop_reason === "end_turn") return;
    }
    yield { type: "error", message: "Agent exceeded maximum tool iterations." };
  } catch {
    yield { type: "error", message: "I'm having trouble connecting. Please check your internet." };
  }
}

export async function executeConfirmedAction(action: PendingAction): Promise<string> {
  if (action.type === "swap_tokens") {
    const quote = await getSwapQuote({
      inputMint: String(action.inputMint),
      outputMint: String(action.outputMint),
      amount: Math.floor(action.amount),
      slippageBps: 50,
    });
    return `Swap prepared. Review and sign in wallet. Quote out amount: ${quote.outAmount}`;
  }
  const transferParams: TransferParams = {
    from: action.fromAddress,
    to: String(action.toAddress),
    amount: action.amount,
    mint: action.type === "send_spl_token" ? action.mintAddress : undefined,
  };
  await buildTransferTransaction(transferParams);
  const intent = inferIntent(action.type);
  return `Action confirmed for ${intent}. Transaction prepared and ready to sign in your wallet.`;
}
