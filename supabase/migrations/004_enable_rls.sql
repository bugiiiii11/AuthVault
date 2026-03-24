-- AuthVault MVP: Row Level Security
ALTER TABLE public.wallet_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own data" ON public.wallet_users
  FOR SELECT USING (supabase_auth_id = auth.uid());

CREATE POLICY "Users see own shares" ON public.key_shares
  FOR SELECT USING (
    user_id IN (SELECT id FROM public.wallet_users WHERE supabase_auth_id = auth.uid())
  );

CREATE POLICY "Users see own sessions" ON public.auth_sessions
  FOR ALL USING (
    user_id IN (SELECT id FROM public.wallet_users WHERE supabase_auth_id = auth.uid())
  );

CREATE POLICY "Users see own devices" ON public.user_devices
  FOR ALL USING (
    user_id IN (SELECT id FROM public.wallet_users WHERE supabase_auth_id = auth.uid())
  );
