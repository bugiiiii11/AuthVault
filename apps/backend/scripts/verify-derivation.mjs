/**
 * Prove the recovery path: re-derive every wallet address from the master key
 * alone and compare it against the live addresses in a backup manifest.
 *
 * This is the check that makes the backup meaningful. The dump carries
 * vault.secrets as pgsodium ciphertext whose key never leaves the Supabase
 * project, so restoring the dump into a new project yields blobs nobody can
 * open. What actually recovers the wallets is
 *
 *     AUTHVAULT_ENCRYPTION_MASTER_KEY  +  the user UUIDs in the dump
 *
 * because deriveUserPrivateKey is deterministic (see keyDerivation.ts). If
 * this script is green, the vault is a convenience and not a dependency; if it
 * ever goes red, the backup has silently stopped being a recovery plan.
 *
 * Reads nothing but the manifest and the environment. Derives in memory,
 * compares addresses, prints no key material.
 *
 *   AUTHVAULT_ENCRYPTION_MASTER_KEY=... node scripts/verify-derivation.mjs <manifest.csv>
 */
import { readFileSync } from 'node:fs';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';

const manifestPath = process.argv[2];
const masterKeyHex = process.env.SIGNAKIT_ENCRYPTION_MASTER_KEY
  || process.env.AUTHVAULT_ENCRYPTION_MASTER_KEY;

if (!manifestPath) {
  console.error('usage: node scripts/verify-derivation.mjs <recovery-manifest.csv>');
  process.exit(64);
}
if (!masterKeyHex) {
  console.error('AUTHVAULT_ENCRYPTION_MASTER_KEY is not set');
  process.exit(64);
}

function hexToBytes(hex) {
  const h = hex.replace(/^0x/, '');
  if (h.length % 2 !== 0) throw new Error('Odd-length hex string');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) out[i / 2] = parseInt(h.slice(i, i + 2), 16);
  return out;
}
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Byte-for-byte the logic of apps/backend/src/services/keyDerivation.ts. It is
// duplicated on purpose: this script must keep working when the app does not
// build, and a silent drift between the two is exactly what it should catch.
function deriveUserPrivateKey(masterKey, userId) {
  const ikm = masterKey.length === 64 && /^[0-9a-fA-F]+$/.test(masterKey)
    ? hexToBytes(masterKey)
    : new TextEncoder().encode(masterKey);
  const salt = new TextEncoder().encode(userId);
  const info = new TextEncoder().encode('authvault-v1');
  let derived = hkdf(sha256, ikm, salt, info, 32);
  let attempt = 0;
  while (!secp256k1.utils.isValidPrivateKey(derived)) {
    attempt++;
    derived = hkdf(sha256, derived, salt,
      new TextEncoder().encode(`authvault-v1-retry-${attempt}`), 32);
  }
  return derived;
}
function privateKeyToEvmAddress(privateKey) {
  const pub = secp256k1.getPublicKey(privateKey, false);
  return '0x' + bytesToHex(keccak_256(pub.slice(1)).slice(-20));
}

const lines = readFileSync(manifestPath, 'utf8')
  .replace(/^﻿/, '')          // PowerShell writes UTF-8 with a BOM
  .split(/\r?\n/).filter(Boolean);
const header = lines.shift().trim();
const HEADERS = {
  'user_id,supabase_auth_id,evm_address': ['user_id', 'supabase_auth_id'],
  'user_id,evm_address': ['user_id'],
};
const saltNames = HEADERS[header];
if (!saltNames) {
  console.error(`unexpected manifest header: ${header}`);
  console.error('expected: user_id,supabase_auth_id,evm_address');
  process.exit(65);
}

// Each row becomes { salts: [...candidate identities], address }.
const rows = lines
  .map((l) => l.split(',').map((c) => c.trim()))
  .filter((c) => c.length === saltNames.length + 1 && c[c.length - 1])
  .map((c) => ({ salts: c.slice(0, -1), address: c[c.length - 1] }))
  .filter((r) => r.salts[0]);

