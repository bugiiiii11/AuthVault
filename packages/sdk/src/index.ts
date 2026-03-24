// AuthVault SDK - Main exports

// Provider
export { AuthVaultProvider } from './AuthVaultProvider';
export type { AuthVaultConfig, AuthVaultContextValue } from './AuthVaultProvider';

// Hooks
export { useAuth } from './hooks/useAuth';
export { useSigning } from './hooks/useSigning';

// Components
export { LoginModal } from './components/LoginModal';

// Core utilities
export { AuthVaultClient, AuthVaultAPIError } from './core/client';
export { getDeviceId, loadSession, clearSession } from './core/session';
export { storeDeviceShare, getDeviceShare, hasDeviceShare, clearAllShares } from './core/deviceShare';

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
