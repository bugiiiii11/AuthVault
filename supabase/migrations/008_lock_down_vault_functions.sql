-- 008_lock_down_vault_functions.sql
--
-- Postgres grants EXECUTE TO PUBLIC on every newly created function by default.
-- Migration 007 never revoked it, so the three SECURITY DEFINER vault wrappers
-- were callable by `anon` and `authenticated` through PostgREST's public
-- /rest/v1/rpc/* endpoints, using only the (publicly published) anon key.
--
-- get_user_vault_key() returns a raw secp256k1 private key, and
-- update_user_vault_key() can overwrite one. Neither performs any caller check,
-- so possession of a vault_secret_id UUID was sufficient. RLS on encrypted_keys
-- (enabled, zero policies) kept those UUIDs unreachable in practice, so there
-- was no known exposure -- but the functions must not be reachable at all.
--
-- Only the service role may call these. Applied by hand to the live project on
-- 2026-09-09; recorded here so a fresh environment is not created vulnerable.

REVOKE EXECUTE ON FUNCTION public.get_user_vault_key(uuid)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_user_vault_key(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_vault_key(uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_vault_key(uuid)          TO service_role;
GRANT EXECUTE ON FUNCTION public.create_user_vault_key(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_user_vault_key(uuid, text) TO service_role;
