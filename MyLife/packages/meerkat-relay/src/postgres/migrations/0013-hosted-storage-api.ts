/** Versioned hosted-storage metadata. PostgreSQL stores no object bytes. */
export const HOSTED_STORAGE_API_SQL = `
CREATE TABLE hosted.storage_api_upload_blocks (
  subject_id text NOT NULL REFERENCES hosted.storage_tenants(subject_id) ON DELETE CASCADE,
  object_id text NOT NULL,
  block_index integer NOT NULL,
  total_blocks integer NOT NULL,
  block_hash text NOT NULL,
  size_bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (subject_id, object_id, block_index),
  CONSTRAINT hosted_storage_api_upload_object_id_valid CHECK (
    length(object_id) BETWEEN 1 AND 128
    AND object_id ~ '^[A-Za-z0-9_-]+$'
  ),
  CONSTRAINT hosted_storage_api_upload_block_index_valid CHECK (
    block_index >= 0 AND block_index < total_blocks
  ),
  CONSTRAINT hosted_storage_api_upload_total_blocks_valid CHECK (
    total_blocks BETWEEN 1 AND 100000
  ),
  CONSTRAINT hosted_storage_api_upload_hash_valid CHECK (
    block_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT hosted_storage_api_upload_size_nonnegative CHECK (size_bytes >= 0)
);

CREATE INDEX hosted_storage_api_upload_subject_object_idx
  ON hosted.storage_api_upload_blocks (subject_id, object_id, block_index);

CREATE TABLE hosted.storage_api_objects (
  subject_id text NOT NULL REFERENCES hosted.storage_tenants(subject_id) ON DELETE CASCADE,
  object_id text NOT NULL,
  encrypted_bytes bigint NOT NULL,
  ciphertext_hash text NOT NULL,
  data_class text NOT NULL,
  total_blocks integer NOT NULL,
  version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (subject_id, object_id),
  CONSTRAINT hosted_storage_api_object_id_valid CHECK (
    length(object_id) BETWEEN 1 AND 128
    AND object_id ~ '^[A-Za-z0-9_-]+$'
  ),
  CONSTRAINT hosted_storage_api_object_bytes_nonnegative CHECK (encrypted_bytes >= 0),
  CONSTRAINT hosted_storage_api_object_hash_valid CHECK (
    ciphertext_hash ~ '^[a-f0-9]{128}$'
  ),
  CONSTRAINT hosted_storage_api_object_data_class_valid CHECK (
    length(data_class) BETWEEN 1 AND 128
    AND data_class ~ '^[A-Za-z0-9_.:-]+$'
  ),
  CONSTRAINT hosted_storage_api_object_total_blocks_valid CHECK (
    total_blocks BETWEEN 1 AND 100000
  ),
  CONSTRAINT hosted_storage_api_object_version_valid CHECK (
    length(version) BETWEEN 1 AND 128
    AND version ~ '^[A-Za-z0-9_-]+$'
  )
);

CREATE INDEX hosted_storage_api_objects_cursor_idx
  ON hosted.storage_api_objects (subject_id, created_at, object_id);

CREATE TABLE hosted.storage_backup_locators (
  subject_id text NOT NULL,
  backup_id text NOT NULL,
  format_version integer NOT NULL,
  encrypted_manifest_hash text NOT NULL,
  created_at timestamptz NOT NULL,
  manifest_object_id text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (subject_id, backup_id),
  FOREIGN KEY (subject_id, manifest_object_id)
    REFERENCES hosted.storage_api_objects(subject_id, object_id) ON DELETE CASCADE,
  CONSTRAINT hosted_storage_backup_id_valid CHECK (
    length(backup_id) BETWEEN 1 AND 128
    AND backup_id ~ '^[A-Za-z0-9_-]+$'
  ),
  CONSTRAINT hosted_storage_backup_format_version_valid CHECK (
    format_version BETWEEN 1 AND 2147483647
  ),
  CONSTRAINT hosted_storage_backup_manifest_hash_valid CHECK (
    encrypted_manifest_hash ~ '^[a-f0-9]{128}$'
  ),
  CONSTRAINT hosted_storage_backup_manifest_object_id_valid CHECK (
    length(manifest_object_id) BETWEEN 1 AND 128
    AND manifest_object_id ~ '^[A-Za-z0-9_-]+$'
  )
);

CREATE INDEX hosted_storage_backup_locators_cursor_idx
  ON hosted.storage_backup_locators (subject_id, created_at, backup_id);

CREATE FUNCTION hosted.delete_storage_api_tenant(target_subject_id text)
RETURNS TABLE (
  tenant_rows bigint,
  policy_rows bigint,
  object_rows bigint,
  upload_block_rows bigint,
  backup_rows bigint,
  storage_object_rows bigint,
  reservation_rows bigint,
  seeder_manifest_rows bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, hosted
AS $meerkat_delete_storage_tenant$
BEGIN
  RETURN QUERY SELECT
    (SELECT count(*) FROM hosted.storage_tenants WHERE subject_id = target_subject_id),
    (SELECT count(*) FROM hosted.storage_tenant_policies WHERE subject_id = target_subject_id),
    (SELECT count(*) FROM hosted.storage_api_objects WHERE subject_id = target_subject_id),
    (SELECT count(*) FROM hosted.storage_api_upload_blocks WHERE subject_id = target_subject_id),
    (SELECT count(*) FROM hosted.storage_backup_locators WHERE subject_id = target_subject_id),
    (SELECT count(*) FROM hosted.storage_objects WHERE subject_id = target_subject_id),
    (SELECT count(*) FROM hosted.storage_reservations WHERE subject_id = target_subject_id),
    (SELECT count(*) FROM hosted.seeder_manifests WHERE subject_id = target_subject_id);

  DELETE FROM hosted.storage_tenants AS tenants
  WHERE tenants.subject_id = target_subject_id;
END
$meerkat_delete_storage_tenant$;

REVOKE ALL ON FUNCTION hosted.delete_storage_api_tenant(text) FROM PUBLIC;
`;
