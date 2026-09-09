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
    [switch]$Configure,
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
    # Verify-only reads a file that already exists, and a derivation check
    # reads the manifest -- neither needs credentials.
    if (-not $dbUrl -and -not $VerifyFile -and -not $VerifyDerivation -and -not $Configure) {
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

# The master key derives every wallet, so it must never reach a command line:
# PSReadLine writes whole command lines to ConsoleHost_history.txt on exit, and
# `$env:X = '<key>'` is a command line. Read it into this process only.
function Invoke-DerivationCheck {
    param([string]$ManifestPath, [string]$RepoRoot, [string]$OutDir)
    if (-not (Test-Path $ManifestPath)) {
        Write-Log -Message "FAIL: no manifest at $ManifestPath -- take a backup first, or pass -VerifyFile <dump.sql>" -OutDir $OutDir
        return 7
    }
    # env.ts reads SIGNAKIT_ first, so accept it first here too.
    $key = $env:SIGNAKIT_ENCRYPTION_MASTER_KEY
    if (-not $key) { $key = $env:AUTHVAULT_ENCRYPTION_MASTER_KEY }
    if (-not $key) {
        $secure = Read-Host -Prompt 'Master key -- SIGNAKIT_ENCRYPTION_MASTER_KEY if Railway has one, else AUTHVAULT_ENCRYPTION_MASTER_KEY (not echoed)' -AsSecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try   { $key = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    }
    if (-not $key) {
        Write-Log -Message 'SKIP derivation check: no master key given' -OutDir $OutDir
        return 0
    }
    Push-Location (Join-Path $RepoRoot 'apps\backend')
    try {
        $env:AUTHVAULT_ENCRYPTION_MASTER_KEY = $key
        # Out-Host, not bare: anything a command writes to stdout inside a
        # function joins that function's return value, and a mismatch then
        # exits 0 while printing FAIL. Caught by the failure-path test.
        node scripts\verify-derivation.mjs $ManifestPath | Out-Host
        $rc = $LASTEXITCODE
    }
    finally {
        Remove-Item Env:\AUTHVAULT_ENCRYPTION_MASTER_KEY -ErrorAction SilentlyContinue
        $key = $null
        Pop-Location
    }
    if ($rc -ne 0) {
        Write-Log -Message "FAIL: derivation check exited $rc -- the master key no longer reproduces the live wallets" -OutDir $OutDir
        return 6
    }
    Write-Log -Message 'derivation check OK -- master key reproduces every wallet address' -OutDir $OutDir
    return 0
}

function Read-Secret {
    param([string]$Prompt)
    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try   { return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

# --- configure -------------------------------------------------------------
if ($Configure) {
    Write-Host "Supabase dashboard -> Connect (top of the page) -> Transaction pooler."
    Write-Host "Copy the URI and replace [YOUR-PASSWORD] with the database password."
    Write-Host ''
    $uri = Read-Secret -Prompt 'Connection URI (not echoed)'
    if (-not $uri) { Write-Host 'Nothing entered -- no change made.'; exit 1 }
    $uri = $uri.Trim().Trim('"').Trim("'")
    if ($uri -notmatch '^postgres(ql)?://') {
        Write-Host "That does not look like a connection URI (it should start with postgresql://). No change made."
        exit 1
    }
    if ($uri -match 'YOUR-PASSWORD|\[YOUR') {
        Write-Host "The password placeholder is still in the URI. Replace [YOUR-PASSWORD] with the real password. No change made."
        exit 1
    }
    if ($uri -notmatch ':6543/') {
        Write-Host "NOTE: not port 6543. Session mode on 5432 has refused every connection before; 6543 (transaction pooler) is the one to use."
    }

    Write-Host 'Testing the connection...'
    docker info *> $null
    if ($LASTEXITCODE -ne 0) { Write-Host 'Docker is not running -- start Docker Desktop and re-run.'; exit 2 }
    docker run --rm -e PGCONNECT_TIMEOUT=15 postgres:17 psql $uri -c 'select 1' *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Could not connect with that URI -- nothing was saved. Check the password and the port.'
        exit 3
    }

    [pscustomobject]@{ dbUrl = $uri; outDir = $DefaultOut } |
        ConvertTo-Json | Set-Content -Path $ConfigPath -Encoding utf8
    $uri = $null
    Write-Host "Connection OK. Saved to $ConfigPath"
    Write-Host "Next:  .\scriptsackup-authvault.ps1"
    exit 0
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

if ($VerifyDerivation -and -not $VerifyFile -and -not $cfg.DbUrl) {
    # Nothing to dump and nothing to re-verify: check the manifest the last
    # run left behind. This is the useful shape when the DSN is not configured
    # yet -- the recovery path can be proven before the schedule exists.
    $rc = Invoke-DerivationCheck -ManifestPath (Join-Path $cfg.OutDir 'recovery-manifest.csv') `
                                -RepoRoot $RepoRoot -OutDir $cfg.OutDir
    exit ([int]($rc | Select-Object -Last 1))
}

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
# Both candidate salts go in. The live code derives from auth.sub, which is
# wallet_users.id (generate.ts:41) -- but this app renamed itself mid-life and
# shipped two "address mismatch" fixes in the days right after, so which
# identity the older keys were derived from is a question the data should
# answer rather than a comment. The verifier probes both and reports which won.
function Get-CopyRows {
    param([string[]]$Lines, [string]$Table)
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -like "COPY $Table (*FROM stdin;") {
            $cols = ($Lines[$i] -replace '^COPY \S+ \(', '' -replace '\) FROM stdin;$', '') -split ',\s*'
            $rows = New-Object System.Collections.ArrayList
            for ($j = $i + 1; $j -lt $Lines.Count -and $Lines[$j] -ne '\.'; $j++) {
                $vals = $Lines[$j] -split "`t"
                $o = @{}
                for ($k = 0; $k -lt $cols.Count; $k++) { $o[$cols[$k]] = $vals[$k] }
                [void]$rows.Add([pscustomobject]$o)
            }
            return ,$rows
        }
    }
    return ,(New-Object System.Collections.ArrayList)
}

$manifest = Join-Path $cfg.OutDir 'recovery-manifest.csv'
$authById = @{}
foreach ($w in (Get-CopyRows -Lines $lines -Table 'public.wallet_users')) {
    $authById[$w.id] = $w.supabase_auth_id
}
$rows = New-Object System.Collections.ArrayList
[void]$rows.Add('user_id,supabase_auth_id,evm_address')
foreach ($k in (Get-CopyRows -Lines $lines -Table 'public.encrypted_keys')) {
    $sid = $authById[$k.user_id]
    if (-not $sid -or $sid -eq ('\' + 'N')) { $sid = '' }
    [void]$rows.Add(('{0},{1},{2}' -f $k.user_id, $sid, $k.evm_address))
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
    $rc = Invoke-DerivationCheck -ManifestPath $manifest -RepoRoot $RepoRoot -OutDir $cfg.OutDir
    exit ([int]($rc | Select-Object -Last 1))
}
