import { useCallback, useState } from 'react';
import { useAuthVaultContext } from '../AuthVaultProvider';
import { saveSession, saveUser, clearSession } from '../core/session';
import type { OAuthProvider, WalletProvider, AuthResponse } from '@authvault/types';

export interface UseAuthReturn {
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  user: AuthResponse['user'] | null;
  error: string | null;
  login: (provider: OAuthProvider, options?: LoginOptions) => Promise<void>;
  connectWallet: (provider: WalletProvider) => Promise<void>;
  logout: () => Promise<void>;
  // Email OTP helpers
  sendEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
}

interface LoginOptions {
  supabaseJwt?: string; // Pre-obtained Supabase JWT (from frontend Supabase Auth)
}

export function useAuth(): UseAuthReturn {
  const { client, state, setState, deviceId } = useAuthVaultContext();
  const [error, setError] = useState<string | null>(null);

  const handleAuthResponse = useCallback((res: AuthResponse) => {
    client.setToken(res.session.token);
    saveSession(res.session.token, res.session.expiresAt, res.session.deviceId);
    saveUser(res.user);
    setState({
      status: 'authenticated',
      user: res.user,
      session: res.session,
    });
    setError(null);
  }, [client, setState]);

  const login = useCallback(async (provider: OAuthProvider, options?: LoginOptions) => {
    setError(null);
    setState(prev => ({ ...prev, status: 'loading' }));

    try {
      if (provider === 'email') {
        // Email is two-step, handled by sendEmailCode + verifyEmailCode
        throw new Error('Use sendEmailCode() and verifyEmailCode() for email login');
      }

      if (!options?.supabaseJwt) {
        throw new Error('supabaseJwt required. Complete Supabase Auth flow first, then pass the JWT.');
      }

      // Google, Apple, X -- all go through the same pattern
      let res: AuthResponse;
      switch (provider) {
        case 'google':
          res = await client.authGoogle(options.supabaseJwt, deviceId);
          break;
        case 'apple':
        case 'x':
          // Apple and X use the same backend pattern (Supabase JWT verification)
          // Backend routes to be added for these providers
          throw new Error(`${provider} login not yet implemented`);
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      handleAuthResponse(res);
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
      handleAuthResponse(res);
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
      // Wallet connection is handled by the connector components
      // They call client.siweNonce() and client.siweVerify() directly
      // This is a placeholder for the connector abstraction
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
    client.setToken(null);
    clearSession();
    setState({ status: 'unauthenticated', user: null, session: null });
    setError(null);
  }, [client, setState]);

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
