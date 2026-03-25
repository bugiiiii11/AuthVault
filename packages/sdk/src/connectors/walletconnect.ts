/**
 * WalletConnect v2 connector.
 * Uses @walletconnect/modal for QR code display.
 */
import type { WalletConnector, ConnectedWallet } from './types';

interface WalletConnectOptions {
  projectId: string;
  chains?: number[];
}

export function createWalletConnectConnector(options: WalletConnectOptions): WalletConnector {
  let provider: any = null;
  let modal: any = null;

  async function getProvider() {
    if (provider) return provider;

    // Dynamic import to avoid bundling if not used
    const { EthereumProvider } = await import('@walletconnect/ethereum-provider');

    provider = await EthereumProvider.init({
      projectId: options.projectId,
      chains: options.chains || [1], // Default to mainnet
      showQrModal: true,
      optionalChains: [137, 56, 42161, 10, 8453], // Polygon, BSC, Arbitrum, Optimism, Base
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

      // Enable will show the QR modal
      const accounts = await wc.enable();

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
        await provider.disconnect();
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
