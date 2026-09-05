import { z } from 'zod';

/**
 * Release manifest schema + deploy verification (Plan 44 WP-6B).
 *
 * WHAT THIS IS. The zod schema for the jsonb stored in `ops.release_manifests.manifest`,
 * plus the pure NC-44.4 deploy gate. A manifest is the durable, immutable record of
 * exactly what a signed release built: every image by immutable digest with its
 * SBOM / scan / attestation / signature references, the git SHA, the applied
 * migration range, the config-schema digest, and the (honestly nullable) founder-
 * supplied mobile build / web artifact slots. The CI supply-chain workflow (WP-6A)
 * emits a draft of this shape; the CLI (release-cli.ts) validates + records it.
 *
 * NC-44.4 (the tag-only gate). A production deploy must reference every image by
 * an immutable `sha256:` digest, never by a mutable tag. The schema REFUSES a
 * tag-only image reference at parse time: a `repository` that carries a `:tag`
 * suffix, or an image entry missing a well-formed sha256 digest, is invalid. The
 * deploy-side gate (`verifyDeployAgainstManifest`) then requires every deployed
 * image ref to be digest-pinned AND present (by repository+digest) in an approved
 * manifest, enumerating each divergence with a machine-readable reason rather than
 * swallowing it.
 *
 * HONESTY. `mobileBuild` and `webArtifact` are nullable: when a release did not
 * produce one, the slot is `null` (honestly absent), never a fabricated ref. When
 * present, the slot MUST carry `founderSupplied: true` -- the marker that a human
 * attested the artifact, since CI cannot itself build a store-signed mobile binary.
 * A non-null slot without that marker is rejected: the schema never lets a
 * fabricated-looking artifact through unmarked.
 *
 * WHAT THIS GATE DOES NOT VERIFY (stated, not implied). The schema and
 * `verifyDeployAgainstManifest` prove digest-pinning and manifest MEMBERSHIP only.
 * They do NOT cryptographically verify the Cosign signature, the SLSA attestation,
 * the registry origin, or that the evidence refs resolve: that half of NC-44.4 runs
 * at deploy time with `cosign verify` / `gh attestation verify` against the live
 * registry (founder-ops; see the release-promotion runbook). Likewise the CONTENT
 * of a recorded manifest (that these digests were really built from this gitSha) is
 * operator-attested at --record: the CLI validates shape, it cannot re-run CI. And
 * the deploy-ref list handed to --verify must be COMPLETE -- the gate checks every
 * ref it is given; supplying a partial list is an operator failure the tool cannot
 * detect and does not claim to.
 */

/** An immutable OCI content digest: `sha256:` + 64 lowercase hex. */
export const IMAGE_DIGEST = /^sha256:[a-f0-9]{64}$/;

/** 40-char lowercase-hex git commit SHA. */
const GIT_SHA = /^[a-f0-9]{40}$/;

/**
 * 64-char lowercase-hex digest of the deploy configuration contract, defined as
 * sha256 over the raw bytes of `deploy/compose.production.yml` at the release
 * commit. CI derives it in release-images.yml; an operator can recompute it with
 * `shasum -a 256 packages/meerkat-relay/deploy/compose.production.yml`.
 */
