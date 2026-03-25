# AuthVault -- Session Handoff

## Session Summary

| Session | Date | Title | Key outcome |
|---------|------|-------|-------------|
| 1 | 2026-03-25 | MVP build | Full auth system: crypto, backend, SDK, connectors, signing |
| 2 | 2026-03-25 | Deployment + Email OTP | Backend on Railway, demo on Vercel, Email OTP working end-to-end |

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

- **Google login disabled** -- `LoginModal` requires `supabaseJwt` prop which is never passed from `App.tsx`. Needs Supabase OAuth flow on the frontend (client-side `signInWithOAuth`, then pass JWT to backend).
- **MetaMask/WalletConnect do nothing** -- `onClick={() => {}}` in `LoginModal.tsx` lines 208-211. Wallet connector hooks exist but are not wired into the modal.
- **EVM address not assigned on login** -- Key generation flow not triggered after first login. "No address yet" shown in demo.

## What To Do Next

| Priority | Task | Details |
|----------|------|---------|
| 1 | Wire MetaMask into LoginModal | Replace empty onClick with useWallet hook, trigger SIWE flow |
| 2 | Wire WalletConnect into LoginModal | Same pattern as MetaMask |
| 3 | Google login frontend flow | Call `supabase.auth.signInWithOAuth({ provider: 'google' })` in frontend, pass resulting JWT to backend |
| 4 | Key generation on first login | Trigger `generateAndDistributeKeys` after `isNew === true` response from backend |
| 5 | Recovery flow | Add recovery share retrieval endpoint, password-based recovery |
| 6 | Web Worker signing | Move SSS reconstruction to Web Worker (v1.1) |
| 7 | Integrate into Swarm Resistance | Replace Web3Auth with @authvault/sdk in game frontend |

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
| `packages/sdk/src/components/LoginModal.tsx` | Auth modal -- Google/wallet handlers need wiring |
| `apps/backend/src/routes/` | Auth (google, email, siwe, session) + keys |
| `apps/backend/src/services/emailOtp.ts` | OTP send (admin client) + verify (anon client) |
| `apps/backend/src/middleware/` | JWT auth, rate limiting |
| `apps/backend/Dockerfile` | Production Docker build (fresh pnpm install in runner) |
| `apps/demo/src/main.tsx` | Demo entry -- AuthVaultProvider with VITE_AUTHVAULT_BACKEND_URL |
| `supabase/migrations/` | 4 SQL files (applied) |
