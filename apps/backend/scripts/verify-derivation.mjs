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
const masterKeyHex = process.env.AUTHVAULT_ENCRYPTION_MASTER_KEY
  || process.env.SIGNAKIT_ENCRYPTION_MASTER_KEY;

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

const lines = readFileSync(manifestPath, 'utf8').split(/\r?\n/).filter(Boolean);
const header = lines.shift();
if (header.trim() !== 'user_id,evm_address') {
  console.error(`unexpected manifest header: ${header}`);
  process.exit(65);
}

let ok = 0;
const mismatches = [];
for (const line of lines) {
  const [userId, expected] = line.split(',');
  if (!userId || !expected) continue;
  const actual = privateKeyToEvmAddress(deriveUserPrivateKey(masterKeyHex, userId));
  if (actual.toLowerCase() === expected.trim().toLowerCase()) ok++;
  else mismatches.push({ userId, expected: expected.trim(), actual });
}

console.log(`derivation check: ${ok} match, ${mismatches.length} mismatch (of ${ok + mismatches.length})`);
for (const m of mismatches.slice(0, 10)) {
  console.error(`  MISMATCH ${m.userId}: manifest ${m.expected} != derived ${m.actual}`);
}
if (mismatches.length > 10) console.error(`  ... and ${mismatches.length - 10} more`);

// Zero rows is a failure, not a pass: an empty manifest would otherwise report
// "0 mismatch" and read as green.
if (ok === 0) {
  console.error('no rows verified -- the manifest is empty');
  process.exit(66);
}
process.exit(mismatches.length === 0 ? 0 : 1);
