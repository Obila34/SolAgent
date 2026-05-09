import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  LAMPORTS_PER_SOL,
  MessageV0,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createTransferCheckedInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import { getHashedName, getNameAccountKey, NameRegistryState } from "@bonfida/spl-name-service";
import { TOKENS } from "../constants/tokens";
import type { ParsedTransaction, TokenBalance } from "../types/solana";

interface HeliusBalanceResponse {
  nativeBalance?: number;
  tokens?: Array<{
    mint: string;
    amount: number;
    decimals: number;
    symbol?: string;
    name?: string;
    logoURI?: string;
  }>;
}

interface HeliusEnrichedTransaction {
  signature: string;
  timestamp: number;
  fee: number;
  type?: string;
  description?: string;
  nativeTransfers?: Array<{ amount: number; fromUserAccount: string; toUserAccount: string }>;
  tokenTransfers?: Array<{ mint: string; tokenAmount: number; symbol?: string; fromUserAccount?: string; toUserAccount?: string }>;
}

export interface EnrichedTransaction extends ParsedTransaction {
  feeLamports: number;
  type: string;
  description: string;
  nativeTransfers: Array<{ amountSol: number; from: string; to: string }>;
  tokenTransfers: Array<{ mint: string; amount: number; symbol: string; from: string; to: string }>;
}

export interface TransferParams {
  from: string;
  to: string;
  amount: number;
  mint?: string;
  decimals?: number;
  payer?: string;
  lookupTables?: AddressLookupTableAccount[];
}

const HELIUS_RPC_URL =
  process.env.EXPO_PUBLIC_HELIUS_RPC_URL ??
  `https://rpc.helius.xyz/?api-key=${process.env.EXPO_PUBLIC_HELIUS_API_KEY ?? ""}`;
const HELIUS_API_KEY = process.env.EXPO_PUBLIC_HELIUS_API_KEY ?? "";
const HELIUS_BASE = process.env.EXPO_PUBLIC_HELIUS_BASE_URL ?? "https://api.helius.xyz";
const connection = new Connection(HELIUS_RPC_URL, "confirmed");
const SOL_MINT = "So11111111111111111111111111111111111111112";
const BALANCE_CACHE_TTL_MS = 30000;

const balanceCache = new Map<string, { fetchedAt: number; balances: TokenBalance[] }>();

function tokenMetaByMint(mint: string): { symbol: string; decimals: number } {
  const known = TOKENS.find((token) => token.mint === mint);
  return { symbol: known?.symbol ?? "TOKEN", decimals: known?.decimals ?? 0 };
}

async function fetchPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};
  const ids = mints.join(",");
  const response = await fetch(`https://price.jup.ag/v2/price?ids=${encodeURIComponent(ids)}`);
  if (!response.ok) return {};
  const data = (await response.json()) as { data?: Record<string, { price?: number }> };
  const prices: Record<string, number> = {};
  for (const mint of mints) prices[mint] = Number(data.data?.[mint]?.price ?? 0);
  return prices;
}

export async function getBalance(address: string): Promise<number> {
  const lamports = await connection.getBalance(new PublicKey(address));
  return lamports / LAMPORTS_PER_SOL;
}

export async function getWalletBalances(publicKey: string): Promise<TokenBalance[]> {
  const cached = balanceCache.get(publicKey);
  if (cached && Date.now() - cached.fetchedAt < BALANCE_CACHE_TTL_MS) return cached.balances;

  const [lamports, dasResponse] = await Promise.all([
    connection.getBalance(new PublicKey(publicKey)),
    fetch(`${HELIUS_BASE}/v0/addresses/${publicKey}/balances?api-key=${HELIUS_API_KEY}`, { method: "POST" }),
  ]);

  const dasData = (dasResponse.ok ? await dasResponse.json() : { tokens: [] }) as HeliusBalanceResponse;
  const rawTokens = dasData.tokens ?? [];
  const mints = Array.from(new Set([SOL_MINT, ...rawTokens.map((token) => token.mint)]));
  const prices = await fetchPrices(mints);

  const balances: TokenBalance[] = [
    {
      mint: SOL_MINT,
      symbol: "SOL",
      decimals: 9,
      amount: lamports / LAMPORTS_PER_SOL,
      usdValue: (lamports / LAMPORTS_PER_SOL) * (prices[SOL_MINT] ?? 0),
    },
    ...rawTokens.map((token) => {
      const meta = tokenMetaByMint(token.mint);
      const amount = Number(token.amount ?? 0) / 10 ** Number(token.decimals ?? meta.decimals);
      return {
        mint: token.mint,
        symbol: token.symbol ?? meta.symbol,
        decimals: Number(token.decimals ?? meta.decimals),
        amount,
        usdValue: amount * (prices[token.mint] ?? 0),
      };
    }),
  ].sort((a, b) => b.usdValue - a.usdValue);

  balanceCache.set(publicKey, { fetchedAt: Date.now(), balances });
  return balances;
}

