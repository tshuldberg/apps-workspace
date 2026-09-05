import { describe, expect, it } from 'vitest';
import {
  parseReleaseManifest,
  safeParseReleaseManifest,
  canonicalizeManifest,
  verifyDeployAgainstManifest,
  type ReleaseManifest,
} from '../release-manifest';

const GIT_SHA = 'a'.repeat(40);
const DIGEST_A = `sha256:${'0'.repeat(64)}`;
const DIGEST_B = `sha256:${'1'.repeat(64)}`;
const CONFIG_DIGEST = 'b'.repeat(64);

function image(overrides: Partial<ReleaseManifest['images'][number]> = {}): ReleaseManifest['images'][number] {
  return {
    name: 'relay',
    repository: 'ghcr.io/meerkat/relay',
    digest: DIGEST_A,
    sbomRef: 'ghcr.io/meerkat/relay:sbom',
    scanResultRef: 'ghcr.io/meerkat/relay:scan',
    attestationRef: 'ghcr.io/meerkat/relay:attest',
    signatureRef: 'ghcr.io/meerkat/relay:sig',
    ...overrides,
  };
}

function manifest(overrides: Partial<ReleaseManifest> = {}): ReleaseManifest {
  return {
    schemaVersion: 1,
    gitSha: GIT_SHA,
    images: [image()],
    migrationRange: { lowest: 1, highest: 10 },
    configSchemaDigest: CONFIG_DIGEST,
    mobileBuild: null,
    webArtifact: null,
    rollbackReleaseId: null,
    ...overrides,
  };
}

