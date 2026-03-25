/**
 * Web Worker for secure key reconstruction and transaction signing.
 * Keeps private key in worker memory, zeroes after use.
 */
import { combine, zeroBytes } from './shamir';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';

export type WorkerRequest =
  | { type: 'sign'; shares: Array<{ index: number; data: number[] }>; txHash: number[] }
  | { type: 'signMessage'; shares: Array<{ index: number; data: number[] }>; messageHash: number[] }
  | { type: 'deriveAddress'; shares: Array<{ index: number; data: number[] }> };

export type WorkerResponse =
  | { type: 'signed'; signature: { r: string; s: string; v: number }; txHash: string }
  | { type: 'signedMessage'; signature: string }
  | { type: 'address'; address: string }
  | { type: 'error'; message: string };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const req = event.data;

    // Convert shares from transferable format
    const shares = req.shares.map(s => ({
      index: s.index,
      data: new Uint8Array(s.data),
    }));

    // Reconstruct private key from shares
    const privateKey = combine(shares);

    let response: WorkerResponse;

    switch (req.type) {
      case 'sign': {
        const txHash = new Uint8Array(req.txHash);
        const sig = secp256k1.sign(txHash, privateKey);
        response = {
          type: 'signed',
          signature: {
            r: sig.r.toString(16).padStart(64, '0'),
            s: sig.s.toString(16).padStart(64, '0'),
            v: sig.recovery + 27,
          },
          txHash: bytesToHex(txHash),
        };
        break;
      }

      case 'signMessage': {
        const msgHash = new Uint8Array(req.messageHash);
        const sig = secp256k1.sign(msgHash, privateKey);
        const sigHex = '0x' +
          sig.r.toString(16).padStart(64, '0') +
          sig.s.toString(16).padStart(64, '0') +
          (sig.recovery + 27).toString(16).padStart(2, '0');
        response = { type: 'signedMessage', signature: sigHex };
        break;
      }

      case 'deriveAddress': {
        const publicKey = secp256k1.getPublicKey(privateKey, false);
        const hash = keccak_256(publicKey.slice(1));
        const addrBytes = hash.slice(-20);
        response = { type: 'address', address: '0x' + bytesToHex(addrBytes) };
        break;
      }

      default:
        response = { type: 'error', message: 'Unknown request type' };
    }

    // CRITICAL: Zero private key from memory
    zeroBytes(privateKey);
    shares.forEach(s => zeroBytes(s.data));

    self.postMessage(response);
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'Worker error',
    } satisfies WorkerResponse);
  }
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
