import { Buffer } from "buffer";
import { VersionedTransaction } from "@solana/web3.js";

const JUPITER_API = "https://quote-api.jup.ag/v6";
const JUPITER_TOKEN_LIST_URL = "https://token.jup.ag/strict";
const JUPITER_PRICE_URL = "https://price.jup.ag/v2/price";

export class PriceImpactTooHighError extends Error {
  constructor(priceImpactPct: number) {
    super(`Price impact too high (${priceImpactPct.toFixed(2)}%).`);
    this.name = "PriceImpactTooHighError";
  }
}

export interface SwapQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
}

export interface JupiterQuote {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: unknown[];
  otherAmountThreshold: string;
}

export interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface QuoteApiResponse {
  data: JupiterQuote[];
}

interface SwapApiResponse {
  swapTransaction: string;
}

const tokenCache = new Map<string, JupiterToken>();

export const TOKEN_ALIASES: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
};

function resolveMint(mintOrSymbol: string): string {
  const upper = mintOrSymbol.toUpperCase();
  return TOKEN_ALIASES[upper] ?? mintOrSymbol;
}

export async function getSwapQuote(params: SwapQuoteParams): Promise<JupiterQuote> {
  const response = await fetch(`${JUPITER_API}/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inputMint: resolveMint(params.inputMint),
      outputMint: resolveMint(params.outputMint),
      amount: params.amount,
      slippageBps: params.slippageBps,
    }),
  });
  if (!response.ok) throw new Error("Unable to fetch swap quote");
  const data = (await response.json()) as QuoteApiResponse;
  const quote = data.data[0];
  const impact = Number(quote.priceImpactPct);
  if (impact > 3) throw new PriceImpactTooHighError(impact);
  return quote;
}

export async function buildSwapTransaction(quote: JupiterQuote, userPublicKey: string): Promise<VersionedTransaction> {
  const response = await fetch(`${JUPITER_API}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });
  if (!response.ok) throw new Error("Unable to build swap transaction");
  const data = (await response.json()) as SwapApiResponse;
  return VersionedTransaction.deserialize(Buffer.from(data.swapTransaction, "base64"));
}

export async function getTokenList(): Promise<JupiterToken[]> {
  if (tokenCache.size > 0) return Array.from(tokenCache.values());
  const response = await fetch(JUPITER_TOKEN_LIST_URL);
  if (!response.ok) throw new Error("Unable to fetch token list");
  const tokens = (await response.json()) as JupiterToken[];
  for (const token of tokens) tokenCache.set(token.symbol.toUpperCase(), token);
  return tokens;
}

export async function getTokenPrice(mintAddress: string): Promise<number> {
  const resolved = resolveMint(mintAddress);
  const response = await fetch(`${JUPITER_PRICE_URL}?ids=${resolved}`);
  if (!response.ok) throw new Error("Unable to fetch token price");
  const json = (await response.json()) as { data?: Record<string, { price: number }> };
  return Number(json.data?.[resolved]?.price ?? 0);
}
