/**
 * Key lifecycle manager.
 * Orchestrates key generation, splitting, share distribution, and recovery.
 */
import { generateEVMKeyPair } from '../crypto/keygen';
import { split, combine, zeroBytes } from '../crypto/shamir';
import { encrypt, decrypt } from '../crypto/encryption';
import { deriveKeyFromPassword, generateSalt } from '../crypto/pbkdf2';
import { storeDeviceShare, getDeviceShare } from './deviceShare';
import { AuthVaultClient } from './client';

/**
 * Generate a new key pair, split into shares, and distribute.
 *
 * @param client - Backend API client
 * @param userId - User ID for device share storage
 * @param encryptionKey - 32-byte key for encrypting shares
 * @returns The EVM address of the generated key
 */
export async function generateAndDistributeKeys(
  client: AuthVaultClient,
  userId: string,
  encryptionKey: Uint8Array,
): Promise<{ evmAddress: string }> {
  // Generate key pair
  const keyPair = generateEVMKeyPair();

  try {
    // Split private key into 3 shares (threshold = 2)
    const shares = split(keyPair.privateKey, 3, 2);

    // Encrypt all shares
    const [deviceEnc, serverEnc, recoveryEnc] = await Promise.all([
      encrypt(shares[0].data, encryptionKey),
      encrypt(shares[1].data, encryptionKey),
      encrypt(shares[2].data, encryptionKey),
    ]);

    // Store device share locally (IndexedDB)
    await storeDeviceShare(
      userId,
      'secp256k1',
      bytesToHex(deviceEnc.ciphertext),
      bytesToHex(deviceEnc.nonce),
    );

    // Send server + recovery shares to backend
    await client.storeShares({
      encryptedShares: {
        server: {
          ciphertext: bytesToHex(serverEnc.ciphertext),
          nonce: bytesToHex(serverEnc.nonce),
        },
        recovery: {
          ciphertext: bytesToHex(recoveryEnc.ciphertext),
          nonce: bytesToHex(recoveryEnc.nonce),
        },
      },
      publicKeys: { evm: keyPair.address },
      curve: 'secp256k1',
    });

    // Zero sensitive data
    shares.forEach(s => zeroBytes(s.data));

    return { evmAddress: keyPair.address };
  } finally {
    // Always zero the private key
    zeroBytes(keyPair.privateKey);
  }
}

/**
 * Set up the recovery bundle after first login.
 * Fetches device + server shares, reconstructs the private key,
 * re-splits it, and stores a password-encrypted bundle on the backend.
 * The bundle contains two shares so the user can recover on any new device.
 *
 * @param client - Backend API client
 * @param userId - User ID (for IndexedDB lookup)
 * @param encryptionKey - Current device encryption key (from IndexedDB)
 * @param password - Recovery password chosen by the user
 */
export async function setupRecoveryBundle(
  client: AuthVaultClient,
  userId: string,
  encryptionKey: Uint8Array,
  password: string,
): Promise<void> {
  // Fetch device share from IndexedDB
  const storedDeviceShare = await getDeviceShare(userId, 'secp256k1');
  if (!storedDeviceShare) throw new Error('No device share found -- key not yet generated');

  // Fetch server share from backend
  const serverShareRes = await client.getServerShare('secp256k1');

  // Decrypt both shares using the device encryption key
  const deviceShareData = await decrypt(
    hexToBytes(storedDeviceShare.shareData),
    hexToBytes(storedDeviceShare.nonce),
    encryptionKey,
  );
  const serverShareData = await decrypt(
    hexToBytes(serverShareRes.encryptedShare),
    hexToBytes(serverShareRes.nonce),
    encryptionKey,
  );

  // Reconstruct private key from device (index 1) + server (index 2) shares
  const privateKey = combine([
    { index: 1, data: deviceShareData },
    { index: 2, data: serverShareData },
  ]);

  let bundleShares: Array<{ index: number; data: Uint8Array }> = [];
  try {
    // Re-split for the recovery bundle (fresh randomness, same private key)
    bundleShares = split(privateKey, 3, 2);

    // Derive a key from the recovery password
    const salt = generateSalt();
    const recoveryKey = await deriveKeyFromPassword(password, salt);

    // Build and encrypt the bundle: two shares sufficient for reconstruction
    const bundle = JSON.stringify({
      a: { index: bundleShares[0].index, data: bytesToHex(bundleShares[0].data) },
      b: { index: bundleShares[1].index, data: bytesToHex(bundleShares[1].data) },
    });
    const bundleBytes = new TextEncoder().encode(bundle);
    const { ciphertext, nonce } = await encrypt(bundleBytes, recoveryKey);

    // Upload to backend
    await client.storeRecoveryBundle({
      curve: 'secp256k1',
      kdfSalt: bytesToHex(salt),
      ciphertext: bytesToHex(ciphertext),
      nonce: bytesToHex(nonce),
    });

    // Zero the recovery key
    zeroBytes(recoveryKey);
  } finally {
    // Zero all sensitive data
    zeroBytes(privateKey);
    bundleShares.forEach(s => zeroBytes(s.data));
    zeroBytes(deviceShareData);
    zeroBytes(serverShareData);
  }
}

