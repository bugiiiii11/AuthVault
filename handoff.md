# SignaKit -- Session Handoff

## Session Summary

| Session | Date | Title | Key outcome |
|---------|------|-------|-------------|
| 1 | 2026-03-25 | MVP build | Full auth system: crypto, backend, SDK, connectors, signing |
| 2 | 2026-03-25 | Deployment + Email OTP | Backend on Railway, demo on Vercel, Email OTP working end-to-end |
| 3 | 2026-03-25 | Google + MetaMask + key generation | All login methods wired and tested live |
| 4 | 2026-03-25 | Recovery flow + BYTEA fix | WalletConnect working, full account recovery system, BYTEA→TEXT DB fix |
| 5 | 2026-03-25 | Bug fixes + architecture decision | Signing fixed, key management redesigned to server-assisted seamless mode |
| 6 | 2026-03-26 | Seamless key management implementation | Full HKDF + Vault key storage, X25519 transport, libsodium removed from backend |
| 7 | 2026-03-26 | Bug fixes, UI redesign, rename to SignaKit | Address persistence fix, identity linking, Swarm Resistance UI, Gmail detection, full rebrand |
| 8 | 2026-03-27 | Testing, bug fixes, HUD modal redesign | Google OAuth first-login fix, WalletConnect fixes, full HUD glass modal redesign, demo cleanup |
| 9 | 2026-03-28 | Swarm Resistance integration | SignaKit integrated into Swarm frontend, MetaMask + Email working, bridge provider, Vite proxy for SSL |
| 10 | 2026-03-28 | Bug fixes, bridge improvements | Google OAuth duplicate client fix, WalletConnect IndexedDB cleanup, private key export, Settings page mock |

## What Was Done (Session 10) -- Bug Fixes, Bridge Improvements

1. **Google OAuth duplicate Supabase client fix** -- Root cause identified: React StrictMode + tsup bundling `@supabase/supabase-js` inside the SDK created TWO GoTrueClient instances that raced to process the OAuth URL hash (second one got 401). Fixes applied: (a) module-level `getOrCreateSupabaseClient` singleton in SignaKitProvider, (b) externalized `@supabase/supabase-js` from tsup build so Vite deduplicates to one copy, (c) broadened `onAuthStateChange` to accept `INITIAL_SESSION` and `TOKEN_REFRESHED` events, (d) explicit `getSession()` call to trigger PKCE code exchange. Google redirect now works (returns to localhost with `#access_token`), but 401 from `/auth/v1/user` persists -- likely still two Supabase copies from Vite pre-bundling. Files: `SignaKitProvider.tsx`, `tsup.config.ts`.

2. **WalletConnect IndexedDB cleanup** -- Stale WC v2 sessions in IndexedDB caused "Pending session not found" / "No matching key" errors. Added proper `await`-based IndexedDB deletion before `EthereumProvider.init()`. Uses `indexedDB.databases()` API on Chrome/Edge to find all WC databases dynamically. Extracted cleanup into standalone `clearAllWalletConnectStorage()` function. WC still hangs after wallet approval -- likely WC relay or project ID domain whitelist issue. Files: `walletconnect.ts`.

3. **Private key export for Settings page** -- Added `getPrivateKeyHex()` to SDK (reads encrypted key from IndexedDB, decrypts, returns hex). Exported `useSignaKitContext` for bridge access to user ID. Bridge creates mock `web3auth.getUserInfo()` (returns `idToken` for social users) and mock `provider.request({ method: "eth_private_key" })` (reads from IndexedDB via `getPrivateKeyHex`). SettingsPage works with zero changes. Files: `privateKeyStore.ts`, `index.ts`, `Web3AuthProvider.jsx`.

4. **LoginModal `onGoogleLogin` prop** -- Added optional callback prop so the bridge can override the built-in Google handler (used when Supabase client is managed externally). Files: `LoginModal.tsx`.

**Files changed (AuthVault repo):** `SignaKitProvider.tsx`, `LoginModal.tsx`, `walletconnect.ts`, `privateKeyStore.ts`, `index.ts`, `tsup.config.ts`
**Files changed (Swarm repo):** `Web3AuthProvider.jsx`, `package.json`, `package-lock.json`, `.env.example`, `vite.config.js`

## What Was Done (Session 9) -- Swarm Resistance Integration

