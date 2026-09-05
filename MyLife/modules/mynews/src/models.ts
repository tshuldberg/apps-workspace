import { z } from 'zod';
import { DIFF_OP_KINDS, MYNEWS_BOUNDS, utf8ByteLength } from './data/bounds';

export const SUGGESTION_TYPES = [
  'correction',
  'context',
  'translation',
  'clarity',
  'headline',
  'copyedit',
] as const;
export const SuggestionTypeSchema = z.enum(SUGGESTION_TYPES);
export type SuggestionType = z.infer<typeof SuggestionTypeSchema>;

export const HttpsUrlSchema = z
  .string()
  .url()
  .startsWith('https://')
  .max(MYNEWS_BOUNDS.URL_MAX_CHARS);

export const ArticleSchema = z.object({
  id: z.string().min(1),
  authorKey: z.string().min(1),
  newsroomId: z.string().min(1).optional(),
  kind: z.enum(['news', 'preprint']),
  status: z.enum(['draft', 'published', 'retracted']),
  currentRev: z.number().int().min(0),
  publishedAt: z.string().datetime().optional(),
});
export type Article = z.infer<typeof ArticleSchema>;

export const ChangelogEntrySchema = z.object({
  suggestionId: z.string().min(1),
  editorKey: z.string().min(1),
  type: SuggestionTypeSchema,
});
export type ChangelogEntry = z.infer<typeof ChangelogEntrySchema>;

/** Canonical bounded article text, shared by the revision schema and callers. */
export const HeadlineSchema = z
  .string()
  .min(MYNEWS_BOUNDS.HEADLINE_MIN_CHARS)
  .max(MYNEWS_BOUNDS.HEADLINE_MAX_CHARS);
export const DekSchema = z.string().max(MYNEWS_BOUNDS.DEK_MAX_CHARS);
/** Bodies are bounded in UTF-8 bytes so the limit is script-neutral. */
export const BodyMarkdownSchema = z
  .string()
  .refine((value) => utf8ByteLength(value) <= MYNEWS_BOUNDS.BODY_MAX_BYTES, {
    message: `bodyMd must be at most ${MYNEWS_BOUNDS.BODY_MAX_BYTES} bytes`,
  });

export const ArticleRevisionSchema = z.object({
  articleId: z.string().min(1),
  rev: z.number().int().min(1),
  headline: HeadlineSchema,
  dek: DekSchema.optional(),
  bodyMd: BodyMarkdownSchema,
  signature: z.string().min(1),
  signerPubkey: z.string().min(1),
  changelog: z.array(ChangelogEntrySchema).max(MYNEWS_BOUNDS.CHANGELOG_MAX_ENTRIES),
  createdAt: z.string().datetime(),
});
export type ArticleRevision = z.infer<typeof ArticleRevisionSchema>;

// Structured diff (plan 48 WP4). Before WP4 the diff crossed the wire as
// unvalidated JSON: anything that parsed was stored in nw_edit_suggestions
// .diff_json. Ops are now typed and every count and string is bounded by
// MYNEWS_BOUNDS, matching the DiffOp shape engines/diff.ts actually emits and
// the nw_diff_within_bounds SQL check in 20260730000003.
const DiffBlockSchema = z.string().max(MYNEWS_BOUNDS.DIFF_MAX_BLOCK_CHARS);

export const DiffOpSchema = z.object({
  kind: z.enum(DIFF_OP_KINDS),
  baseIndex: z.number().int().nonnegative(),
  anchorBefore: DiffBlockSchema.nullable(),
  anchorAfter: DiffBlockSchema.nullable(),
  baseBlocks: z.array(DiffBlockSchema).max(MYNEWS_BOUNDS.DIFF_MAX_BLOCKS_PER_OP),
  newBlocks: z.array(DiffBlockSchema).max(MYNEWS_BOUNDS.DIFF_MAX_BLOCKS_PER_OP),
});
export const StructuredDiffSchema = z.object({
  baseHash: z.string().min(1).max(MYNEWS_BOUNDS.DIFF_BASE_HASH_MAX_CHARS),
  ops: z.array(DiffOpSchema).max(MYNEWS_BOUNDS.DIFF_MAX_OPS),
});

/**
 * Wire form of a structured diff: the serialized string a client sends to
 * mynews-suggest. Bounded in bytes before it is parsed, then validated against
 * StructuredDiffSchema, so a hostile payload never becomes stored jsonb.
 */
