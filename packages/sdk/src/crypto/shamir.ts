/**
 * Shamir's Secret Sharing over GF(2^8)
 *
 * Splits a secret (arbitrary byte array) into N shares with threshold T,
 * such that any T shares can reconstruct the secret but T-1 shares reveal nothing.
 *
 * Uses GF(2^8) with irreducible polynomial x^8 + x^4 + x^3 + x + 1 (0x11B).
 * This is the same field used by AES.
 */

// -- GF(2^8) Arithmetic --

// Precomputed exp and log tables for GF(2^8) with generator 0x03
const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);

(function initTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    LOG_TABLE[x] = i;
    x = x ^ (x << 1) ^ (x >= 128 ? 0x1b : 0); // multiply by generator 3
    x &= 0xff;
  }
  EXP_TABLE[255] = EXP_TABLE[0]; // wrap
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[a] + LOG_TABLE[b]) % 255];
}

function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero in GF(2^8)');
  if (a === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[a] - LOG_TABLE[b] + 255) % 255];
}

// -- Polynomial evaluation in GF(2^8) --

function evaluatePolynomial(coefficients: Uint8Array, x: number): number {
  // coefficients[0] is the secret (constant term)
  // Horner's method: result = c[n-1], then for i = n-2..0: result = result * x + c[i]
  let result = 0;
  for (let i = coefficients.length - 1; i >= 0; i--) {
    result = gfMul(result, x) ^ coefficients[i]; // XOR is addition in GF(2^8)
  }
  return result;
}

// -- Lagrange interpolation at x=0 --

function lagrangeInterpolateAtZero(points: Array<{ x: number; y: number }>): number {
  const n = points.length;
  let secret = 0;

  for (let i = 0; i < n; i++) {
    let numerator = 1;
    let denominator = 1;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      numerator = gfMul(numerator, points[j].x);           // x_j (evaluating at 0)
      denominator = gfMul(denominator, points[j].x ^ points[i].x); // x_j - x_i (XOR = subtraction in GF(2^8))
    }

    const lagrangeCoeff = gfDiv(numerator, denominator);
    secret ^= gfMul(points[i].y, lagrangeCoeff); // XOR = addition in GF(2^8)
  }

  return secret;
}

// -- Secure random bytes --

function getRandomBytes(count: number): Uint8Array {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    const buf = new Uint8Array(count);
    globalThis.crypto.getRandomValues(buf);
    return buf;
  }
  throw new Error('No secure random source available');
}

// -- Public API --

/**
 * Split a secret into shares using Shamir's Secret Sharing.
 *
 * @param secret - The secret to split (Uint8Array of any length)
 * @param total - Total number of shares to generate (N)
 * @param threshold - Minimum shares needed to reconstruct (T)
 * @returns Array of N shares, each containing { index, data }
 */
export function split(
  secret: Uint8Array,
  total: number,
  threshold: number,
): Array<{ index: number; data: Uint8Array }> {
  if (threshold < 2) throw new Error('Threshold must be at least 2');
  if (total < threshold) throw new Error('Total must be >= threshold');
  if (total > 255) throw new Error('Maximum 255 shares (GF(2^8) limit)');
  if (secret.length === 0) throw new Error('Secret cannot be empty');

  const shares: Array<{ index: number; data: Uint8Array }> = [];

  for (let s = 0; s < total; s++) {
    shares.push({ index: s + 1, data: new Uint8Array(secret.length) });
  }

  // For each byte of the secret, generate a random polynomial and evaluate
  for (let byteIdx = 0; byteIdx < secret.length; byteIdx++) {
    // Polynomial coefficients: [secret_byte, random_1, ..., random_(threshold-1)]
    const coefficients = new Uint8Array(threshold);
    coefficients[0] = secret[byteIdx];

    // Random coefficients for degree 1 to threshold-1
    const randomCoeffs = getRandomBytes(threshold - 1);
    for (let i = 1; i < threshold; i++) {
      coefficients[i] = randomCoeffs[i - 1];
      // Ensure at least one non-zero random coefficient for security
      if (i === 1 && coefficients[i] === 0) {
        coefficients[i] = 1; // Avoid degenerate polynomial
      }
    }

    // Evaluate polynomial at x = 1, 2, ..., total
    for (let s = 0; s < total; s++) {
      shares[s].data[byteIdx] = evaluatePolynomial(coefficients, s + 1);
    }

    // Zero the coefficients
    coefficients.fill(0);
    randomCoeffs.fill(0);
  }

  return shares;
}

/**
 * Reconstruct a secret from shares using Lagrange interpolation.
 *
 * @param shares - Array of at least `threshold` shares
 * @returns The reconstructed secret as Uint8Array
 */
export function combine(
  shares: Array<{ index: number; data: Uint8Array }>,
): Uint8Array {
  if (shares.length < 2) throw new Error('Need at least 2 shares');

  const secretLength = shares[0].data.length;
  if (shares.some(s => s.data.length !== secretLength)) {
    throw new Error('All shares must have the same length');
  }

  // Validate unique indices
  const indices = new Set(shares.map(s => s.index));
  if (indices.size !== shares.length) {
    throw new Error('Duplicate share indices');
  }

  const secret = new Uint8Array(secretLength);

  for (let byteIdx = 0; byteIdx < secretLength; byteIdx++) {
    const points = shares.map(s => ({ x: s.index, y: s.data[byteIdx] }));
    secret[byteIdx] = lagrangeInterpolateAtZero(points);
  }

  return secret;
}

/**
 * Zero out a Uint8Array (for secure memory cleanup).
 */
export function zeroBytes(arr: Uint8Array): void {
  arr.fill(0);
}
