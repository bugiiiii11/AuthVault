import { useCallback } from 'react';
import { useAuthVaultContext } from '../AuthVaultProvider';

export function useSigning() {
  const { state } = useAuthVaultContext();

  const signTransaction = useCallback(async (_txData: unknown) => {
    // TODO: Implement SSS reconstruction + signing in Web Worker
    throw new Error('Not implemented');
  }, []);

  return {
    signTransaction,
    isSigningSupported: state.status === 'authenticated',
  };
}