export const StructuredDiffJsonSchema = z
  .string()
  .refine((value) => utf8ByteLength(value) <= MYNEWS_BOUNDS.DIFF_MAX_BYTES, {
    message: `diffJson must be at most ${MYNEWS_BOUNDS.DIFF_MAX_BYTES} bytes`,
  })
  .transform((value, ctx) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'diffJson is not JSON' });
      return z.NEVER;
    }
  })
  .pipe(StructuredDiffSchema);

const CITATION_REQUIRED: ReadonlySet<SuggestionType> = new Set<SuggestionType>([
  'correction',
  'context',
]);

export const EditSuggestionSchema = z
  .object({
    id: z.string().min(1),
    articleId: z.string().min(1),
    baseRev: z.number().int().min(1),
    editorKey: z.string().min(1),
    type: SuggestionTypeSchema,
    diff: StructuredDiffSchema,
    citations: z.array(HttpsUrlSchema).max(MYNEWS_BOUNDS.CITATIONS_MAX_ITEMS).default([]),
    rationale: z
      .string()
      .min(MYNEWS_BOUNDS.RATIONALE_MIN_CHARS)
      .max(MYNEWS_BOUNDS.RATIONALE_MAX_CHARS),
    status: z.enum(['open', 'accepted', 'partial', 'rejected', 'stale']),
    createdAt: z.string().datetime(),
  })
  .refine((s) => !CITATION_REQUIRED.has(s.type) || s.citations.length > 0, {
    message: 'corrections and context suggestions require at least one citation',
    path: ['citations'],
  });
export type EditSuggestion = z.infer<typeof EditSuggestionSchema>;

/**
 * Suggestion-thread comment (plan 48 WP4). Comments used to be a direct
 * client insert into nw_suggestion_events under an RLS policy, with no length
 * limit and no suspension, terms, or rate gate. They now go through the
 * mynews-comment edge function, which validates this shape.
 */
export const SuggestionCommentSchema = z.object({
  suggestionId: z.string().min(1),
  body: z
    .string()
    .min(MYNEWS_BOUNDS.COMMENT_MIN_CHARS)
    .max(MYNEWS_BOUNDS.COMMENT_MAX_CHARS),
});
export type SuggestionComment = z.infer<typeof SuggestionCommentSchema>;

export const CredibilityEntrySchema = z.object({
  type: SuggestionTypeSchema,
  acceptedAtMs: z.number().int().nonnegative(),
  authorKey: z.string().min(1),
  authorStanding: z.number().min(0).max(1),
  selfEdit: z.boolean().optional(),
});
export type CredibilityEntry = z.infer<typeof CredibilityEntrySchema>;

export const PledgeSchema = z.object({
  journalistId: z.string().min(1),
  amountCents: z.number().int().positive(),
});
export type Pledge = z.infer<typeof PledgeSchema>;

// Content reporting (Apple Guideline 1.2). Mirrors the nw_reports CHECK
// constraints in supabase/migrations/20260703000001_mynews_bootstrap.sql. The
// wire payload is validated against these before the mynews-report function
// resolves the reporter, checks the target exists, and inserts under the
// service role.
export const REPORT_TARGET_KINDS = [
  'article',
  'revision',
  'suggestion',
  'profile',
  'media',
] as const;
export const ReportTargetKindSchema = z.enum(REPORT_TARGET_KINDS);
export type ReportTargetKind = z.infer<typeof ReportTargetKindSchema>;

/**
 * Report reasons, severity-first (plan 48 WP8 taxonomy expansion). Order is the
 * display order in the report sheets on both surfaces, and it matches
 * REPORT_SEVERITY_RANK descending so the most serious option is never buried.
 * Mirrors the nw_reports_reason_taxonomy_v2 CHECK and the nw_report_sla seed in
 * migration 20260730000009.
 */
export const REPORT_REASONS = [
  'child-safety',
  'ncii',
  'threats',
  'violence',
  'self-harm',
  'hate',
  'harassment',
  'impersonation',
  'doxxing-privacy',
  'fraud-scam',
  'copyright',
  'spam',
  'other',
] as const;
export const ReportReasonSchema = z.enum(REPORT_REASONS);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

export const ReportSubmissionSchema = z.object({
  targetKind: ReportTargetKindSchema,
  targetId: z.string().min(1),
  reason: ReportReasonSchema,
  detail: z.string().max(MYNEWS_BOUNDS.REPORT_DETAIL_MAX_CHARS).default(''),
});
export type ReportSubmission = z.infer<typeof ReportSubmissionSchema>;

