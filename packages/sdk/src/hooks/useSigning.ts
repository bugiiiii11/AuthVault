/**
 * useSigning hook -- reconstructs key from shares and signs transactions.
 * For MVP: signing happens on main thread (20-40ms, invisible to user).
 * v1.1: Move to Web Worker for additional isolation.
 */
import { useCallback } from 'react';
import { useAuthVaultContext } from '../AuthVaultProvider';
import { getDeviceShare } from '../core/deviceShare';
import { decrypt } from '../crypto/encryption';
import { combine, zeroBytes } from '../crypto/shamir';
import { secp256k1 } from '@noble/curves/secp256k1';

interface SignResult {
  signature: { r: string; s: string; v: number };
}

interface SignMessageResult {
  signature: string; // 0x-prefixed hex
}

export function useSigning() {
  const { state, client } = useAuthVaultContext();

  async function getShares(encryptionKey: Uint8Array): Promise<Array<{ index: number; data: Uint8Array }>> {
    if (!state.user) throw new Error('Not authenticated');

    // Get device share from IndexedDB
    const deviceShareRecord = await getDeviceShare(state.user.id, 'secp256k1');
    if (!deviceShareRecord) {
      throw new Error('Device share not found. Please log in again.');
    }

    // Decrypt device share
    const deviceShareData = await decrypt(
      hexToBytes(deviceShareRecord.shareData),
      hexToBytes(deviceShareRecord.nonce),
      encryptionKey,
    );

    // Get server share from backend
    const serverShareResponse = await client.getServerShare('secp256k1');

    // Decrypt server share
    const serverShareData = await decrypt(
      hexToBytes(serverShareResponse.encryptedShare),
      hexToBytes(serverShareResponse.nonce),
      encryptionKey,
    );

    return [
      { index: 1, data: deviceShareData },
      { index: 2, data: serverShareData },
    ];
  }

  const signTransaction = useCallback(async (
    txHash: Uint8Array,
    encryptionKey: Uint8Array,
  ): Promise<SignResult> => {
    const shares = await getShares(encryptionKey);
    const privateKey = combine(shares);

    try {
      const sig = secp256k1.sign(txHash, privateKey);
      return {
        signature: {
          r: sig.r.toString(16).padStart(64, '0'),
          s: sig.s.toString(16).padStart(64, '0'),
          v: sig.recovery + 27,
        },
      };
    } finally {
      // CRITICAL: Zero private key from memory immediately
      zeroBytes(privateKey);
      shares.forEach(s => zeroBytes(s.data));
    }
  }, [state.user, client]);

  const signMessage = useCallback(async (
    messageHash: Uint8Array,
    encryptionKey: Uint8Array,
  ): Promise<SignMessageResult> => {
    const shares = await getShares(encryptionKey);
    const privateKey = combine(shares);

    try {
      const sig = secp256k1.sign(messageHash, privateKey);
      const sigHex = '0x' +
        sig.r.toString(16).padStart(64, '0') +
        sig.s.toString(16).padStart(64, '0') +
        (sig.recovery + 27).toString(16).padStart(2, '0');
      return { signature: sigHex };
    } finally {
      zeroBytes(privateKey);
      shares.forEach(s => zeroBytes(s.data));
    }
  }, [state.user, client]);

  return {
    signTransaction,
    signMessage,
    isSigningSupported: state.status === 'authenticated' && state.user?.loginMethod === 'social',
  };
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
