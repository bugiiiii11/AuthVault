/**
 * Google OAuth route.
 * Frontend authenticates with Google via Supabase Auth,
 * then sends the Supabase JWT here for user creation + session.
 */
import { Hono } from 'hono';
import { verifySupabaseJWT } from '../../services/oauthVerifier';
import { findOrCreateUser } from '../../services/userManager';
import { issueSessionJWT } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';
import { randomUUID } from 'crypto';

const google = new Hono();

google.post(
  '/',
  rateLimit({ window: '15m', max: 10, keyPrefix: 'auth:google' }),
  async (c) => {
    const body = await c.req.json<{ supabaseJwt: string; deviceId?: string }>();

    if (!body.supabaseJwt) {
      return c.json({
        error: { code: 'AUTH_OAUTH_FAILED', message: 'Missing supabaseJwt', userMessage: 'Login failed. Please try again.', retryable: true },
      }, 400);
    }

    try {
      // Verify the Supabase JWT
      const identity = await verifySupabaseJWT(body.supabaseJwt);

      if (identity.provider !== 'google') {
        return c.json({
          error: { code: 'AUTH_OAUTH_FAILED', message: 'Not a Google token', userMessage: 'Login failed. Please try again.', retryable: true },
        }, 400);
      }

      // Find or create the user
      const { user, isNew } = await findOrCreateUser({
        provider: 'google',
        subject: identity.subject,
        email: identity.email,
        supabaseAuthId: identity.supabaseAuthId,
      });

      // Issue session JWT
      const deviceId = body.deviceId || randomUUID();
      const token = await issueSessionJWT({
        sub: user.id,
        authId: identity.supabaseAuthId,
        deviceId,
      });

      return c.json({
        user,
        session: { token, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), deviceId },
        isNew,
      });
    } catch (err) {
      console.error('Google auth error:', err);
      return c.json({
        error: { code: 'AUTH_OAUTH_FAILED', message: 'OAuth verification failed', userMessage: 'Login failed. Please try again.', retryable: true },
      }, 401);
    }
  },
);

export default google;
