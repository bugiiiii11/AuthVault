import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthState, AuthUser, AuthResponse } from '@authvault/types';
import { AuthVaultClient } from './core/client';
import { loadSession, loadUser, saveSession, saveUser, clearSession, getDeviceId } from './core/session';
import { generateAndDistributeKeys } from './core/keyManager';
import { getOrCreateEncryptionKey } from './core/deviceShare';

export interface AuthVaultConfig {
  backendUrl: string;
  chains: ('evm' | 'solana')[];
  walletConnectProjectId?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  theme?: Record<string, unknown>;
}

export interface AuthVaultContextValue {
  config: AuthVaultConfig;
  client: AuthVaultClient;
  state: AuthState;
  setState: (state: AuthState | ((prev: AuthState) => AuthState)) => void;
  deviceId: string;
  supabaseClient: SupabaseClient | null;
  handleAuthResponse: (res: AuthResponse) => Promise<void>;
}

const AuthVaultContext = createContext<AuthVaultContextValue | null>(null);

export function useAuthVaultContext() {
  const ctx = useContext(AuthVaultContext);
  if (!ctx) throw new Error('useAuthVaultContext must be used within AuthVaultProvider');
  return ctx;
}

interface AuthVaultProviderProps {
  children: ReactNode;
  backendUrl: string;
  chains?: ('evm' | 'solana')[];
  walletConnectProjectId?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  theme?: Record<string, unknown>;
}

export function AuthVaultProvider({
  children,
  backendUrl,
  chains = ['evm'],
  walletConnectProjectId,
  supabaseUrl,
  supabaseAnonKey,
  theme,
}: AuthVaultProviderProps) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    session: null,
  });

  const client = useMemo(() => new AuthVaultClient(backendUrl), [backendUrl]);
  const deviceId = useMemo(() => getDeviceId(), []);

  const config: AuthVaultConfig = useMemo(
    () => ({ backendUrl, chains, walletConnectProjectId, supabaseUrl, supabaseAnonKey, theme }),
    [backendUrl, chains, walletConnectProjectId, supabaseUrl, supabaseAnonKey, theme],
  );

  const supabaseClient = useMemo<SupabaseClient | null>(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey);
  }, [supabaseUrl, supabaseAnonKey]);

  /**
   * Central post-auth handler used by all login methods.
   * Saves session, updates state, and generates keys for new social/email users.
   */
  const handleAuthResponse = useCallback(async (res: AuthResponse) => {
    client.setToken(res.session.token);
    saveSession(res.session.token, res.session.expiresAt, res.session.deviceId);
    saveUser(res.user);
    setState({ status: 'authenticated', user: res.user, session: res.session });

    // Generate Shamir SSS keys for new social/email users (wallet users have their own address)
    if (res.isNew && res.user.loginMethod !== 'wallet') {
      try {
        const encKey = await getOrCreateEncryptionKey(res.user.id);
        const { evmAddress } = await generateAndDistributeKeys(client, res.user.id, encKey);
        const updatedUser = { ...res.user, evmAddress };
        saveUser(updatedUser);
        setState(prev => ({ ...prev, user: updatedUser }));
      } catch (err) {
        console.error('Key generation failed (non-fatal):', err);
      }
    }
  }, [client]);

  // Hydrate session from localStorage on mount
  useEffect(() => {
    const session = loadSession();
    if (session) {
      client.setToken(session.token);
      const cachedUser = loadUser<AuthUser>();

      if (cachedUser) {
        setState({
          status: 'authenticated',
          user: cachedUser,
          session: { token: session.token, expiresAt: session.expiresAt, deviceId: session.deviceId },
        });
      }

      // Verify session is still valid with backend
      client.getMe()
        .then(({ user }) => {
          saveUser(user);
          setState({
            status: 'authenticated',
            user,
            session: { token: session.token, expiresAt: session.expiresAt, deviceId: session.deviceId },
          });
        })
        .catch(() => {
          clearSession();
          client.setToken(null);
          setState({ status: 'unauthenticated', user: null, session: null });
        });
    } else {
      setState({ status: 'unauthenticated', user: null, session: null });
    }
  }, [client]);

  // Handle Google OAuth redirect callback via Supabase onAuthStateChange
  useEffect(() => {
    if (!supabaseClient) return;

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        if (event !== 'SIGNED_IN' || !session) return;
        if (session.user.app_metadata?.provider !== 'google') return;

        // Skip if we already have an AuthVault session for this user
        const existing = loadSession();
        if (existing) return;

        try {
          const res = await client.authGoogle(session.access_token, deviceId);
          await handleAuthResponse(res);
        } catch (err) {
          console.error('Google OAuth callback failed:', err);
          setState(prev => ({ ...prev, status: 'unauthenticated' }));
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [supabaseClient, client, deviceId, handleAuthResponse]);

  return (
    <AuthVaultContext.Provider value={{ config, client, state, setState, deviceId, supabaseClient, handleAuthResponse }}>
      {children}
    </AuthVaultContext.Provider>
  );
}
