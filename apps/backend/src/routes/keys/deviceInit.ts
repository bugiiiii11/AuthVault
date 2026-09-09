/**
 * POST /api/keys/device-init
 * Transport-encrypts the user's private key for a specific device.
 *
 * Uses only Node.js built-in crypto (no libsodium -- its ESM build is broken in Docker).
 *
 * Protocol (X25519 ECDH + AES-256-GCM):
 *   1. Client generates ephemeral X25519 keypair (Web Crypto API).
 *   2. Client sends its raw public key (32 bytes, hex) in the request body.
 *   3. Server generates its own ephemeral X25519 keypair.
 *   4. Server performs ECDH to derive a shared secret.
 *   5. Server derives an AES-256 key via HKDF-SHA256.
 *   6. Server AES-256-GCM encrypts the private key.
 *   7. Server returns { serverPublicKey, encryptedKey, iv, tag }.
 *   8. Client mirrors steps 4-5 and AES-256-GCM decrypts to get the private key.
 *   9. Client re-encrypts with local XChaCha20 key and stores in IndexedDB.
 */
import { createPublicKey, diffieHellman, generateKeyPairSync, createCipheriv, randomBytes, hkdfSync } from 'node:crypto';
import { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth';
import { adminClient } from '../../config/supabase';
import { rateLimit } from '../../middleware/rateLimit';

const deviceInit = new Hono();

/** Wrap a raw 32-byte X25519 key in SPKI DER so Node.js createPublicKey accepts it. */
function rawToSpkiX25519(raw: Buffer): Buffer {
  // SPKI DER header for X25519 (OID 1.3.101.110):
  //   30 2a 30 05 06 03 2b 65 6e 03 21 00
  const header = Buffer.from('302a300506032b656e032100', 'hex');
  return Buffer.concat([header, raw]);
}

deviceInit.post(
  '/device-init',
  requireAuth,
  rateLimit({ window: '5m', max: 10, keyPrefix: 'keys:device-init' }),
  async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json<{ clientPublicKey: string }>();

    if (!body.clientPublicKey || body.clientPublicKey.length !== 64) {
      return c.json({
        error: { code: 'BAD_REQUEST', message: 'clientPublicKey must be a 32-byte hex string (64 chars)', userMessage: 'Invalid request.', retryable: false },
      }, 400);
    }

    try {
      // Look up Vault reference
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

      // Retrieve private key from Vault
      const { data: privateKeyHex, error: vaultErr } = await adminClient
        .rpc('get_user_vault_key_for_user', { p_user_id: auth.sub, p_secret_id: keyData.vault_secret_id });

      if (vaultErr || !privateKeyHex) {
        throw new Error(`Vault retrieval failed: ${vaultErr?.message ?? 'empty secret'}`);
      }

      // Generate server ephemeral X25519 keypair (KeyObject, not encoded)
      const { privateKey: serverPrivKey, publicKey: serverPubKey } = generateKeyPairSync('x25519');

      // Export server public key as raw 32 bytes (SPKI DER minus 12-byte header)
      const serverPubSpki = serverPubKey.export({ type: 'spki', format: 'der' }) as Buffer;
      const serverPubRaw = serverPubSpki.subarray(12);

      // Import client's raw X25519 public key as a KeyObject
      const clientPubRaw = Buffer.from(body.clientPublicKey, 'hex');
      const clientPubKey = createPublicKey({
        key: rawToSpkiX25519(clientPubRaw),
        format: 'der',
        type: 'spki',
      });

      // ECDH shared secret
      const sharedSecret = diffieHellman({ privateKey: serverPrivKey, publicKey: clientPubKey });

      // Derive AES-256 key via HKDF-SHA256
      const aesKey = Buffer.from(
        hkdfSync('sha256', sharedSecret, Buffer.alloc(0), 'authvault-device-init-v1', 32),
      );

      // AES-256-GCM encrypt the private key
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
      const privateKeyBuf = Buffer.from(privateKeyHex as string, 'hex');
      const encrypted = Buffer.concat([cipher.update(privateKeyBuf), cipher.final()]);
      const tag = cipher.getAuthTag();

      // Audit log (best-effort)
      adminClient.from('key_access_log').insert({
        user_id: auth.sub,
        device_id: auth.deviceId ?? null,
        action: 'device_init',
        ip_address: c.req.header('x-forwarded-for') ?? null,
      }).then(({ error: e }) => {
        if (e) console.warn('Audit log insert failed:', e.message);
      });

      return c.json({
        serverPublicKey: serverPubRaw.toString('hex'),
        encryptedKey: encrypted.toString('hex'),
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
      });
    } catch (err) {
      console.error('Device init error:', err);
      return c.json({
        error: { code: 'SERVER_ERROR', message: 'Device init failed', userMessage: 'Something went wrong. Please try again.', retryable: true },
      }, 500);
    }
  },
);

export default deviceInit;
