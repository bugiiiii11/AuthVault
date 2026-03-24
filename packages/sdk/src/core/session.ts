/**
 * Session management for AuthVault SDK.
 * Persists session token in localStorage with expiry checking.
 */

const SESSION_KEY = 'authvault:session';
const USER_KEY = 'authvault:user';

interface StoredSession {
  token: string;
  expiresAt: string;
  deviceId: string;
}

/**
 * Save session to localStorage.
 */
export function saveSession(token: string, expiresAt: string, deviceId: string): void {
  const session: StoredSession = { token, expiresAt, deviceId };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Load session from localStorage. Returns null if expired or missing.
 */
export function loadSession(): StoredSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const session: StoredSession = JSON.parse(raw);
    if (new Date(session.expiresAt) < new Date()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
}

/**
 * Clear session from localStorage.
 */
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Save user data to localStorage (for quick hydration on reload).
 */
export function saveUser(user: unknown): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Load cached user data.
 */
export function loadUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Generate or retrieve a stable device ID.
 */
export function getDeviceId(): string {
  const key = 'authvault:deviceId';
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}
