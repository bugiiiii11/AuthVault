/**
 * useWallet hook -- connects external wallets and authenticates via SIWE.
 */
import { useCallback, useState, useMemo, useRef } from 'react';
import { useSignaKitContext } from '../SignaKitProvider';
import { getDeviceId } from '../core/session';
import { createMetaMaskConnector } from '../connectors/metamask';
import { createWalletConnectConnector } from '../connectors/walletconnect';
import { createCoinbaseConnector } from '../connectors/coinbase';
import type { WalletConnector, ConnectedWallet } from '../connectors/types';
import type { WalletProvider } from '@signakit/types';

export function useWallet() {
  const { config, client, setState, handleAuthResponse } = useSignaKitContext();
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [wcUri, setWcUri] = useState<string | null>(null);

  // Use ref to give the connector a stable callback that always calls the latest setWcUri
  const wcUriCallbackRef = useRef<(uri: string) => void>((uri) => setWcUri(uri));
  wcUriCallbackRef.current = (uri) => setWcUri(uri);

  const connectors = useMemo(() => {
    const map: Partial<Record<WalletProvider, WalletConnector>> = {
      metamask: createMetaMaskConnector(),
    };

    if (config.walletConnectProjectId) {
      map.walletconnect = createWalletConnectConnector({
        projectId: config.walletConnectProjectId,
        onDisplayUri: (uri) => wcUriCallbackRef.current(uri),
      });
    }

    map.coinbase = createCoinbaseConnector({ appName: 'Swarm Resistance' });

    return map;
  }, [config.walletConnectProjectId]);

  const connect = useCallback(async (provider: WalletProvider) => {
    const connector = connectors[provider];
    if (!connector) {
      setError(`${provider} connector not available`);
      return;
    }

    setError(null);
    setIsConnecting(true);
    setWcUri(null);
    setState(prev => ({ ...prev, status: 'loading' }));

    try {
      // Step 1: Connect wallet
      const wallet: ConnectedWallet = await connector.connect();

      // Clear QR once connected
      setWcUri(null);

      // Step 2: Request SIWE nonce from backend
      const { nonce } = await client.siweNonce(wallet.address);

      // Step 3: Construct SIWE message
      const domain = typeof window !== 'undefined' ? window.location.host : 'localhost';
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
      const issuedAt = new Date().toISOString();

      const message = [
        `${domain} wants you to sign in with your Ethereum account:`,
        wallet.address,
        '',
        'Sign in to Swarm Resistance',
        '',
        `URI: ${origin}`,
        `Version: 1`,
        `Chain ID: ${wallet.chainId}`,
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
      ].join('\n');

      // Step 4: Sign message
      const signature = await connector.signMessage(message);

      // Step 5: Verify with backend and set auth state
      const deviceId = getDeviceId();
      const res = await client.siweVerify(message, signature, deviceId);
      await handleAuthResponse(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Wallet connection failed';
      setError(msg);
      setWcUri(null);
      setState(prev => ({ ...prev, status: 'unauthenticated' }));
    } finally {
      setIsConnecting(false);
    }
  }, [connectors, client, handleAuthResponse, setState]);

  return {
    connect,
    connectors,
    isConnecting,
    error,
    wcUri,
  };
}
