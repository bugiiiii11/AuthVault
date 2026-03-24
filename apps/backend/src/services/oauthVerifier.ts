/**
 * OAuth token verification service.
 * Verifies Supabase Auth JWT and extracts user identity.
 */
import { adminClient } from '../config/supabase';

export interface VerifiedIdentity {
  supabaseAuthId: string;
  email?: string;
  provider: string;
  subject: string;
}

/**
 * Verify a Supabase Auth JWT and extract identity.
 * The frontend authenticates via Supabase Auth (Google, Apple, etc.),
 * then sends the Supabase JWT to our backend for verification.
 */
export async function verifySupabaseJWT(jwt: string): Promise<VerifiedIdentity> {
  const { data: { user }, error } = await adminClient.auth.getUser(jwt);

  if (error || !user) {
    throw new Error(`OAuth verification failed: ${error?.message || 'No user'}`);
  }

  // Extract provider info from user metadata
  const provider = user.app_metadata?.provider || 'email';
  const subject = user.id; // Supabase user ID as subject

  return {
    supabaseAuthId: user.id,
    email: user.email,
    provider,
    subject,
  };
}
