/**
 * useSigning hook -- signs transactions and messages using the user's private key.
 *
 * Seamless mode: the private key is retrieved from IndexedDB (stored during device-init),
 * decrypted with the user's local encryption key, used to sign, then zeroed from memory.
 *
 * No SSS reconstruction needed -- the server already assembled the key during device-init.
 */
import { useCallback } from 'react';
import { useSignaKitContext } from '../SignaKitProvider';
import { getPrivateKey } from '../core/privateKeyStore';
import { zeroBytes } from '../crypto/shamir';
import { secp256k1 } from '@noble/curves/secp256k1';

interface SignResult {
  signature: { r: string; s: string; v: number };
}

interface SignMessageResult {
  signature: string; // 0x-prefixed hex
}

export function useSigning() {
  const { state } = useSignaKitContext();

  async function loadPrivateKey(): Promise<Uint8Array> {
    if (!state.user) throw new Error('Not authenticated');

    const privateKey = await getPrivateKey(state.user.id, 'secp256k1');
    if (!privateKey) {
      throw new Error('Private key not found on device. Please log in again.');
    }
    return privateKey;
  }

  const signTransaction = useCallback(async (
    txHash: Uint8Array,
  ): Promise<SignResult> => {
    const privateKey = await loadPrivateKey();
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
      zeroBytes(privateKey);
    }
  }, [state.user]);

  const signMessage = useCallback(async (
    messageHash: Uint8Array,
  ): Promise<SignMessageResult> => {
    const privateKey = await loadPrivateKey();
    try {
      const sig = secp256k1.sign(messageHash, privateKey);
      const sigHex = '0x' +
        sig.r.toString(16).padStart(64, '0') +
        sig.s.toString(16).padStart(64, '0') +
        (sig.recovery + 27).toString(16).padStart(2, '0');
      return { signature: sigHex };
    } finally {
      zeroBytes(privateKey);
    }
  }, [state.user]);

  return {
    signTransaction,
    signMessage,
    isSigningSupported: state.status === 'authenticated' && state.user?.loginMethod !== 'wallet',
  };
}
