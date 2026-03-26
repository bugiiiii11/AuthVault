/**
 * User management service.
 * Creates/finds wallet_users based on OAuth identity.
 */
import { adminClient } from '../config/supabase';
import type { AuthUser } from '@signakit/types';

interface OAuthIdentity {
  provider: string;    // 'google', 'apple', 'x', 'email'
  subject: string;     // provider's unique user ID
  email?: string;
  supabaseAuthId: string;
}

interface UserResult {
  user: AuthUser;
  isNew: boolean;
}

/**
 * Find or create a wallet_user based on OAuth identity.
 *
 * Checks three paths in order:
 *   1. Exact match on provider + subject (normal case)
 *   2. Match on supabase_auth_id (handles Supabase identity auto-linking,
 *      e.g. same email used for both Google OAuth and email OTP)
 *   3. Create new user
 */
export async function findOrCreateUser(identity: OAuthIdentity): Promise<UserResult> {
  // 1. Exact match: provider + subject
  const { data: existing } = await adminClient
    .from('wallet_users')
    .select('*')
    .eq('oauth_provider', identity.provider)
    .eq('oauth_subject', identity.subject)
    .single();

  if (existing) {
    await adminClient
      .from('wallet_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', existing.id);

    return {
      user: mapDbUser(existing),
      isNew: false,
    };
  }

  // 2. Match by supabase_auth_id (identity linking: same Supabase user, different provider)
  const { data: linked } = await adminClient
    .from('wallet_users')
    .select('*')
    .eq('supabase_auth_id', identity.supabaseAuthId)
    .single();

  if (linked) {
    await adminClient
      .from('wallet_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', linked.id);

    return {
      user: mapDbUser(linked),
      isNew: false,
    };
  }

  // 3. Create new user
  const { data: newUser, error } = await adminClient
    .from('wallet_users')
    .insert({
      supabase_auth_id: identity.supabaseAuthId,
      email: identity.email,
      oauth_provider: identity.provider,
      oauth_subject: identity.subject,
      login_method: 'social',
      last_login_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !newUser) {
    throw new Error(`Failed to create user: ${error?.message}`);
  }

  return {
    user: mapDbUser(newUser),
    isNew: true,
  };
}

/**
 * Find or create a wallet user for external wallet login (SIWE).
 */
export async function findOrCreateWalletUser(evmAddress: string): Promise<UserResult> {
  const { data: existing } = await adminClient
    .from('wallet_users')
    .select('*')
    .eq('public_key_evm', evmAddress)
    .eq('login_method', 'wallet')
    .single();

  if (existing) {
    await adminClient
      .from('wallet_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', existing.id);

    return { user: mapDbUser(existing), isNew: false };
  }

  const { data: newUser, error } = await adminClient
    .from('wallet_users')
    .insert({
      login_method: 'wallet',
      public_key_evm: evmAddress,
      last_login_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !newUser) {
    throw new Error(`Failed to create wallet user: ${error?.message}`);
  }

  return { user: mapDbUser(newUser), isNew: true };
}

/**
 * Update user's public keys after key generation.
 */
export async function updateUserPublicKeys(
  userId: string,
  keys: { evm?: string; solana?: string },
): Promise<void> {
  const update: Record<string, string> = {};
  if (keys.evm) update.public_key_evm = keys.evm;
  if (keys.solana) update.public_key_solana = keys.solana;

  const { error } = await adminClient
    .from('wallet_users')
    .update(update)
    .eq('id', userId);

  if (error) throw new Error(`Failed to update public keys: ${error.message}`);
}

/**
 * Get user by ID.
 */
export async function getUserById(userId: string): Promise<AuthUser | null> {
  const { data } = await adminClient
    .from('wallet_users')
    .select('*')
    .eq('id', userId)
    .single();

  return data ? mapDbUser(data) : null;
}

// Map DB row to AuthUser type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbUser(row: any): AuthUser {
  return {
    id: row.id,
    email: row.email ?? undefined,
    oauthProvider: row.oauth_provider ?? undefined,
    loginMethod: row.login_method,
    evmAddress: row.public_key_evm ?? undefined,
    solanaAddress: row.public_key_solana ?? undefined,
    recoveryConfigured: row.recovery_configured ?? false,
    lastLoginAt: row.last_login_at ?? undefined,
    createdAt: row.created_at,
  };
}
