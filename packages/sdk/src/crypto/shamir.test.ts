import { describe, it, expect } from 'vitest';
import { split, combine, zeroBytes } from './shamir';

describe('Shamir Secret Sharing', () => {
  // Helper to create a known secret
  function makeSecret(length: number, fill?: number): Uint8Array {
    const secret = new Uint8Array(length);
    if (fill !== undefined) {
      secret.fill(fill);
    } else {
      crypto.getRandomValues(secret);
    }
    return secret;
  }

  describe('split and combine', () => {
    it('reconstructs 32-byte secret with any 2 of 3 shares', () => {
      const secret = makeSecret(32);
      const shares = split(secret, 3, 2);

      expect(shares).toHaveLength(3);
      expect(shares[0].data).toHaveLength(32);

      // Any 2 shares should reconstruct
      expect(combine([shares[0], shares[1]])).toEqual(secret);
      expect(combine([shares[0], shares[2]])).toEqual(secret);
      expect(combine([shares[1], shares[2]])).toEqual(secret);

      // All 3 shares should also work
      expect(combine([shares[0], shares[1], shares[2]])).toEqual(secret);
    });

    it('works with all-zeros secret', () => {
      const secret = makeSecret(32, 0x00);
      const shares = split(secret, 3, 2);
      expect(combine([shares[0], shares[1]])).toEqual(secret);
    });

    it('works with all-0xFF secret', () => {
      const secret = makeSecret(32, 0xff);
      const shares = split(secret, 3, 2);
      expect(combine([shares[1], shares[2]])).toEqual(secret);
    });

    it('works with single-byte secret', () => {
      const secret = new Uint8Array([0x42]);
      const shares = split(secret, 3, 2);
      expect(combine([shares[0], shares[2]])).toEqual(secret);
    });

    it('works with large secret (64 bytes)', () => {
      const secret = makeSecret(64);
      const shares = split(secret, 3, 2);
      expect(combine([shares[0], shares[1]])).toEqual(secret);
    });

    it('works with 3-of-5 threshold', () => {
      const secret = makeSecret(32);
      const shares = split(secret, 5, 3);

      expect(shares).toHaveLength(5);

      // Any 3 shares should work
      expect(combine([shares[0], shares[2], shares[4]])).toEqual(secret);
      expect(combine([shares[1], shares[3], shares[4]])).toEqual(secret);

      // 2 shares should NOT reconstruct correctly
      const badResult = combine([shares[0], shares[1]]);
      // With threshold=3, using only 2 shares gives wrong result
      // (statistically almost certainly different)
      expect(badResult).not.toEqual(secret);
    });

    it('handles different share order', () => {
      const secret = makeSecret(32);
      const shares = split(secret, 3, 2);

      // Reversed order should give same result
      expect(combine([shares[2], shares[0]])).toEqual(secret);
      expect(combine([shares[1], shares[0]])).toEqual(secret);
    });
  });

  describe('edge cases and validation', () => {
    it('rejects threshold < 2', () => {
      const secret = makeSecret(32);
      expect(() => split(secret, 3, 1)).toThrow('Threshold must be at least 2');
    });

    it('rejects total < threshold', () => {
      const secret = makeSecret(32);
      expect(() => split(secret, 2, 3)).toThrow('Total must be >= threshold');
    });

    it('rejects total > 255', () => {
      const secret = makeSecret(32);
      expect(() => split(secret, 256, 2)).toThrow('Maximum 255 shares');
    });

    it('rejects empty secret', () => {
      expect(() => split(new Uint8Array(0), 3, 2)).toThrow('Secret cannot be empty');
    });

    it('rejects fewer than 2 shares for combine', () => {
      const secret = makeSecret(32);
      const shares = split(secret, 3, 2);
      expect(() => combine([shares[0]])).toThrow('Need at least 2 shares');
    });

    it('rejects duplicate share indices', () => {
      const secret = makeSecret(32);
      const shares = split(secret, 3, 2);
      expect(() => combine([shares[0], shares[0]])).toThrow('Duplicate share indices');
    });

    it('rejects mismatched share lengths', () => {
      expect(() => combine([
        { index: 1, data: new Uint8Array(32) },
        { index: 2, data: new Uint8Array(16) },
      ])).toThrow('same length');
    });
  });

  describe('security properties', () => {
    it('shares are different from the secret', () => {
      const secret = makeSecret(32, 0xAB);
      const shares = split(secret, 3, 2);

      // Each share should differ from the secret
      for (const share of shares) {
        expect(share.data).not.toEqual(secret);
      }
    });

    it('different splits produce different shares', () => {
      const secret = makeSecret(32);
      const shares1 = split(secret, 3, 2);
      const shares2 = split(secret, 3, 2);

      // Random polynomial means different shares each time
      // (extremely unlikely to be equal)
      expect(shares1[0].data).not.toEqual(shares2[0].data);
    });

    it('shares have correct indices', () => {
      const secret = makeSecret(32);
      const shares = split(secret, 3, 2);
      expect(shares[0].index).toBe(1);
      expect(shares[1].index).toBe(2);
      expect(shares[2].index).toBe(3);
    });
  });

  describe('zeroBytes', () => {
    it('zeroes a Uint8Array', () => {
      const arr = new Uint8Array([1, 2, 3, 4, 5]);
      zeroBytes(arr);
      expect(arr).toEqual(new Uint8Array(5));
    });
  });

  describe('deterministic reconstruction', () => {
    it('same shares always produce same secret', () => {
      const secret = makeSecret(32);
      const shares = split(secret, 3, 2);

      const result1 = combine([shares[0], shares[1]]);
      const result2 = combine([shares[0], shares[1]]);
      expect(result1).toEqual(result2);
      expect(result1).toEqual(secret);
    });
  });
});
