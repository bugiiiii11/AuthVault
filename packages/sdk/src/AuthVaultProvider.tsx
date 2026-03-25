import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthState, AuthUser, AuthResponse } from '@authvault/types';
import { AuthVaultClient } from './core/client';
import { loadSession, loadUser, saveSession, saveUser, clearSession, getDeviceId } from './core/session';
import { getOrCreateEncryptionKey } from './core/deviceShare';
import { storePrivateKey, hasPrivateKey } from './core/privateKeyStore';

// libsodium loaded dynamically (same pattern as encryption.ts)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sodium: any;
async function getSodium() {
  if (!_sodium) {
    const mod = await import('libsodium-wrappers');
    _sodium = mod.default || mod;
    await _sodium.ready;
  }
  return _sodium;
}

export interface AuthVaultConfig {
  backendUrl: string;
  chains: ('evm' | 'solana')[];
  walletConnectProjectId?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  theme?: Record<string, unknown>;
}

export interface AuthVaultContextValue {
  config: AuthVaultConfig;
  client: AuthVaultClient;
  state: AuthState;
  setState: (state: AuthState | ((prev: AuthState) => AuthState)) => void;
  deviceId: string;
  supabaseClient: SupabaseClient | null;
  handleAuthResponse: (res: AuthResponse) => Promise<void>;
}

const AuthVaultContext = createContext<AuthVaultContextValue | null>(null);

export function useAuthVaultContext() {
  const ctx = useContext(AuthVaultContext);
  if (!ctx) throw new Error('useAuthVaultContext must be used within AuthVaultProvider');
  return ctx;
}

interface AuthVaultProviderProps {
  children: ReactNode;
  backendUrl: string;
  chains?: ('evm' | 'solana')[];
  walletConnectProjectId?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  theme?: Record<string, unknown>;
}

export function AuthVaultProvider({
  children,
  backendUrl,
  chains = ['evm'],
  walletConnectProjectId,
  supabaseUrl,
  supabaseAnonKey,
  theme,
}: AuthVaultProviderProps) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    session: null,
  });

  const client = useMemo(() => new AuthVaultClient(backendUrl), [backendUrl]);
  const deviceId = useMemo(() => getDeviceId(), []);

  const config: AuthVaultConfig = useMemo(
    () => ({ backendUrl, chains, walletConnectProjectId, supabaseUrl, supabaseAnonKey, theme }),
    [backendUrl, chains, walletConnectProjectId, supabaseUrl, supabaseAnonKey, theme],
  );

  const supabaseClient = useMemo<SupabaseClient | null>(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey);
  }, [supabaseUrl, supabaseAnonKey]);

  /**
   * Ensure the private key is stored in IndexedDB for this user.
   * Called on every social/email login and on hydration if key is missing.
   *
   * Steps:
   *   1. Call POST /api/keys/generate  -- idempotent, ensures key exists in Vault.
   *   2. Call POST /api/keys/device-init with an ephemeral X25519 pubkey.
   *   3. Unseal the response with the X25519 private key (libsodium crypto_box_seal_open).
   *   4. Re-encrypt and store in IndexedDB.
   */
  const ensureLocalKey = useCallback(async (userId: string): Promise<string | null> => {
    try {
      // Step 1: ensure key exists server-side, get EVM address
      const { evmAddress } = await client.generateKey();

      // Step 2: generate ephemeral X25519 keypair
      const sodium = await getSodium();
      const ephemeral = sodium.crypto_box_keypair();
      const pubKeyHex = sodium.to_hex(ephemeral.publicKey);

      // Step 3: get sealed private key from server
      const { encryptedKey } = await client.deviceInit(pubKeyHex);

      // Step 4: unseal
      const sealedBytes = sodium.from_hex(encryptedKey);
      const privateKeyBytes = sodium.crypto_box_seal_open(
        sealedBytes,
        ephemeral.publicKey,
        ephemeral.privateKey,
      );

      if (!privateKeyBytes) throw new Error('Failed to unseal private key');

      // Step 5: store encrypted in IndexedDB
      await storePrivateKey(userId, 'secp256k1', privateKeyBytes);

      return evmAddress;
    } catch (err) {
      console.error('ensureLocalKey failed:', err);
      return null;
    }
  }, [client]);

  /**
   * Central post-auth handler used by all login methods.
   */
  const handleAuthResponse = useCallback(async (res: AuthResponse) => {
    client.setToken(res.session.token);
    saveSession(res.session.token, res.session.expiresAt, res.session.deviceId);
    saveUser(res.user);
    setState({ status: 'authenticated', user: res.user, session: res.session });

    // Wallet users manage their own keys -- nothing to do
    if (res.user.loginMethod === 'wallet') return;

    const alreadyHasKey = await hasPrivateKey(res.user.id, 'secp256k1');
    if (alreadyHasKey) return;

    // New device or first login: fetch key from server
    const evmAddress = await ensureLocalKey(res.user.id);
    if (evmAddress) {
      const updatedUser = { ...res.user, evmAddress };
      saveUser(updatedUser);
      setState(prev => ({ ...prev, user: updatedUser }));
    }
  }, [client, ensureLocalKey]);

  // Hydrate session from localStorage on mount
  useEffect(() => {
    const session = loadSession();
    if (session) {
      client.setToken(session.token);
      const cachedUser = loadUser<AuthUser>();

      if (cachedUser) {
        setState({
          status: 'authenticated',
          user: cachedUser,
          session: { token: session.token, expiresAt: session.expiresAt, deviceId: session.deviceId },
        });
      }

      // Verify session is still valid with backend
      client.getMe()
        .then(async ({ user }) => {
          saveUser(user);
          setState({
            status: 'authenticated',
            user,
            session: { token: session.token, expiresAt: session.expiresAt, deviceId: session.deviceId },
          });

          // For social/email users: ensure private key is in IndexedDB
          if (user.loginMethod !== 'wallet') {
            const hasKey = await hasPrivateKey(user.id, 'secp256k1');
            if (!hasKey) {
              const evmAddress = await ensureLocalKey(user.id);
              if (evmAddress) {
                const updatedUser = { ...user, evmAddress };
                saveUser(updatedUser);
                setState(prev => ({ ...prev, user: updatedUser }));
              }
            }
          }
        })
        .catch(() => {
          clearSession();
          client.setToken(null);
          setState({ status: 'unauthenticated', user: null, session: null });
        });
    } else {
      setState({ status: 'unauthenticated', user: null, session: null });
    }
  }, [client, ensureLocalKey]);

  // Handle Google OAuth redirect callback via Supabase onAuthStateChange
  useEffect(() => {
    if (!supabaseClient) return;

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        if (event !== 'SIGNED_IN' || !session) return;
        if (session.user.app_metadata?.provider !== 'google') return;

        // Skip if we already have an AuthVault session for this user
        const existing = loadSession();
        if (existing) return;

        try {
          const res = await client.authGoogle(session.access_token, deviceId);
          await handleAuthResponse(res);
        } catch (err) {
          console.error('Google OAuth callback failed:', err);
          setState(prev => ({ ...prev, status: 'unauthenticated' }));
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [supabaseClient, client, deviceId, handleAuthResponse]);

  return (
    <AuthVaultContext.Provider value={{
      config,
      client,
      state,
      setState,
      deviceId,
      supabaseClient,
      handleAuthResponse,
    }}>
      {children}
    </AuthVaultContext.Provider>
  );
}
