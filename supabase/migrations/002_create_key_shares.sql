-- AuthVault MVP: Key shares table
CREATE TABLE public.key_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.wallet_users(id) ON DELETE CASCADE,
  share_index INTEGER NOT NULL,
  share_type TEXT NOT NULL CHECK (share_type IN ('device', 'server', 'recovery')),
  encrypted_share BYTEA NOT NULL,
  encryption_nonce BYTEA NOT NULL,
  vault_secret_id UUID,
  device_id TEXT,
  device_name TEXT,
  recovery_hint TEXT,
  curve TEXT NOT NULL DEFAULT 'secp256k1',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, share_index, curve)
);

CREATE INDEX idx_shares_user ON public.key_shares(user_id);
