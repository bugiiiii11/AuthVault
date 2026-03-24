/**
 * Email OTP service.
 * Uses Supabase Auth's built-in OTP for email verification.
 */
import { adminClient } from '../config/supabase';

/**
 * Send a magic link / OTP to the user's email via Supabase Auth.
 * Returns a request ID for tracking.
 */
export async function sendEmailOTP(email: string): Promise<{ requestId: string }> {
  const { error } = await adminClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    throw new Error(`Failed to send OTP: ${error.message}`);
  }

  // Use email hash as request ID for correlation
  const requestId = Buffer.from(email).toString('base64url');
  return { requestId };
}

/**
 * Verify an email OTP code.
 * Returns a Supabase session if verification succeeds.
 */
export async function verifyEmailOTP(
  email: string,
  code: string,
): Promise<{ accessToken: string; userId: string }> {
  const { data, error } = await adminClient.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  });

  if (error || !data.session) {
    throw new Error(`OTP verification failed: ${error?.message || 'No session'}`);
  }

  return {
    accessToken: data.session.access_token,
    userId: data.user!.id,
  };
}
