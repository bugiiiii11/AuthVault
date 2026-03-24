import { useCallback } from 'react';
import { useAuthVaultContext } from '../AuthVaultProvider';
import type { OAuthProvider, WalletProvider } from '@authvault/types';

export function useAuth() {
  const { state, setState } = useAuthVaultContext();

  const login = useCallback(async (_provider: OAuthProvider) => {
    // TODO: Implement OAuth flow
    setState({ ...state, status: 'loading' });
  }, [state, setState]);

  const connectWallet = useCallback(async (_provider: WalletProvider) => {
    // TODO: Implement wallet connection
    setState({ ...state, status: 'loading' });
  }, [state, setState]);

  const logout = useCallback(async () => {
    setState({ status: 'unauthenticated', user: null, session: null });
  }, [setState]);

  return {
    status: state.status,
    user: state.user,
    session: state.session,
    login,
    connectWallet,
    logout,
  };
}
