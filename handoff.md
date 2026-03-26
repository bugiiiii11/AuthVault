# AuthVault -- Session Handoff

## Session Summary

| Session | Date | Title | Key outcome |
|---------|------|-------|-------------|
| 1 | 2026-03-25 | MVP build | Full auth system: crypto, backend, SDK, connectors, signing |
| 2 | 2026-03-25 | Deployment + Email OTP | Backend on Railway, demo on Vercel, Email OTP working end-to-end |
| 3 | 2026-03-25 | Google + MetaMask + key generation | All login methods wired and tested live |
| 4 | 2026-03-25 | Recovery flow + BYTEA fix | WalletConnect working, full account recovery system, BYTEA→TEXT DB fix |
| 5 | 2026-03-25 | Bug fixes + architecture decision | Signing fixed, key management redesigned to server-assisted seamless mode |
| 6 | 2026-03-26 | Seamless key management implementation | Full HKDF + Vault key storage, X25519 transport, libsodium removed from backend |

## What Was Done (Session 6) -- Seamless Key Management Implementation

1. **DB migration 007 applied** -- `encrypted_keys` table, `key_access_log` table, vault wrapper functions (`create_user_vault_key`, `get_user_vault_key`, `update_user_vault_key`). Applied to Supabase live.

2. **Backend: HKDF key derivation + Vault storage** -- `services/keyDerivation.ts` derives private key via HKDF-SHA256 from master secret + oauth subject. `routes/keys/generate.ts` rewritten: server generates key, encrypts with app-level key, stores in Vault. Idempotent (returns existing key if already stored).

3. **Backend: device-init route** -- `routes/keys/deviceInit.ts` implements X25519 ECDH + AES-256-GCM transport using Node.js built-in crypto (no libsodium). Client sends ephemeral public key, server derives shared secret via ECDH + HKDF, encrypts private key, returns ciphertext.

4. **Backend: libsodium fully removed** -- ESM build of libsodium-wrappers crashed in Docker (missing `libsodium.mjs`). All backend crypto now uses Node.js built-in `crypto` module. Recovery routes removed from `index.ts`.

5. **SDK: seamless key flow** -- `core/privateKeyStore.ts` stores full encrypted private key in IndexedDB. `AuthVaultProvider.tsx` removed all recovery state, added `ensureLocalKey()` using Web Crypto API for X25519 ECDH transport. `hooks/useSigning.ts` uses direct private key from IndexedDB (no SSS reconstruction).

6. **SDK: recovery UI removed** -- `LoginModal.tsx` stripped of `recovery-setup` and `recovery-password` views. SSS code kept behind `mode: 'sovereign'` flag.

7. **Logout fix** -- `useAuth.ts` now calls `supabaseClient.auth.signOut()` to clear Google Supabase session. Previously Google session persisted and auto-re-logged users.

8. **Demo updated** -- `App.tsx` updated to new signing API (no encryptionKey param).

**Commits this session:** af3c33e, 826b3db, 0820543, 5d937db

## What Was Done (Session 5) -- Bug Fixes + Architecture Decision

1. **Signing fixed ("No server share found")** -- Migration 006 had truncated `key_shares`, leaving users with valid sessions but no server share. Fixed in two places: (a) hydration `useEffect` now verifies server share after `getMe()` succeeds and auto-regenerates keys if missing; (b) `handleAuthResponse` for returning users does the same check. Committed: dbc6ca5.

2. **Recovery escape hatch added** -- When no recovery bundle exists (because it was never set up), the recovery-password modal had no way out. Added `resetKeys()` to provider context and a "Generate a new wallet instead" link in the recovery-password view. Committed: d68b77e.

3. **Architecture decision: switch to server-assisted seamless key management** -- The 2-of-3 SSS + recovery password design creates friction for multi-device gaming users. Agreed to replace with server-assisted HKDF-based key storage (same model as Web3Auth default). Key points:
   - Server derives `userKey = HKDF(master_secret || oauth_subject || "authvault-v1")` on the fly
   - Server generates private key, double-encrypts (app-level XChaCha20 + Supabase Vault), stores in `encrypted_keys` table
   - New device: server re-encrypts with session transport key, client caches in IndexedDB
   - No recovery password. Any device + same Google account = same wallet
   - Existing SSS code stays behind a `mode: 'sovereign'` flag for future SaaS use
   - `supabase_vault` v0.3.1 confirmed installed on project `hldkdiibvsdtgxnqaaxq`
   - Full spec: `AuthVault_MVP_Key_Management_Revision.md`

## What Was Done (Session 4) -- Recovery Flow + BYTEA Fix

1. **WalletConnect domain whitelist fixed** -- User added `auth-vault-demo.vercel.app` to WalletConnect Cloud allowed domains. QR modal now works and was tested successfully with Trust Wallet. Priority 1 is done.