1. **SignaKit integrated into Swarm Resistance frontend** -- Created bridge provider (`Web3AuthProvider.jsx`) that wraps SignaKit SDK internally but exposes the exact same `useWeb3Auth()` hook interface. All 14 consumer files work with zero changes. Old Web3Auth code preserved as `Web3AuthProvider_legacy.jsx`. Swarm repo: `C:\Users\cryptomeda\Desktop\Swarm\myprojects\swarm-dev\frontend`.

2. **SDK installation method** -- npm link failed (Vite follows symlinks into AuthVault monorepo). Solution: `npm pack` the SDK as tarball, install with `npm install ./signakit-sdk-0.1.0.tgz`. Must temporarily change `@signakit/types` from `workspace:*` to `0.1.0` before packing.

3. **Vite proxy for Railway SSL** -- Railway TLS handshake fails on Windows browsers (cert valid but OCSP broken). Added Vite dev server proxy: `/signakit-api` -> Railway backend with `secure: false`. All API calls go through localhost, bypassing browser SSL.

4. **LoginModal fixes** -- Added missing `isOpen` prop. Changed `max-w-[500px]` Tailwind arbitrary class to inline `maxWidth: 500px` (Tailwind classes from pre-built SDK aren't processed by Swarm's Tailwind).

5. **WalletConnect stale session cleanup** -- Added aggressive localStorage cleanup of all `wc@`/`walletconnect`/`WALLETCONNECT` keys before each connect. Still not fully fixed -- WC v2 also stores in IndexedDB.

6. **CORS and OAuth config updated** -- Railway ALLOWED_ORIGINS now includes `swarmresistance.com`, `www.swarmresistance.com`, `localhost:3000`. Supabase redirect URLs and Google Cloud JS origins updated similarly.

7. **Login method status** -- MetaMask (SIWE) and Email OTP work end-to-end on Swarm frontend. Google OAuth redirect not returning to localhost (config issue). WalletConnect has persistent stale session bug from WC v2 Core.

**Files changed (AuthVault repo):** `LoginModal.tsx` (inline maxWidth), `walletconnect.ts` (stale session cleanup)
**Files changed (Swarm repo):** `Web3AuthProvider.jsx` (new bridge), `vite.config.js` (proxy, aliases), `.env` (SignaKit vars), `.env.example`, `package.json` (SDK + deps)

## What Was Done (Session 8) -- Testing, Bug Fixes, HUD Modal Redesign

1. **Google OAuth first-login fix** -- New Google users got 401 because Supabase admin API needs a moment to propagate freshly-created user records. Added retry logic (3 attempts, increasing delay) in `onAuthStateChange` handler. Also added 429 rate-limit detection to stop retrying into more 429s. Files: `SignaKitProvider.tsx`. Committed: dd7027a, 7566479.

2. **WalletConnect fixes** -- Three issues fixed: (a) stale sessions in localStorage caused `enable()` to skip pairing and hang forever -- now disconnects stale sessions before connecting; (b) after disconnect, provider is recreated fresh instead of reusing broken instance; (c) added 2-minute timeout to prevent infinite hangs. Files: `connectors/walletconnect.ts`. Committed: 5effdb8, 42ea4f3, 1781128.

