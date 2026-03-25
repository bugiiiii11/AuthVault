# AuthVault -- Project Instructions

## What This Is
AuthVault MVP -- self-hosted Web3Auth replacement for Swarm Resistance gaming platform.
Authentication + transaction signing only. No wallet UI, no token display, no custody.

## Current State
- Session: 1 complete
- Phase: MVP code complete, deployment + integration remaining
- Repo: github.com/bugiiiii11/AuthVault (8 commits on main)
- Supabase: project hldkdiibvsdtgxnqaaxq, 4 tables live with RLS
- Build: 4/4 packages clean, 33/33 crypto tests passing
- Blocker: Google Cloud Console requires 2SV setup (in progress)

## Tech Stack
- Monorepo: Turborepo + pnpm 10
- Language: TypeScript 5.4+, Node 22
- Frontend: React + Vite + Tailwind CSS
- Backend: Hono 4.x + jose (JWT) + Supabase client
- Database: Supabase (PostgreSQL + Auth + Vault)
- SDK bundler: tsup
- Testing: Vitest
- Crypto: @noble/curves, libsodium-wrappers, Shamir SSS (custom GF(2^8))
- Wallets: MetaMask (EIP-6963), WalletConnect v2, Coinbase Wallet SDK

## MVP Scope
- EVM only (no Solana yet)
- Google OAuth + Email OTP (Apple, X later)
- MetaMask + WalletConnect + Coinbase wallet connections
- Shamir SSS (2-of-3) for social login key management
- SIWE (Sign-In With Ethereum) for wallet users

## Conventions
- No emojis in code or docs
- pnpm only (no npm/yarn)
- Commit messages: concise, "why" not "what"
- All env vars in .env.example (never commit real .env)
- libsodium-wrappers requires CJS alias in vite/vitest configs (ESM build is broken)

## Skills Available
- `/start` -- Session initialization, read project state
- `/wrap` -- Commit, push, update docs
- `/doc-update` -- Update handoff.md and project docs
- `/save` -- Emergency context save before compaction
- `/design` -- Swarm Resistance UI system (colors, components, accessibility)

## Key Files
- `handoff.md` -- Session history and "What To Do Next"
- `AuthVault_MVP_Documentation.md` -- Full MVP spec (source of truth)
- `.env.example` -- All required environment variables
