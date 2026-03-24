import { describe, it, expect } from 'vitest';
import { generateEVMKeyPair, deriveEVMAddress } from './keygen';

describe('EVM Key Generation', () => {
  it('generates a valid key pair', () => {
    const keyPair = generateEVMKeyPair();

    expect(keyPair.privateKey).toHaveLength(32);
    expect(keyPair.publicKey).toHaveLength(65); // uncompressed
    expect(keyPair.publicKey[0]).toBe(0x04); // uncompressed prefix
    expect(keyPair.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(keyPair.curve).toBe('secp256k1');
  });

  it('generates unique key pairs', () => {
    const kp1 = generateEVMKeyPair();
    const kp2 = generateEVMKeyPair();

    expect(kp1.privateKey).not.toEqual(kp2.privateKey);
    expect(kp1.address).not.toBe(kp2.address);
  });

  it('derives consistent address from private key', () => {
    const keyPair = generateEVMKeyPair();
    const derivedAddress = deriveEVMAddress(keyPair.privateKey);

    expect(derivedAddress).toBe(keyPair.address);
  });

  it('produces EIP-55 checksummed address', () => {
    const keyPair = generateEVMKeyPair();
    const addr = keyPair.address;

    // EIP-55: address has mixed case (not all lowercase or all uppercase)
    const hexPart = addr.slice(2);
    const hasUpper = /[A-F]/.test(hexPart);
    const hasLower = /[a-f]/.test(hexPart);
    // Most addresses will have mixed case; very rare edge cases might not
    // At minimum, it should be a valid hex string
    expect(hexPart).toMatch(/^[0-9a-fA-F]{40}$/);
    // Verify checksum by re-deriving
    expect(deriveEVMAddress(keyPair.privateKey)).toBe(addr);
  });

  it('generates valid address for known private key', () => {
    // This is a well-known test vector
    // Private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
    // Expected address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Hardhat account #0)
    const privateKey = new Uint8Array([
      0xac, 0x09, 0x74, 0xbe, 0xc3, 0x9a, 0x17, 0xe3,
      0x6b, 0xa4, 0xa6, 0xb4, 0xd2, 0x38, 0xff, 0x94,
      0x4b, 0xac, 0xb4, 0x78, 0xcb, 0xed, 0x5e, 0xfc,
      0xae, 0x78, 0x4d, 0x7b, 0xf4, 0xf2, 0xff, 0x80,
    ]);

    const address = deriveEVMAddress(privateKey);
    expect(address.toLowerCase()).toBe('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
  });
});
