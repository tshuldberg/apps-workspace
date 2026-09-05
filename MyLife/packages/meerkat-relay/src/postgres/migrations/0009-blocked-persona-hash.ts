/**
 * Additive hash-keyed public-post persona blocking (Plan 44 WP-3D).
 *
 * The file adapter records a block only as sha256(lower(personaPubkey)) (a one-way
 * marker file); the raw pubkey cannot be recovered from it. PostgreSQL previously
 * keyed community.blocked_personas on the RAW persona_pubkey, so the file block list
 * could not be imported and the cutover digest gate blocked while any block existed.
 *
 * This migration makes the sha256 hash the ENFORCEMENT KEY on both backends:
 *   - adds persona_pubkey_hash and backfills it from every existing raw pubkey, so no
 *     currently-enforced block is dropped;
 *   - relaxes persona_pubkey to nullable (imported rows have only the hash) while
 *     KEEPING it when the runtime knows it, for audit and reversibility;
 *   - makes persona_pubkey_hash the unique, NOT NULL enforcement key.
 * Runtime enforcement now hashes the incoming (already 64-hex-validated) pubkey and
 * checks the hash, so a persona blocked in file mode stays blocked after cutover. A
 * block is NEVER silently lifted: the backfill covers every prior row before the hash
 * becomes the key, and the import materializes a hash row for every file marker.
 */
export const BLOCKED_PERSONA_HASH_SQL = `
ALTER TABLE community.blocked_personas
  ADD COLUMN persona_pubkey_hash text;

UPDATE community.blocked_personas
  SET persona_pubkey_hash = encode(sha256(convert_to(lower(persona_pubkey), 'UTF8')), 'hex')
  WHERE persona_pubkey_hash IS NULL;

-- Move the primary key from the raw pubkey to the hash so an imported hash-only block
-- (no raw pubkey) is a valid row and the hash is the single enforcement key. The raw
-- pubkey becomes nullable, retained only when a runtime block knows it.
ALTER TABLE community.blocked_personas
  DROP CONSTRAINT blocked_personas_pkey;

ALTER TABLE community.blocked_personas
  ALTER COLUMN persona_pubkey DROP NOT NULL,
  ALTER COLUMN persona_pubkey_hash SET NOT NULL,
  ADD CONSTRAINT blocked_personas_pkey PRIMARY KEY (persona_pubkey_hash),
  ADD CONSTRAINT blocked_persona_hash_hex
    CHECK (persona_pubkey_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT blocked_persona_hash_matches_pubkey
    CHECK (
      persona_pubkey IS NULL
      OR persona_pubkey_hash = encode(sha256(convert_to(lower(persona_pubkey), 'UTF8')), 'hex')
    );
`;
