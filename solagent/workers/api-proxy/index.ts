interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  ANTHROPIC_API_KEY: string;
  HELIUS_WEBHOOK_SECRET: string;
  HELIUS_RPC_URL: string;
  RATE_LIMIT: KVNamespaceLike;
  WEBHOOKS: KVNamespaceLike;
}

type PaymentProof = {
  signature?: string;
  payer?: string;
  amount?: number;
  timestamp?: number;
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-PAYMENT,X-Helius-Signature",
};

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 10;

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function getPathname(url: string): string {
  return new URL(url).pathname;
}

function parsePaymentProof(headerValue: string): PaymentProof | null {
  try {
    const decoded = atob(headerValue);
    const parsed = JSON.parse(decoded) as PaymentProof;
    if (!parsed.signature) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function verifyPaymentSignature(signature: string, env: Env): Promise<boolean> {
  try {
    const response = await fetch(env.HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignatureStatuses",
        params: [[signature], { searchTransactionHistory: true }],
      }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as {
      result?: { value?: Array<{ confirmationStatus?: string; err?: unknown } | null> };
    };
    const status = data.result?.value?.[0];
    if (!status || status.err) return false;
    return status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized";
  } catch {
    return false;
  }
}

async function checkRateLimit(walletKey: string, env: Env): Promise<boolean> {
  const nowBucket = Math.floor(Date.now() / (RATE_LIMIT_WINDOW_SECONDS * 1000));
  const kvKey = `ratelimit:${walletKey}:${nowBucket}`;
  const current = Number((await env.RATE_LIMIT.get(kvKey)) ?? "0");
  if (current >= RATE_LIMIT_MAX_REQUESTS) return false;
  await env.RATE_LIMIT.put(kvKey, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS + 5 });
  return true;
}

function buildX402PaymentRequest(): Record<string, unknown> {
  return {
    scheme: "exact",
    network: "solana-mainnet",
    maxAmountRequired: "100000",
    resource: "solagent://ai-query",
    description: "SolAgent AI Query",
    mimeType: "application/json",
    payTo: "",
    maxTimeoutSeconds: 30,
    asset: "SOL_NATIVE",
    extra: { name: "SolAgent", version: "1.0" },
  };
}

async function handleClaudeProxy(request: Request, env: Env): Promise<Response> {
  const bodyText = await request.text();
  const bodyData = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {};

  const paymentHeader = request.headers.get("X-PAYMENT");
  const paymentProof = paymentHeader ? parsePaymentProof(paymentHeader) : null;
  const walletAddress =
    (typeof bodyData.walletAddress === "string" && bodyData.walletAddress) ||
    paymentProof?.payer ||
    request.headers.get("CF-Connecting-IP") ||
    "unknown";

  const allowed = await checkRateLimit(walletAddress, env);
  if (!allowed) {
    return jsonResponse(429, { error: "Rate limit exceeded", code: "RATE_LIMITED" });
  }

  if (paymentHeader) {
    if (!paymentProof?.signature) {
      return jsonResponse(402, { error: "Invalid payment proof", paymentRequest: buildX402PaymentRequest() });
    }
    const valid = await verifyPaymentSignature(paymentProof.signature, env);
    if (!valid) {
      return jsonResponse(402, { error: "Invalid payment proof", paymentRequest: buildX402PaymentRequest() });
    }
  }

  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: bodyText,
  });

  if (!anthropicResponse.ok || !anthropicResponse.body) {
    const errorText = await anthropicResponse.text();
    return jsonResponse(anthropicResponse.status, { error: errorText || "Anthropic upstream error" });
  }

  return new Response(anthropicResponse.body, {
    status: anthropicResponse.status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function extractWalletAddress(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "unknown";
  const record = payload as Record<string, unknown>;
  if (typeof record.walletAddress === "string") return record.walletAddress;
  if (typeof record.address === "string") return record.address;
  if (Array.isArray(record) && record.length > 0) return "unknown";
  const txs = record.transactions;
  if (Array.isArray(txs) && txs.length > 0) {
    const first = txs[0] as Record<string, unknown>;
    if (typeof first.feePayer === "string") return first.feePayer;
  }
  return "unknown";
}

async function handleHeliusWebhook(request: Request, env: Env): Promise<Response> {
  const providedSignature = request.headers.get("X-Helius-Signature");
  if (!providedSignature || providedSignature !== env.HELIUS_WEBHOOK_SECRET) {
    return jsonResponse(401, { error: "Invalid webhook signature" });
  }

  const payload = (await request.json()) as unknown;
  const walletAddress = extractWalletAddress(payload);
  const timestamp = Date.now();
  const key = `webhook:${walletAddress}:${timestamp}`;
  await env.WEBHOOKS.put(key, JSON.stringify(payload));
  return jsonResponse(200, { ok: true });
}

function handleHealth(): Response {
  return jsonResponse(200, { status: "ok", timestamp: new Date().toISOString() });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const pathname = getPathname(request.url);

    if (request.method === "POST" && pathname === "/api/claude") {
      return handleClaudeProxy(request, env);
    }

    if (request.method === "POST" && pathname === "/api/webhooks/helius") {
      return handleHeliusWebhook(request, env);
    }

    if (request.method === "GET" && pathname === "/api/health") {
      return handleHealth();
    }

    return jsonResponse(404, { error: "Not found" });
  },
};
