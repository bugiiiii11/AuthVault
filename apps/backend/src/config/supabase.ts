/**
 * Supabase client instances.
 * - adminClient: service role key, bypasses RLS (for backend operations)
 * - createUserClient: creates a client scoped to a user's JWT
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

// Admin client (service role) -- bypasses RLS
export const adminClient: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Create a client scoped to a specific user's JWT
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
