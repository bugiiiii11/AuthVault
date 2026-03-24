-- AuthVault MVP: Sessions table
CREATE TABLE public.auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.wallet_users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  session_token_hash TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sessions_user ON public.auth_sessions(user_id);
CREATE INDEX idx_sessions_expires ON public.auth_sessions(expires_at);

-- Devices table
CREATE TABLE public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.wallet_users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT,
  platform TEXT,
  has_share BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  registered_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, device_id)
);
