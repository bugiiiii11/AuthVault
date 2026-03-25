# AuthVault -- Session Handoff

## Session Summary

| Session | Date | Title | Key outcome |
|---------|------|-------|-------------|
| 1 | 2026-03-25 | MVP build | Full auth system: crypto, backend, SDK, connectors, signing |
| 2 | 2026-03-25 | Deployment + Email OTP | Backend on Railway, demo on Vercel, Email OTP working end-to-end |
| 3 | 2026-03-25 | Google + MetaMask + key generation | All login methods wired and tested live |

## What Was Done (Session 3) -- Google + MetaMask + Key Generation

1. **MetaMask wired** -- `LoginModal` now calls `useWallet.connect('metamask')`. SIWE flow end-to-end: nonce → sign → verify → session. Tested and working.
2. **WalletConnect wired** -- Same pattern. UI opens and shows QR modal. Blocked only by WalletConnect Cloud domain whitelist (see Known Issues).
3. **Google OAuth wired** -- `LoginModal.handleGoogleLogin` calls `supabaseClient.auth.signInWithOAuth`. `AuthVaultProvider` listens to `onAuthStateChange`, auto-calls backend on redirect callback. Tested and working.
4. **Key generation on first login** -- Centralized `handleAuthResponse` in `AuthVaultProvider` generates Shamir SSS keys (3 shares, 2-of-3 threshold) when `isNew === true` and `loginMethod !== 'wallet'`. Device share stored in IndexedDB, server + recovery shares sent to backend. EVM address populated immediately after login.
5. **`@supabase/supabase-js` added to SDK** -- Supabase client created in provider if `supabaseUrl` + `supabaseAnonKey` provided. Exposed via context.
6. **`getOrCreateEncryptionKey` helper** -- Generates/persists a 32-byte encryption key per user in IndexedDB. Used to encrypt all SSS shares.
7. **Deleted `@authvault/demo` Railway service** -- Demo is on Vercel only. Railway service was misconfigured (static frontend, no healthcheck).
8. **Committed**: 13aaa5d, f8a8582.

## What Was Done (Session 2) -- Deployment + Email OTP

1. **Google 2SV fixed** -- Enabled 2-Step Verification in Google Account, gained Cloud Console access.
2. **Google OAuth credentials** -- Created OAuth Client ID + Secret in Google Cloud Console, configured Supabase Google provider with callback URL.
3. **Backend deployed to Railway** -- Fixed 4 Docker/pnpm issues (Dockerfile path, node_modules virtual store, railway.toml location, prod install). Live at: `authvaultbackend-production.up.railway.app`. Committed: 0d7e6ae, c8d2e32, 0809c07, 17db64c.
4. **Demo deployed to Vercel** -- Fixed hardcoded localhost URL, missing vite/client tsconfig types, turbo.json env vars. Live at: `auth-vault-demo.vercel.app`. Committed: 379e167, 4c6b483, 1000e0a.
5. **Email OTP working** -- Fixed CORS (ALLOWED_ORIGINS), Supabase OTP length (8→6), email confirmation disabled, OTP verify using anon client. Full login flow verified. Committed: 1542e67, b0a7ca8.
6. **Backend dev script** -- Added `--env-file=.env` flag to tsx watch command. Committed: 0d7e6ae.

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

## Live URLs

| Service | URL |
|---------|-----|
| Backend (Railway) | `https://authvaultbackend-production.up.railway.app` |
| Demo (Vercel) | `https://auth-vault-demo.vercel.app` |
| Supabase | project `hldkdiibvsdtgxnqaaxq` |

## Known Issues

- **WalletConnect QR blank** -- `pulse.walletconnect.org` returns 403 (origin not allowed). Fix: add `auth-vault-demo.vercel.app` to allowed domains in WalletConnect Cloud dashboard (cloud.walletconnect.com → project → Settings → Allowed Domains).

## What To Do Next

| Priority | Task | Details |
|----------|------|---------|
| 1 | Fix WalletConnect domain whitelist | WalletConnect Cloud → project → Settings → add `auth-vault-demo.vercel.app` |
| 2 | Recovery flow | Add recovery share retrieval endpoint, password-based recovery UI |
| 3 | Web Worker signing | Move SSS reconstruction to Web Worker for non-blocking signing (v1.1) |
| 4 | Integrate into Swarm Resistance | Replace Web3Auth with `@authvault/sdk` in game frontend |

## Deployment Env Vars

### Railway (backend) -- already set
```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
AUTHVAULT_JWT_SECRET, AUTHVAULT_ENCRYPTION_MASTER_KEY
GOOGLE_CLIENT_ID
ALLOWED_ORIGINS=https://auth-vault-demo.vercel.app
NODE_ENV=production, PORT=3001
```

### Vercel (demo) -- already set
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
VITE_AUTHVAULT_BACKEND_URL=https://authvaultbackend-production.up.railway.app
VITE_WALLETCONNECT_PROJECT_ID
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/sdk/src/crypto/` | Shamir SSS, encryption, keygen (33 tests) |
| `packages/sdk/src/core/` | HTTP client, device share, session, key manager |
| `packages/sdk/src/hooks/` | useAuth, useWallet, useSigning |
| `packages/sdk/src/connectors/` | MetaMask, WalletConnect, Coinbase |
| `packages/sdk/src/components/LoginModal.tsx` | Auth modal -- all methods wired |
| `packages/sdk/src/AuthVaultProvider.tsx` | Provider -- Supabase client, handleAuthResponse, key gen |
| `apps/backend/src/routes/` | Auth (google, email, siwe, session) + keys |
| `apps/backend/src/services/emailOtp.ts` | OTP send (admin client) + verify (anon client) |
| `apps/backend/src/middleware/` | JWT auth, rate limiting |
| `apps/backend/Dockerfile` | Production Docker build (fresh pnpm install in runner) |
| `apps/demo/src/main.tsx` | Demo entry -- AuthVaultProvider with all env vars |
| `supabase/migrations/` | 4 SQL files (applied) |
