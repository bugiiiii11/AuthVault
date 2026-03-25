/**
 * Recovery bundle routes.
 * Handles storing and retrieving the password-encrypted recovery bundle,
 * and re-provisioning the server share after a recovery.
 */
import { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth';
import { adminClient } from '../../config/supabase';
import { rateLimit } from '../../middleware/rateLimit';

const recovery = new Hono();

/**
 * POST /api/keys/recovery-bundle
 * Store (or replace) the user's recovery bundle.
 * Called after the user sets their recovery password for the first time,
 * or when they change it.
 *
 * Body: { curve, kdfSalt, ciphertext, nonce }
 */
recovery.post(
  '/recovery-bundle',
  requireAuth,
  rateLimit({ window: '10m', max: 5, keyPrefix: 'keys:recovery-bundle-store' }),
  async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json<{
      curve?: string;
      kdfSalt: string;
      ciphertext: string;
      nonce: string;
    }>();

    if (!body.kdfSalt || !body.ciphertext || !body.nonce) {
      return c.json({
        error: { code: 'BAD_REQUEST', message: 'Missing bundle fields', userMessage: 'Invalid request.', retryable: false },
      }, 400);
    }

    const curve = body.curve || 'secp256k1';

    try {
      const { error: bundleErr } = await adminClient
        .from('recovery_bundles')
        .upsert({
          user_id: auth.sub,
          curve,
          kdf_salt: body.kdfSalt,
          bundle_ciphertext: body.ciphertext,
          bundle_nonce: body.nonce,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,curve' });

      if (bundleErr) throw new Error(`Recovery bundle store failed: ${bundleErr.message}`);

      // Mark recovery as configured
      const { error: userErr } = await adminClient
        .from('wallet_users')
        .update({ recovery_configured: true })
        .eq('id', auth.sub);

      if (userErr) throw new Error(`User update failed: ${userErr.message}`);

      return c.json({ success: true });
    } catch (err) {
      console.error('Recovery bundle store error:', err);
      return c.json({
        error: { code: 'SERVER_ERROR', message: 'Bundle storage failed', userMessage: 'Something went wrong. Please try again.', retryable: true },
      }, 500);
    }
  },
);

/**
 * GET /api/keys/recovery-bundle
 * Retrieve the user's encrypted recovery bundle.
 * Called during account recovery on a new device.
 *
 * Query: ?curve=secp256k1
 */
recovery.get(
  '/recovery-bundle',
  requireAuth,
  rateLimit({ window: '15m', max: 5, keyPrefix: 'keys:recovery-bundle-get' }),
  async (c) => {
    const auth = c.get('auth');
    const curve = c.req.query('curve') || 'secp256k1';

    try {
      const { data, error } = await adminClient
        .from('recovery_bundles')
        .select('kdf_salt, bundle_ciphertext, bundle_nonce')
        .eq('user_id', auth.sub)
        .eq('curve', curve)
        .single();

      if (error || !data) {
        return c.json({
          error: { code: 'NOT_FOUND', message: 'No recovery bundle found', userMessage: 'Recovery has not been set up for this account.', retryable: false },
        }, 404);
      }

      return c.json({
        kdfSalt: data.kdf_salt,
        ciphertext: data.bundle_ciphertext,
        nonce: data.bundle_nonce,
      });
    } catch (err) {
      console.error('Recovery bundle get error:', err);
      return c.json({
        error: { code: 'SERVER_ERROR', message: 'Bundle retrieval failed', userMessage: 'Something went wrong. Please try again.', retryable: true },
      }, 500);
    }
  },
);

/**
 * POST /api/keys/recover
 * Update the server share after successful recovery on a new device.
 * The client has reconstructed the private key and generated a new device share.
 * This endpoint replaces the old server share with one encrypted by the new device key.
 *
 * Body: { curve, encryptedServerShare: { ciphertext, nonce } }
 */
recovery.post(
  '/recover',
  requireAuth,
  rateLimit({ window: '15m', max: 3, keyPrefix: 'keys:recover' }),
  async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json<{
      curve?: string;
      encryptedServerShare: { ciphertext: string; nonce: string };
    }>();

    if (!body.encryptedServerShare?.ciphertext || !body.encryptedServerShare?.nonce) {
      return c.json({
        error: { code: 'BAD_REQUEST', message: 'Missing share data', userMessage: 'Invalid request.', retryable: false },
      }, 400);
    }

    const curve = body.curve || 'secp256k1';

    try {
      const { error } = await adminClient
        .from('key_shares')
        .update({
          encrypted_share: hexToBytes(body.encryptedServerShare.ciphertext),
          encryption_nonce: hexToBytes(body.encryptedServerShare.nonce),
          device_id: auth.deviceId,
        })
        .eq('user_id', auth.sub)
        .eq('share_type', 'server')
        .eq('curve', curve)
        .eq('is_active', true);

      if (error) throw new Error(`Server share update failed: ${error.message}`);

      return c.json({ success: true });
    } catch (err) {
      console.error('Recovery server share update error:', err);
      return c.json({
        error: { code: 'SERVER_ERROR', message: 'Share update failed', userMessage: 'Something went wrong. Please try again.', retryable: true },
      }, 500);
    }
  },
);

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export default recovery;
