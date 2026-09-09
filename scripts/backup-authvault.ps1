<#
.SYNOPSIS
  Scheduled logical backup of the AuthVault Supabase project.

.DESCRIPTION
  The project runs on the Supabase Free plan: no PITR, no daily backups, no
  SLA. Its Postgres process crashed twice on 2026-09-09 with no root cause
  from Supabase, and every sign-in to swarmresistance.com goes through it.
  This is the only backup that exists.

  Runs pg_dump inside a postgres:17 container (no local pg client is
  installed, and the server is 17 -- an older client refuses the dump),
  verifies the result table by table, writes a recovery manifest, compresses
  it and prunes old copies.

  READ scripts/README.md BEFORE TRUSTING THIS FILE AS A RECOVERY PLAN. The
  dump carries vault.secrets as ciphertext whose decryption key stays with
  the Supabase project, so restoring it elsewhere does NOT recover wallets.
  What recovers wallets is AUTHVAULT_ENCRYPTION_MASTER_KEY plus the user
  UUIDs in this dump -- verify-derivation.mjs proves that path still works.

.PARAMETER Install
  Register the daily Scheduled Task and exit. Safe to re-run; replaces it.

.PARAMETER VerifyDerivation
  After a successful dump, re-derive every wallet address from the master key
  and compare against the manifest. Needs AUTHVAULT_ENCRYPTION_MASTER_KEY in
  the environment. Not part of the scheduled run -- the master key should not
  sit in a Scheduled Task.
#>
[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$VerifyDerivation,
    [string]$VerifyFile,
    [int]$Keep = 30
)

$ErrorActionPreference = 'Stop'
$ScriptPath = $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent (Split-Path -Parent $ScriptPath)

# --- config ----------------------------------------------------------------
# Never in the repo: the DSN carries the database password.
$ConfigPath = Join-Path $env:USERPROFILE '.authvault-backup.json'
$DefaultOut = Join-Path $env:USERPROFILE 'AuthVaultBackups'

function Get-Config {
    $dbUrl = $env:AUTHVAULT_DB_URL
    $outDir = $null
    if (Test-Path $ConfigPath) {
        $cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
        if (-not $dbUrl) { $dbUrl = $cfg.dbUrl }
        if ($cfg.outDir)  { $outDir = $cfg.outDir }
    }
    if (-not $outDir) { $outDir = $DefaultOut }
    # Verify-only reads a file that already exists; it needs no credentials.
    if (-not $dbUrl -and -not $VerifyFile) {
        throw "No connection string. Create $ConfigPath from scripts/backup-config.sample.json, or set AUTHVAULT_DB_URL."
    }
    # Supabase pooler: port 6543 (transaction mode) answers when 5432 refuses
    # every connection -- a whole session was lost to that in swarm-dev S145.
    [pscustomobject]@{ DbUrl = $dbUrl; OutDir = $outDir }
}

function Write-Log {
    param([string]$Message, [string]$OutDir)
    $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Write-Host $line
    if ($OutDir -and (Test-Path $OutDir)) {
        Add-Content -Path (Join-Path $OutDir 'backup.log') -Value $line -Encoding utf8
    }
}

# Rows in a `COPY <table> (...) FROM stdin;` block, terminated by a lone \.
function Get-CopyRowCount {
    param([string[]]$Lines, [string]$Table)
    $start = -1
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -like "COPY $Table (*FROM stdin;") { $start = $i + 1; break }
    }
    if ($start -lt 0) { return -1 }
    $n = 0
    for ($i = $start; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -eq '\.') { return $n }
        $n++
    }
    return -1   # unterminated block = truncated dump
}

