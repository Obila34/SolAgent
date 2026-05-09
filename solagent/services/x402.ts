import { PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { connection } from "./solana";
import { useSettingsStore } from "../store/settingsStore";

const COST_PER_QUERY_SOL = 0.001;
const LAMPORTS_PER_QUERY = 100_000;
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export interface PaymentRequest {
  scheme: "exact";
  network: "solana-mainnet";
  maxAmountRequired: string;
  resource: "solagent://ai-query";
  description: "SolAgent AI Query";
  mimeType: "application/json";
  payTo: string;
  maxTimeoutSeconds: number;
  asset: "SOL_NATIVE";
  extra: { name: "SolAgent"; version: "1.0" };
}

export function getQueryCostSol(): number {
  return COST_PER_QUERY_SOL;
}

export function canChargeForQuery(): boolean {
  const { aiSpendUsd, monthlyAiBudgetUsd } = useSettingsStore.getState();
  return aiSpendUsd + COST_PER_QUERY_SOL <= monthlyAiBudgetUsd;
}

export function createPaymentRequest(): PaymentRequest {
  const payTo = process.env.EXPO_PUBLIC_X402_RECIPIENT ?? "";
  return {
    scheme: "exact",
    network: "solana-mainnet",
    maxAmountRequired: String(LAMPORTS_PER_QUERY),
    resource: "solagent://ai-query",
    description: "SolAgent AI Query",
    mimeType: "application/json",
    payTo,
    maxTimeoutSeconds: 30,
    asset: "SOL_NATIVE",
    extra: { name: "SolAgent", version: "1.0" },
  };
}

export async function buildPaymentTransaction(payerPublicKey: string): Promise<VersionedTransaction> {
  const paymentRequest = createPaymentRequest();
  if (!paymentRequest.payTo) throw new Error("Missing EXPO_PUBLIC_X402_RECIPIENT");
  const payer = new PublicKey(payerPublicKey);
  const recipient = new PublicKey(paymentRequest.payTo);
  const latest = await connection.getLatestBlockhash("confirmed");
  const memoInstruction = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from("x402:solagent:ai-query", "utf8"),
  });
  const transferIx = SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: recipient,
    lamports: LAMPORTS_PER_QUERY,
  });
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: latest.blockhash,
    instructions: [transferIx, memoInstruction],
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

export async function submitPaymentProof(
  signature: string,
  payer: string,
): Promise<string> {
  const proof = {
    signature,
    payer,
    amount: LAMPORTS_PER_QUERY,
    timestamp: Date.now(),
  };
  return Buffer.from(JSON.stringify(proof)).toString("base64");
}

export async function chargeForQuery(
  payerPublicKey: string,
  signAndSend: (transaction: VersionedTransaction) => Promise<string>,
): Promise<string> {
  if (!canChargeForQuery()) throw new Error("Monthly AI budget exceeded");
  const transaction = await buildPaymentTransaction(payerPublicKey);
  const signature = await signAndSend(transaction);
  const proof = await submitPaymentProof(signature, payerPublicKey);
  useSettingsStore.getState().addQueryUsage(COST_PER_QUERY_SOL, COST_PER_QUERY_SOL);
  return proof;
}

export async function chargeAiQuery(): Promise<{ charged: boolean; amount: number }> {
  const state = useSettingsStore.getState();
  if (!state.x402Enabled || process.env.EXPO_PUBLIC_X402_ENABLED !== "true") return { charged: false, amount: 0 };
  if (!canChargeForQuery()) return { charged: false, amount: 0 };
  state.addQueryUsage(COST_PER_QUERY_SOL, COST_PER_QUERY_SOL);
  return { charged: true, amount: COST_PER_QUERY_SOL };
}
