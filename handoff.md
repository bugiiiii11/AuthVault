# AuthVault -- Session Handoff

## Session Summary

| Session | Date | Title | Key outcome |
|---------|------|-------|-------------|
| 1 | 2026-03-25 | Full MVP foundation | Monorepo, crypto, backend auth, SDK frontend, Supabase live |

## What Was Done (Session 1) -- Full MVP Foundation

1. **Monorepo scaffold** -- Turborepo + pnpm, 4 packages. Committed: f0b95ec.
2. **Tooling** -- Supabase MCP, Context7 MCP, 5 skills (/start, /wrap, /doc-update, /save, /design), 5 security hooks.
3. **Crypto core (33/33 tests)** -- Shamir SSS, XChaCha20-Poly1305, secp256k1 keygen. Committed: 46e0ee2.
4. **Supabase migrations applied** -- 4 tables live (wallet_users, key_shares, auth_sessions, user_devices) + RLS policies. Project: hldkdiibvsdtgxnqaaxq.
5. **Backend auth (complete)** -- Google OAuth, Email OTP, SIWE (wallet), session mgmt, key management routes. JWT middleware (jose), rate limiting (Upstash + in-memory). Committed: f8408ec.
6. **SDK frontend** -- AuthVaultProvider (session hydration), useAuth hook (Google, Email OTP), LoginModal (Swarm Resistance design), HTTP client, IndexedDB device share storage, session management. Committed: 3c20e06.

## What To Do Next

| Priority | Task | Details |
|----------|------|---------|
| 1 | SDK -- wallet connectors | MetaMask (EIP-6963), WalletConnect v2 connector components |
| 2 | SDK -- signing (Web Worker) | SSS reconstruction + transaction signing in worker |
| 3 | Recovery flow | Password-based recovery share decryption |
| 4 | Supabase Auth config | Enable Google OAuth provider in Supabase dashboard |
| 5 | Integration testing | Full login flow E2E (social + wallet) with demo app |
| 6 | Deploy backend to Railway | Connect repo, set env vars, verify health endpoint |
| 7 | Deploy demo to Vercel | Connect repo, verify build |

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project conventions and current state |
| `handoff.md` | This file -- session tracking |
| `AuthVault_MVP_Documentation.md` | Full MVP spec (source of truth) |
| `packages/sdk/src/crypto/` | Shamir SSS, encryption, keygen (33 tests) |
| `packages/sdk/src/core/` | HTTP client, device share (IndexedDB), session mgmt |
| `packages/sdk/src/hooks/` | useAuth, useSigning |
| `packages/sdk/src/components/` | LoginModal |
| `apps/backend/src/routes/` | Auth (google, email, siwe, session) + keys |
| `apps/backend/src/services/` | userManager, oauthVerifier, emailOtp |
| `apps/backend/src/middleware/` | JWT auth, rate limiting |
