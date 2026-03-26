import { useCallback, useState } from 'react';
import { useSignaKitContext } from '../SignaKitProvider';
import { clearSession } from '../core/session';
import type { OAuthProvider, WalletProvider } from '@signakit/types';

export interface UseAuthReturn {
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  user: ReturnType<typeof useSignaKitContext>['state']['user'];
  error: string | null;
  login: (provider: OAuthProvider, options?: LoginOptions) => Promise<void>;
  connectWallet: (provider: WalletProvider) => Promise<void>;
  logout: () => Promise<void>;
  // Email OTP helpers
  sendEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
}

interface LoginOptions {
  supabaseJwt?: string;
}

export function useAuth(): UseAuthReturn {
  const { client, state, setState, deviceId, handleAuthResponse, supabaseClient } = useSignaKitContext();
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (provider: OAuthProvider, options?: LoginOptions) => {
    setError(null);
    setState(prev => ({ ...prev, status: 'loading' }));

    try {
      if (provider === 'email') {
        throw new Error('Use sendEmailCode() and verifyEmailCode() for email login');
      }

      if (!options?.supabaseJwt) {
        throw new Error('supabaseJwt required. Complete Supabase Auth flow first, then pass the JWT.');
      }

      if (provider === 'google') {
        const res = await client.authGoogle(options.supabaseJwt, deviceId);
        await handleAuthResponse(res);
      } else {
        throw new Error(`${provider} login not yet implemented`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      setState(prev => ({ ...prev, status: 'unauthenticated' }));
    }
  }, [client, deviceId, handleAuthResponse, setState]);

  const sendEmailCode = useCallback(async (email: string) => {
    setError(null);
    try {
      await client.emailStart(email);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send code';
      setError(msg);
      throw err;
    }
  }, [client]);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    setError(null);
    setState(prev => ({ ...prev, status: 'loading' }));

    try {
      const res = await client.emailVerify(email, code, deviceId);
      await handleAuthResponse(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setError(msg);
      setState(prev => ({ ...prev, status: 'unauthenticated' }));
      throw err;
    }
  }, [client, deviceId, handleAuthResponse, setState]);

  const connectWallet = useCallback(async (_provider: WalletProvider) => {
    setError(null);
    setState(prev => ({ ...prev, status: 'loading' }));

    try {
      throw new Error('Use wallet connector components for wallet login');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Wallet connection failed';
      setError(msg);
      setState(prev => ({ ...prev, status: 'unauthenticated' }));
    }
  }, [setState]);

  const logout = useCallback(async () => {
    try {
      await client.logout();
    } catch {
      // Ignore logout API errors -- still clear local state
    }
    // Must sign out from Supabase too, otherwise the Google Supabase session
    // persists and the onAuthStateChange listener re-authenticates automatically
    // on the next page load, overwriting any email/other login attempt.
    if (supabaseClient) {
      try { await supabaseClient.auth.signOut(); } catch { /* non-fatal */ }
    }
    client.setToken(null);
    clearSession();
    setState({ status: 'unauthenticated', user: null, session: null });
    setError(null);
  }, [client, supabaseClient, setState]);

  return {
    status: state.status,
    user: state.user,
    error,
    login,
    connectWallet,
    logout,
    sendEmailCode,
    verifyEmailCode,
  };
}