2. **Recovery flow built** -- Full account recovery system implemented:
   - `supabase/migrations/005_create_recovery_bundles.sql` -- `recovery_bundles` table + `wallet_users.recovery_configured` column
   - `packages/sdk/src/crypto/pbkdf2.ts` -- PBKDF2-SHA-256 key derivation via Web Crypto API
   - `apps/backend/src/routes/keys/recovery.ts` -- 3 new routes: `POST /api/keys/recovery-bundle`, `GET /api/keys/recovery-bundle`, `POST /api/keys/recover`
   - `packages/sdk/src/core/keyManager.ts` -- `setupRecoveryBundle` + complete `recoverWithPassword`
   - `packages/sdk/src/core/client.ts` -- `storeRecoveryBundle`, `getRecoveryBundle`, `updateServerShareAfterRecovery`
   - `packages/sdk/src/AuthVaultProvider.tsx` -- `needsRecoverySetup`, `needsRecovery`, `setupRecovery`, `completeRecovery`, `dismissRecoverySetup` added to context
   - `packages/sdk/src/components/LoginModal.tsx` -- two new views: `recovery-setup` (set password after first login) and `recovery-password` (enter password on new device)
   - Committed: 161d090

3. **Sign-message test added to demo** -- "Test: Sign Message" button in `apps/demo/src/App.tsx`. Gets encryption key from IndexedDB, hashes a test message with SHA-256, signs with secp256k1 via SSS reconstruction, displays signature. Exported `getOrCreateEncryptionKey` from SDK index. Committed: 4b4f209

4. **BYTEA to TEXT fix** -- PostgREST returns BYTEA columns as base64 strings in JSON, which broke the nonce hex round-trip ("invalid public_nonce length" error). Fixed by:
   - `supabase/migrations/006_key_shares_bytea_to_text.sql` -- alter `key_shares.encrypted_share` and `key_shares.encryption_nonce` from BYTEA to TEXT; truncate stale test data
   - `apps/backend/src/routes/keys/generate.ts` -- store/return hex strings directly (no more hexToBytes/bytesToHex on DB values)
   - `apps/backend/src/routes/keys/recovery.ts` -- same fix for recover endpoint
   - Applied to Supabase live DB
   - Committed: 1c8be0a, eb0c0e0

**Commits this session:** 161d090, 4b4f209, 1c8be0a, eb0c0e0

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

None outstanding. WalletConnect domain whitelist resolved in session 4.

## What To Do Next

| Priority | Task | Details |
|----------|------|---------|
| 1 | Verify Railway deploy | Confirm commit `5d937db` is running on Railway (no libsodium backend). Check healthcheck endpoint |
| 2 | Test email OTP with different email | `chaosgenesisnft@gmail.com` has Supabase provider conflict (Google + OTP). Test with a separate email |
| 3 | Test full login + signing flow | Google OAuth login, verify EVM address appears, test message signing |
| 4 | Test multi-device | Same Google account in 2 browsers → same wallet address, signing works from both |
| 5 | Integrate into Swarm Resistance | Replace Web3Auth with `@authvault/sdk` in game frontend |

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
| `packages/sdk/src/crypto/` | Shamir SSS, encryption, keygen, PBKDF2 (33 tests) |
| `packages/sdk/src/core/` | HTTP client, device share, session, key manager, recovery |
| `packages/sdk/src/hooks/` | useAuth, useWallet, useSigning |
| `packages/sdk/src/connectors/` | MetaMask, WalletConnect, Coinbase |
| `packages/sdk/src/components/LoginModal.tsx` | Auth modal -- all methods + recovery-setup + recovery-password views |
| `packages/sdk/src/AuthVaultProvider.tsx` | Provider -- Supabase client, handleAuthResponse, key gen, recovery state |
| `packages/sdk/src/core/privateKeyStore.ts` | IndexedDB store for full encrypted private key (seamless mode) |
| `apps/backend/src/services/keyDerivation.ts` | HKDF-SHA256 key derivation service |
| `apps/backend/src/routes/keys/deviceInit.ts` | X25519 ECDH + AES-256-GCM transport route |
| `apps/backend/src/routes/` | Auth (google, email, siwe, session) + keys (generate, deviceInit) |
| `apps/backend/src/services/emailOtp.ts` | OTP send (admin client) + verify (anon client) |
| `apps/backend/src/middleware/` | JWT auth, rate limiting |
| `apps/backend/Dockerfile` | Production Docker build (fresh pnpm install in runner) |
| `apps/demo/src/main.tsx` | Demo entry -- AuthVaultProvider with all env vars |
| `apps/demo/src/App.tsx` | Demo app -- login UI + sign-message test button |
| `supabase/migrations/` | 7 SQL files (applied) |