const CONFIG_SCHEMA_DIGEST = /^[a-f0-9]{64}$/;

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} must be a non-empty string`);

/**
 * A repository is a registry path with NO tag and NO digest suffix
 * (`ghcr.io/owner/meerkat-relay`). A `:tag` in the repository is the NC-44.4
 * tag-only smell and is rejected here; the digest lives in its own field. A `@`
 * (an embedded digest) is likewise rejected so the repository stays a pure path.
 */
const repository = nonEmpty('repository').refine(
  (value) => !value.includes('@') && !/:[^/]+$/u.test(value),
  { message: 'repository must be a bare path with no :tag or @digest suffix (NC-44.4)' },
);

export const releaseImageSchema = z
  .object({
    name: nonEmpty('image name'),
    repository,
    digest: z
      .string()
      .trim()
      .regex(IMAGE_DIGEST, 'image digest must be sha256:<64 hex> (NC-44.4 tag-only refs are rejected)'),
    sbomRef: nonEmpty('sbomRef'),
    scanResultRef: nonEmpty('scanResultRef'),
    attestationRef: nonEmpty('attestationRef'),
    signatureRef: nonEmpty('signatureRef'),
  })
  .strict();

export type ReleaseImage = z.infer<typeof releaseImageSchema>;

const migrationRangeSchema = z
  .object({
    lowest: z.number().int().nonnegative(),
    highest: z.number().int().nonnegative(),
  })
  .strict()
  .refine((range) => range.lowest <= range.highest, {
    message: 'migrationRange.lowest must be <= migrationRange.highest',
  });

/**
 * A founder-supplied artifact slot. `founderSupplied` is a literal `true`: a
 * present slot is an explicit human attestation, so the schema can never emit a
 * present-but-unattested artifact. When a release produced no such artifact the
 * whole slot is `null` (honestly absent), which every field below allows.
 */
const founderArtifactSchema = z
  .object({
    ref: nonEmpty('artifact ref'),
    founderSupplied: z.literal(true),
  })
  .strict();

/**
 * Image entries must be unique by name AND by (repository, digest): duplicate pins
 * with conflicting SBOM/scan/attestation/signature references would make the
 * recorded evidence ambiguous, and ambiguity in evidence is dishonesty.
 */
const uniqueImages = z
  .array(releaseImageSchema)
  .min(1, 'a release manifest must reference at least one image')
  .superRefine((images, ctx) => {
    const names = new Set<string>();
    const pins = new Set<string>();
    for (const image of images) {
      if (names.has(image.name)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate image name: ${image.name}` });
      }
      names.add(image.name);
      const pin = `${image.repository}@${image.digest}`;
      if (pins.has(pin)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate image pin: ${pin}` });
      }
      pins.add(pin);
    }
  });

export const releaseManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    gitSha: z.string().trim().regex(GIT_SHA, 'gitSha must be a 40-char lowercase hex commit SHA'),
    images: uniqueImages,
    migrationRange: migrationRangeSchema,
    configSchemaDigest: z
      .string()
      .trim()
      .regex(CONFIG_SCHEMA_DIGEST, 'configSchemaDigest must be a 64-char lowercase hex digest'),
    mobileBuild: founderArtifactSchema.nullable(),
    webArtifact: founderArtifactSchema.nullable(),
    rollbackReleaseId: z.string().trim().min(1).nullable(),
  })
  .strict();

export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;

/** Parse + validate an unknown value into a ReleaseManifest, throwing on any violation. */
export function parseReleaseManifest(value: unknown): ReleaseManifest {
  return releaseManifestSchema.parse(value);
}

/** Non-throwing parse for callers that want to branch on the zod error. */
export function safeParseReleaseManifest(value: unknown): z.SafeParseReturnType<unknown, ReleaseManifest> {
  return releaseManifestSchema.safeParse(value);
}

/**
 * A single reason one deployed image ref fails the NC-44.4 gate.
 *
 *  - `tag_only_ref`: the deployed ref is not a `repository@sha256:<digest>` pin
 *    (a bare tag or a malformed digest). Deploying this is exactly what the gate
 *    exists to stop.
 *  - `not_in_manifest`: the ref is digest-pinned but its (repository, digest) pair
 *    is not present in the approved manifest, so it was never built + signed by
 *    this release.
 *
 * A manifest image that no deploy ref uses is NOT a divergence: a release may
 * legitimately publish more images than a given deploy pulls (`manifest_image_unused`
 * is deliberately absent from this union).
 */
export type DeployDivergenceReason = 'tag_only_ref' | 'not_in_manifest';

export interface DeployDivergence {
  ref: string;
  reason: DeployDivergenceReason;
}

export interface DeployVerification {
  ok: boolean;
  divergences: DeployDivergence[];
}

/**
 * Split a `repository@sha256:<digest>` deploy ref into its parts. Returns null for
 * anything that is not a well-formed digest pin: a bare `repo:tag`, a `repo` with
 * no digest, or a `@` suffix that is not a valid sha256 digest. That null IS the
 * tag_only_ref finding upstream.
 */
function parseDigestPinnedRef(ref: string): { repository: string; digest: string } | null {
  const trimmed = ref.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return null;
  const repositoryPart = trimmed.slice(0, at);
  const digestPart = trimmed.slice(at + 1);
  if (!IMAGE_DIGEST.test(digestPart)) return null;
  // A digest-pinned ref's repository half must itself be a bare path: a
  // `repo:tag@sha256:...` still smuggles a mutable tag and is refused.
  if (repositoryPart.includes('@') || /:[^/]+$/u.test(repositoryPart)) return null;
  return { repository: repositoryPart, digest: digestPart };
}

/**
 * The pure NC-44.4 deploy gate. Every deployed image ref must be digest-pinned AND
 * present (by repository+digest) in `manifest.images`. Divergences are enumerated
 * with a reason, never swallowed. An empty deploy set is NOT ok: verifying "no
 * images" against a real release is meaningless and must fail closed.
 */
export function verifyDeployAgainstManifest(
  manifest: ReleaseManifest,
  deployImageRefs: readonly string[],
): DeployVerification {
  const divergences: DeployDivergence[] = [];
  if (deployImageRefs.length === 0) {
    return { ok: false, divergences };
  }
  const manifestPins = new Set(
    manifest.images.map((image) => `${image.repository}@${image.digest}`),
  );
  for (const ref of deployImageRefs) {
    const parsed = parseDigestPinnedRef(ref);
    if (!parsed) {
      divergences.push({ ref, reason: 'tag_only_ref' });
      continue;
    }
    if (!manifestPins.has(`${parsed.repository}@${parsed.digest}`)) {
      divergences.push({ ref, reason: 'not_in_manifest' });
    }
  }
  return { ok: divergences.length === 0, divergences };
}

/**
 * Canonicalize a manifest to a deterministic JSON string with stable (sorted) key
 * order at every depth, so `manifestDigestHex` (sha256 of this string) is stable
 * regardless of the input key order. Arrays keep their order (image order is
 * meaningful); only object keys are sorted.
 */
export function canonicalizeManifest(manifest: ReleaseManifest): string {
  return JSON.stringify(sortValue(manifest));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
