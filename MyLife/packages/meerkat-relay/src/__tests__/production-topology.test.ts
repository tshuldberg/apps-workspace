import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const compose = readFileSync(path.join(packageRoot, 'deploy/compose.production.yml'), 'utf8');
const communityBin = readFileSync(path.join(packageRoot, 'bin/meerkat-community-node.mjs'), 'utf8');

describe('first-party production topology', () => {
  it('mounts signed storage discovery and every hosted OAuth provider through secret files', () => {
    for (const required of [
      'MEERKAT_STORAGE_OPERATOR_KEY_FILE: /run/secrets/storage-operator-key',
      'MEERKAT_STORAGE_PUBLIC_ENDPOINT:',
      'MEERKAT_OAUTH_KMS_KEY_FILE: /run/secrets/oauth-kms-key',
      'MEERKAT_OAUTH_PROVIDERS: google,dropbox,onedrive,box',
      'MEERKAT_OAUTH_GOOGLE_CLIENT_SECRET_FILE: /run/secrets/oauth-google-client-secret',
      'MEERKAT_OAUTH_DROPBOX_CLIENT_SECRET_FILE: /run/secrets/oauth-dropbox-client-secret',
      'MEERKAT_OAUTH_ONEDRIVE_CLIENT_SECRET_FILE: /run/secrets/oauth-onedrive-client-secret',
      'MEERKAT_OAUTH_BOX_CLIENT_SECRET_FILE: /run/secrets/oauth-box-client-secret',
    ]) expect(compose).toContain(required);
    expect(compose).not.toMatch(/MEERKAT_OAUTH_[A-Z]+_CLIENT_SECRET:\s/u);
  });

  it('composes managed intake and the scanner, seeder, filing, and ClamD safety plane', () => {
    for (const service of ['clamav:', 'archive-scanner:', 'archive-seeder:', 'ncmec-filer:']) {
      expect(compose).toContain(`  ${service}`);
    }
    for (const required of [
      'MEERKAT_ARCHIVE_POSTGRES_URL:',
      'MEERKAT_ARCHIVE_TENANT_CAP_BYTES:',
      'MEERKAT_ARCHIVE_CLAMD_HOST: clamav',
      'MEERKAT_NCMEC_FILING_API_TOKEN_FILE: /run/secrets/ncmec-filing-api-token',
      "fetch('http://127.0.0.1:9896/readyz')",
      "fetch('http://127.0.0.1:9897/readyz')",
      "fetch('http://127.0.0.1:9898/readyz')",
    ]) expect(compose).toContain(required);
    expect(communityBin).toContain('archiveIntake: archiveIntakeOption');
    expect(communityBin).toContain("service: 'archive-intake'");
    expect(communityBin).toContain('quota: { capBytes: () => archiveCapBytes }');
  });

  it('requires validated DMCA agent data and dependency readiness before edge activation', () => {
    for (const field of [
      'MEERKAT_DMCA_AGENT_NAME:', 'MEERKAT_DMCA_AGENT_ORG:', 'MEERKAT_DMCA_AGENT_ADDRESS:',
      'MEERKAT_DMCA_AGENT_EMAIL:', 'MEERKAT_DMCA_AGENT_PHONE:',
      'MEERKAT_DMCA_AGENT_REGISTRATION_DATE:',
    ]) expect(compose).toContain(field);
    const edgeBlock = compose.slice(compose.indexOf('  edge:'), compose.indexOf('\n  relay:'));
    for (const dependency of ['archive-scanner:', 'archive-seeder:', 'ncmec-filer:']) {
      expect(edgeBlock).toContain(`      ${dependency}`);
    }
  });

  it('deploys the plan 51 verification-account service behind the edge on its own role', () => {
    // The account service is a first-party topology member: its own compose
    // service (persona lineage over the platform image, never the slim relay
    // image), its own port, its own database role, and an edge readiness gate.
    expect(compose).toContain('\n  account:\n');
    const accountBlock = compose.slice(compose.indexOf('\n  account:\n'), compose.indexOf('\n  directory:'));
    for (const required of [
      'command: ["./node_modules/.bin/tsx", "bin/meerkat-account-service.mjs"]',
      'PORT: "8896"',
      'MEERKAT_DEPLOYMENT_PROFILE: first-party',
      'MEERKAT_STORE_BACKEND: postgres',
      'MEERKAT_POSTGRES_URL: ${ACCOUNT_DATABASE_URL:?set ACCOUNT_DATABASE_URL for the meerkat_account role}',
      'MEERKAT_POSTGRES_SSL_MODE: verify-full',
      'MEERKAT_POSTGRES_SSL_CA_FILE: /run/secrets/postgres-ca.pem',
      // Fail-fast interpolation (`:?`) is the pinned semantic: a silently-empty
      // wall secret must abort compose interpolation, never boot the service.
      'MEERKAT_ACCOUNT_SESSION_SECRET: ${MEERKAT_ACCOUNT_SESSION_SECRET:?',
      'MEERKAT_ACCOUNT_EPOCH_KEY_SECRET: ${MEERKAT_ACCOUNT_EPOCH_KEY_SECRET:?',
      'MEERKAT_ALLOWED_ORIGINS:',
      // The ASSN root CA rides the mounted-file convention (multiline PEM
      // cannot ride dotenv interpolation).
      'MEERKAT_ASSN_ROOT_CA_FILE:',
      'target: assn-root-ca.pem',
      "fetch('http://127.0.0.1:8896/readyz')",
    ]) expect(accountBlock).toContain(required);
    // THE WALL, deploy-shaped: the account service must not receive any other
    // service's database URL, and no other service may receive the account URL.
    for (const foreign of [
      'PERSONA_DATABASE_URL', 'COMMUNITY_DATABASE_URL', 'MODERATION_DATABASE_URL',
      'HOSTED_DATABASE_URL', 'PUSH_DATABASE_URL', 'DIRECTORY_DATABASE_URL',
      'HUMANITY_DATABASE_URL', 'ARCHIVE_DATABASE_URL',
    ]) expect(accountBlock).not.toContain(foreign);
    expect(compose.split('\n').filter((line) => line.includes('ACCOUNT_DATABASE_URL')).length).toBe(1);
    // Edge exposure: dedicated domain + readiness gate before edge activation.
    const edgeBlock = compose.slice(compose.indexOf('  edge:'), compose.indexOf('\n  relay:'));
    expect(edgeBlock).toContain('ACCOUNT_DOMAIN:');
    expect(edgeBlock).toContain('      account:');
    const caddy = readFileSync(path.join(packageRoot, 'deploy/Caddyfile.production'), 'utf8');
    expect(caddy).toContain('{$ACCOUNT_DOMAIN} {');
    expect(caddy).toContain('reverse_proxy account:8896');
  });

  it('uses mounted files for every private byte-store, OAuth, push, and filing credential', () => {
    for (const pathValue of [
      '/run/secrets/object-store-access-key', '/run/secrets/object-store-secret-key',
      '/run/secrets/oauth-kms-key', '/run/secrets/storage-operator-key',
      '/run/secrets/ncmec-filing-api-token', '/run/secrets/push-token-keys',
    ]) expect(compose).toContain(pathValue);
  });
});
