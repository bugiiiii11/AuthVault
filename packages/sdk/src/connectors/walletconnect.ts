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
 * Await IndexedDB database deletion (wraps IDBOpenDBRequest in a promise).
 */
function deleteIDB(name: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve(); // non-fatal
      req.onblocked = () => resolve(); // don't hang if blocked
    } catch {
      resolve();
    }
  });
}

/**
 * Nuke ALL WalletConnect storage (localStorage + IndexedDB).
 * Must complete BEFORE EthereumProvider.init() runs, because init
 * restores stale sessions and fires "Pending session not found" errors.
 */
async function clearAllWalletConnectStorage(): Promise<void> {
  // 1. Clear localStorage (sync)
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

  // 2. Delete IndexedDB databases (async -- must await before provider init)
  try {
    const deletions: Promise<void>[] = [];

    if (typeof indexedDB.databases === 'function') {
      // Chrome/Edge: enumerate and delete all WC databases
      const allDbs = await indexedDB.databases();
      for (const db of allDbs) {
        if (db.name && (
          db.name.includes('walletconnect') ||
          db.name.includes('WALLET_CONNECT') ||
          db.name.startsWith('wc@')
        )) {
          deletions.push(deleteIDB(db.name));
        }
      }
    } else {
      // Fallback: delete known database names
      const knownDbs = [
        'WALLET_CONNECT_V2_INDEXED_DB',
        'walletconnect',
        'wc@2:core:0.3//keychain',
        'wc@2:core:0.3//messages',
        'wc@2:core:0.3//subscription',
        'wc@2:core:0.3//history',
        'wc@2:core:0.3//expirer',
        'wc@2:core:0.3//pairing',
        'wc@2:universal_provider',
      ];
      for (const name of knownDbs) {
        deletions.push(deleteIDB(name));
      }
    }

    await Promise.all(deletions);
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
      // Step 1: Nuke all stale WC data BEFORE creating the provider.
      // EthereumProvider.init() restores sessions on creation, so stale
      // data must be gone before that call.
      await clearAllWalletConnectStorage();

      // Step 2: Always create a fresh provider
      provider = null;

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
      provider = wc;

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
