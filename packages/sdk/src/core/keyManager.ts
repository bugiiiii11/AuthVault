/**
 * Key lifecycle manager.
 * Orchestrates key generation, splitting, share distribution, and recovery.
 */
import { generateEVMKeyPair } from '../crypto/keygen';
import { split, combine, zeroBytes } from '../crypto/shamir';
import { encrypt, decrypt } from '../crypto/encryption';
import { storeDeviceShare } from './deviceShare';
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
 * Recover access using recovery password.
 * Reconstructs key from server share + recovery share,
 * then creates a new device share.
 *
 * @param client - Backend API client
 * @param userId - User ID
 * @param encryptionKey - Key derived from recovery password
 * @param newDeviceEncryptionKey - Key for encrypting new device share
 */
export async function recoverWithPassword(
  client: AuthVaultClient,
  userId: string,
  encryptionKey: Uint8Array,
  newDeviceEncryptionKey: Uint8Array,
): Promise<{ evmAddress: string }> {
  // Get server share
  const serverShareResponse = await client.getServerShare('secp256k1');
  const serverShareData = await decrypt(
    hexToBytes(serverShareResponse.encryptedShare),
    hexToBytes(serverShareResponse.nonce),
    encryptionKey,
  );

  // TODO: Get recovery share from backend
  // For now, recovery share retrieval needs a separate endpoint
  // This is a placeholder for the full recovery flow
  throw new Error('Recovery flow not yet fully implemented -- requires recovery share endpoint');
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