// Separate DMCA takedown (17 U.S.C. 512(c)(3)) and counter-notice
// (17 U.S.C. 512(g)(3)) contracts. The exact attestation text and version are
// part of the payload so the database preserves what the submitter accepted.
// Counsel approval and designated-agent registration remain operational gates.
export const DMCA_NOTICE_KINDS = ['takedown', 'counter'] as const;
export const DmcaNoticeKindSchema = z.enum(DMCA_NOTICE_KINDS);
export type DmcaNoticeKind = z.infer<typeof DmcaNoticeKindSchema>;

export const DMCA_ATTESTATION_VERSION = '2026-07-12' as const;
export const DMCA_TAKEDOWN_GOOD_FAITH_ATTESTATION_TEXT =
  'I have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.' as const;
export const DMCA_TAKEDOWN_ACCURACY_ATTESTATION_TEXT =
  'I state under penalty of perjury that the information in this notice is accurate and that I am the copyright owner or am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.' as const;
export const DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT =
  'I state under penalty of perjury that I have a good-faith belief that the material was removed or disabled as a result of mistake or misidentification of the material to be removed or disabled.' as const;
export const DMCA_COUNTER_JURISDICTION_ATTESTATION_TEXT =
  'I consent to the jurisdiction of the Federal District Court for the judicial district in which my address is located, or if my address is outside the United States, for any judicial district in which MyNews may be found.' as const;
export const DMCA_COUNTER_SERVICE_ATTESTATION_TEXT =
  "I will accept service of process from the person who submitted the original notice of claimed infringement, or that person's agent." as const;

export const DmcaTakedownSchema = z.object({
  kind: z.literal('takedown'),
  complainantName: z.string().min(1).max(200),
  complainantEmail: z.string().email().max(320),
  complainantAddress: z.string().max(1000).default(''),
  copyrightedWork: z.string().min(1).max(2000),
  infringingUrl: HttpsUrlSchema.max(2000),
  goodFaith: z.literal(true),
  goodFaithAttestationText: z.literal(DMCA_TAKEDOWN_GOOD_FAITH_ATTESTATION_TEXT),
  goodFaithAttestationVersion: z.literal(DMCA_ATTESTATION_VERSION),
  accuracyUnderPenalty: z.literal(true),
  accuracyAttestationText: z.literal(DMCA_TAKEDOWN_ACCURACY_ATTESTATION_TEXT),
  accuracyAttestationVersion: z.literal(DMCA_ATTESTATION_VERSION),
  signature: z.string().min(1).max(200),
});
export type DmcaTakedown = z.infer<typeof DmcaTakedownSchema>;

export const DmcaCounterNoticeSchema = z.object({
  kind: z.literal('counter'),
  originalNoticeReference: z.string().max(200).default(''),
  counterNotifierName: z.string().min(1).max(200),
  counterNotifierAddress: z.string().min(1).max(1000),
  counterNotifierPhone: z.string().min(1).max(50),
  counterNotifierEmail: z.string().email().max(320),
  removedMaterial: z.string().min(1).max(4000),
  materialLocationBeforeRemoval: HttpsUrlSchema.max(2000),
  goodFaithMistakeOrMisidentification: z.literal(true),
  statementUnderPenaltyOfPerjury: z.literal(true),
  mistakeAttestationText: z.literal(DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT),
  mistakeAttestationVersion: z.literal(DMCA_ATTESTATION_VERSION),
  consentToFederalJurisdiction: z.literal(true),
  jurisdictionAttestationText: z.literal(DMCA_COUNTER_JURISDICTION_ATTESTATION_TEXT),
  jurisdictionAttestationVersion: z.literal(DMCA_ATTESTATION_VERSION),
  acceptanceOfServiceOfProcess: z.literal(true),
  serviceAttestationText: z.literal(DMCA_COUNTER_SERVICE_ATTESTATION_TEXT),
  serviceAttestationVersion: z.literal(DMCA_ATTESTATION_VERSION),
  signature: z.string().min(1).max(200),
});
export type DmcaCounterNotice = z.infer<typeof DmcaCounterNoticeSchema>;

const DmcaNoticeUnionSchema = z.discriminatedUnion('kind', [
  DmcaTakedownSchema,
  DmcaCounterNoticeSchema,
]);

// Backward-compatible export for callers that imported DmcaNoticeSchema. A
// missing kind still means takedown, matching the original contract. Counter
// payloads now validate against their own statutory shape.
export const DmcaNoticeSchema = z.preprocess((raw) => {
  if (typeof raw !== 'object' || raw === null || 'kind' in raw) return raw;
  return { ...(raw as Record<string, unknown>), kind: 'takedown' };
}, DmcaNoticeUnionSchema);
export type DmcaNotice = z.infer<typeof DmcaNoticeSchema>;
