/**
 * PBKDF2 key derivation for recovery password.
 * Uses the native Web Crypto API -- no external dependencies.
 */

const ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256; // 32 bytes

/**
 * Derive a 32-byte encryption key from a password and salt using PBKDF2-SHA-256.
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: ITERATIONS,
    },
    keyMaterial,
    KEY_LENGTH_BITS,
  );

  return new Uint8Array(bits);
}

/**
 * Generate a random 16-byte salt for PBKDF2.
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}
