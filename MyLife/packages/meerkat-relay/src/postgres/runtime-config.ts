export type MeerkatDeploymentProfile = 'self-host' | 'first-party';
/**
 * `file` and `postgres` are the two authoritative single-backend modes. `shadow` is the
 * migration-window comparator mode (Plan 44 WP-3B): PRIMARY = file (authoritative, serves
 * traffic), SHADOW = PostgreSQL (mirrored, deep-compared, never affects behavior). Shadow
 * requires BOTH a file dataDir and full PostgreSQL config, and is forbidden in the
 * first-party profile (first-party stays fail-closed PostgreSQL-only; shadow is a transient
 * self-host / staging migration tool).
 */
export type MeerkatStoreBackend = 'file' | 'postgres' | 'shadow';
export type MeerkatObjectStoreBackend = 's3' | 'file';

/**
 * The typed object-store (byte-path) block, resolved only for services that opt in with
 * `requireObjectStore` (currently the hosted service). First-party mode requires backend `s3`
 * fully configured; self-host `file` needs nothing beyond DATA_DIR (bytes stay on the volume).
 * Credentials are read from mounted-secret FILES only (never plain env), mirroring the PostgreSQL
 * CA-file convention; the file paths ride here and the caller reads them at construction.
 */
export interface MeerkatObjectStoreRuntimeConfig {
  backend: MeerkatObjectStoreBackend;
  s3?: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyIdFile: string;
    secretAccessKeyFile: string;
    forcePathStyle: boolean;
    allowInsecureHttp: boolean;
  };
}

export interface MeerkatStoreRuntimeConfig {
  profile: MeerkatDeploymentProfile;
  backend: MeerkatStoreBackend;
  productionMode: boolean;
  service: string;
  dataDir?: string;
  postgres?: {
    connectionString: string;
    sslMode: 'disable' | 'require' | 'verify-full';
    sslCaFile?: string;
    applicationName: string;
  };
  /** Present only when the caller set `requireObjectStore`; absent for services with no byte path. */
  objectStore?: MeerkatObjectStoreRuntimeConfig;
}

export interface ResolveMeerkatStoreRuntimeConfigOptions {
  env?: Record<string, string | undefined>;
  service: string;
  productionMode?: boolean;
  /**
   * When true, resolve the typed object-store byte-path block and fail closed if first-party mode
   * lacks a fully configured s3 backend. Services with no byte path (persona, verification,
   * directory, community) leave this unset and get no `objectStore` field, unchanged.
   */
  requireObjectStore?: boolean;
}

const SAFE_SERVICE = /^[a-z][a-z0-9-]{0,39}$/;

function requiredValue(
  env: Record<string, string | undefined>,
  name: string,
): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optionalValue(
  env: Record<string, string | undefined>,
  name: string,
): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

const SAFE_OBJECT_STORE_BUCKET = /^[A-Za-z0-9][A-Za-z0-9._-]{1,254}$/;

/**
 * Resolve the typed object-store byte-path block. First-party mode REQUIRES backend `s3` fully
 * configured (endpoint + region + bucket + both credential FILE paths), failing closed naming the
 * missing var; production refuses a plaintext http:// endpoint unless an explicit trusted-network
 * opt-in is set. Self-host `file` mode requires nothing (bytes stay on the DATA_DIR volume).
 * Credentials are never read from plain env: only the mounted-secret FILE paths ride in the config.
 */
function resolveObjectStoreConfig(
  env: Record<string, string | undefined>,
  profile: MeerkatDeploymentProfile,
  productionMode: boolean,
): MeerkatObjectStoreRuntimeConfig {
  const rawBackend = optionalValue(env, 'MEERKAT_OBJECT_STORE_BACKEND')
    ?? (profile === 'first-party' ? 's3' : 'file');
  if (rawBackend !== 's3' && rawBackend !== 'file') {
    throw new Error('MEERKAT_OBJECT_STORE_BACKEND must be s3 or file');
  }
  if (profile === 'first-party' && rawBackend !== 's3') {
    throw new Error('First-party Meerkat services require the s3 object-store backend');
  }
  if (rawBackend === 'file') {
    return { backend: 'file' };
  }

  const endpoint = requiredValue(env, 'MEERKAT_OBJECT_STORE_ENDPOINT');
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error('MEERKAT_OBJECT_STORE_ENDPOINT must be a valid URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('MEERKAT_OBJECT_STORE_ENDPOINT must use http:// or https://');
  }
  const allowInsecureHttp = optionalValue(env, 'MEERKAT_OBJECT_STORE_ALLOW_INSECURE_HTTP') === 'true';
  if (parsed.protocol === 'http:' && productionMode && !allowInsecureHttp) {
    throw new Error(
      'Production object-store endpoints require https:// unless MEERKAT_OBJECT_STORE_ALLOW_INSECURE_HTTP=true (trusted network opt-in)',
    );
  }
  const bucket = requiredValue(env, 'MEERKAT_OBJECT_STORE_BUCKET');
  if (!SAFE_OBJECT_STORE_BUCKET.test(bucket)) {
    throw new Error('MEERKAT_OBJECT_STORE_BUCKET must be a valid S3 bucket name');
  }
  return {
    backend: 's3',
    s3: {
      endpoint,
      region: requiredValue(env, 'MEERKAT_OBJECT_STORE_REGION'),
      bucket,
      accessKeyIdFile: requiredValue(env, 'MEERKAT_OBJECT_STORE_ACCESS_KEY_FILE'),
      secretAccessKeyFile: requiredValue(env, 'MEERKAT_OBJECT_STORE_SECRET_KEY_FILE'),
      forcePathStyle: optionalValue(env, 'MEERKAT_OBJECT_STORE_FORCE_PATH_STYLE') !== 'false',
      allowInsecureHttp,
    },
  };
}

