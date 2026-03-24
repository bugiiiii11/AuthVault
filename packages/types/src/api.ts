import type { AuthUser, AuthSession } from './auth';

// -- Auth responses --

export interface AuthResponse {
  user: AuthUser;
  session: AuthSession;
  isNew: boolean;
}

export interface NonceResponse {
  nonce: string;
}

export interface EmailStartResponse {
  requestId: string;
}

// -- Key management responses --

export interface KeyGenerateRequest {
  encryptedShares: {
    server: { ciphertext: string; nonce: string };
    recovery: { ciphertext: string; nonce: string };
  };
  publicKeys: {
    evm?: string;
    solana?: string;
  };
}

export interface ServerShareResponse {
  encryptedShare: string;
  nonce: string;
}

// -- Error response --

export interface AuthVaultError {
  error: {
    code: string;
    message: string;
    userMessage: string;
    retryable: boolean;
  };
}

// -- Health --

export interface HealthResponse {
  status: 'ok';
  version: string;
}
