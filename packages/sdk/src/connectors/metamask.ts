/**
 * MetaMask connector using EIP-6963 provider discovery.
 * Falls back to window.ethereum detection.
 */
import type { WalletConnector, ConnectedWallet, EIP1193Provider, EIP6963ProviderDetail } from './types';

let detectedProvider: EIP1193Provider | null = null;
let eip6963Providers: EIP6963ProviderDetail[] = [];

// Listen for EIP-6963 provider announcements
if (typeof window !== 'undefined') {
  window.addEventListener('eip6963:announceProvider', ((event: CustomEvent<EIP6963ProviderDetail>) => {
    const detail = event.detail;
    if (detail.info.rdns === 'io.metamask' || detail.info.name.toLowerCase().includes('metamask')) {
      eip6963Providers.push(detail);
    }
  }) as EventListener);

  // Request providers
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

function getProvider(): EIP1193Provider | null {
  // Prefer EIP-6963 discovered provider
  if (eip6963Providers.length > 0) {
    return eip6963Providers[0].provider;
  }

  // Fallback to window.ethereum
  const ethereum = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  if (ethereum) {
    return ethereum;
  }

  return null;
}

export function createMetaMaskConnector(): WalletConnector {
  return {
    id: 'metamask',
    name: 'MetaMask',

    isInstalled(): boolean {
      return getProvider() !== null;
    },

    async connect(): Promise<ConnectedWallet> {
      const provider = getProvider();
      if (!provider) {
        throw new Error('MetaMask not installed. Please install MetaMask to continue.');
      }

      detectedProvider = provider;

      // Request accounts
      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      }) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask');
      }

      // Get chain ID
      const chainIdHex = await provider.request({
        method: 'eth_chainId',
      }) as string;

      const chainId = parseInt(chainIdHex, 16);

      return {
        address: accounts[0].toLowerCase(),
        chainId,
        connector: 'metamask',
      };
    },

    async disconnect(): Promise<void> {
      detectedProvider = null;
    },

    async signMessage(message: string): Promise<string> {
      if (!detectedProvider) {
        throw new Error('MetaMask not connected');
      }

      const accounts = await detectedProvider.request({
        method: 'eth_accounts',
      }) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts available');
      }

      const signature = await detectedProvider.request({
        method: 'personal_sign',
        params: [message, accounts[0]],
      }) as string;

      return signature;
    },

    onAccountsChanged(callback: (accounts: string[]) => void) {
      detectedProvider?.on('accountsChanged', callback as (...args: unknown[]) => void);
    },

    onChainChanged(callback: (chainId: string) => void) {
      detectedProvider?.on('chainChanged', callback as (...args: unknown[]) => void);
    },
  };
}
