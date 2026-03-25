/**
 * HTTP client for AuthVault backend API.
 */
import type { AuthResponse, EmailStartResponse, NonceResponse, AuthVaultError, HealthResponse } from '@authvault/types';

export class AuthVaultClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  setToken(token: string | null) {
    this.token = token;
  }

  // -- Auth endpoints --

  async authGoogle(supabaseJwt: string, deviceId: string): Promise<AuthResponse> {
    return this.post('/api/auth/google', { supabaseJwt, deviceId });
  }

  async emailStart(email: string): Promise<EmailStartResponse> {
    return this.post('/api/auth/email/start', { email });
  }

  async emailVerify(email: string, code: string, deviceId: string): Promise<AuthResponse> {
    return this.post('/api/auth/email/verify', { email, code, deviceId });
  }

  async siweNonce(address: string): Promise<NonceResponse> {
    return this.post('/api/auth/siwe/nonce', { address });
  }

  async siweVerify(message: string, signature: string, deviceId: string): Promise<AuthResponse> {
    return this.post('/api/auth/siwe/verify', { message, signature, deviceId });
  }

  async getMe(): Promise<{ user: AuthResponse['user'] }> {
    return this.get('/api/auth/me');
  }

  async logout(): Promise<void> {
    await this.delete('/api/auth');
  }

  // -- Key endpoints (seamless mode) --

  /**
   * Ask the server to generate (or confirm) the user's wallet key.
   * Idempotent: safe to call on every login.
   */
  async generateKey(): Promise<{ success: boolean; evmAddress: string }> {
    return this.post('/api/keys/generate', {});
  }

  /**
   * Retrieve the private key sealed for this device.
   * @param clientPublicKey - hex-encoded X25519 public key (32 bytes = 64 hex chars)
   */
  async deviceInit(clientPublicKey: string): Promise<{
    serverPublicKey: string;
    encryptedKey: string;
    iv: string;
    tag: string;
  }> {
    return this.post('/api/keys/device-init', { clientPublicKey });
  }

  // -- Legacy SSS key methods (sovereign mode, not used by default) --
  // These methods reference backend routes that are no longer registered in seamless mode.
  // Kept for future `mode: 'sovereign'` SaaS use; calling them will return 404.

  /** @deprecated Use generateKey() instead (seamless mode). */
  async storeShares(data: {
    encryptedShares: { server: { ciphertext: string; nonce: string }; recovery: { ciphertext: string; nonce: string } };
    publicKeys: { evm?: string; solana?: string };
    curve?: string;
  }): Promise<{ success: boolean }> {
    return this.post('/api/keys/generate-sss', data);
  }

  /** @deprecated Not available in seamless mode. */
  async getServerShare(curve = 'secp256k1'): Promise<{ encryptedShare: string; nonce: string }> {
    return this.get(`/api/keys/server-share?curve=${curve}`);
  }

  /** @deprecated Not available in seamless mode. */
  async storeRecoveryBundle(data: {
    curve?: string;
    kdfSalt: string;
    ciphertext: string;
    nonce: string;
  }): Promise<{ success: boolean }> {
    return this.post('/api/keys/recovery-bundle', data);
  }

  /** @deprecated Not available in seamless mode. */
  async getRecoveryBundle(curve = 'secp256k1'): Promise<{ kdfSalt: string; ciphertext: string; nonce: string }> {
    return this.get(`/api/keys/recovery-bundle?curve=${curve}`);
  }

  /** @deprecated Not available in seamless mode. */
  async updateServerShareAfterRecovery(data: {
    curve?: string;
    encryptedServerShare: { ciphertext: string; nonce: string };
  }): Promise<{ success: boolean }> {
    return this.post('/api/keys/recover', data);
  }

  // -- Health --

  async health(): Promise<HealthResponse> {
    return this.get('/api/health');
  }

  // -- HTTP helpers --

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: this.headers(),
      credentials: 'include',
    });
    return this.handleResponse<T>(res);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    return this.handleResponse<T>(res);
  }

  private async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.headers(),
      credentials: 'include',
    });
    return this.handleResponse<T>(res);
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    const data = await res.json();
    if (!res.ok) {
      const err = data as AuthVaultError;
      throw new AuthVaultAPIError(
        err.error?.code || 'UNKNOWN',
        err.error?.message || 'Request failed',
        err.error?.userMessage || 'Something went wrong.',
        err.error?.retryable ?? false,
        res.status,
      );
    }
    return data as T;
  }
}

export class AuthVaultAPIError extends Error {
  constructor(
    public code: string,
    message: string,
    public userMessage: string,
    public retryable: boolean,
    public status: number,
  ) {
    super(message);
    this.name = 'AuthVaultAPIError';
  }
}
