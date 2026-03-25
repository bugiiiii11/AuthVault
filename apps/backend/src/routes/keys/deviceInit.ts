/**
 * POST /api/keys/device-init
 * Transport-encrypts the user's private key for a specific device.
 *
 * Flow:
 *   1. Client generates an ephemeral X25519 keypair (libsodium crypto_box_keypair).
 *   2. Client sends the public key (hex) in the request body.
 *   3. Server retrieves the private key from Supabase Vault.
 *   4. Server seals the private key with libsodium crypto_box_seal using the client's public key.
 *   5. Server returns the sealed ciphertext (hex).
 *   6. Client unseals with its X25519 private key to obtain the plaintext private key.
 *   7. Client re-encrypts with its local XChaCha20 key and stores in IndexedDB.
 *
 * The sealed box (X25519 + XSalsa20-Poly1305) provides forward secrecy: the ephemeral
 * keypair is discarded after each call so no past sessions can be decrypted.
 */
import { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth';
import { adminClient } from '../../config/supabase';
import { rateLimit } from '../../middleware/rateLimit';
import _sodium from 'libsodium-wrappers';

const deviceInit = new Hono();

deviceInit.post(
  '/device-init',
  requireAuth,
  rateLimit({ window: '5m', max: 10, keyPrefix: 'keys:device-init' }),
  async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json<{ clientPublicKey: string }>();

    if (!body.clientPublicKey || body.clientPublicKey.length !== 64) {
      return c.json({
        error: { code: 'BAD_REQUEST', message: 'clientPublicKey must be a 32-byte hex string', userMessage: 'Invalid request.', retryable: false },
      }, 400);
    }

    try {
      // Look up Vault reference for this user
      const { data: keyData, error: lookupErr } = await adminClient
        .from('encrypted_keys')
        .select('vault_secret_id')
        .eq('user_id', auth.sub)
        .eq('curve', 'secp256k1')
        .single();

      if (lookupErr || !keyData) {
        return c.json({
          error: { code: 'KEY_NOT_FOUND', message: 'No key found for user', userMessage: 'Wallet not set up. Please log in again.', retryable: false },
        }, 404);
      }

      // Retrieve private key from Vault (decrypted by Vault's pgsodium layer)
      const { data: privateKeyHex, error: vaultErr } = await adminClient
        .rpc('get_user_vault_key', { p_secret_id: keyData.vault_secret_id });

      if (vaultErr || !privateKeyHex) {
        throw new Error(`Vault retrieval failed: ${vaultErr?.message ?? 'empty secret'}`);
      }

      // Seal private key bytes with the client's X25519 public key
      await _sodium.ready;
      const sodium = _sodium;

      const clientPubKeyBytes = sodium.from_hex(body.clientPublicKey);
      const privateKeyBytes = sodium.from_hex(privateKeyHex as string);

      if (clientPubKeyBytes.length !== sodium.crypto_box_PUBLICKEYBYTES) {
        return c.json({
          error: { code: 'BAD_REQUEST', message: 'Invalid client public key length', userMessage: 'Invalid request.', retryable: false },
        }, 400);
      }

      const sealedBox = sodium.crypto_box_seal(privateKeyBytes, clientPubKeyBytes);

      // Audit log (best-effort, non-fatal)
      adminClient.from('key_access_log').insert({
        user_id: auth.sub,
        device_id: auth.deviceId ?? null,
        action: 'device_init',
        ip_address: c.req.header('x-forwarded-for') ?? null,
      }).then(({ error }) => {
        if (error) console.warn('Audit log insert failed:', error.message);
      });

      return c.json({ encryptedKey: sodium.to_hex(sealedBox) });
    } catch (err) {
      console.error('Device init error:', err);
      return c.json({
        error: { code: 'SERVER_ERROR', message: 'Device init failed', userMessage: 'Something went wrong. Please try again.', retryable: true },
      }, 500);
    }
  },
);

export default deviceInit;
