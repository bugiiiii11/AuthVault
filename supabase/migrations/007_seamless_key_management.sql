-- Migration 007: Server-assisted seamless key management
-- Replaces SSS (3-of-2 shares) with server-side HKDF key derivation + Supabase Vault storage.
-- The encrypted_keys table holds Vault secret references only; actual key material lives in vault.secrets.

-- Table: encrypted_keys
-- One row per user per curve. vault_secret_id points to vault.secrets.
CREATE TABLE IF NOT EXISTS encrypted_keys (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES wallet_users(id) ON DELETE CASCADE,
  curve           text        NOT NULL DEFAULT 'secp256k1',
  vault_secret_id uuid        NOT NULL,
  evm_address     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, curve)
);

ALTER TABLE encrypted_keys ENABLE ROW LEVEL SECURITY;
-- No public policies: backend always uses the service-role key (bypasses RLS).

-- Table: key_access_log
-- Append-only audit trail for key generation and device-init events.
CREATE TABLE IF NOT EXISTS key_access_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES wallet_users(id),
  device_id  text,
  action     text        NOT NULL CHECK (action IN ('generate', 'device_init', 'regenerate')),
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE key_access_log ENABLE ROW LEVEL SECURITY;

-- Vault wrapper functions
-- These run with SECURITY DEFINER so the service-role caller can access vault.* without
-- needing direct grants on the vault schema.

CREATE OR REPLACE FUNCTION create_user_vault_key(p_user_id uuid, p_secret text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  SELECT vault.create_secret(
    p_secret,
    'user_key_' || p_user_id::text,
    'AuthVault user private key'
  ) INTO v_secret_id;
  RETURN v_secret_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_vault_key(p_secret_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_decrypted text;
BEGIN
  SELECT decrypted_secret INTO v_decrypted
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id;
  RETURN v_decrypted;
END;
$$;

CREATE OR REPLACE FUNCTION update_user_vault_key(p_secret_id uuid, p_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  PERFORM vault.update_secret(p_secret_id, p_secret);
END;
$$;