/**
 * Resolve one explicit durable-state authority for a Meerkat service process.
 * First-party deployments fail closed unless PostgreSQL is selected. Self-hosted
 * processes retain the complete file-backed path and never switch merely because a
 * database URL happens to be present in the environment.
 */
export function resolveMeerkatStoreRuntimeConfig(
  options: ResolveMeerkatStoreRuntimeConfigOptions,
): MeerkatStoreRuntimeConfig {
  const env = options.env ?? process.env;
  const service = options.service.trim();
  if (!SAFE_SERVICE.test(service)) {
    throw new Error('Meerkat service name must be a safe lowercase identifier');
  }

  const requestedProductionMode = options.productionMode ?? env.NODE_ENV === 'production';
  const rawProfile = optionalValue(env, 'MEERKAT_DEPLOYMENT_PROFILE')
    ?? (requestedProductionMode ? undefined : 'self-host');
  if (rawProfile !== 'self-host' && rawProfile !== 'first-party') {
    throw new Error(
      'MEERKAT_DEPLOYMENT_PROFILE must be self-host or first-party',
    );
  }
  const productionMode = requestedProductionMode || rawProfile === 'first-party';

  const rawBackend = optionalValue(env, 'MEERKAT_STORE_BACKEND')
    ?? (rawProfile === 'self-host' && !productionMode ? 'file' : undefined);
  if (rawBackend !== 'file' && rawBackend !== 'postgres' && rawBackend !== 'shadow') {
    throw new Error('MEERKAT_STORE_BACKEND must be file, postgres, or shadow');
  }
  if (rawProfile === 'first-party' && rawBackend !== 'postgres') {
    // First-party stays fail-closed PostgreSQL-only. `shadow` is a transient migration-window
    // tool (file primary + PostgreSQL shadow), never the first-party authority.
    throw new Error('First-party Meerkat services require the PostgreSQL store backend');
  }

  if (rawBackend === 'shadow') {
    // Shadow mode resolves BOTH sub-configs so a partial setup fails closed naming the
    // missing var: the file dataDir (PRIMARY authority) AND the full PostgreSQL config
    // (SHADOW mirror), each under the exact same rules as its single-backend mode.
    const dataDir = requiredValue(env, 'DATA_DIR');
    const postgres = resolvePostgresConfig(env, service, productionMode);
    const objectStore = options.requireObjectStore
      ? resolveObjectStoreConfig(env, rawProfile, productionMode)
      : undefined;
    return {
      profile: rawProfile,
      backend: 'shadow',
      productionMode,
      service,
      dataDir,
      postgres,
      ...(objectStore ? { objectStore } : {}),
    };
  }

  if (rawBackend === 'file') {
    const dataDir = requiredValue(env, 'DATA_DIR');
    // The object-store byte-path block is resolved only for services that opt in (the hosted
    // service), AFTER the primary store config, so a primary-store error still surfaces first.
    const objectStore = options.requireObjectStore
      ? resolveObjectStoreConfig(env, rawProfile, productionMode)
      : undefined;
    return {
      profile: rawProfile,
      backend: rawBackend,
      productionMode,
      service,
      dataDir,
      ...(objectStore ? { objectStore } : {}),
    };
  }

  const postgres = resolvePostgresConfig(env, service, productionMode);

  // Object-store block resolves LAST, after the PostgreSQL config, so a primary-store
  // misconfiguration still surfaces before a byte-path one.
  const objectStore = options.requireObjectStore
    ? resolveObjectStoreConfig(env, rawProfile, productionMode)
    : undefined;

  return {
    profile: rawProfile,
    backend: rawBackend,
    productionMode,
    service,
    postgres,
    ...(objectStore ? { objectStore } : {}),
  };
}

/**
 * Resolve the PostgreSQL connection block from env under the shared TLS/production rules
 * (production forces verify-full plus a CA file). Shared by the `postgres` and `shadow`
 * backends so shadow's mirror is configured identically to a real PostgreSQL authority.
 */
function resolvePostgresConfig(
  env: Record<string, string | undefined>,
  service: string,
  productionMode: boolean,
): NonNullable<MeerkatStoreRuntimeConfig['postgres']> {
  const connectionString = requiredValue(env, 'MEERKAT_POSTGRES_URL');
  const sslMode = optionalValue(env, 'MEERKAT_POSTGRES_SSL_MODE') ?? 'verify-full';
  if (sslMode !== 'disable' && sslMode !== 'require' && sslMode !== 'verify-full') {
    throw new Error(
      'MEERKAT_POSTGRES_SSL_MODE must be disable, require, or verify-full',
    );
  }
  if (productionMode && sslMode !== 'verify-full') {
    throw new Error('Production PostgreSQL connections require verify-full TLS');
  }
  const sslCaFile = optionalValue(env, 'MEERKAT_POSTGRES_SSL_CA_FILE');
  if (sslMode === 'verify-full' && !sslCaFile) {
    throw new Error('verify-full PostgreSQL TLS requires MEERKAT_POSTGRES_SSL_CA_FILE');
  }
  return {
    connectionString,
    sslMode,
    ...(sslCaFile ? { sslCaFile } : {}),
    applicationName: `meerkat-${service}`,
  };
}
