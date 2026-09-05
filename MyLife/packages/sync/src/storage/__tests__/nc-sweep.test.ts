import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertNotSecretLike } from '../schema';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const SYNC_STORAGE_ROOT = join(REPO_ROOT, 'packages/sync/src/storage');
const MOBILE_STORAGE_ROOT = join(REPO_ROOT, 'apps/meerkat/app/(root)/data/storage-destinations');
const WEB_STORAGE_ROOT = join(REPO_ROOT, 'apps/meerkat-web/src/lib/storage');

function read(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf8');
}

function productionTypeScriptFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...productionTypeScriptFiles(path));
    else if (entry.isFile() && ['.ts', '.tsx'].includes(extname(entry.name))) files.push(path);
  }
  return files.sort();
}

function exportedFunctionBlock(source: string, name: string): string {
  const start = source.indexOf(`export function ${name}`);
  if (start < 0) throw new Error(`function ${name} was not found`);
  const bodyStart = source.indexOf('{', start);
  if (bodyStart < 0) throw new Error(`function ${name} has no body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const value = source[index];
    if (value === '{') depth += 1;
    if (value === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`function ${name} has an unterminated body`);
}

function registryKinds(source: string): string[] {
  const match = /DESTINATION_KINDS:[\s\S]*?= \[([\s\S]*?)\] as const;/u.exec(source);
  if (match?.[1] === undefined) throw new Error('destination registry order was not found');
  return [...match[1].matchAll(/'([^']+)'/gu)].map((value) => value[1] ?? '');
}

describe('Plan 41 negative-criteria static sweep', () => {
  it('NC-41.1: router eligibility excludes device private keys and accepts ciphertext-only objects', () => {
    // Arrange
    const router = read('packages/sync/src/storage/router.ts');

    // Act
    const privateKeyRejections = [
      'device_private_key',
      'device_private_keys',
      'identity_private_key',
      'private_key',
    ].map((dataClass) => new RegExp(`${dataClass}: 'device_private_keys_never_routable'`, 'u').test(router));

    // Assert
    expect(privateKeyRejections).toEqual([true, true, true, true]);
    expect(router).toContain('export type RouterEncryptedStorageObject = EncryptedStorageObject;');
    expect(router).toContain('The router never accepts plaintext private data and never encrypts.');
  });

  it('NC-41.3: every SQLite credential_ref write has assertNotSecretLike at the schema seam', () => {
    // Arrange
    const schema = read('packages/sync/src/storage/schema.ts');
    const insert = exportedFunctionBlock(schema, 'insertStorageDestination');
    const update = exportedFunctionBlock(schema, 'updateStorageDestinationCredential');
    const storageFiles = productionTypeScriptFiles(SYNC_STORAGE_ROOT);
    const sqlWriteSites = storageFiles.flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return [...source.matchAll(/(?:INSERT INTO mk_storage_destinations|SET credential_ref = \?)/gu)]
        .map(() => path);
    });

    // Act
    const tokenShapedValues = [
      'Bearer provider-access-token',
      'ya29.provider-access-token',
      `eyJ${'a'.repeat(40)}.${'b'.repeat(40)}.${'c'.repeat(40)}`,
      'ab'.repeat(80),
    ];

    // Assert
    expect([...new Set(sqlWriteSites)]).toEqual([join(SYNC_STORAGE_ROOT, 'schema.ts')]);
    expect(insert).toContain('assertNotSecretLike(row.credential_ref)');
    expect(update).toContain('assertNotSecretLike(credentialRef)');
    for (const value of tokenShapedValues) expect(() => assertNotSecretLike(value)).toThrow();
  });

  it('NC-41.6: WebDAV and S3 ETags remain versions and never populate ciphertextHash', () => {
    // Arrange
    const adapterSources = productionTypeScriptFiles(join(SYNC_STORAGE_ROOT, 'adapters'))
      .map((path) => readFileSync(path, 'utf8'));
    const webdav = read('packages/sync/src/storage/adapters/webdav.ts');
    const s3 = read('packages/sync/src/storage/adapters/s3.ts');

    // Act
    const unsafeAssignments = adapterSources.flatMap((source) => [
      ...source.matchAll(/ciphertextHash\s*:\s*[^,\n]*(?:etag|eTag|ETag)/gu),
    ]);

    // Assert
    expect(unsafeAssignments).toHaveLength(0);
    expect(webdav).toContain('ciphertextHash: null');
    expect(s3).toContain('ciphertextHash: null');
    expect(webdav).toMatch(/remoteVersion:\s*normalizeEtag\(/u);
    expect(s3).toMatch(/remoteVersion:\s*normalizeEtag\(/u);
  });

  it('NC-41.7: hosted remains last-party opt-in, ordered after user destinations, and absent from default policy rows', () => {
    // Arrange
    const mobileRegistry = read('apps/meerkat/app/(root)/data/storage-destinations/destination-registry.ts');
    const webRegistry = read('apps/meerkat-web/src/lib/storage/destination-registry.ts');
    const expectedOrder = [
      'local_device',
      'icloud_drive',
      'google_drive',
      'dropbox',
      'onedrive',
      'box',
      'file_provider',
      'webdav',
      's3',
      'hosted_storage',
      'connected_server',
      'web_directory',
    ];
    const productionSources = [SYNC_STORAGE_ROOT, MOBILE_STORAGE_ROOT, WEB_STORAGE_ROOT]
      .flatMap(productionTypeScriptFiles)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    // Act
    const hostedDefault = /(?:primary_destination_id|mirror_destination_id)\s*:\s*['"]hosted(?:_storage)?['"]/u;

    // Assert
    expect(registryKinds(mobileRegistry)).toEqual(expectedOrder);
    expect(registryKinds(webRegistry)).toEqual(expectedOrder);
    expect(mobileRegistry).toContain('options.hostedStorage?.(destination) ?? null');
    expect(webRegistry).toContain('options.hostedStorage?.(destination) ?? null');
    expect(mobileRegistry).toContain("if (options.hostedStorage) configuredKinds.add('hosted_storage')");
    expect(webRegistry).toContain("if (options.hostedStorage) configuredKinds.add('hosted_storage')");
    expect(productionSources).not.toMatch(hostedDefault);
  });

  it('NC-41.8: unavailable platform or unconfigured factories return null instead of rendering support', () => {
    // Arrange
    const mobileRegistry = read('apps/meerkat/app/(root)/data/storage-destinations/destination-registry.ts');
    const webRegistry = read('apps/meerkat-web/src/lib/storage/destination-registry.ts');

    // Act
    const mobileUnsupported = ['web_directory'];
    const webUnsupported = ['icloud_drive', 'file_provider'];

    // Assert
    for (const kind of mobileUnsupported) {
      expect(mobileRegistry).toContain(`${kind}: () => null`);
    }
    for (const kind of webUnsupported) {
      expect(webRegistry).toContain(`${kind}: () => null`);
    }
    for (const registry of [mobileRegistry, webRegistry]) {
      expect(registry).toContain('options.hostedStorage?.(destination) ?? null');
      expect(registry).toContain('options.connectedServer?.(destination) ?? null');
      expect(registry).toContain("if (options.hostedStorage) configuredKinds.add('hosted_storage')");
      expect(registry).toContain("if (options.connectedServer) configuredKinds.add('connected_server')");
    }
    expect(mobileRegistry).toContain("if (platformOS === 'ios')");
    expect(mobileRegistry).toContain("} else if (platformOS === 'android')");
    expect(webRegistry).not.toContain("configuredKinds.add('icloud_drive')");
    expect(webRegistry).not.toContain("configuredKinds.add('file_provider')");
  });
});
