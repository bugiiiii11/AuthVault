-- Recovery bundles table.
-- Stores a password-encrypted bundle containing two Shamir shares,
-- allowing account recovery on a new device without the device encryption key.
-- The bundle is encrypted client-side with a PBKDF2-derived key from the
-- user's recovery password -- the backend never sees the plaintext shares.

CREATE TABLE IF NOT EXISTS recovery_bundles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES wallet_users(id) ON DELETE CASCADE NOT NULL,
  curve TEXT NOT NULL DEFAULT 'secp256k1',
  kdf_salt TEXT NOT NULL,           -- hex-encoded 16-byte PBKDF2 salt
  bundle_ciphertext TEXT NOT NULL,  -- hex-encoded XChaCha20-Poly1305 ciphertext
  bundle_nonce TEXT NOT NULL,       -- hex-encoded 24-byte nonce
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, curve)
);

ALTER TABLE recovery_bundles ENABLE ROW LEVEL SECURITY;
-- No direct user access -- all reads/writes go through the backend service role.

-- Mark recovery as configured on the users table when a bundle is stored.
ALTER TABLE wallet_users
  ADD COLUMN IF NOT EXISTS recovery_configured BOOLEAN NOT NULL DEFAULT FALSE;
