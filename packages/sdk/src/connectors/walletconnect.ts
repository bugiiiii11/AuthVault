/**
 * WalletConnect v2 connector.
 * Renders QR code in our own UI instead of relying on @reown/appkit modal.
 */
import type { WalletConnector, ConnectedWallet } from './types';

interface WalletConnectOptions {
  projectId: string;
  chains?: number[];
  onDisplayUri?: (uri: string) => void;
}

// Timeout for WalletConnect pairing (2 minutes)
const WC_CONNECT_TIMEOUT_MS = 120_000;

export function createWalletConnectConnector(options: WalletConnectOptions): WalletConnector {
  let provider: any = null;

  async function getProvider() {
    if (provider) return provider;

    // Dynamic import to avoid bundling if not used
    const { EthereumProvider } = await import('@walletconnect/ethereum-provider');

    provider = await EthereumProvider.init({
      projectId: options.projectId,
      chains: options.chains || [1], // Default to mainnet
      showQrModal: false, // We render our own QR code
      optionalChains: [137, 56, 42161, 10, 8453], // Polygon, BSC, Arbitrum, Optimism, Base
    });

    // Emit the pairing URI so the UI can show a QR code
    provider.on('display_uri', (uri: string) => {
      options.onDisplayUri?.(uri);
    });

    return provider;
  }

  return {
    id: 'walletconnect',
    name: 'WalletConnect',

    isInstalled(): boolean {
      return true; // WalletConnect is always available (protocol-based)
    },

    async connect(): Promise<ConnectedWallet> {
      const wc = await getProvider();

      // Clear any stale session so enable() always creates a fresh pairing
      // and fires display_uri. Without this, enable() reuses a dead session
      // from localStorage and hangs forever.
      if (wc.session) {
        try { await wc.disconnect(); } catch { /* ignore */ }
      }

      // Wrap enable() with a timeout so it can't hang forever
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
