/**
 * Email OTP auth routes.
 * Two-step flow: start (send code) -> verify (check code + create session).
 */
import { Hono } from 'hono';
import { sendEmailOTP, verifyEmailOTP } from '../../services/emailOtp';
import { verifySupabaseJWT } from '../../services/oauthVerifier';
import { findOrCreateUser } from '../../services/userManager';
import { issueSessionJWT } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';
import { randomUUID } from 'crypto';

const email = new Hono();

// Step 1: Send OTP to email
email.post(
  '/start',
  rateLimit({ window: '1h', max: 5, keyPrefix: 'auth:email:start' }),
  async (c) => {
    const body = await c.req.json<{ email: string }>();

    if (!body.email || !isValidEmail(body.email)) {
      return c.json({
        error: { code: 'AUTH_EMAIL_INVALID', message: 'Invalid email', userMessage: 'Please enter a valid email.', retryable: false },
      }, 400);
    }

    try {
      const { requestId } = await sendEmailOTP(body.email);
      return c.json({ requestId });
    } catch (err) {
      console.error('Email OTP send error:', err);
      return c.json({
        error: { code: 'SERVER_ERROR', message: 'Failed to send OTP', userMessage: 'Something went wrong. Please try again.', retryable: true },
      }, 500);
    }
  },
);

// Step 2: Verify OTP code
email.post(
  '/verify',
  rateLimit({ window: '15m', max: 10, keyPrefix: 'auth:email:verify' }),
  async (c) => {
    const body = await c.req.json<{ email: string; code: string; deviceId?: string }>();

    if (!body.email || !body.code) {
      return c.json({
        error: { code: 'AUTH_OTP_INVALID', message: 'Missing email or code', userMessage: 'Wrong code. Please try again.', retryable: true },
      }, 400);
    }

    if (body.code.length !== 6 || !/^\d{6}$/.test(body.code)) {
      return c.json({
        error: { code: 'AUTH_OTP_INVALID', message: 'Invalid code format', userMessage: 'Wrong code. Please try again.', retryable: true },
      }, 400);
    }

    try {
      // Verify OTP with Supabase -- returns a session
      const { accessToken, userId } = await verifyEmailOTP(body.email, body.code);

      // Verify the session to get full identity
      const identity = await verifySupabaseJWT(accessToken);

      // Find or create the user
      const { user, isNew } = await findOrCreateUser({
        provider: 'email',
        subject: identity.subject,
        email: body.email,
        supabaseAuthId: userId,
      });

      // Issue session JWT
      const deviceId = body.deviceId || randomUUID();
      const token = await issueSessionJWT({
        sub: user.id,
        authId: userId,
        deviceId,
      });

      return c.json({
        user,
        session: { token, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), deviceId },
        isNew,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Email OTP verify error:', message);

      if (message.includes('expired')) {
        return c.json({
          error: { code: 'AUTH_OTP_EXPIRED', message: 'OTP expired', userMessage: 'Code expired. Request a new one.', retryable: true },
        }, 400);
      }

      if (message.includes('duplicate') || message.includes('unique')) {
        return c.json({
          error: { code: 'AUTH_IDENTITY_CONFLICT', message: 'Identity conflict', userMessage: 'This email is linked to another login method. Try a different login.', retryable: false },
        }, 409);
      }

      return c.json({
        error: { code: 'AUTH_OTP_INVALID', message: 'OTP verification failed', userMessage: 'Wrong code. Please try again.', retryable: true },
      }, 400);
    }
  },
);

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default email;
