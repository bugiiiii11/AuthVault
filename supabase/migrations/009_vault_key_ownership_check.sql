-- 009_vault_key_ownership_check.sql
--
-- get_user_vault_key() decrypts whatever secret id it is handed, with no caller
-- check -- the ownership test lived only in the backend (deviceInit.ts looks up
-- encrypted_keys filtered by user_id before calling it). Correct today, but it
-- makes any future backend bug a cross-user private-key disclosure.
--
-- This variant verifies in the database that the secret belongs to the user,
-- so the guarantee no longer depends on the caller getting it right.
-- deviceInit.ts calls this instead as of the same commit. The old function is
-- left in place (service_role only, per 008) for rollback.
--
-- Applied by hand to the live project on 2026-09-09.

CREATE OR REPLACE FUNCTION public.get_user_vault_key_for_user(p_user_id uuid, p_secret_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE v_decrypted text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.encrypted_keys
    WHERE vault_secret_id = p_secret_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'vault secret does not belong to user';
  END IF;

  SELECT decrypted_secret INTO v_decrypted
  FROM vault.decrypted_secrets WHERE id = p_secret_id;
  RETURN v_decrypted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_vault_key_for_user(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_vault_key_for_user(uuid, uuid) TO service_role;
