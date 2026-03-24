import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, generateKey } from './encryption';

describe('XChaCha20-Poly1305 Encryption', () => {
  it('encrypts and decrypts correctly', async () => {
    const key = await generateKey();
    const plaintext = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

    const { ciphertext, nonce } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, nonce, key);

    expect(decrypted).toEqual(plaintext);
  });

  it('encrypts and decrypts a 32-byte share', async () => {
    const key = await generateKey();
    const share = new Uint8Array(32);
    crypto.getRandomValues(share);

    const { ciphertext, nonce } = await encrypt(share, key);
    const decrypted = await decrypt(ciphertext, nonce, key);

    expect(decrypted).toEqual(share);
  });

  it('ciphertext differs from plaintext', async () => {
    const key = await generateKey();
    const plaintext = new Uint8Array(32);
    plaintext.fill(0xAB);

    const { ciphertext } = await encrypt(plaintext, key);
    expect(ciphertext).not.toEqual(plaintext);
    // Ciphertext is longer (includes auth tag)
    expect(ciphertext.length).toBeGreaterThan(plaintext.length);
  });

  it('different encryptions produce different ciphertexts', async () => {
    const key = await generateKey();
    const plaintext = new Uint8Array([1, 2, 3]);

    const enc1 = await encrypt(plaintext, key);
    const enc2 = await encrypt(plaintext, key);

    // Different nonces mean different ciphertexts
    expect(enc1.nonce).not.toEqual(enc2.nonce);
    expect(enc1.ciphertext).not.toEqual(enc2.ciphertext);
  });

  it('fails with wrong key', async () => {
    const key1 = await generateKey();
    const key2 = await generateKey();
    const plaintext = new Uint8Array([1, 2, 3]);

    const { ciphertext, nonce } = await encrypt(plaintext, key1);

    await expect(decrypt(ciphertext, nonce, key2)).rejects.toThrow();
  });

  it('fails with tampered ciphertext', async () => {
    const key = await generateKey();
    const plaintext = new Uint8Array([1, 2, 3]);

    const { ciphertext, nonce } = await encrypt(plaintext, key);

    // Tamper with ciphertext
    const tampered = new Uint8Array(ciphertext);
    tampered[0] ^= 0xFF;

    await expect(decrypt(tampered, nonce, key)).rejects.toThrow();
  });

  it('fails with wrong nonce', async () => {
    const key = await generateKey();
    const plaintext = new Uint8Array([1, 2, 3]);

    const { ciphertext, nonce } = await encrypt(plaintext, key);

    // Wrong nonce
    const wrongNonce = new Uint8Array(nonce.length);
    crypto.getRandomValues(wrongNonce);

    await expect(decrypt(ciphertext, wrongNonce, key)).rejects.toThrow();
  });

  it('rejects invalid key length', async () => {
    const badKey = new Uint8Array(16); // Too short
    const plaintext = new Uint8Array([1, 2, 3]);

    await expect(encrypt(plaintext, badKey)).rejects.toThrow('Key must be');
  });

  it('generateKey produces 32-byte key', async () => {
    const key = await generateKey();
    expect(key.length).toBe(32);
  });
});