describe('releaseManifestSchema', () => {
  it('rejects duplicate image names and duplicate repository+digest pins', () => {
    const dupName = safeParseReleaseManifest(manifest({
      images: [image(), image({ repository: 'ghcr.io/meerkat/other', digest: DIGEST_B })],
    }));
    expect(dupName.success).toBe(false);
    if (!dupName.success) {
      expect(dupName.error.issues.some((issue) => issue.message.includes('duplicate image name'))).toBe(true);
    }
    const dupPin = safeParseReleaseManifest(manifest({
      images: [image(), image({ name: 'relay-copy' })],
    }));
    expect(dupPin.success).toBe(false);
    if (!dupPin.success) {
      expect(dupPin.error.issues.some((issue) => issue.message.includes('duplicate image pin'))).toBe(true);
    }
  });

  it('round-trips a valid manifest', () => {
    const parsed = parseReleaseManifest(manifest());
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]!.digest).toBe(DIGEST_A);
    expect(parsed.mobileBuild).toBeNull();
  });

  it('accepts a founder-supplied mobile build and web artifact', () => {
    const parsed = parseReleaseManifest(
      manifest({
        mobileBuild: { ref: 'testflight://build/42', founderSupplied: true },
        webArtifact: { ref: 'vercel://deploy/abc', founderSupplied: true },
        rollbackReleaseId: 'release-2026-07-01',
      }),
    );
    expect(parsed.mobileBuild).toEqual({ ref: 'testflight://build/42', founderSupplied: true });
    expect(parsed.webArtifact?.founderSupplied).toBe(true);
    expect(parsed.rollbackReleaseId).toBe('release-2026-07-01');
  });

  it('rejects a tag-only repository (NC-44.4)', () => {
    const result = safeParseReleaseManifest(
      manifest({ images: [image({ repository: 'ghcr.io/meerkat/relay:v1.2.3' })] }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a repository carrying an embedded @digest', () => {
    const result = safeParseReleaseManifest(
      manifest({ images: [image({ repository: `ghcr.io/meerkat/relay@${DIGEST_A}` })] }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a malformed image digest', () => {
    expect(safeParseReleaseManifest(manifest({ images: [image({ digest: 'sha256:not-hex' })] })).success).toBe(false);
    expect(safeParseReleaseManifest(manifest({ images: [image({ digest: 'v1.2.3' })] })).success).toBe(false);
    expect(safeParseReleaseManifest(manifest({ images: [image({ digest: `sha256:${'a'.repeat(63)}` })] })).success).toBe(false);
  });

  it('rejects an empty images array', () => {
    expect(safeParseReleaseManifest(manifest({ images: [] })).success).toBe(false);
  });

  it('rejects an image entry missing a reference field', () => {
    const bad = image();
    // @ts-expect-error deliberately dropping a required field
    delete bad.signatureRef;
    expect(safeParseReleaseManifest(manifest({ images: [bad] })).success).toBe(false);
  });

  it('rejects a migrationRange with lowest > highest', () => {
    expect(safeParseReleaseManifest(manifest({ migrationRange: { lowest: 11, highest: 10 } })).success).toBe(false);
  });

  it('accepts a single-migration range (lowest == highest)', () => {
    expect(safeParseReleaseManifest(manifest({ migrationRange: { lowest: 7, highest: 7 } })).success).toBe(true);
  });

  it('rejects a negative or non-integer migration id', () => {
    expect(safeParseReleaseManifest(manifest({ migrationRange: { lowest: -1, highest: 10 } })).success).toBe(false);
    expect(safeParseReleaseManifest(manifest({ migrationRange: { lowest: 1.5, highest: 10 } })).success).toBe(false);
  });

  it('rejects a non-40-hex git SHA', () => {
    expect(safeParseReleaseManifest(manifest({ gitSha: 'abc' })).success).toBe(false);
    expect(safeParseReleaseManifest(manifest({ gitSha: 'A'.repeat(40) })).success).toBe(false);
  });

  it('rejects a non-64-hex config schema digest', () => {
    expect(safeParseReleaseManifest(manifest({ configSchemaDigest: 'short' })).success).toBe(false);
  });

  it('rejects a non-null mobileBuild without founderSupplied:true (honesty gate)', () => {
    const result = safeParseReleaseManifest(
      // @ts-expect-error founderSupplied literal is required on a present slot
      manifest({ mobileBuild: { ref: 'testflight://build/42' } }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a mobileBuild with founderSupplied:false', () => {
    const result = safeParseReleaseManifest(
      // @ts-expect-error founderSupplied must be the literal true
      manifest({ mobileBuild: { ref: 'testflight://build/42', founderSupplied: false } }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects unknown top-level keys (strict schema)', () => {
    expect(safeParseReleaseManifest({ ...manifest(), fabricated: 'nope' }).success).toBe(false);
  });
});

describe('canonicalizeManifest', () => {
  it('produces identical output regardless of input key order', () => {
    const a = manifest();
    const reordered = JSON.parse(
      JSON.stringify({
        rollbackReleaseId: null,
        images: a.images,
        gitSha: a.gitSha,
        webArtifact: null,
        schemaVersion: 1,
        configSchemaDigest: a.configSchemaDigest,
        migrationRange: { highest: 10, lowest: 1 },
        mobileBuild: null,
      }),
    );
    expect(canonicalizeManifest(parseReleaseManifest(reordered))).toBe(canonicalizeManifest(a));
  });
});

describe('verifyDeployAgainstManifest', () => {
  it('passes when every deploy ref is digest-pinned and present', () => {
    const result = verifyDeployAgainstManifest(manifest(), [`ghcr.io/meerkat/relay@${DIGEST_A}`]);
    expect(result).toEqual({ ok: true, divergences: [] });
  });

  it('flags a tag-only deploy ref', () => {
    const result = verifyDeployAgainstManifest(manifest(), ['ghcr.io/meerkat/relay:latest']);
    expect(result.ok).toBe(false);
    expect(result.divergences).toEqual([{ ref: 'ghcr.io/meerkat/relay:latest', reason: 'tag_only_ref' }]);
  });

  it('flags a repo:tag@digest ref that still smuggles a mutable tag', () => {
    const ref = `ghcr.io/meerkat/relay:latest@${DIGEST_A}`;
    const result = verifyDeployAgainstManifest(manifest(), [ref]);
    expect(result.ok).toBe(false);
    expect(result.divergences).toEqual([{ ref, reason: 'tag_only_ref' }]);
  });

  it('flags a digest-pinned ref that is not in the manifest', () => {
    const ref = `ghcr.io/meerkat/relay@${DIGEST_B}`;
    const result = verifyDeployAgainstManifest(manifest(), [ref]);
    expect(result.ok).toBe(false);
    expect(result.divergences).toEqual([{ ref, reason: 'not_in_manifest' }]);
  });

  it('does NOT flag a manifest image that a deploy simply does not pull', () => {
    const multi = manifest({
      images: [image(), image({ name: 'community', repository: 'ghcr.io/meerkat/community', digest: DIGEST_B })],
    });
    const result = verifyDeployAgainstManifest(multi, [`ghcr.io/meerkat/relay@${DIGEST_A}`]);
    expect(result).toEqual({ ok: true, divergences: [] });
  });

  it('fails closed on an empty deploy ref set', () => {
    expect(verifyDeployAgainstManifest(manifest(), [])).toEqual({ ok: false, divergences: [] });
  });

  it('enumerates every divergence rather than short-circuiting', () => {
    const result = verifyDeployAgainstManifest(manifest(), [
      'ghcr.io/meerkat/relay:latest',
      `ghcr.io/meerkat/relay@${DIGEST_B}`,
    ]);
    expect(result.ok).toBe(false);
    expect(result.divergences.map((d) => d.reason).sort()).toEqual(['not_in_manifest', 'tag_only_ref']);
  });
});
