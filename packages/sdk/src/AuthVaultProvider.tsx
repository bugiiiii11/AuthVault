import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AuthState } from '@authvault/types';

interface AuthVaultConfig {
  backendUrl: string;
  chains?: ('evm' | 'solana')[];
  walletConnectProjectId?: string;
  theme?: Record<string, unknown>;
}

interface AuthVaultContextValue {
  config: AuthVaultConfig;
  state: AuthState;
  setState: (state: AuthState) => void;
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
  theme?: Record<string, unknown>;
}

export function AuthVaultProvider({
  children,
  backendUrl,
  chains = ['evm'],
  walletConnectProjectId,
  theme,
}: AuthVaultProviderProps) {
  const [state, setState] = useState<AuthState>({
    status: 'idle',
    user: null,
    session: null,
  });

  const config: AuthVaultConfig = { backendUrl, chains, walletConnectProjectId, theme };

  return (
    <AuthVaultContext.Provider value={{ config, state, setState }}>
      {children}
    </AuthVaultContext.Provider>
  );
}
