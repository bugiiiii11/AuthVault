/**
 * Device share storage using IndexedDB.
 * Stores the user's device share (share index 1) locally.
 */

const DB_NAME = 'authvault';
const DB_VERSION = 1;
const STORE_NAME = 'shares';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

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

function getStoreKey(userId: string, curve: string): string {
  return `device-share:${userId}:${curve}`;
}

export interface StoredDeviceShare {
  key: string;
  userId: string;
  curve: string;
  shareData: string;  // hex-encoded encrypted share
  nonce: string;      // hex-encoded nonce
  createdAt: number;
}

/**
 * Store a device share in IndexedDB.
 */
export async function storeDeviceShare(
  userId: string,
  curve: string,
  shareData: string,
  nonce: string,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const record: StoredDeviceShare = {
    key: getStoreKey(userId, curve),
    userId,
    curve,
    shareData,
    nonce,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve a device share from IndexedDB.
 */
export async function getDeviceShare(
  userId: string,
  curve: string,
): Promise<StoredDeviceShare | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.get(getStoreKey(userId, curve));
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a device share from IndexedDB.
 */
export async function deleteDeviceShare(
  userId: string,
  curve: string,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.delete(getStoreKey(userId, curve));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if a device share exists.
 */
export async function hasDeviceShare(
  userId: string,
  curve: string,
): Promise<boolean> {
  const share = await getDeviceShare(userId, curve);
  return share !== null;
}

/**
 * Clear all device shares (used on logout).
 */
export async function clearAllShares(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
