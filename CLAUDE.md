# SignaKit -- Project Instructions

## What This Is
SignaKit (formerly AuthVault) -- self-hosted Web3Auth replacement for Swarm Resistance gaming platform.
Authentication + transaction signing only. No wallet UI, no token display, no custody.

## Current State
- Session: 10 complete
- Phase: Integrated into Swarm Resistance frontend. MetaMask + Email working. Next: fix Google OAuth 401 (duplicate Supabase client), fix WalletConnect relay hang, deploy
- Repo: github.com/bugiiiii11/AuthVault (folder name kept, package names renamed to signakit)
- Swarm frontend: C:\Users\cryptomeda\Desktop\Swarm\myprojects\swarm-dev\frontend (separate repo, JSX, npm)
- Supabase: project hldkdiibvsdtgxnqaaxq, supabase_vault v0.3.1 installed
- Build: 4/4 packages clean, 33/33 crypto tests passing
- Backend: live at authvaultbackend-production.up.railway.app (SSL broken on Windows, use Vite proxy for dev)
- Demo: live at auth-vault-demo.vercel.app
- Production domain: swarmresistance.com (not cryptomeda.tech)
- Next blocker: Google OAuth redirect, api.swarmresistance.com for SSL fix, WalletConnect stale sessions

## Tech Stack
- Monorepo: Turborepo + pnpm 10
- Language: TypeScript 5.4+, Node 22
- Frontend: React + Vite + Tailwind CSS
- Backend: Hono 4.x + jose (JWT) + Supabase client
- Database: Supabase (PostgreSQL + Auth + Vault)
- SDK bundler: tsup
- Testing: Vitest
- Crypto: @noble/curves, libsodium-wrappers (SDK only), Node.js crypto (backend), Web Crypto API (transport)
- Wallets: MetaMask (EIP-6963), WalletConnect v2, Coinbase Wallet SDK

## MVP Scope
- EVM only (no Solana yet)
- Google OAuth + Email OTP (Apple, X later)
- MetaMask + WalletConnect + Coinbase wallet connections
- Server-assisted seamless key management (HKDF + Vault, no recovery password)
- SSS 2-of-3 code kept behind `mode: 'sovereign'` flag for future SaaS use
- SIWE (Sign-In With Ethereum) for wallet users

## Conventions
- No emojis in code or docs
- pnpm only (no npm/yarn)
- Commit messages: concise, "why" not "what"
- All env vars in .env.example (never commit real .env)
- libsodium-wrappers requires CJS alias in vite/vitest configs (ESM build is broken)

## Backward Compatibility Constants (DO NOT RENAME)
- HKDF info strings: `authvault-v1`, `authvault-device-init-v1`
- IndexedDB database name: `authvault`
- localStorage keys: `authvault:session`, `authvault:user`, `authvault:deviceId`
- Vault SQL functions: `create_user_vault_key`, `get_user_vault_key`, `update_user_vault_key`

## Skills Available
- `/start` -- Session initialization, read project state
- `/wrap` -- Commit, push, update docs
- `/doc-update` -- Update handoff.md and project docs
- `/save` -- Emergency context save before compaction
- `/design` -- Swarm Resistance UI system (colors, components, accessibility)
- `/skillscanner` -- Scan a Claude Code skill for scams, malicious code, and safety issues before installing

## Key Files
- `handoff.md` -- Session history and "What To Do Next"
- `.env.example` -- All required environment variables
