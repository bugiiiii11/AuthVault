import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthState, AuthUser, AuthResponse } from '@authvault/types';
import { AuthVaultClient } from './core/client';
import { loadSession, loadUser, saveSession, saveUser, clearSession, getDeviceId } from './core/session';
import { generateAndDistributeKeys, setupRecoveryBundle, recoverWithPassword } from './core/keyManager';
import { getOrCreateEncryptionKey, hasDeviceShare } from './core/deviceShare';

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
  // Recovery
  needsRecoverySetup: boolean;
  needsRecovery: boolean;
  setupRecovery: (password: string) => Promise<void>;
  completeRecovery: (password: string) => Promise<void>;
  dismissRecoverySetup: () => void;
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

  // Recovery state
  const [needsRecoverySetup, setNeedsRecoverySetup] = useState(false);
  const [needsRecovery, setNeedsRecovery] = useState(false);
  // Kept in memory only while the user is setting up recovery (zeroed after use)
  const [pendingEncKey, setPendingEncKey] = useState<Uint8Array | null>(null);

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
   * Central post-auth handler used by all login methods.
   * Saves session, updates state, and triggers key generation or recovery prompt.
   */
  const handleAuthResponse = useCallback(async (res: AuthResponse) => {
    client.setToken(res.session.token);
    saveSession(res.session.token, res.session.expiresAt, res.session.deviceId);
    saveUser(res.user);
    setState({ status: 'authenticated', user: res.user, session: res.session });

    if (res.user.loginMethod === 'wallet') return;

    if (res.isNew) {
      // First login -- generate Shamir SSS keys and prompt for recovery setup
      try {
        const encKey = await getOrCreateEncryptionKey(res.user.id);
        const { evmAddress } = await generateAndDistributeKeys(client, res.user.id, encKey);
        const updatedUser = { ...res.user, evmAddress };
        saveUser(updatedUser);
        setState(prev => ({ ...prev, user: updatedUser }));
        // Keep enc key in memory for recovery setup
        setPendingEncKey(encKey);
        setNeedsRecoverySetup(true);
      } catch (err) {
        console.error('Key generation failed (non-fatal):', err);
      }
    } else {
      // Returning user -- check if device share is present
      const hasShare = await hasDeviceShare(res.user.id, 'secp256k1');
      if (!hasShare) {
        setNeedsRecovery(true);
      } else {
        // Device share present -- verify server share also exists in DB.
        // If missing (e.g. DB reset / migration), regenerate keys silently.
        try {
          await client.getServerShare('secp256k1');
        } catch {
          try {
            const encKey = await getOrCreateEncryptionKey(res.user.id);
            const { evmAddress } = await generateAndDistributeKeys(client, res.user.id, encKey);
            const updatedUser = { ...res.user, evmAddress };
            saveUser(updatedUser);
            setState(prev => ({ ...prev, user: updatedUser }));
            setPendingEncKey(encKey);
            setNeedsRecoverySetup(true);
          } catch (regenErr) {
            console.error('Key regeneration failed:', regenErr);
          }
        }
      }
    }
  }, [client]);

  /**
   * Complete the recovery setup step: build and upload the password-encrypted bundle.
   */
  const setupRecovery = useCallback(async (password: string) => {
    const user = loadUser<AuthUser>();
    if (!user) throw new Error('No user session');

    const encKey = pendingEncKey ?? await getOrCreateEncryptionKey(user.id);
    await setupRecoveryBundle(client, user.id, encKey, password);

    setPendingEncKey(null);
    setNeedsRecoverySetup(false);
  }, [client, pendingEncKey]);

  /**
   * Dismiss the recovery setup prompt without setting a password.
   * The user can set up recovery later.
   */
  const dismissRecoverySetup = useCallback(() => {
    setPendingEncKey(null);
    setNeedsRecoverySetup(false);
  }, []);

  /**
   * Complete account recovery on a new device using the recovery password.
   * The user must already be authenticated (JWT in place) before calling this.
   */
  const completeRecovery = useCallback(async (password: string) => {
    const user = loadUser<AuthUser>();
    if (!user) throw new Error('No user session');

    const newDeviceEncKey = await getOrCreateEncryptionKey(user.id);
    const { evmAddress } = await recoverWithPassword(client, user.id, newDeviceEncKey, password);

    const updatedUser = { ...user, evmAddress };
    saveUser(updatedUser);
    setState(prev => ({ ...prev, user: updatedUser }));
    setNeedsRecovery(false);
  }, [client]);

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

          // For social/email users, verify server share exists.
          // If missing (e.g. DB reset), regenerate keys silently so signing works.
          if (user.loginMethod !== 'wallet') {
            const hasShare = await hasDeviceShare(user.id, 'secp256k1');
            if (!hasShare) {
              setNeedsRecovery(true);
            } else {
              try {
                await client.getServerShare('secp256k1');
              } catch {
                try {
                  const encKey = await getOrCreateEncryptionKey(user.id);
                  const { evmAddress } = await generateAndDistributeKeys(client, user.id, encKey);
                  const updatedUser = { ...user, evmAddress };
                  saveUser(updatedUser);
                  setState(prev => ({ ...prev, user: updatedUser }));
                  setPendingEncKey(encKey);
                  setNeedsRecoverySetup(true);
                } catch (regenErr) {
                  console.error('Key regeneration on hydration failed:', regenErr);
                }
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
  }, [client]);

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
      needsRecoverySetup,
      needsRecovery,
      setupRecovery,
      completeRecovery,
      dismissRecoverySetup,
    }}>
      {children}
    </AuthVaultContext.Provider>
  );
}
