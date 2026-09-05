import type { S3Credentials } from './adapters/s3';
import type { WebdavCredentials } from './adapters/webdav';

export interface WebdavDestinationConfig {
  kind: 'webdav';
  baseUrl: string;
}

export interface S3DestinationConfig {
  kind: 's3';
  endpoint: string;
  bucket: string;
  region: string;
  prefix?: string;
}

export interface ConnectedServerDestinationConfig {
  kind: 'connected_server';
  descriptorUrl: string;
  operatorPublicKey: string;
}

export type CredentialDestinationConfig = WebdavDestinationConfig | S3DestinationConfig
  | ConnectedServerDestinationConfig;

export function serializeCredentialDestinationConfig(config: CredentialDestinationConfig): string {
  validateDestinationConfig(config);
  return JSON.stringify(config);
}

export function parseCredentialDestinationConfig(value: string | null): CredentialDestinationConfig | null {
  if (value === null || value.length > 16_384) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return null;
  }
  try {
    validateDestinationConfig(parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function serializeWebdavCredentials(credentials: WebdavCredentials): string {
  validateText(credentials.username, 'WebDAV username', 1, 1_024);
  validateText(credentials.password, 'WebDAV password', 1, 16_384);
  return JSON.stringify({ username: credentials.username, password: credentials.password });
}

export function parseWebdavCredentials(value: string | null): WebdavCredentials | null {
  const parsed = parseRecord(value);
  if (parsed === null || exactKeys(parsed, ['password', 'username']) === false
    || typeof parsed.username !== 'string' || typeof parsed.password !== 'string') return null;
  try {
    validateText(parsed.username, 'WebDAV username', 1, 1_024);
    validateText(parsed.password, 'WebDAV password', 1, 16_384);
    return { username: parsed.username, password: parsed.password };
  } catch {
    return null;
  }
}

export function serializeS3Credentials(credentials: S3Credentials): string {
  validateText(credentials.accessKeyId, 'S3 access key id', 1, 1_024);
  validateText(credentials.secretAccessKey, 'S3 secret access key', 1, 16_384);
  if (credentials.sessionToken !== undefined) {
    validateText(credentials.sessionToken, 'S3 session token', 1, 32_768);
  }
  return JSON.stringify(credentials);
}

export function parseS3Credentials(value: string | null): S3Credentials | null {
  const parsed = parseRecord(value);
  if (parsed === null || typeof parsed.accessKeyId !== 'string'
    || typeof parsed.secretAccessKey !== 'string'
    || (parsed.sessionToken !== undefined && typeof parsed.sessionToken !== 'string')) return null;
  const keys = Object.keys(parsed).sort();
  if (keys.some((key) => !['accessKeyId', 'secretAccessKey', 'sessionToken'].includes(key))) return null;
  try {
    validateText(parsed.accessKeyId, 'S3 access key id', 1, 1_024);
    validateText(parsed.secretAccessKey, 'S3 secret access key', 1, 16_384);
    if (typeof parsed.sessionToken === 'string') {
      validateText(parsed.sessionToken, 'S3 session token', 1, 32_768);
    }
    return {
      accessKeyId: parsed.accessKeyId,
      secretAccessKey: parsed.secretAccessKey,
      ...(typeof parsed.sessionToken === 'string' ? { sessionToken: parsed.sessionToken } : {}),
    };
  } catch {
    return null;
  }
}

function validateDestinationConfig(value: unknown): asserts value is CredentialDestinationConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('destination configuration is invalid');
  }
  const record = value as Record<string, unknown>;
  if (record.kind === 'webdav') {
    if (!exactKeys(record, ['baseUrl', 'kind']) || typeof record.baseUrl !== 'string') {
      throw new Error('WebDAV configuration is invalid');
    }
    validateUrl(record.baseUrl, 'WebDAV URL');
    return;
  }
  if (record.kind === 's3') {
    if (Object.keys(record).some((key) => !['bucket', 'endpoint', 'kind', 'prefix', 'region'].includes(key))
      || typeof record.endpoint !== 'string' || typeof record.bucket !== 'string'
      || typeof record.region !== 'string'
      || (record.prefix !== undefined && typeof record.prefix !== 'string')) {
      throw new Error('S3 configuration is invalid');
    }
    validateUrl(record.endpoint, 'S3 endpoint');
    validateText(record.bucket, 'S3 bucket', 1, 255);
    validateText(record.region, 'S3 region', 1, 100);
    if (typeof record.prefix === 'string') validateText(record.prefix, 'S3 prefix', 1, 500);
    return;
  }
  if (record.kind === 'connected_server') {
    if (!exactKeys(record, ['descriptorUrl', 'kind', 'operatorPublicKey'])
      || typeof record.descriptorUrl !== 'string'
      || typeof record.operatorPublicKey !== 'string') {
      throw new Error('connected server configuration is invalid');
    }
    validateUrl(record.descriptorUrl, 'Connected server descriptor URL');
    if (!/^[a-f0-9]{64}$/u.test(record.operatorPublicKey)) {
      throw new Error('Connected server operator key is invalid');
    }
    return;
  }
  throw new Error('destination configuration is invalid');
}

function validateUrl(value: string, label: string): void {
  validateText(value, label, 1, 4_096);
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`${label} is invalid`);
}

function validateText(value: string, label: string, minimum: number, maximum: number): void {
  if (value.length < minimum || value.length > maximum || /[\0\r\n]/u.test(value)) {
    throw new Error(`${label} is invalid`);
  }
}

function parseRecord(value: string | null): Record<string, unknown> | null {
  if (value === null || value.length > 65_536) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function exactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(record).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}
