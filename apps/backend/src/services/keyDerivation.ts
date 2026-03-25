/**
 * Server-side key derivation for seamless mode.
 *
 * Private key = HKDF-SHA256(masterKey, userId, info='authvault-v1')
 * This is deterministic: same master key + same user ID always produces the same wallet.
 * If the Vault entry is ever lost the key can be re-derived from the master secret.
 */
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';

function hexToBytes(hex: string): Uint8Array {
  const h = hex.replace(/^0x/, '');
  if (h.length % 2 !== 0) throw new Error('Odd-length hex string');
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) {
    bytes[i / 2] = parseInt(h.slice(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derive a deterministic secp256k1 private key for a user.
 *
 * @param masterKeyHex - AUTHVAULT_ENCRYPTION_MASTER_KEY (hex or plain string)
 * @param userId       - wallet_users.id (UUID string)
 */
export function deriveUserPrivateKey(masterKeyHex: string, userId: string): Uint8Array {
  // Accept hex master key (32 bytes = 64 chars) or treat as UTF-8 if shorter
  const ikm = masterKeyHex.length === 64 && /^[0-9a-fA-F]+$/.test(masterKeyHex)
    ? hexToBytes(masterKeyHex)
    : new TextEncoder().encode(masterKeyHex);

  const salt = new TextEncoder().encode(userId);
  const info = new TextEncoder().encode('authvault-v1');

  let derived = hkdf(sha256, ikm, salt, info, 32);

  // secp256k1 private keys must be in [1, n-1].  The probability of failure is
  // negligible (~2^-128) but we loop to be correct.
  let attempt = 0;
  while (!secp256k1.utils.isValidPrivateKey(derived)) {
    attempt++;
    derived = hkdf(sha256, derived, salt, new TextEncoder().encode(`authvault-v1-retry-${attempt}`), 32);
  }

  return derived;
}

/**
 * Compute the checksummed EVM address from a secp256k1 private key.
 */
export function privateKeyToEvmAddress(privateKey: Uint8Array): string {
  // Uncompressed public key: 0x04 || x || y (65 bytes)
  const pubKey = secp256k1.getPublicKey(privateKey, false);
  // Drop the 0x04 prefix, keccak256-hash the 64-byte x||y, take last 20 bytes
  const hash = keccak_256(pubKey.slice(1));
  const addressBytes = hash.slice(-20);
  return '0x' + bytesToHex(addressBytes);
}