export async function buildTransferTransaction(params: TransferParams): Promise<VersionedTransaction> {
  const from = new PublicKey(params.from);
  const to = new PublicKey(params.to);
  const payer = new PublicKey(params.payer ?? params.from);
  const latest = await connection.getLatestBlockhash("confirmed");

  const ixs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
  ];

  if (!params.mint || params.mint === SOL_MINT) {
    ixs.push(
      SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports: Math.floor(params.amount * LAMPORTS_PER_SOL),
      }),
    );
  } else {
    const mint = new PublicKey(params.mint);
    const sourceAta = await getAssociatedTokenAddress(mint, from);
    const destinationAta = await getAssociatedTokenAddress(mint, to);
    ixs.push(
      createTransferCheckedInstruction(
        sourceAta,
        mint,
        destinationAta,
        from,
        Math.floor(params.amount * 10 ** Number(params.decimals ?? 6)),
        Number(params.decimals ?? 6),
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: latest.blockhash,
    instructions: ixs,
  }).compileToV0Message(params.lookupTables ?? []);

  return new VersionedTransaction(message);
}

export async function confirmTransaction(signature: string): Promise<"confirmed" | "failed" | "timeout"> {
  const start = Date.now();
  while (Date.now() - start < 30000) {
    const statusResponse = await connection.getSignatureStatuses([signature]);
    const status = statusResponse.value[0];
    if (status?.err) return "failed";
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return "confirmed";
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return "timeout";
}

export async function getTransactionHistory(publicKey: string, limit: number): Promise<EnrichedTransaction[]> {
  const url = `${HELIUS_BASE}/v0/addresses/${publicKey}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const txs = (await response.json()) as HeliusEnrichedTransaction[];
  return txs.map((tx) => {
    const type = tx.type ?? "UNKNOWN";
    const description = tx.description ?? "Transaction on Solana";
    return {
      signature: tx.signature,
      slot: 0,
      timestamp: tx.timestamp ?? 0,
      status: "success",
      summary: description,
      feeLamports: tx.fee ?? 0,
      type,
      description,
      nativeTransfers: (tx.nativeTransfers ?? []).map((item) => ({
        amountSol: item.amount / LAMPORTS_PER_SOL,
        from: item.fromUserAccount,
        to: item.toUserAccount,
      })),
      tokenTransfers: (tx.tokenTransfers ?? []).map((item) => ({
        mint: item.mint,
        amount: item.tokenAmount,
        symbol: item.symbol ?? tokenMetaByMint(item.mint).symbol,
        from: item.fromUserAccount ?? "",
        to: item.toUserAccount ?? "",
      })),
    };
  });
}

export async function resolveWalletName(name: string): Promise<string | null> {
  const trimmed = name.trim();
  try {
    if (trimmed.endsWith(".sol")) {
      const hashedName = await getHashedName(trimmed.replace(".sol", ""));
      const nameAccountKey = await getNameAccountKey(hashedName, undefined, undefined);
      const registry = await NameRegistryState.retrieve(connection, nameAccountKey);
      return registry.registry.owner.toBase58();
    }
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
      return new PublicKey(trimmed).toBase58();
    }
    return null;
  } catch {
    return null;
  }
}

export async function sendSignedTransaction(rawTx: Buffer | Uint8Array): Promise<string> {
  return connection.sendRawTransaction(rawTx);
}

export { connection, MessageV0 };
