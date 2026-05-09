# SolAgent — AI Financial Agent on Solana

## The Problem
Most people can't use crypto because it requires understanding
wallet addresses, gas fees, slippage, and DEX interfaces.
This friction locks billions of people out of the open financial system.

## The Solution
SolAgent lets anyone manage their Solana wallet using plain English.
"Send 10 USDC to John", "Swap my SOL to USDC", "What's my balance?" —
the AI agent handles everything and asks for confirmation before acting.

## Demo
[Watch 3-min demo video](https://your-demo-link-here)

## Features
- 💬 Natural language wallet management via Claude AI
- ⚡ Token swaps via Jupiter aggregator (best price routing)
- 🎙️ Voice commands via ElevenLabs STT/TTS
- 💸 x402 micro-payments per AI query (0.001 SOL)
- 📱 Built for Solana Mobile / Seeker device
- 📊 Real-time portfolio with USD values via Helius

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Mobile | Expo 52 / React Native 0.76 |
| Navigation | Expo Router |
| Solana | @solana/web3.js + Mobile Wallet Adapter |
| AI Agent | Anthropic Claude (claude-sonnet-4-20250514) |
| Swaps | Jupiter V6 Aggregator |
| RPC | Helius Enhanced API |
| Voice | ElevenLabs Scribe STT + TTS |
| Payments | x402 protocol on Solana |
| Backend | Cloudflare Workers |
| State | Zustand + AsyncStorage |

## Architecture
User → Expo App → Cloudflare Worker → Anthropic API
                ↓
          Helius RPC → Solana Mainnet
                ↓
          Jupiter V6 → Best swap route

## Quick Start
git clone https://github.com/yourusername/solagent
cd solagent
cp .env.example .env
# Fill in your API keys in .env
npm install
npx expo run:android

## Environment Variables
See `.env.example` for all required keys with descriptions.

## Hackathon Tracks
- 🏆 Best App Overall on Solana — Dev3pack 2026
- 📱 Best Mobile App on Solana Mobile — Dev3pack 2026
- ⚡ Best use of x402 on Solana — $500 bonus prize

## License
MIT — open source as required by hackathon rules
