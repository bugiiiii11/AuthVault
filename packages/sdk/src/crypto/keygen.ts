/**
 * Key generation for EVM (secp256k1).
 * Generates key pairs and derives blockchain addresses.
 */
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import type { KeyPair } from '@signakit/types';

/**
 * Generate an EVM (Ethereum) key pair.
 *
 * @returns KeyPair with privateKey, publicKey, and 0x-prefixed address
 */
export function generateEVMKeyPair(): KeyPair {
  const privateKey = secp256k1.utils.randomPrivateKey();
  const publicKey = secp256k1.getPublicKey(privateKey, false); // uncompressed (65 bytes)

  // Ethereum address = last 20 bytes of keccak256(publicKey without 0x04 prefix)
  const hash = keccak_256(publicKey.slice(1));
  const addressBytes = hash.slice(-20);
  const address = '0x' + bytesToHex(addressBytes);

  return {
    privateKey,
    publicKey,
    address: toChecksumAddress(address),
    curve: 'secp256k1',
  };
}

/**
 * Derive an EVM address from a private key.
 */
export function deriveEVMAddress(privateKey: Uint8Array): string {
  const publicKey = secp256k1.getPublicKey(privateKey, false);
  const hash = keccak_256(publicKey.slice(1));
  const addressBytes = hash.slice(-20);
  const address = '0x' + bytesToHex(addressBytes);
  return toChecksumAddress(address);
}

/**
 * EIP-55 checksum encoding for Ethereum addresses.
 */
function toChecksumAddress(address: string): string {
  const addr = address.toLowerCase().replace('0x', '');
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(addr)));

  let checksummed = '0x';
  for (let i = 0; i < addr.length; i++) {
    checksummed += parseInt(hash[i], 16) >= 8
      ? addr[i].toUpperCase()
      : addr[i];
  }
  return checksummed;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
