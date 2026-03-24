-- AuthVault MVP: Users table
CREATE TABLE public.wallet_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_auth_id UUID UNIQUE REFERENCES auth.users(id),
  email TEXT,
  oauth_provider TEXT,
  oauth_subject TEXT,
  login_method TEXT NOT NULL,
  public_key_evm TEXT,
  public_key_solana TEXT,
  recovery_configured BOOLEAN DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(oauth_provider, oauth_subject)
);

CREATE INDEX idx_users_auth ON public.wallet_users(supabase_auth_id);
CREATE INDEX idx_users_evm ON public.wallet_users(public_key_evm);
