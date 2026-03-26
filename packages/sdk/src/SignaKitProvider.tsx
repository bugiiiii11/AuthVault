import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthState, AuthUser, AuthResponse } from '@signakit/types';
import { SignaKitClient } from './core/client';
import { loadSession, loadUser, saveSession, saveUser, clearSession, getDeviceId } from './core/session';
import { storePrivateKey, hasPrivateKey } from './core/privateKeyStore';

// -- Transport decryption helpers (Web Crypto API, no libsodium needed) --

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate an ephemeral X25519 keypair for transport key exchange.
 */
async function generateTransportKeypair(): Promise<{
  publicKeyHex: string;
  keypair: CryptoKeyPair;
}> {
  // X25519 is not in older TS lib types -- cast through unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keypair = await (crypto.subtle as any).generateKey(
    { name: 'X25519' },
    true,
    ['deriveBits'],
  ) as CryptoKeyPair;
  const pubRaw = await crypto.subtle.exportKey('raw', keypair.publicKey);
  return { publicKeyHex: bytesToHex(new Uint8Array(pubRaw)), keypair };
}

/**
 * Decrypt the private key returned by POST /api/keys/device-init.
 * Mirrors the server-side X25519 ECDH + HKDF + AES-256-GCM operation.
 */
async function unsealPrivateKey(
  serverPublicKey: string,
  encryptedKey: string,
  iv: string,
  tag: string,
  clientKeypair: CryptoKeyPair,
): Promise<Uint8Array> {
  // X25519 not in all TS lib versions -- cast through any where needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subtle = crypto.subtle as any;

  // Import server's ephemeral X25519 public key (raw 32 bytes)
  const serverPub = await subtle.importKey(
    'raw',
    hexToBytes(serverPublicKey),
    { name: 'X25519' },
    false,
    [],
  ) as CryptoKey;

  // ECDH: derive shared bits
  const sharedBits = await subtle.deriveBits(
    { name: 'X25519', public: serverPub },
    clientKeypair.privateKey,
    256,
  ) as ArrayBuffer;

  // HKDF → AES-256 key (matches server: hkdfSync('sha256', ..., 'authvault-device-init-v1', 32))
  const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0) as unknown as BufferSource,
      info: new TextEncoder().encode('authvault-device-init-v1') as unknown as BufferSource,
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  // AES-256-GCM decrypt (Web Crypto expects tag appended to ciphertext)
  const encBytes = hexToBytes(encryptedKey);
  const tagBytes = hexToBytes(tag);
  const ivBytes = hexToBytes(iv);
  const cipherWithTag = new Uint8Array(encBytes.length + tagBytes.length);
  cipherWithTag.set(encBytes);
  cipherWithTag.set(tagBytes, encBytes.length);

  const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, aesKey, cipherWithTag) as ArrayBuffer;
  return new Uint8Array(decrypted);
}

export interface SignaKitConfig {
  backendUrl: string;
  chains: ('evm' | 'solana')[];
  walletConnectProjectId?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  theme?: Record<string, unknown>;
}

export interface SignaKitContextValue {
  config: SignaKitConfig;
  client: SignaKitClient;
  state: AuthState;
  setState: (state: AuthState | ((prev: AuthState) => AuthState)) => void;
  deviceId: string;
  supabaseClient: SupabaseClient | null;
  handleAuthResponse: (res: AuthResponse) => Promise<void>;
}

const SignaKitContext = createContext<SignaKitContextValue | null>(null);

export function useSignaKitContext() {
  const ctx = useContext(SignaKitContext);
  if (!ctx) throw new Error('useSignaKitContext must be used within SignaKitProvider');
  return ctx;
}

interface SignaKitProviderProps {
  children: ReactNode;
  backendUrl: string;
  chains?: ('evm' | 'solana')[];
  walletConnectProjectId?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  theme?: Record<string, unknown>;
}

export function SignaKitProvider({
  children,
  backendUrl,
  chains = ['evm'],
  walletConnectProjectId,
  supabaseUrl,
  supabaseAnonKey,
  theme,
}: SignaKitProviderProps) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    session: null,
  });

  const client = useMemo(() => new SignaKitClient(backendUrl), [backendUrl]);
  const deviceId = useMemo(() => getDeviceId(), []);

  const config: SignaKitConfig = useMemo(
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

      // Step 2: generate ephemeral X25519 keypair (Web Crypto, no libsodium)
      const { publicKeyHex, keypair } = await generateTransportKeypair();

      // Step 3: get transport-encrypted private key from server
      const { serverPublicKey, encryptedKey, iv, tag } = await client.deviceInit(publicKeyHex);

      // Step 4: X25519 ECDH + AES-256-GCM decrypt
      const privateKeyBytes = await unsealPrivateKey(serverPublicKey, encryptedKey, iv, tag, keypair);

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
              // No key on this device: fetch from server
              const evmAddress = await ensureLocalKey(user.id);
              if (evmAddress) {
                const updatedUser = { ...user, evmAddress };
                saveUser(updatedUser);
                setState(prev => ({ ...prev, user: updatedUser }));
              }
            } else if (!user.evmAddress) {
              // Key exists locally but DB address is missing: fetch address from server
              try {
                const { evmAddress } = await client.generateKey();
                if (evmAddress) {
                  const updatedUser = { ...user, evmAddress };
                  saveUser(updatedUser);
                  setState(prev => ({ ...prev, user: updatedUser }));
                }
              } catch {
                // Non-fatal: address will show after next login
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

        // Skip if we already have a SignaKit session for this user
        const existing = loadSession();
        if (existing) return;

        // Retry logic: for brand-new Google users, Supabase may need a moment
        // before the admin API can verify the freshly-issued access token.
        const maxRetries = 3;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            if (attempt > 0) {
              await new Promise(r => setTimeout(r, 1000 * attempt));
            }
            const res = await client.authGoogle(session.access_token, deviceId);
            await handleAuthResponse(res);
            return;
          } catch (err) {
            if (attempt === maxRetries - 1) {
              console.error('Google OAuth callback failed after retries:', err);
              setState(prev => ({ ...prev, status: 'unauthenticated' }));
            }
          }
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [supabaseClient, client, deviceId, handleAuthResponse]);

  return (
    <SignaKitContext.Provider value={{
      config,
      client,
      state,
      setState,
      deviceId,
      supabaseClient,
      handleAuthResponse,
    }}>
      {children}
    </SignaKitContext.Provider>
  );
}