/**
 * Recover access on a new device using the recovery password.
 * Downloads the encrypted bundle, decrypts it, reconstructs the private key,
 * generates a new device share, and updates the server share.
 *
 * @param client - Backend API client (must have a valid JWT already set)
 * @param userId - User ID (for new device share storage)
 * @param newDeviceEncryptionKey - Fresh 32-byte key for the new device
 * @param password - The user's recovery password
 * @returns The EVM address (to confirm recovery succeeded)
 */
export async function recoverWithPassword(
  client: AuthVaultClient,
  userId: string,
  newDeviceEncryptionKey: Uint8Array,
  password: string,
): Promise<{ evmAddress: string }> {
  // Fetch the encrypted recovery bundle
  const bundleRes = await client.getRecoveryBundle('secp256k1');

  // Derive the recovery key from password + stored salt
  const salt = hexToBytes(bundleRes.kdfSalt);
  const recoveryKey = await deriveKeyFromPassword(password, salt);

  let privateKey: Uint8Array | null = null;
  let newShares: Array<{ index: number; data: Uint8Array }> = [];

  try {
    // Decrypt the bundle
    const bundleBytes = await decrypt(
      hexToBytes(bundleRes.ciphertext),
      hexToBytes(bundleRes.nonce),
      recoveryKey,
    );

    const bundle = JSON.parse(new TextDecoder().decode(bundleBytes)) as {
      a: { index: number; data: string };
      b: { index: number; data: string };
    };

    // Reconstruct the private key
    privateKey = combine([
      { index: bundle.a.index, data: hexToBytes(bundle.a.data) },
      { index: bundle.b.index, data: hexToBytes(bundle.b.data) },
    ]);

    // Derive the EVM address from the reconstructed private key
    const { deriveEVMAddress } = await import('../crypto/keygen');
    const evmAddress = deriveEVMAddress(privateKey);

    // Re-split for the new device
    newShares = split(privateKey, 3, 2);

    // Encrypt new device share with the new device key
    const deviceEnc = await encrypt(newShares[0].data, newDeviceEncryptionKey);
    await storeDeviceShare(
      userId,
      'secp256k1',
      bytesToHex(deviceEnc.ciphertext),
      bytesToHex(deviceEnc.nonce),
    );

    // Encrypt new server share with the new device key and update backend
    const serverEnc = await encrypt(newShares[1].data, newDeviceEncryptionKey);
    await client.updateServerShareAfterRecovery({
      curve: 'secp256k1',
      encryptedServerShare: {
        ciphertext: bytesToHex(serverEnc.ciphertext),
        nonce: bytesToHex(serverEnc.nonce),
      },
    });

    return { evmAddress };
  } finally {
    zeroBytes(recoveryKey);
    if (privateKey) zeroBytes(privateKey);
    newShares.forEach(s => zeroBytes(s.data));
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