# --- install ---------------------------------------------------------------
if ($Install) {
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
        -Argument ('-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $ScriptPath)
    # 03:20 local. Late enough that a laptop is idle, and StartWhenAvailable
    # catches the run the next time the machine is on if it was off.
    $trigger  = New-ScheduledTaskTrigger -Daily -At '03:20'
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
        -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
    Register-ScheduledTask -TaskName 'AuthVault daily backup' -Action $action `
        -Trigger $trigger -Settings $settings -Force | Out-Null
    Write-Host "Registered Scheduled Task 'AuthVault daily backup' (daily 03:20)."
    Write-Host "Run it now with:  Start-ScheduledTask -TaskName 'AuthVault daily backup'"
    exit 0
}

# --- run -------------------------------------------------------------------
$cfg = Get-Config
if (-not (Test-Path $cfg.OutDir)) {
    New-Item -ItemType Directory -Path $cfg.OutDir -Force | Out-Null
    # The dump carries auth.users (emails, OAuth identities) and the vault
    # ciphertext. Readable by this user only.
    icacls $cfg.OutDir /inheritance:r /grant:r "$($env:USERNAME):(OI)(CI)F" | Out-Null
}

Write-Log -Message 'backup start' -OutDir $cfg.OutDir

if ($VerifyFile) {
    # Re-run the checks against a dump that already exists (an archived copy,
    # or the one-off taken by hand during the 2026-09-09 incident). No dump is
    # taken, nothing is compressed, and the file is never deleted.
    if (-not (Test-Path $VerifyFile)) { throw "No such file: $VerifyFile" }
    $sqlPath = (Resolve-Path $VerifyFile).Path
    Write-Log -Message "verify-only: $sqlPath" -OutDir $cfg.OutDir
}
else {
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Log -Message 'FAIL: Docker is not running (start Docker Desktop)' -OutDir $cfg.OutDir
    exit 2
}

$stamp   = Get-Date -Format 'yyyy-MM-dd_HHmm'
$sqlName = "authvault_$stamp.sql"
$sqlPath = Join-Path $cfg.OutDir $sqlName

# pg_dump writes inside the container, straight onto the mounted directory:
# piping a multi-megabyte dump back through PowerShell re-encodes it.
docker run --rm -v "$($cfg.OutDir):/out" -e PGCONNECT_TIMEOUT=15 postgres:17 `
    pg_dump --no-password --file "/out/$sqlName" $cfg.DbUrl
if ($LASTEXITCODE -ne 0) {
    Write-Log -Message "FAIL: pg_dump exited $LASTEXITCODE" -OutDir $cfg.OutDir
    if (Test-Path $sqlPath) { Remove-Item $sqlPath -Force }
    exit 3
}
}

# --- verify ----------------------------------------------------------------
# A dump that exits 0 but stops mid-COPY is the failure mode that matters:
# it looks like a backup and restores as a partial database.
$lines = Get-Content -Path $sqlPath -Encoding UTF8
# Not the last line: pg_dump 17.6 writes \unrestrict tokens and a blank line
# after the marker. Anywhere in the tail is what "it finished" looks like.
$tail = $lines | Select-Object -Last 12
if (-not ($tail -like '*PostgreSQL database dump complete*')) {
    Write-Log -Message 'FAIL: dump has no completion marker -- truncated' -OutDir $cfg.OutDir
    if (-not $VerifyFile) { Remove-Item $sqlPath -Force }
    exit 4
}

$expect = @{
    'public.wallet_users'   = 1
    'public.encrypted_keys' = 1
    'auth.users'            = 1
    'vault.secrets'         = 1
}
$counts = @{}
$bad = @()
foreach ($table in $expect.Keys) {
    $n = Get-CopyRowCount -Lines $lines -Table $table
    $counts[$table] = $n
    if ($n -lt $expect[$table]) { $bad += "$table=$n" }
}
if ($bad.Count -gt 0) {
    Write-Log -Message ("FAIL: tables missing or empty -- " + ($bad -join ', ')) -OutDir $cfg.OutDir
    if (-not $VerifyFile) { Remove-Item $sqlPath -Force }
    exit 5
}

# encrypted_keys and vault.secrets must agree: one stored secret per wallet.
if ($counts['public.encrypted_keys'] -gt $counts['vault.secrets']) {
    Write-Log -Message ("WARN: {0} encrypted_keys but only {1} vault.secrets" -f `
        $counts['public.encrypted_keys'], $counts['vault.secrets']) -OutDir $cfg.OutDir
}

# --- recovery manifest -----------------------------------------------------
# user_id -> evm_address. Tiny, and it is the half of the recovery path that
# the master key alone cannot supply: HKDF needs the user UUID as its salt.
$manifest = Join-Path $cfg.OutDir 'recovery-manifest.csv'
$rows = @('user_id,evm_address')
$start = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -like 'COPY public.encrypted_keys (*FROM stdin;') { $start = $i + 1; break }
}
for ($i = $start; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -eq '\.') { break }
    $f = $lines[$i] -split "`t"
    if ($f.Count -ge 5) { $rows += ('{0},{1}' -f $f[1], $f[4]) }
}
Set-Content -Path $manifest -Value $rows -Encoding utf8

# --- compress + prune ------------------------------------------------------
if ($VerifyFile) {
    Write-Log -OutDir $cfg.OutDir -Message ("VERIFIED {0} -- wallet_users={1} encrypted_keys={2} auth.users={3} vault.secrets={4}; manifest -> {5}" -f `
        (Split-Path $sqlPath -Leaf), $counts['public.wallet_users'], $counts['public.encrypted_keys'],
        $counts['auth.users'], $counts['vault.secrets'], $manifest)
    exit 0
}

$zipPath = [System.IO.Path]::ChangeExtension($sqlPath, 'zip')
Compress-Archive -Path $sqlPath -DestinationPath $zipPath -Force
Remove-Item $sqlPath -Force

$zips = Get-ChildItem -Path $cfg.OutDir -Filter 'authvault_*.zip' |
        Sort-Object LastWriteTime -Descending
if ($zips.Count -gt $Keep) {
    $zips | Select-Object -Skip $Keep | ForEach-Object {
        Remove-Item $_.FullName -Force
        Write-Log -Message "pruned $($_.Name)" -OutDir $cfg.OutDir
    }
}

$sizeKb = [math]::Round((Get-Item $zipPath).Length / 1KB, 1)
Write-Log -OutDir $cfg.OutDir -Message ("OK {0} ({1} KB) -- wallet_users={2} encrypted_keys={3} auth.users={4} vault.secrets={5}, {6} kept" -f `
    (Split-Path $zipPath -Leaf), $sizeKb, $counts['public.wallet_users'],
    $counts['public.encrypted_keys'], $counts['auth.users'], $counts['vault.secrets'],
    [math]::Min($zips.Count, $Keep))

# --- optional: prove the recovery path still works -------------------------
if ($VerifyDerivation) {
    if (-not $env:AUTHVAULT_ENCRYPTION_MASTER_KEY) {
        Write-Log -Message 'SKIP derivation check: AUTHVAULT_ENCRYPTION_MASTER_KEY not set' -OutDir $cfg.OutDir
        exit 0
    }
    Push-Location (Join-Path $RepoRoot 'apps\backend')
    node scripts\verify-derivation.mjs $manifest
    $rc = $LASTEXITCODE
    Pop-Location
    if ($rc -ne 0) {
        Write-Log -Message "FAIL: derivation check exited $rc -- the master key no longer reproduces the live wallets" -OutDir $cfg.OutDir
        exit 6
    }
    Write-Log -Message 'derivation check OK -- master key reproduces every wallet address' -OutDir $cfg.OutDir
}
