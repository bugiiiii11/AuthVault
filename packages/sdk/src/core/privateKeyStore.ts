/**
 * Stores and retrieves the user's full private key in IndexedDB.
 * The key is XChaCha20-encrypted with the per-user encryption key before storage.
 *
 * Uses the same 'authvault' IndexedDB database and 'shares' object store as
 * deviceShare.ts, with a 'private-key:' key prefix to avoid collisions.
 */
import { encrypt, decrypt } from '../crypto/encryption';
import { getOrCreateEncryptionKey } from './deviceShare';

const DB_NAME = 'authvault';
const STORE_NAME = 'shares';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storeKey(userId: string, curve: string): string {
  return `private-key:${userId}:${curve}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Encrypt and persist the private key in IndexedDB.
 */
export async function storePrivateKey(
  userId: string,
  curve: string,
  privateKeyBytes: Uint8Array,
): Promise<void> {
  const encKey = await getOrCreateEncryptionKey(userId);
  const { ciphertext, nonce } = await encrypt(privateKeyBytes, encKey);

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put({
      key: storeKey(userId, curve),
      ciphertext: bytesToHex(ciphertext),
      nonce: bytesToHex(nonce),
      createdAt: Date.now(),
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve and decrypt the private key from IndexedDB.
 * Returns null if not found.
 */
export async function getPrivateKey(
  userId: string,
  curve: string,
): Promise<Uint8Array | null> {
  const db = await openDB();
  const record = await new Promise<{ ciphertext: string; nonce: string } | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(storeKey(userId, curve));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!record) return null;

  const encKey = await getOrCreateEncryptionKey(userId);
  return decrypt(hexToBytes(record.ciphertext), hexToBytes(record.nonce), encKey);
}

/**
 * Check whether a private key exists for this user/curve.
 */
export async function hasPrivateKey(userId: string, curve: string): Promise<boolean> {
  const db = await openDB();
  const record = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(storeKey(userId, curve));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return record != null;
}

/**
 * Delete the private key from IndexedDB (e.g. on logout).
 */
export async function deletePrivateKey(userId: string, curve: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(storeKey(userId, curve));
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
