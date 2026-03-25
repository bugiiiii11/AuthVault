/**
 * Coinbase Wallet connector.
 */
import type { WalletConnector, ConnectedWallet } from './types';

interface CoinbaseOptions {
  appName: string;
  appLogoUrl?: string;
}

export function createCoinbaseConnector(options: CoinbaseOptions): WalletConnector {
  let provider: any = null;

  async function getProvider() {
    if (provider) return provider;

    const { CoinbaseWalletSDK } = await import('@coinbase/wallet-sdk');
    const sdk = new CoinbaseWalletSDK({
      appName: options.appName,
      appLogoUrl: options.appLogoUrl,
    });

    provider = sdk.makeWeb3Provider();
    return provider;
  }

  return {
    id: 'coinbase',
    name: 'Coinbase Wallet',

    isInstalled(): boolean {
      return true; // SDK creates its own provider
    },

    async connect(): Promise<ConnectedWallet> {
      const cb = await getProvider();

      const accounts = await cb.request({
        method: 'eth_requestAccounts',
      }) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from Coinbase Wallet');
      }

      const chainIdHex = await cb.request({
        method: 'eth_chainId',
      }) as string;

      return {
        address: accounts[0].toLowerCase(),
        chainId: parseInt(chainIdHex, 16),
        connector: 'coinbase',
      };
    },

    async disconnect(): Promise<void> {
      if (provider) {
        await provider.disconnect?.();
        provider = null;
      }
    },

    async signMessage(message: string): Promise<string> {
      if (!provider) throw new Error('Coinbase Wallet not connected');

      const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, accounts[0]],
      });

      return signature as string;
    },
  };
}
