# AuthVault -- Project Instructions

## What This Is
AuthVault MVP -- self-hosted Web3Auth replacement for Swarm Resistance gaming platform.
Authentication + transaction signing only. No wallet UI, no token display, no custody.

## Current State
- Session: 1
- Phase: Pre-development (skills, hooks, docs setup)
- Repo: github.com/bugiiiii11/AuthVault
- Infra: Supabase (fresh project) + Railway (backend) + Vercel (frontend)

## Tech Stack
- Monorepo: Turborepo + pnpm 9
- Language: TypeScript 5.4+, Node 20 LTS
- Frontend: React + Vite + Tailwind CSS
- Backend: Hono 4.x + Drizzle ORM
- Database: Supabase (PostgreSQL + Auth + Vault)
- SDK bundler: tsup
- Testing: Vitest
- Crypto: @noble/curves, libsodium-wrappers

## MVP Scope (Day 1)
- EVM only (no Solana yet)
- Google OAuth + Email OTP (Apple, X later)
- MetaMask + WalletConnect wallet connections
- Shamir SSS (2-of-3) for social login key management

## Conventions
- No emojis in code or docs
- pnpm only (no npm/yarn)
- Commit messages: concise, "why" not "what"
- All env vars in .env.example (never commit real .env)

## Skills Available
- `/start` -- Session initialization, read project state
- `/wrap` -- Commit, push, update docs
- `/doc-update` -- Update handoff.md and project docs
- `/save` -- Emergency context save before compaction

## Key Files
- `handoff.md` -- Session history and "What To Do Next"
- `AuthVault_MVP_Documentation.md` -- Full MVP spec (source of truth)
