# AuthVault -- Session Handoff

## Session Summary

| Session | Date | Title | Key outcome |
|---------|------|-------|-------------|
| 1 | 2026-03-24 | Project setup | Skills, hooks, docs, project planning |

## What Was Done (Session 1) -- Project Setup

1. **Documentation review** -- Reviewed full AuthVault MVP spec. Confirmed scope: auth-only, EVM first, Google + Email day 1, Vite not Next.js.
2. **Skills created** -- `/start`, `/wrap`, `/doc-update`, `/save` adapted for AuthVault monorepo structure.
3. **Security hooks installed** -- 5 hook scripts (block-dangerous, block-internal-urls, protect-files, audit-all, scan-injection) + settings.local.json config.
4. **Project docs created** -- CLAUDE.md, handoff.md, memory files.

## What To Do Next

| Priority | Task | Details |
|----------|------|---------|
| 1 | Install MCPs | Supabase MCP + Context7 MCP |
| 2 | Init git repo | Clone github.com/bugiiiii11/AuthVault, connect remote |
| 3 | Scaffold monorepo | Turborepo + pnpm workspaces, packages/sdk, packages/types, apps/backend, apps/demo, supabase/ |
| 4 | Supabase schema | 4 migration files: users, key_shares, sessions, devices + RLS |
| 5 | Crypto core | Shamir SSS + XChaCha20-Poly1305 encryption + key gen (secp256k1) + tests |
| 6 | Backend auth | Hono server, Google OAuth, Email OTP, session management |
| 7 | SDK foundation | AuthVaultProvider, useAuth hook, LoginModal with theming |
| 8 | Wallet connectors | MetaMask (EIP-6963), WalletConnect v2 |
| 9 | Signing | useSigning hook, Web Worker SSS reconstruction |
| 10 | Recovery + polish | Recovery flow, error handling, E2E tests, deploy |

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project conventions and current state |
| `handoff.md` | This file -- session tracking |
| `AuthVault_MVP_Documentation.md` | Full MVP spec (source of truth) |
| `.claude/commands/` | Custom skills (start, wrap, doc-update, save) |
| `.claude/hooks/` | Security hook scripts |
| `.claude/settings.local.json` | Hooks configuration |
