# AuthVault backup and recovery

This project is the single gate on every sign-in to swarmresistance.com. It runs on the
Supabase **Free** plan: no PITR, no daily backups, no support SLA. On 2026-09-09 its Postgres
process crashed twice (~8 h of total login downtime, both wallet and social) and Supabase
returned no root cause. The founder's decision (2026-09-09) is to stay on Free at the current
10 MAU, which makes a scheduled backup the mitigation rather than an extra.

## The thing to understand before trusting the backup

A `pg_dump` of this project contains `vault.secrets` — one row per wallet, holding the user's
private key as pgsodium AEAD **ciphertext**. The key that decrypts it belongs to the Supabase
project and is not in the dump. **Restoring this dump into a new project therefore does not
recover a single wallet.** It restores 43 blobs nobody can open.

What recovers wallets is:

```
AUTHVAULT_ENCRYPTION_MASTER_KEY   +   the user UUIDs (which the dump does have)
```

because derivation is deterministic — `HKDF-SHA256(masterKey, salt=userId, info='authvault-v1')`,
[`keyDerivation.ts`](../apps/backend/src/services/keyDerivation.ts). The master key is a Railway
environment variable and is stored in the founder's password manager (Bitwarden, 2026-09-09).

So the recovery set is **two independent things**, and they must not live in the same place:

| Piece | Where | Loss means |
|---|---|---|
| Master key | Bitwarden + Railway env | Every wallet is unrecoverable, dump or no dump |
| Dump (user UUIDs, `wallet_users`, `auth.users`) | `%USERPROFILE%\AuthVaultBackups` | Identities and mappings lost; keys still derivable if UUIDs are recovered elsewhere |

The master key cannot be rotated: a new value gives all 43 users new addresses.

## Setup (once)

1. Save the connection details:

   ```powershell
   .\scriptsackup-authvault.ps1 -Configure
   ```

   It prompts for the URI without echoing it, refuses a URI that still has the `[YOUR-PASSWORD]`
   placeholder, **tests the connection before saving**, and writes
   `%USERPROFILE%\.authvault-backup.json` — outside the repo, because it carries the database
   password. Get the URI from the Supabase dashboard's **Connect** button at the top of the page
   (not Settings → Database, which only offers a password reset), section **Transaction pooler**,
   and replace `[YOUR-PASSWORD]` with the database password. **Use port 6543**: session mode on
   5432 has refused every connection while 6543 answered. `backup-config.sample.json` shows the
   shape if you would rather write the file by hand.
2. Register the daily task (no elevation needed, runs as you, 03:20 local):

   ```powershell
   .\scripts\backup-authvault.ps1 -Install
   ```
3. Prove it works end to end:

   ```powershell
   Start-ScheduledTask -TaskName 'AuthVault daily backup'
   Get-Content "$env:USERPROFILE\AuthVaultBackups\backup.log" -Tail 5
   ```

Docker Desktop must be running — the dump runs in a `postgres:17` container because no local
`pg_dump` is installed and an older client refuses a v17 server. The first run pulls the image.

## What a run does

`pg_dump` → verify → manifest → compress → prune, and it fails loudly rather than leaving a
plausible-looking partial file:

- **exit 2** Docker not running · **exit 3** `pg_dump` failed · **exit 4** dump truncated (no
  completion marker) · **exit 5** an expected table is missing or empty · **exit 6** the
  derivation check failed
- verifies row counts for `public.wallet_users`, `public.encrypted_keys`, `auth.users`,
  `vault.secrets` and warns if there are more wallets than stored secrets
- writes `recovery-manifest.csv` (`user_id,evm_address`) — small, and it is the half of the
  recovery path the master key alone cannot supply
- keeps the newest 30 archives (`-Keep N` to change), appends one line per run to `backup.log`
- the output directory is ACL'd to the current user: the dump carries `auth.users`, i.e. emails
  and OAuth identities

Baseline from the 2026-09-09 dump: `wallet_users=167 encrypted_keys=43 auth.users=49
vault.secrets=44`, 621 KB uncompressed. A sharp drop in any of those is worth a look.

## Verifying

Re-run the checks against any existing dump, taking no new one and deleting nothing:

```powershell
.\scripts\backup-authvault.ps1 -VerifyFile "$env:USERPROFILE\Desktop\authvault_backup_2026-09-09.sql"
```

**The check that actually matters** — re-derive every wallet address from the master key and
compare it against the live addresses. Green means the vault is a convenience, not a dependency,
and the backup really is a recovery plan. Deliberately not part of the scheduled run: the master
key should not sit in a Scheduled Task.

```powershell
.\scripts\backup-authvault.ps1 -VerifyDerivation
```

It prompts for the key without echoing it, holds it for the child process only, and clears it
afterwards. **Check Railway for both variables first:** `env.ts` reads
`SIGNAKIT_ENCRYPTION_MASTER_KEY || AUTHVAULT_ENCRYPTION_MASTER_KEY`, so if both are set the
SIGNAKIT one is what the live wallets were derived from and the other is a decoy. A run where
*every* row mismatches is telling you the value is wrong, not that the wallets have drifted. **Do not put the key on a command line** — PSReadLine writes whole command lines to
`ConsoleHost_history.txt` when the session exits, so `$env:KEY = '<value>'` lands on disk in
plaintext. If that has already happened, run `Set-PSReadLineOption -HistorySaveStyle SaveNothing`
in that session before closing it, then purge any surviving lines:

```powershell
$h = (Get-PSReadLineOption).HistorySavePath
(Get-Content $h) | Where-Object { $_ -notmatch 'ENCRYPTION_MASTER_KEY' } | Set-Content $h
```

With no DSN configured and no dump to check, `-VerifyDerivation` runs on its own against the
manifest the last run left behind — so the recovery path can be proven before the schedule
exists. Exit codes: **0** every address matches · **6** at least one does not · **7** no manifest.

Worth running after any change to key derivation, and once a quarter otherwise.

## Restoring

**Losing the project** (Supabase gone, migrating to eu-central-1):

1. New Supabase project, run the migrations in `supabase/` in order.
2. Restore `public.*` and `auth.*` from the dump — **not** `vault.secrets`, whose ciphertext is
   dead outside the old project.
3. Set `AUTHVAULT_ENCRYPTION_MASTER_KEY` on the new backend to the value from Bitwarden.
4. Wallets re-derive on demand. Confirm with `-VerifyDerivation` against the restored manifest
   **before** telling anyone to log in: matching addresses is the proof that users keep their
   NFTs and balances.

**Losing rows but keeping the project** — restore the affected tables from the dump; the vault
is intact, so nothing special applies.

## Related

- `swarm-meta/backlog.md` rows S293-01 (Free plan, no backups), S293-02 (`/health` does not
  cover the login path), S293-04 (one env var regenerates every wallet)
- Migration 008/009 closed the `anon`-callable vault RPCs that returned raw private keys (S293)
