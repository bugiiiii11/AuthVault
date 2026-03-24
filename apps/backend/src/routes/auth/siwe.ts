/**
 * Sign-In With Ethereum (SIWE) routes.
 * For users connecting with MetaMask, WalletConnect, etc.
 */
import { Hono } from 'hono';
import { randomBytes } from 'crypto';
import { verifyMessage } from 'viem';
import { findOrCreateWalletUser } from '../../services/userManager';
import { issueSessionJWT } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';
import { randomUUID } from 'crypto';

const siwe = new Hono();

// In-memory nonce store (Redis in production)
const nonceStore = new Map<string, { nonce: string; createdAt: number }>();

// Cleanup expired nonces (older than 5 minutes)
function cleanupNonces() {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  for (const [key, value] of nonceStore) {
    if (value.createdAt < fiveMinAgo) nonceStore.delete(key);
  }
}

// Step 1: Request a nonce
siwe.post(
  '/nonce',
  rateLimit({ window: '15m', max: 20, keyPrefix: 'auth:siwe:nonce' }),
  async (c) => {
    const body = await c.req.json<{ address: string }>();

    if (!body.address || !/^0x[a-fA-F0-9]{40}$/.test(body.address)) {
      return c.json({
        error: { code: 'AUTH_SIWE_INVALID', message: 'Invalid address', userMessage: 'Invalid wallet address.', retryable: false },
      }, 400);
    }

    cleanupNonces();

    const nonce = randomBytes(16).toString('hex');
    nonceStore.set(body.address.toLowerCase(), { nonce, createdAt: Date.now() });

    return c.json({ nonce });
  },
);

// Step 2: Verify signed message
siwe.post(
  '/verify',
  rateLimit({ window: '15m', max: 10, keyPrefix: 'auth:siwe:verify' }),
  async (c) => {
    const body = await c.req.json<{ message: string; signature: `0x${string}`; deviceId?: string }>();

    if (!body.message || !body.signature) {
      return c.json({
        error: { code: 'AUTH_SIWE_INVALID', message: 'Missing message or signature', userMessage: 'Wallet verification failed.', retryable: true },
      }, 400);
    }

    try {
      // Parse the SIWE message to extract address and nonce
      const addressMatch = body.message.match(/0x[a-fA-F0-9]{40}/);
      const nonceMatch = body.message.match(/Nonce: ([a-f0-9]+)/);

      if (!addressMatch || !nonceMatch) {
        throw new Error('Invalid SIWE message format');
      }

      const address = addressMatch[0].toLowerCase();
      const messageNonce = nonceMatch[1];

      // Verify nonce
      const stored = nonceStore.get(address);
      if (!stored || stored.nonce !== messageNonce) {
        throw new Error('Invalid or expired nonce');
      }

      // Remove used nonce
      nonceStore.delete(address);

      // Verify signature using viem
      const valid = await verifyMessage({
        address: address as `0x${string}`,
        message: body.message,
        signature: body.signature,
      });

      if (!valid) {
        throw new Error('Invalid signature');
      }

      // Find or create wallet user
      const { user, isNew } = await findOrCreateWalletUser(address);

      // Issue session JWT
      const deviceId = body.deviceId || randomUUID();
      const token = await issueSessionJWT({
        sub: user.id,
        authId: user.id, // Wallet users don't have a Supabase auth ID
        deviceId,
      });

      return c.json({
        user,
        session: { token, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), deviceId },
        isNew,
      });
    } catch (err) {
      console.error('SIWE verify error:', err);
      return c.json({
        error: { code: 'AUTH_SIWE_INVALID', message: 'Signature verification failed', userMessage: 'Wallet verification failed.', retryable: true },
      }, 401);
    }
  },
);

export default siwe;
