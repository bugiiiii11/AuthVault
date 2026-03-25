/**
 * Key generation and share storage routes.
 * Called after social login when user needs a new wallet.
 *
 * Note: encrypted_share and encryption_nonce are stored as TEXT (hex strings).
 * PostgREST returns BYTEA as base64, which creates encoding ambiguity; TEXT avoids it.
 */
import { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth';
import { adminClient } from '../../config/supabase';
import { updateUserPublicKeys } from '../../services/userManager';
import { rateLimit } from '../../middleware/rateLimit';

const keys = new Hono();

/**
 * POST /api/keys/generate
 * Store server share + recovery share, update user's public keys.
 * Called by SDK after client-side key generation and splitting.
 */
keys.post(
  '/generate',
  requireAuth,
  rateLimit({ window: '5m', max: 5, keyPrefix: 'keys:generate' }),
  async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json<{
      encryptedShares: {
        server: { ciphertext: string; nonce: string };
        recovery: { ciphertext: string; nonce: string };
      };
      publicKeys: { evm?: string; solana?: string };
      curve?: string;
    }>();

    if (!body.encryptedShares?.server || !body.publicKeys) {
      return c.json({
        error: { code: 'SERVER_ERROR', message: 'Missing share data', userMessage: 'Something went wrong. Please try again.', retryable: true },
      }, 400);
    }

    const curve = body.curve || 'secp256k1';

    try {
      // Store server share (index 2) -- hex strings stored directly as TEXT
      const { error: serverErr } = await adminClient
        .from('key_shares')
        .upsert({
          user_id: auth.sub,
          share_index: 2,
          share_type: 'server',
          encrypted_share: body.encryptedShares.server.ciphertext,
          encryption_nonce: body.encryptedShares.server.nonce,
          curve,
          device_id: auth.deviceId,
          is_active: true,
        }, { onConflict: 'user_id,share_index,curve' });

      if (serverErr) throw new Error(`Server share store failed: ${serverErr.message}`);

      // Store recovery share (index 3) if provided
      if (body.encryptedShares.recovery) {
        const { error: recoveryErr } = await adminClient
          .from('key_shares')
          .upsert({
            user_id: auth.sub,
            share_index: 3,
            share_type: 'recovery',
            encrypted_share: body.encryptedShares.recovery.ciphertext,
            encryption_nonce: body.encryptedShares.recovery.nonce,
            curve,
            is_active: true,
          }, { onConflict: 'user_id,share_index,curve' });

        if (recoveryErr) throw new Error(`Recovery share store failed: ${recoveryErr.message}`);
      }

      // Update user's public keys
      await updateUserPublicKeys(auth.sub, body.publicKeys);

      return c.json({ success: true });
    } catch (err) {
      console.error('Key generate error:', err);
      return c.json({
        error: { code: 'SERVER_ERROR', message: 'Key storage failed', userMessage: 'Something went wrong. Please try again.', retryable: true },
      }, 500);
    }
  },
);

/**
 * GET /api/keys/server-share
 * Retrieve the encrypted server share for the current user.
 * Used during signing to reconstruct the key with device share.
 */
keys.get(
  '/server-share',
  requireAuth,
  rateLimit({ window: '5m', max: 10, keyPrefix: 'keys:share' }),
  async (c) => {
    const auth = c.get('auth');
    const curve = c.req.query('curve') || 'secp256k1';

    try {
      const { data, error } = await adminClient
        .from('key_shares')
        .select('encrypted_share, encryption_nonce')
        .eq('user_id', auth.sub)
        .eq('share_type', 'server')
        .eq('curve', curve)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return c.json({
          error: { code: 'SHARE_NOT_FOUND', message: 'No server share found', userMessage: 'Account not found on this device.', retryable: false },
        }, 404);
      }

      // encrypted_share and encryption_nonce are already hex TEXT -- return directly
      return c.json({
        encryptedShare: data.encrypted_share as string,
        nonce: data.encryption_nonce as string,
      });
    } catch (err) {
      console.error('Share retrieval error:', err);
      return c.json({
        error: { code: 'SERVER_ERROR', message: 'Share retrieval failed', userMessage: 'Something went wrong. Please try again.', retryable: true },
      }, 500);
    }
  },
);

export default keys;