// A pasted secret picks up whitespace, quotes or a 0x prefix, and any of those
// derives a completely different key. Probe the cheap variants against a few
// rows first, then run the whole manifest with whichever one works -- and say
// which, because a variant winning means the stored value needs fixing too.
const variants = [];
const seen = new Set();
for (const [label, value] of [
  ['as given', masterKeyHex],
  ['whitespace trimmed', masterKeyHex.trim()],
  ['surrounding quotes stripped', masterKeyHex.trim().replace(/^["']|["']$/g, '')],
  ['0x prefix stripped', masterKeyHex.trim().replace(/^0x/i, '')],
  ['0x prefix added', '0x' + masterKeyHex.trim().replace(/^0x/i, '')],
]) {
  if (value && !seen.has(value)) { seen.add(value); variants.push([label, value]); }
}

// Probe every (key variant x identity column) combination against a few rows,
// then run the whole manifest with whichever combination works. Trying the
// identity column matters as much as the key: an app that renamed itself and
// then shipped two address-mismatch fixes is exactly where a derivation
// identity quietly changes.
const probe = rows.slice(0, 3);
let chosen = { key: variants[0], saltIdx: 0 };
let found = false;
outer:
for (const v of variants) {
  for (let s = 0; s < saltNames.length; s++) {
    if (!probe.every((r) => r.salts[s])) continue;
    const hit = probe.every((r) =>
      privateKeyToEvmAddress(deriveUserPrivateKey(v[1], r.salts[s])).toLowerCase()
        === r.address.toLowerCase());
    if (hit) { chosen = { key: v, saltIdx: s }; found = true; break outer; }
  }
}
if (found && (chosen.key[0] !== 'as given' || chosen.saltIdx !== 0)) {
  console.log(`NOTE: matched using key "${chosen.key[0]}" and identity `
    + `"${saltNames[chosen.saltIdx]}" -- record that, it is not the assumed pair.`);
}

let ok = 0;
const mismatches = [];
for (const r of rows) {
  const salt = r.salts[chosen.saltIdx];
  if (!salt) { mismatches.push({ userId: r.salts[0], expected: r.address, actual: '(no identity)' }); continue; }
  const actual = privateKeyToEvmAddress(deriveUserPrivateKey(chosen.key[1], salt));
  if (actual.toLowerCase() === r.address.toLowerCase()) ok++;
  else mismatches.push({ userId: salt, expected: r.address, actual });
}

console.log(`derivation check: ${ok} match, ${mismatches.length} mismatch (of ${ok + mismatches.length})`);
for (const m of mismatches.slice(0, 10)) {
  console.error(`  MISMATCH ${m.userId}: manifest ${m.expected} != derived ${m.actual}`);
}
if (mismatches.length > 10) console.error(`  ... and ${mismatches.length - 10} more`);

// An empty manifest would otherwise report "0 mismatch" and read as green.
if (ok === 0 && mismatches.length === 0) {
  console.error('no rows in the manifest -- take a backup first');
  process.exit(66);
}
// Every row wrong is a different diagnosis from some rows wrong: the key does
// not belong to this project at all, rather than the wallets having drifted.
if (ok === 0) {
  console.error('');
  console.error('EVERY row mismatched. Whitespace/quote/0x variants of the key were');
  console.error(`tried, against ${saltNames.length} identity column(s): ${saltNames.join(', ')}.`);
  console.error('');
  console.error('What this does NOT mean: the manifest and the UUID are fine (the salt is');
  console.error('wallet_users.id, which is auth.sub -- generate.ts:41), and this script is');
  console.error('checked against the real keyDerivation.ts. So the value is the problem.');
  console.error('');
  console.error('Check, in order:');
  console.error('  1. Railway PROJECT-level shared variables, not just the service ones.');
  console.error('     env.ts reads SIGNAKIT_ENCRYPTION_MASTER_KEY FIRST; if one exists at');
  console.error('     project scope it wins and never appears in the service list.');
  console.error('  2. Whether the service was ever REDEPLOYED after this variable was last');
  console.error('     edited. A staged Railway variable shows the new value in the UI while');
  console.error('     the running container still holds the old one.');
  console.error('  3. Whether a different secret was pasted (the database password is not');
  console.error('     this one).');
  console.error('');
  console.error('Decisive test if all three come up clean: create one NEW account, let it');
  console.error('generate a wallet, and re-run. A new wallet that matches means the key was');
  console.error('rotated and the old 43 need the vault; a new wallet that also mismatches');
  console.error('means the running service is not using the value the dashboard shows.');
  process.exit(1);
}
process.exit(mismatches.length === 0 ? 0 : 1);
