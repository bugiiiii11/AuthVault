// AuthVault SDK - Main exports

// Provider
export { AuthVaultProvider } from './AuthVaultProvider';
export type { AuthVaultConfig, AuthVaultContextValue } from './AuthVaultProvider';

// Hooks
export { useAuth } from './hooks/useAuth';
export { useWallet } from './hooks/useWallet';
export { useSigning } from './hooks/useSigning';

// Components
export { LoginModal } from './components/LoginModal';

// Connectors
export { createMetaMaskConnector } from './connectors/metamask';
export { createWalletConnectConnector } from './connectors/walletconnect';
export { createCoinbaseConnector } from './connectors/coinbase';
export type { WalletConnector, ConnectedWallet } from './connectors/types';

// Core utilities
export { AuthVaultClient, AuthVaultAPIError } from './core/client';
export { getDeviceId, loadSession, clearSession } from './core/session';
export { storeDeviceShare, getDeviceShare, hasDeviceShare, clearAllShares } from './core/deviceShare';
export { generateAndDistributeKeys } from './core/keyManager';

// Crypto
export { split, combine, zeroBytes } from './crypto/shamir';
export { encrypt, decrypt, generateKey } from './crypto/encryption';
export { generateEVMKeyPair, deriveEVMAddress } from './crypto/keygen';

// Re-export types
export type {
  AuthUser, AuthSession, AuthState, AuthStatus,
  OAuthProvider, WalletProvider, LoginMethod,
  KeyPair, Share, EncryptedShare, SplitResult,
  AuthResponse, AuthVaultError,
} from '@authvault/types';
