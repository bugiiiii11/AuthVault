import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import type { AuthState, AuthUser } from '@authvault/types';
import { AuthVaultClient } from './core/client';
import { loadSession, loadUser, saveSession, saveUser, clearSession, getDeviceId } from './core/session';

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
          // Session invalid, clear and set unauthenticated
          clearSession();
          client.setToken(null);
          setState({ status: 'unauthenticated', user: null, session: null });
        });
    } else {
      setState({ status: 'unauthenticated', user: null, session: null });
    }
  }, [client]);

  return (
    <AuthVaultContext.Provider value={{ config, client, state, setState, deviceId }}>
      {children}
    </AuthVaultContext.Provider>
  );
}
