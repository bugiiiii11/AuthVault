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

## Blockers Found

- **Google Cloud Console** requires 2-Step Verification. User set up Authenticator but console still blocked. May need to sign out/in or wait longer. Google OAuth config deferred to next session.

## What To Do Next

| Priority | Task | Details |
|----------|------|---------|
| 1 | Google 2SV fix | Sign out/in to Google, then access Cloud Console to create OAuth credentials |
| 2 | Supabase Auth config | Enable Google OAuth provider with Client ID + Secret |
| 3 | Deploy backend to Railway | Connect GitHub repo, set env vars from .env.example, verify /api/health |
| 4 | Deploy demo to Vercel | Connect GitHub repo, set VITE_ env vars, verify build |
| 5 | Integration testing | Test Email OTP + MetaMask flows end-to-end (Google after OAuth config) |
| 6 | Recovery flow | Add recovery share retrieval endpoint, password-based recovery |
| 7 | Web Worker signing | Move SSS reconstruction to Web Worker (v1.1) |
| 8 | Integrate into Swarm Resistance | Replace Web3Auth with @authvault/sdk in game frontend |

## Deployment Env Vars Needed

### Railway (backend)
```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
AUTHVAULT_JWT_SECRET (generate: openssl rand -hex 32)
AUTHVAULT_ENCRYPTION_MASTER_KEY (generate: openssl rand -hex 32)
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (optional for dev)
ALLOWED_ORIGINS (your Vercel domain)
PORT=3001
NODE_ENV=production
```

### Vercel (demo)
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
VITE_AUTHVAULT_BACKEND_URL (your Railway URL)
VITE_WALLETCONNECT_PROJECT_ID
```

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