3. **LoginModal HUD glass redesign** -- Full visual overhaul matching swarmresistance.com: glass panel with backdrop-blur, HUD corner accents with animated glow dots, uniform `< BUTTON >` style with bracket decorators for all 4 login options, inline SVG sizing (fixes giant icon bug when Tailwind classes don't apply), proper spacing (500px modal, px-10 content padding, pb-12 bottom). Removed subtitle, footer, divider. Simplified labels to "Wallet"/"Social". Files: `components/LoginModal.tsx`. Committed: ce5307e through 6439017 (8 commits).

4. **Demo app cleanup** -- Removed SignaKit branding, version text, sign-message test button. Clean `< Connect Wallet >` button in HUD style. Connected state shows status badge + provider pill. Added SVG favicon. Files: `apps/demo/src/App.tsx`, `apps/demo/public/favicon.svg`, `apps/demo/index.html`. Committed: e4a7fd1, 228e273.

**Commits this session:** dd7027a, 5d7e5ad, 5effdb8, 42ea4f3, ce5307e, e4a7fd1, 228e273, 097092b, 80625b3, 7da4e8a, 7566479, 04cb5d8, 6439017, 1781128

## What Was Done (Session 7) -- Bug Fixes, UI Redesign, Rename to SignaKit

1. **Address persistence bug fixed** -- `generate.ts` was updating wrong column (`evm_address` instead of `public_key_evm`). Address showed on first login but disappeared after page reload. Fixed column name + added backfill in idempotent path. DB backfill applied to all existing users via SQL.

2. **Identity linking fix** -- `findOrCreateUser` now checks `supabase_auth_id` as fallback when `provider+subject` doesn't match. Handles Supabase auto-linking (same email, different providers like Google + email OTP). Added 409 error response for identity conflicts.

3. **Hydration address recovery** -- On session hydration, if private key exists in IndexedDB but `getMe()` returns no `evmAddress`, client now calls `generateKey()` to fetch address from server.

4. **Gmail OTP detection** -- LoginModal detects Gmail addresses in email OTP flow and shows warning with "Use Google Login" redirect button. Gmail users should use Google OAuth; email OTP is for non-Gmail addresses.

5. **LoginModal redesign (Swarm Resistance design system)** -- Full UI overhaul: Orbitron/JetBrains Mono fonts, cyan/orange color scheme, corner accent brackets, section labels (Wallet/Account), close button, per-wallet loading state. Reordered: MetaMask > WalletConnect > divider > Google > Email.

6. **Demo app restyled** -- Matching dark sci-fi theme with gradient text, status dot, proper typography.

7. **Renamed AuthVault to SignaKit** -- 33 files updated. All packages `@signakit/*`, all exports renamed (`SignaKitProvider`, `SignaKitClient`, etc.). Env vars accept both old (`AUTHVAULT_*`) and new (`SIGNAKIT_*`) names for backward compat. HKDF constants, IndexedDB name, localStorage keys preserved.

8. **Rate limit increased** -- Email OTP send limit raised from 5/hour to 15/hour per IP.

9. **OTP input size reduced** -- OTP digit boxes shrunk from `w-12 h-14` to `w-11 h-12`.

**Commits this session:** 3b3fbed, 1f08036, de02fb6

## What Was Done (Session 6) -- Seamless Key Management Implementation

1. **DB migration 007 applied** -- `encrypted_keys` table, `key_access_log` table, vault wrapper functions (`create_user_vault_key`, `get_user_vault_key`, `update_user_vault_key`). Applied to Supabase live.

2. **Backend: HKDF key derivation + Vault storage** -- `services/keyDerivation.ts` derives private key via HKDF-SHA256 from master secret + oauth subject. `routes/keys/generate.ts` rewritten: server generates key, encrypts with app-level key, stores in Vault. Idempotent (returns existing key if already stored).

3. **Backend: device-init route** -- `routes/keys/deviceInit.ts` implements X25519 ECDH + AES-256-GCM transport using Node.js built-in crypto (no libsodium). Client sends ephemeral public key, server derives shared secret via ECDH + HKDF, encrypts private key, returns ciphertext.

4. **Backend: libsodium fully removed** -- ESM build of libsodium-wrappers crashed in Docker (missing `libsodium.mjs`). All backend crypto now uses Node.js built-in `crypto` module. Recovery routes removed from `index.ts`.

5. **SDK: seamless key flow** -- `core/privateKeyStore.ts` stores full encrypted private key in IndexedDB. `SignaKitProvider.tsx` removed all recovery state, added `ensureLocalKey()` using Web Crypto API for X25519 ECDH transport. `hooks/useSigning.ts` uses direct private key from IndexedDB (no SSS reconstruction).

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
   - `packages/sdk/src/SignaKitProvider.tsx` -- `needsRecoverySetup`, `needsRecovery`, `setupRecovery`, `completeRecovery`, `dismissRecoverySetup` added to context
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
3. **Google OAuth wired** -- `LoginModal.handleGoogleLogin` calls `supabaseClient.auth.signInWithOAuth`. `SignaKitProvider` listens to `onAuthStateChange`, auto-calls backend on redirect callback. Tested and working.
4. **Key generation on first login** -- Centralized `handleAuthResponse` in `SignaKitProvider` generates Shamir SSS keys (3 shares, 2-of-3 threshold) when `isNew === true` and `loginMethod !== 'wallet'`. Device share stored in IndexedDB, server + recovery shares sent to backend. EVM address populated immediately after login.
5. **`@supabase/supabase-js` added to SDK** -- Supabase client created in provider if `supabaseUrl` + `supabaseAnonKey` provided. Exposed via context.
6. **`getOrCreateEncryptionKey` helper** -- Generates/persists a 32-byte encryption key per user in IndexedDB. Used to encrypt all SSS shares.
7. **Deleted `@signakit/demo` Railway service** -- Demo is on Vercel only. Railway service was misconfigured (static frontend, no healthcheck).
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
6. **SDK frontend** -- SignaKitProvider, useAuth, LoginModal, HTTP client, IndexedDB storage, session mgmt. Committed: 3c20e06.
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

- Gmail email OTP: Supabase auto-links Gmail identities with Google OAuth, causing verifyOtp to fail. Handled by Gmail detection in LoginModal (redirects to Google login). Not a bug, by design.
- Railway SSL: TLS handshake fails on Windows (curl exit code 35, `ERR_SSL_PROTOCOL_ERROR` in Chrome). Cert is valid but OCSP broken. Domain regeneration didn't fix it. Workaround: Vite proxy for dev, Cloudflare proxy for production.
- WalletConnect v2: Stale session errors fixed (IndexedDB + localStorage cleanup). But WC still hangs after wallet approval -- relay response never arrives. Possibly WC Cloud project ID domain whitelist or WC version issue.
- Google OAuth: Redirect works (returns to localhost with `#access_token`). But Supabase `_getSessionFromURL` gets 401 calling `/auth/v1/user` with the fresh token. Root cause: likely two copies of `@supabase/supabase-js` (one bundled in SDK pre-bundle, one from app node_modules) despite externalization + dedupe config. May need to force single copy via Vite alias or try PKCE flow.
- Multiple GoTrueClient: Module-level singleton added. Warning eliminated when singleton works, but Vite pre-bundling may create separate copies that bypass the singleton.

## What To Do Next

| Priority | Task | Details |
|----------|------|---------|
| 1 | Fix Google OAuth 401 | Force single `@supabase/supabase-js` copy via Vite alias (point to app's node_modules), or try PKCE flow (`flowType: 'pkce'`), or manually process URL hash before Supabase client init |
| 2 | Fix WalletConnect relay | Hangs after wallet approval. Check WC Cloud project ID domain whitelist (must include localhost:3000). Consider downgrading `@walletconnect/ethereum-provider` version |
| 3 | Test private key export | Settings page should work with bridge mock `provider.request({ method: "eth_private_key" })` |
| 4 | Set up api.swarmresistance.com | Point subdomain to Railway via Cloudflare proxy. Permanent SSL fix |
| 5 | Deploy Swarm frontend | Deploy to Vercel with SignaKit env vars |
| 6 | Test multi-device | Same Google account in 2 browsers -> same wallet address |

## Deployment Env Vars

### Railway (backend) -- already set
```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
SIGNAKIT_JWT_SECRET, SIGNAKIT_ENCRYPTION_MASTER_KEY
GOOGLE_CLIENT_ID
ALLOWED_ORIGINS=https://auth-vault-demo.vercel.app,https://swarmresistance.com,https://www.swarmresistance.com,http://localhost:3000
NODE_ENV=production, PORT=3001
```

### Vercel (demo) -- already set
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
VITE_SIGNAKIT_BACKEND_URL=https://authvaultbackend-production.up.railway.app
VITE_WALLETCONNECT_PROJECT_ID
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/sdk/src/crypto/` | Shamir SSS, encryption, keygen, PBKDF2 (33 tests) |
| `packages/sdk/src/core/` | HTTP client, device share, session, key manager, recovery |
| `packages/sdk/src/hooks/` | useAuth, useWallet, useSigning |
| `packages/sdk/src/connectors/` | MetaMask, WalletConnect, Coinbase |
| `packages/sdk/src/components/LoginModal.tsx` | Auth modal -- HUD glass design, all inline styles, 4 login methods |
| `packages/sdk/src/SignaKitProvider.tsx` | Provider -- Supabase client, handleAuthResponse, key gen, recovery state |
| `packages/sdk/src/core/privateKeyStore.ts` | IndexedDB store for full encrypted private key (seamless mode) |
| `apps/backend/src/services/keyDerivation.ts` | HKDF-SHA256 key derivation service |
| `apps/backend/src/routes/keys/deviceInit.ts` | X25519 ECDH + AES-256-GCM transport route |
| `apps/backend/src/routes/` | Auth (google, email, siwe, session) + keys (generate, deviceInit) |
| `apps/backend/src/services/emailOtp.ts` | OTP send (admin client) + verify (anon client) |
| `apps/backend/src/middleware/` | JWT auth, rate limiting |
| `apps/backend/Dockerfile` | Production Docker build (fresh pnpm install in runner) |
| `apps/demo/src/main.tsx` | Demo entry -- SignaKitProvider with all env vars |
| `apps/demo/src/App.tsx` | Demo app -- Connect Wallet button + connected state card |
| `supabase/migrations/` | 7 SQL files (applied) |
