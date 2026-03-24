/**
 * XChaCha20-Poly1305 AEAD encryption for share protection.
 * Uses libsodium-wrappers for the cryptographic primitives.
 */
// Use dynamic import to handle ESM/CJS compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sodium: any;

async function loadSodium() {
  if (!sodium) {
    const mod = await import('libsodium-wrappers');
    sodium = mod.default || mod;
  }
  return sodium;
}

let initialized = false;

async function ensureReady() {
  if (!initialized) {
    const s = await loadSodium();
    await s.ready;
    initialized = true;
  }
  return sodium;
}

/**
 * Encrypt data using XChaCha20-Poly1305.
 *
 * @param plaintext - Data to encrypt
 * @param key - 32-byte encryption key
 * @returns Ciphertext and nonce
 */
export async function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  await ensureReady();

  if (key.length !== sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES) {
    throw new Error(`Key must be ${sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES} bytes`);
  }

  const nonce = sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  );

  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    null, // no additional data
    null, // nsec (unused in this AEAD)
    nonce,
    key,
  );

  return { ciphertext: new Uint8Array(ciphertext), nonce };
}

/**
 * Decrypt data using XChaCha20-Poly1305.
 *
 * @param ciphertext - Data to decrypt
 * @param nonce - Nonce used during encryption
 * @param key - 32-byte encryption key
 * @returns Decrypted plaintext
 * @throws If decryption fails (wrong key or tampered ciphertext)
 */
export async function decrypt(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array,
): Promise<Uint8Array> {
  await ensureReady();

  if (key.length !== sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES) {
    throw new Error(`Key must be ${sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES} bytes`);
  }

  const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null, // nsec (unused)
    ciphertext,
    null, // no additional data
    nonce,
    key,
  );

  return new Uint8Array(plaintext);
}

/**
 * Generate a random 32-byte encryption key.
 */
export async function generateKey(): Promise<Uint8Array> {
  await ensureReady();
  return sodium.crypto_aead_xchacha20poly1305_ietf_keygen();
}
