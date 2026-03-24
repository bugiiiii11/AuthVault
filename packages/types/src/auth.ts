export type OAuthProvider = 'google' | 'apple' | 'x' | 'email';
export type WalletProvider = 'metamask' | 'phantom' | 'walletconnect' | 'coinbase';
export type LoginMethod = 'social' | 'wallet';
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthUser {
  id: string;
  email?: string;
  oauthProvider?: OAuthProvider;
  loginMethod: LoginMethod;
  evmAddress?: string;
  solanaAddress?: string;
  recoveryConfigured: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  deviceId: string;
}

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  session: AuthSession | null;
}
