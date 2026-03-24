# AuthVault -- Session Handoff

## Session Summary

| Session | Date | Title | Key outcome |
|---------|------|-------|-------------|
| 1 | 2026-03-25 | Foundation + crypto core | Monorepo scaffold, MCPs, skills, crypto (33 tests passing) |

## What Was Done (Session 1) -- Foundation + Crypto Core

1. **Monorepo scaffold** -- Turborepo + pnpm, 4 packages: @authvault/types, @authvault/sdk, @authvault/backend (Hono), @authvault/demo (Vite+React+Tailwind). Committed: f0b95ec.
2. **MCPs installed** -- Supabase MCP + Context7 MCP.
3. **Skills created** -- `/start`, `/wrap`, `/doc-update`, `/save`, `/design` (Swarm Resistance UI system).
4. **Security hooks** -- 5 scripts + settings.local.json config.
5. **Shared types** -- auth.ts, crypto.ts, api.ts in @authvault/types.
6. **Supabase migrations** -- 4 SQL files written (not yet applied): users, key_shares, sessions, devices + RLS.
7. **Crypto core (33/33 tests)** -- Shamir SSS (GF(2^8), 2-of-3), XChaCha20-Poly1305 encryption, secp256k1 key gen with EIP-55 checksums. Committed: 46e0ee2.

## What To Do Next

| Priority | Task | Details |
|----------|------|---------|
| 1 | Apply Supabase migrations | Run 4 SQL files against Supabase project |
| 2 | Backend auth -- Google OAuth | Verify Supabase JWT, create/find user, return session |
| 3 | Backend auth -- Email OTP | Send code, verify code, create session |
| 4 | Backend middleware | JWT auth, rate limiting (Upstash), CORS |
| 5 | Backend key management | Store server share (Vault), retrieve share, recovery endpoint |
| 6 | Backend session management | Issue JWT, verify, refresh, device tracking |
| 7 | SDK -- full useAuth hook | OAuth flow (redirect + callback), session persistence |
| 8 | SDK -- device share storage | IndexedDB for client-side device share |
| 9 | SDK -- LoginModal | Full themed modal matching /design system |
| 10 | SDK -- wallet connectors | MetaMask (EIP-6963), WalletConnect v2, SIWE |
| 11 | SDK -- signing (Web Worker) | SSS reconstruction + transaction signing |
| 12 | Recovery flow | Password-based recovery share decryption |
| 13 | Integration + E2E tests | Full login flow testing (social + wallet) |
| 14 | Deploy | Backend to Railway, demo to Vercel |

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project conventions and current state |
| `handoff.md` | This file -- session tracking |
| `AuthVault_MVP_Documentation.md` | Full MVP spec (source of truth) |
| `.claude/commands/` | Skills: start, wrap, doc-update, save, design |
| `.claude/hooks/` | Security hook scripts |
| `packages/sdk/src/crypto/` | Shamir SSS, encryption, keygen (all tested) |
| `packages/types/src/` | Shared TypeScript types |
| `apps/backend/src/index.ts` | Hono server entry point |
| `supabase/migrations/` | 4 SQL migration files (not yet applied) |
