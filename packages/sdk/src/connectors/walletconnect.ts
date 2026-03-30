/**
 * WalletConnect v2 connector.
 * Uses @walletconnect/ethereum-provider with built-in QR modal.
 */
import type { WalletConnector, ConnectedWallet } from './types';

interface WalletConnectOptions {
  projectId: string;
  /** Primary EVM chain IDs (default: [137] Polygon). Wallet will connect on these chains. */
  chains?: number[];
  /** Additional supported chains (default: [1, 56, 42161, 10, 8453]). */
  optionalChains?: number[];
}

// Timeout for WalletConnect pairing (2 minutes)
const WC_CONNECT_TIMEOUT_MS = 120_000;

/**
 * Clear WalletConnect localStorage keys (sync, no deadlock risk).
 * IndexedDB is intentionally NOT deleted here -- deleting databases while
 * the old provider still has open connections causes an IndexedDB deadlock
 * that blocks EthereumProvider.init() indefinitely.
 */
function clearWalletConnectLocalStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('wc@') || key.startsWith('walletconnect') || key.startsWith('WALLETCONNECT'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch { /* non-fatal */ }
}

export function createWalletConnectConnector(options: WalletConnectOptions): WalletConnector {
  let provider: any = null;

  return {
    id: 'walletconnect',
    name: 'WalletConnect',

    isInstalled(): boolean {
      return true; // WalletConnect is always available (protocol-based)
    },

    async connect(): Promise<ConnectedWallet> {
      // Step 1: Fire-and-forget disconnect on the old provider.
      // Do NOT await -- disconnect() can hang if the relay is unresponsive,
      // and awaiting it while the provider holds IndexedDB connections open
      // will deadlock any subsequent IndexedDB operations.
      if (provider) {
        const old = provider;
        provider = null;
        // Fire and forget: best-effort cleanup, no await
        old.disconnect().catch(() => {});
        // Force-close the relay WebSocket so it doesn't send stale messages
        try { old.signer?.client?.core?.relayer?.provider?.connection?.close(); } catch { /* ignore */ }
      }

      // Step 2: Clear localStorage (sync, safe)
      clearWalletConnectLocalStorage();

      // Step 3: Create a fresh provider.
      // init() may restore a stale session from IndexedDB -- that's fine,
      // we'll clean it up before calling enable().
      const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
      const wc = await EthereumProvider.init({
        projectId: options.projectId,
        chains: options.chains || [137], // Polygon by default -- avoids chain-switch race
        showQrModal: true,
        optionalChains: (options.optionalChains || [1, 56, 42161, 10, 8453]) as [number, ...number[]],
        metadata: {
          name: 'Swarm Resistance',
          description: 'Swarm Resistance Gaming Platform',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://swarmresistance.com',
          icons: ['https://swarmresistance.com/Favicon.png'],
        },
      });

      // Step 4: If init() restored a stale session, disconnect it on the
      // new provider so enable() creates a fresh pairing with QR modal.
      if (wc.session) {
        try { await wc.disconnect(); } catch { /* ignore */ }
      }

      provider = wc;

      // Step 5: enable() triggers a new pairing and shows the QR modal
      const accounts = await Promise.race([
        wc.enable(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('WalletConnect connection timed out. Please try again.')), WC_CONNECT_TIMEOUT_MS)
        ),
      ]);

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from WalletConnect');
      }

      const chainId = wc.chainId || 1;

      return {
        address: accounts[0].toLowerCase(),
        chainId,
        connector: 'walletconnect',
      };
    },

    async disconnect(): Promise<void> {
      if (provider) {
        try { await provider.disconnect(); } catch { /* ignore */ }
        provider = null;
      }
    },

    async signMessage(message: string): Promise<string> {
      if (!provider) {
        throw new Error('WalletConnect not connected');
      }

      const accounts = provider.accounts as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts available');
      }

      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, accounts[0]],
      });

      return signature as string;
    },

    onAccountsChanged(callback: (accounts: string[]) => void) {
      provider?.on('accountsChanged', callback);
    },

    onChainChanged(callback: (chainId: string) => void) {
      provider?.on('chainChanged', callback);
    },
  };
}
