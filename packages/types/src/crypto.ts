export type Curve = 'secp256k1' | 'ed25519';
export type ShareType = 'device' | 'server' | 'recovery';

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  address: string;
  curve: Curve;
}

export interface Share {
  index: number;
  data: Uint8Array;
  type: ShareType;
}

export interface EncryptedShare {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

export interface SplitResult {
  shares: Share[];
  publicKey: Uint8Array;
  address: string;
  curve: Curve;
}
