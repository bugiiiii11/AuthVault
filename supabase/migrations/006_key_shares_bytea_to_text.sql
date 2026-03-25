-- Change key_shares encrypted columns from BYTEA to TEXT.
-- PostgREST returns BYTEA as base64 in JSON, causing encoding bugs
-- in the hex round-trip (nonces arrive with wrong byte length).
-- TEXT stores hex strings directly, avoiding all encoding ambiguity.
-- Truncates test data since it was stored with the broken serialization.

TRUNCATE TABLE key_shares;
TRUNCATE TABLE recovery_bundles;

ALTER TABLE key_shares
  ALTER COLUMN encrypted_share TYPE TEXT USING encode(encrypted_share, 'hex'),
  ALTER COLUMN encryption_nonce TYPE TEXT USING encode(encryption_nonce, 'hex');
