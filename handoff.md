# AuthVault -- Session Handoff

## Session Summary

| Session | Date | Title | Key outcome |
|---------|------|-------|-------------|
| 1 | 2026-03-25 | MVP build | Full auth system: crypto, backend, SDK, connectors, signing |

## What Was Done (Session 1) -- MVP Build

1. **Monorepo scaffold** -- Turborepo + pnpm, 4 packages. Committed: f0b95ec.
2. **Tooling** -- Supabase MCP, Context7 MCP, 5 skills, 5 security hooks, /design system.
3. **Crypto core (33/33 tests)** -- Shamir SSS (GF(2^8)), XChaCha20-Poly1305, secp256k1 keygen. Committed: 46e0ee2.
4. **Supabase live** -- 4 tables (wallet_users, key_shares, auth_sessions, user_devices) + RLS. Project: hldkdiibvsdtgxnqaaxq.
5. **Backend complete** -- 10 API routes (Google, Email OTP, SIWE, session, keys), JWT middleware, rate limiting. Committed: f8408ec.
6. **SDK frontend** -- AuthVaultProvider, useAuth, LoginModal, HTTP client, IndexedDB storage, session mgmt. Committed: 3c20e06.
7. **Wallet connectors** -- MetaMask (EIP-6963), WalletConnect v2, Coinbase Wallet + useWallet hook with SIWE flow. Committed: 601d8d0.
8. **Signing** -- useSigning hook with main-thread SSS reconstruction (20-40ms). Committed: 601d8d0.
9. **Key lifecycle** -- generateAndDistributeKeys (generate, split, encrypt, store device + send server/recovery shares). Committed: 601d8d0.
10. **Deployment config** -- Dockerfile (multi-stage, Node 20 Alpine) + railway.toml. Committed: 601d8d0.

## What To Do Next

| Priority | Task | Details |
|----------|------|---------|
| 1 | Supabase Auth config | Enable Google OAuth provider in Supabase dashboard (manual) |
| 2 | Deploy backend to Railway | Connect GitHub repo, set env vars, verify /api/health |
| 3 | Deploy demo to Vercel | Connect GitHub repo, set VITE_ env vars |
| 4 | Integration testing | Test full Google login + Email OTP + MetaMask flows end-to-end |
| 5 | Recovery flow completion | Add recovery share retrieval endpoint, password-based recovery |
| 6 | Web Worker signing | Move SSS reconstruction to Web Worker for v1.1 |
| 7 | Integrate into Swarm Resistance | Replace Web3Auth with @authvault/sdk in game frontend |

## Key Files

| File | Purpose |
|------|---------|
| `packages/sdk/src/crypto/` | Shamir SSS, encryption, keygen (33 tests) |
| `packages/sdk/src/core/` | HTTP client, device share, session, key manager |
| `packages/sdk/src/hooks/` | useAuth, useWallet, useSigning |
| `packages/sdk/src/connectors/` | MetaMask, WalletConnect, Coinbase |
| `packages/sdk/src/components/` | LoginModal (Swarm Resistance design) |
| `apps/backend/src/routes/` | Auth (google, email, siwe, session) + keys |
| `apps/backend/src/services/` | userManager, oauthVerifier, emailOtp |
| `apps/backend/src/middleware/` | JWT auth, rate limiting |
| `apps/backend/Dockerfile` | Production Docker build |
| `supabase/migrations/` | 4 SQL files (applied) |
