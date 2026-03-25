/**
 * POST /api/keys/generate
 * Server-side seamless key management.
 *
 * Derives the user's private key via HKDF, stores it in Supabase Vault,
 * and records the Vault secret reference in encrypted_keys.
 * Idempotent: returns the existing address if a key already exists.
 */
import { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth';
import { adminClient } from '../../config/supabase';
import { rateLimit } from '../../middleware/rateLimit';
import { env } from '../../config/env';
import { deriveUserPrivateKey, privateKeyToEvmAddress, bytesToHex } from '../../services/keyDerivation';

const keys = new Hono();

keys.post(
  '/generate',
  requireAuth,
  rateLimit({ window: '5m', max: 5, keyPrefix: 'keys:generate' }),
  async (c) => {
    const auth = c.get('auth');
    const curve = 'secp256k1';

    try {
      // Idempotent: return existing address if key already exists
      const { data: existing } = await adminClient
        .from('encrypted_keys')
        .select('evm_address')
        .eq('user_id', auth.sub)
        .eq('curve', curve)
        .single();

      if (existing?.evm_address) {
        return c.json({ success: true, evmAddress: existing.evm_address });
      }

      // Derive private key (deterministic HKDF)
      const privateKey = deriveUserPrivateKey(env.ENCRYPTION_MASTER_KEY, auth.sub);
      const evmAddress = privateKeyToEvmAddress(privateKey);
      const privateKeyHex = bytesToHex(privateKey);

      // Store in Supabase Vault via wrapper function
      const { data: vaultSecretId, error: vaultErr } = await adminClient
        .rpc('create_user_vault_key', {
          p_user_id: auth.sub,
          p_secret: privateKeyHex,
        });

      if (vaultErr || !vaultSecretId) {
        throw new Error(`Vault storage failed: ${vaultErr?.message ?? 'no secret id returned'}`);
      }

      // Record vault reference
      const { error: storeErr } = await adminClient
        .from('encrypted_keys')
        .insert({
          user_id: auth.sub,
          curve,
          vault_secret_id: vaultSecretId,
          evm_address: evmAddress,
        });

      if (storeErr) throw new Error(`Key metadata store failed: ${storeErr.message}`);

      // Update public EVM address on the user record
      await adminClient
        .from('wallet_users')
        .update({ evm_address: evmAddress })
        .eq('id', auth.sub);

      // Audit log
      await adminClient.from('key_access_log').insert({
        user_id: auth.sub,
        device_id: auth.deviceId ?? null,
        action: 'generate',
        ip_address: c.req.header('x-forwarded-for') ?? null,
      });

      return c.json({ success: true, evmAddress });
    } catch (err) {
      console.error('Key generate error:', err);
      return c.json({
        error: { code: 'SERVER_ERROR', message: 'Key generation failed', userMessage: 'Something went wrong. Please try again.', retryable: true },
      }, 500);
    }
  },
);

export default keys;
