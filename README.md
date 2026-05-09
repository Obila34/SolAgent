# SolAgent

> Your Solana wallet. Plain English.

SolAgent is a mobile AI agent for Solana. You tell it what you want — send tokens, swap assets, check your balance — and it handles the transaction, shows you exactly what's about to happen, and waits for you to say yes before touching anything.

---

## Table of Contents

- [Why It Exists](#why-it-exists)
- [Demo](#demo)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [AI Agent Design](#ai-agent-design)
- [Solana Integration](#solana-integration)
- [Voice Interface](#voice-interface)
- [x402 Micro-payments](#x402-micro-payments)
- [Security Model](#security-model)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Building & Deployment](#building--deployment)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

---

## Why It Exists

Sending USDC to a friend shouldn't require a tutorial. But it does. You open a wallet app, hunt for the right token, paste a 44-character address (hoping it's the right one), set an amount, guess at the fee, and submit. Something designed to replace banks ended up being harder to use than online banking.

SolAgent cuts that down to one step. Type `send 10 USDC to 7xKp...3mNq` or say it out loud. The agent checks your balance, builds the transaction, shows you the USD amount and estimated fee, and waits. You confirm or cancel. Nothing moves without you.

It's not trying to be a trading terminal or a DeFi dashboard. It's trying to be the wallet you'd hand to someone who's never touched crypto and not have them immediately lost.

---

## Demo

**Live demo:** [appetize.io/app/solagent](https://appetize.io)

**GitHub:** [github.com/Obila34/SolAgent](https://github.com/Obila34/SolAgent)

**What you can try:**

| You say | What happens |
|---|---|
| `"What's my balance?"` | Fetches all token balances from Helius, converts to USD, returns a summary |
| `"Send 5 USDC to 7xKp...3mNq"` | Validates address, builds SPL transfer, shows preview card, waits for confirm |
| `"Swap 0.5 SOL to USDC"` | Fetches Jupiter quote, shows output amount + price impact, routes swap on confirm |
| `"Show my recent transactions"` | Pulls enriched tx history from Helius, returns human-readable descriptions |
| `"What's the price of SOL?"` | Queries Jupiter Price API, returns current USD price |

---

## Features

### Natural Language Wallet Control
Claude sits at the center of SolAgent. When you send a message, it figures out what you want, picks the right tool, calls it with the right parameters, and returns a response. It doesn't just pattern-match commands — it reasons. If you say "send SOL to John" and John's address isn't obvious, it asks before doing anything.

### Transaction Preview Before Every Action
The agent never signs anything on its own. Every transfer and swap produces a preview card first: action type, from/to addresses, token amount, USD equivalent, estimated fee, and price impact for swaps. Green to confirm, red to cancel. That's the only path to execution.

### Jupiter Swaps
Swaps go through Jupiter V6 — the main DEX aggregator on Solana. SolAgent fetches a quote, shows the expected output, slippage, and route. Price impact above 3% gets flagged before you confirm. Transactions use versioned format with dynamic compute units and auto-priority fees.

### Real-Time Portfolio
The portfolio screen uses Helius's DAS API — one call returns every token, NFT, and native SOL balance with metadata. USD values come from Jupiter's Price API. It refreshes every 60 seconds while the app is open and pauses in the background.

### Transaction History
Helius's Enhanced Transactions API returns actual descriptions of what happened instead of raw instruction data. Transactions group by date, color-code by type, and link directly to Solana Explorer on tap.

### Voice Commands
Hold the mic, speak, release. ElevenLabs Scribe transcribes the audio. The text goes to the agent. Responses can play back as audio via TTS. No on-device model — it's all API, which keeps the app small.

### x402 Micro-payments
There's an optional pay-per-query mode that charges 0.001 SOL per AI request via the x402 protocol. That's a real on-chain transfer — signed by your wallet, verified on Solana by the Cloudflare Worker before it ever reaches Claude. The settings screen shows your query count and total SOL spent.

### Solana Mobile Stack
On Android, signing goes through the Mobile Wallet Adapter protocol. The wallet app handles the private key — SolAgent never sees it. On iOS, the app uses a read-only dev keypair so you can see the UI without real transactions.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Mobile App                           │
│  (Expo / React Native / Expo Router)                        │
│                                                             │
│  ┌──────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│  │ Chat UI  │  │ Portfolio   │  │ Transaction History  │   │
│  └────┬─────┘  └──────┬──────┘  └──────────┬───────────┘   │
│       │               │                    │               │
│  ┌────▼───────────────▼────────────────────▼───────────┐   │
│  │              Service Layer                           │   │
│  │  claude.ts  |  solana.ts  |  jupiter.ts  |  x402.ts │   │
│  └────┬──────────────┬───────────────┬──────────────────┘  │
└───────┼──────────────┼───────────────┼─────────────────────┘
        │              │               │
        ▼              ▼               ▼
┌───────────────┐ ┌──────────┐ ┌─────────────┐
│  Cloudflare   │ │  Helius  │ │  Jupiter V6 │
│  Worker       │ │  RPC     │ │  API        │
│  (API Proxy)  │ │          │ │             │
└───────┬───────┘ └────┬─────┘ └─────────────┘
        │              │
        ▼              ▼
┌───────────────┐ ┌──────────────────┐
│  Anthropic    │ │  Solana Mainnet  │
│  Claude API   │ │                  │
└───────────────┘ └──────────────────┘
```

**What happens when you say "swap 1 SOL to USDC":**
1. App sends the message + conversation history to the Cloudflare Worker
2. Worker validates x402 payment (if enabled), rate-limits by wallet, forwards to Claude
3. Claude picks `swap_tokens` with `{ inputMint: SOL, outputMint: USDC, amount: 1 }`
4. App fetches a Jupiter quote and checks price impact
5. Tool result goes back to Claude, Claude writes a human-readable response
6. App shows the transaction preview card
7. You tap Confirm — Mobile Wallet Adapter signs the versioned transaction
8. Transaction goes to Helius RPC, confirmation polled every 2 seconds
9. Claude confirms with the signature and an explorer link

---

## Tech Stack

### Mobile

| Package | Version | Purpose |
|---|---|---|
| `expo` | 54.0.0 | Mobile framework and build toolchain |
| `react-native` | 0.81.5 | Cross-platform UI primitives |
| `expo-router` | 6.x | File-based navigation and deep linking |
| `nativewind` | 4.x | Tailwind CSS utility classes in React Native |
| `react-native-reanimated` | 3.10.1 | Gesture-driven animations and spring physics |
| `react-native-gesture-handler` | 2.28.x | Touch gesture recognition |
| `react-native-safe-area-context` | 5.6.x | Safe area insets for notched devices |
| `react-native-screens` | 4.16.x | Native screen containers for navigation |
| `zustand` | 5.x | Lightweight state management |
| `@react-native-async-storage/async-storage` | 2.x | Persistent local storage |

### Solana

| Package | Version | Purpose |
|---|---|---|
| `@solana/web3.js` | 1.98.x | Core Solana SDK — connections, transactions, accounts |
| `@solana/spl-token` | 0.4.x | SPL token program interactions — transfers, accounts |
| `@solana-mobile/mobile-wallet-adapter-protocol` | 2.1.x | Native wallet signing on Android via MWA |
| `@solana-mobile/mobile-wallet-adapter-protocol-web3js` | 2.1.x | Web3.js integration for MWA |
| `@bonfida/spl-name-service` | 3.x | .sol domain name resolution |
| `bs58` | 6.x | Base58 encoding/decoding for Solana addresses |

### AI & Voice

| Package | Version | Purpose |
|---|---|---|
| `@anthropic-ai/sdk` | 0.36.x | Claude API client with streaming and tool use |
| `expo-av` | 16.x | Audio recording for voice input |
| `expo-speech` | 14.x | TTS fallback for voice output |

### Utilities

| Package | Version | Purpose |
|---|---|---|
| `date-fns` | 3.x | Date formatting for transaction history grouping |
| `expo-haptics` | 15.x | Haptic feedback on confirm/cancel/error |
| `expo-clipboard` | 8.x | Copy-to-clipboard for addresses and signatures |
| `expo-web-browser` | 15.x | In-app browser for Solana Explorer links |
| `expo-secure-store` | 15.x | Encrypted storage for sensitive config |
| `victory-native` | 41.x | Portfolio balance sparkline chart |
| `react-native-svg` | 15.x | SVG rendering (required by victory-native) |

### Backend

| Technology | Purpose |
|---|---|
| Cloudflare Workers | Edge API proxy — Claude key management, x402 validation, rate limiting |
| Cloudflare KV | Rate limit counters and webhook event storage |
| Helius Webhooks | Real-time on-chain event notifications pushed to the Worker |

---

## AI Agent Design

### Tool Calling

SolAgent doesn't parse commands with regex or a decision tree. It gives Claude a set of tools and lets Claude decide which to call. The model reads the message, picks the tool, fills in the parameters, and the app executes it.

**Available tools:**

```typescript
get_wallet_balance       // Fetch SOL + SPL token balances for a wallet
send_sol                 // Build a SOL transfer transaction
send_spl_token           // Build an SPL token transfer (USDC, USDT, etc.)
swap_tokens              // Get Jupiter quote and build swap transaction
get_token_price          // Current USD price for any Solana token
resolve_wallet_name      // Resolve .sol domain to wallet address
get_transaction_history  // Recent enriched transaction history
```

### The Agentic Loop

The agent keeps running until Claude has nothing left to do:

```
User message
     ↓
Claude API call (with tools + conversation history)
     ↓
Claude returns tool_call → App executes tool → Result returned to Claude
     ↓
Claude returns tool_call → App executes tool → Result returned to Claude
     ↓
Claude returns text response → Displayed to user
```

For transaction tools, the loop pauses at the tool call and waits for the user to confirm. The transaction gets built but not signed until that happens.

### System Prompt

Claude is told to:
- Never move funds without showing a preview first
- Always show amounts in token units and USD
- Ask when addresses or amounts are unclear
- Flag transactions that look unusually large
- Stay concise — bullet points beat paragraphs for multi-step info
- Drop the jargon unless the user introduces it first

### Streaming

Responses stream token-by-token using `client.messages.stream()`. The chat bubble fills in real time instead of appearing all at once after a delay.

---

## Solana Integration

### RPC (Helius)

All RPC goes through Helius instead of a public endpoint. The main reasons:

- **DAS API** — `getAssetsByOwner` returns every token and NFT with metadata in one call
- **Enhanced Transactions** — actual descriptions of what happened, not raw instruction arrays
- **Webhooks** — push events for balance changes without polling
- **Reliability** — public endpoints rate-limit aggressively; Helius doesn't

### Transactions

All transactions use versioned format (v0) with Address Lookup Tables where applicable. Priority fees are dynamic. Compute limit is 200,000 CU with a 1,000 microlamport priority fee.

**SOL transfer:**
```typescript
SystemProgram.transfer({ fromPubkey, toPubkey, lamports })
```

**SPL token transfer:**
```typescript
createTransferCheckedInstruction(
  sourceAccount, mint, destinationAccount,
  owner, amount, decimals
)
```

### Wallet Connection

On Android:
```typescript
await transact(async (wallet) => {
  await wallet.authorize({ cluster: 'mainnet-beta', identity })
  const signedTxs = await wallet.signAndSendTransactions({ transactions })
})
```

On iOS, the app generates a read-only keypair and shows a dev mode banner. No real transactions execute.

### Confirmation

After submission, the app polls `getSignatureStatuses()` every 2 seconds with a 30-second timeout:

```
processed → confirmed → finalized
```

---

## Voice Interface

**Input (ElevenLabs Scribe):**

1. User holds mic — `expo-av` records in HIGH_QUALITY preset
2. On release, audio URI captured
3. Sent to ElevenLabs STT as `multipart/form-data` with `model_id: scribe_v1`
4. Transcription injected into chat, sent to agent

**Output (ElevenLabs TTS):**

1. Claude's response sent to TTS endpoint with configured voice ID
2. Audio saved to Expo cache
3. `expo-av` plays it back
4. `isSpeaking` state drives a visual indicator

No on-device model. The pipeline is API-only, which keeps the APK size reasonable.

---

## x402 Micro-payments

x402 is an HTTP payment protocol on Solana. Each AI query costs 0.001 SOL — paid on-chain, verified by the Worker before the request reaches Claude.

**Flow:**

```
1. App POSTs to Cloudflare Worker: /api/claude
2. Worker returns 402 with payment details
3. App builds SOL transfer (0.001 SOL to recipient)
4. MWA signs and sends it
5. App retries with X-PAYMENT header
6. Worker calls getTransaction() on Helius to verify
7. Request forwarded to Anthropic
8. Response streamed back
```

**Payment proof (base64-encoded in X-PAYMENT header):**
```json
{
  "signature": "base58-encoded-tx-signature",
  "payer": "wallet-public-key",
  "amount": 100000,
  "timestamp": 1234567890
}
```

A replayed signature fails the on-chain verification. A forged one fails even faster.

---

## Security Model

**API key** — The Anthropic key lives in a Cloudflare Worker secret. It's never in the app bundle, never in client env vars, never on the device.

**Private keys** — SolAgent never sees them. MWA means the wallet app signs; SolAgent only receives the signed transaction.

**Execution gate** — The agent builds transactions, it doesn't send them. Sending requires a tap on the Confirm button. No background execution, no silent signing.

**Rate limiting** — 10 AI requests per minute per wallet address, enforced in the Worker via KV. Over the limit returns 429.

**Address validation** — Every address is validated as a real base58 Solana public key before it touches any transaction builder.

**x402 replay protection** — The Worker verifies each payment signature on-chain. A signature used once will be found in the transaction history; a reused one gets rejected.

---

## Project Structure

```
solagent/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout, polyfills, wallet provider
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Tab bar configuration
│   │   ├── index.tsx             # Chat screen — main AI interface
│   │   ├── portfolio.tsx         # Token balances with USD values
│   │   ├── history.tsx           # Enriched transaction history
│   │   └── settings.tsx          # Wallet, x402, voice, network settings
│   └── modal/
│       └── confirm-tx.tsx        # Transaction preview and confirmation
├── components/
│   ├── chat/
│   │   ├── ChatBubble.tsx        # Message bubble (user + agent variants)
│   │   ├── ChatInput.tsx         # Text input + mic button
│   │   ├── ThinkingIndicator.tsx # Animated dots while Claude is processing
│   │   └── TxPreviewCard.tsx     # Inline transaction preview in chat
│   ├── wallet/
│   │   ├── BalanceCard.tsx       # Total portfolio value card
│   │   ├── QuickActions.tsx      # Send / Swap / Receive shortcuts
│   │   └── WalletConnectBtn.tsx  # MWA connect button with state handling
│   └── ui/
│       ├── GradientCard.tsx      # Glassmorphic card with gradient border
│       └── TokenBadge.tsx        # Token icon + symbol badge
├── hooks/
│   ├── useWallet.ts              # MWA connect/disconnect/sign
│   ├── useChat.ts                # Agent message loop + action handling
│   ├── usePortfolio.ts           # Balance fetching + auto-refresh
│   └── useVoice.ts               # Record/transcribe/speak pipeline
├── services/
│   ├── claude.ts                 # Claude API client + tool definitions + streaming
│   ├── solana.ts                 # Helius RPC + transaction builders + confirmation
│   ├── jupiter.ts                # Swap quotes + token list + price API
│   ├── elevenlabs.ts             # STT (Scribe) + TTS pipeline
│   └── x402.ts                   # Payment request + proof generation + verification
├── store/
│   ├── walletStore.ts            # Connected wallet state + dev mode flag
│   ├── chatStore.ts              # Message history + pending action state
│   ├── portfolioStore.ts         # Token balances + last updated timestamp
│   └── settingsStore.ts          # x402 toggle + voice toggle + network + spend tracking
├── workers/
│   └── api-proxy/
│       └── index.ts              # Cloudflare Worker — proxy, x402 validation, rate limiting
├── constants/
│   ├── theme.ts                  # Color tokens (Solana purple/green palette)
│   └── tokens.ts                 # Common token mints (SOL, USDC, USDT, BONK, JUP)
├── types/
│   ├── agent.ts                  # AgentEvent, PendingAction, Tool types
│   ├── chat.ts                   # Message, ChatRole types
│   └── solana.ts                 # TokenBalance, EnrichedTransaction types
├── utils/
│   ├── addressUtils.ts           # Truncate, validate, format Solana addresses
│   ├── formatters.ts             # Currency, token amount, date formatters
│   └── intentParser.ts           # Pre-Claude intent detection for quick actions
├── index.js                      # Entry point with Buffer + crypto polyfills
├── app.json                      # Expo config — scheme, permissions, plugins
├── eas.json                      # EAS Build profiles
├── babel.config.js               # Babel config with Reanimated plugin
├── tsconfig.json                 # TypeScript config
└── .npmrc                        # legacy-peer-deps=true for Solana package compat
```

---

## Getting Started

### Prerequisites

- **Node.js 20+** — Expo 54 won't run on Node 18 or below
- **npm 10+** — ships with Node 20
- **Expo Go** (iOS) or an Android device for testing

### Clone and install

```bash
git clone https://github.com/Obila34/SolAgent.git
cd SolAgent/solagent
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is needed because `@jup-ag/core` has a peer conflict with newer `@solana/spl-token`. This is a known issue across the Solana ecosystem. It doesn't affect how the app runs.

### Configure environment

```bash
cp .env.example .env
```

Fill in your keys — see [Environment Variables](#environment-variables) below.

### Run on iOS

```bash
npx expo start
```

Scan the QR with your iPhone camera. Opens in Expo Go.

> MWA is Android-only. On iOS the app generates a read-only keypair — you can see everything but no real transactions execute.

### Run on Android

```bash
npx expo start --android
```

Needs an Android emulator (Android Studio) or a physical device with USB debugging on.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_HELIUS_RPC_URL` | ✅ | Helius RPC endpoint with API key. Get one at [helius.dev](https://helius.dev) |
| `EXPO_PUBLIC_HELIUS_API_KEY` | ✅ | Helius API key for Enhanced APIs and DAS |
| `EXPO_PUBLIC_CLAUDE_PROXY_URL` | ✅ | Your Cloudflare Worker URL — deploy it first |
| `EXPO_PUBLIC_ELEVENLABS_API_KEY` | ✅ | ElevenLabs API key |
| `EXPO_PUBLIC_ELEVENLABS_VOICE_ID` | ✅ | Voice ID for TTS responses |
| `EXPO_PUBLIC_X402_ENABLED` | ❌ | Set to `true` to enable pay-per-query (default: false) |
| `EXPO_PUBLIC_X402_RECIPIENT` | ❌ | Solana wallet address to receive x402 payments |
| `ANTHROPIC_API_KEY` | ✅ | Claude API key — **server-side only**, goes in Cloudflare Worker secrets, never here |

---

## Building & Deployment

### Deploy the Cloudflare Worker

```bash
cd workers
npm install
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put HELIUS_WEBHOOK_SECRET
npx wrangler deploy
```

Copy the deployed URL into `EXPO_PUBLIC_CLAUDE_PROXY_URL`.

### Build an APK

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

Builds in Expo's cloud — no Android Studio needed. Takes around 20 minutes. Download the `.apk` from the Expo dashboard when done.

### Production build

```bash
eas build --platform android --profile production
```

---

## API Reference

### Cloudflare Worker

**`POST /api/claude`**
Proxies to Anthropic. Validates x402 payment if `X-PAYMENT` is present. Rate limits at 10 req/min per wallet.

```
Content-Type: application/json
X-Wallet-Address: <solana-public-key>
X-PAYMENT: <base64-payment-proof>   (optional)
```

Returns an SSE stream.

**`POST /api/webhooks/helius`**
Receives Helius webhook events. Validates `X-Helius-Signature` before processing.

**`GET /api/health`**
Returns `{ status: "ok", timestamp: <unix-ms> }`.

---

## Contributing

1. Fork the repo
2. Branch off: `git checkout -b feat/your-thing`
3. Make your change
4. Check types: `npx tsc --noEmit`
5. Run tests: `npm test -- --runInBand`
6. Open a PR

One thing per PR. Easier to review, easier to revert if something breaks.

---

## License

MIT
