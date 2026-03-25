/**
 * Shared types for wallet connectors.
 */

export interface WalletConnector {
  id: string;
  name: string;
  icon?: string;
  isInstalled: () => boolean;
  connect: () => Promise<ConnectedWallet>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  onAccountsChanged?: (callback: (accounts: string[]) => void) => void;
  onChainChanged?: (callback: (chainId: string) => void) => void;
}

export interface ConnectedWallet {
  address: string;
  chainId: number;
  connector: string;
}

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: EIP1193Provider;
}

export interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
}
