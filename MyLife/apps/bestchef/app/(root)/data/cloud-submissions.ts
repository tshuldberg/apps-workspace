import {
  ensureSubmissionAlias,
  getDishById,
  getSubmissionById,
  normalizePublicMediaUrl,
  slugify,
  type Submission as CloudSubmission,
  type SubmissionProfileSummary,
} from '@mylife/bestchef';
import type { DatabaseAdapter } from '@mylife/db';
import type { SocialProfile } from '@mylife/social';
import {
  DEMO_DISHES,
  DEMO_SUBMISSIONS,
  type DemoDish,
  type DemoSubmission,
} from './demo';
import { getUgcLanguage } from './app-language';
import { getLocalSubmission, type LocalSubmission } from './local-submissions';
import { canCreateDemoCloudAlias } from './public-data-policy';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEMO_STEPS = [
  'Prepare the ingredients.',
  'Cook and season to taste.',
  'Plate and serve while fresh.',
];

export function isCloudSubmissionId(submissionId: string | null | undefined): boolean {
  return typeof submissionId === 'string' && UUID_PATTERN.test(submissionId);
}

function formatCloudDate(value: Date): string {
  return value.toISOString().split('T')[0] ?? value.toISOString();
}

function cloudAlias(prefix: 'demo' | 'local', id: string): string {
  return `${prefix}:${id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80)}`;
}

function recipeIngredientLines(value: unknown): string[] {
  const parsed = typeof value === 'string' ? parseJson(value) : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (typeof item === 'string') return [item];
    if (!item || typeof item !== 'object') return [];
    const row = item as { name?: unknown; quantity?: unknown; unit?: unknown; item?: unknown };
    if (typeof row.name === 'string' && row.name.trim()) return [row.name.trim()];
    const parts = [row.quantity, row.unit, row.item]
      .filter((part): part is string | number => typeof part === 'string' || typeof part === 'number')
      .map((part) => String(part).trim())
      .filter(Boolean);
    return parts.length > 0 ? [parts.join(' ')] : [];
  });
}

function recipeStepLines(value: unknown): string[] {
  const parsed = typeof value === 'string' ? parseJson(value) : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (typeof item === 'string') return [item];
    if (!item || typeof item !== 'object') return [];
    const instruction = (item as { instruction?: unknown }).instruction;
    return typeof instruction === 'string' && instruction.trim() ? [instruction.trim()] : [];
  });
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function localDishForSubmission(submission: DemoSubmission | LocalSubmission): DemoDish | null {
  return DEMO_DISHES.find((dish) => dish.id === submission.dishId) ?? null;
}

function submissionDishSlug(
  submission: DemoSubmission | LocalSubmission,
  dish: DemoDish | null,
): string {
  return dish?.slug ?? slugify('dishName' in submission ? submission.dishName : submission.dishId);
}

function demoAliasInput(
  profile: SocialProfile,
  submission: DemoSubmission,
  dish: DemoDish,
) {
  return {
    alias: cloudAlias('demo', submission.id),
    profileId: profile.id,
    dishSlug: dish.slug,
    title: submission.title,
    description: submission.description,
    ingredients: submission.ingredients,
    steps: DEMO_STEPS,
    tags: submission.tags,
    photoUrl: normalizePublicMediaUrl(submission.photoUrl),
    language: getUgcLanguage(),
  };
}

function localAliasInput(
  profile: SocialProfile,
  submission: LocalSubmission,
  dish: DemoDish | null,
  resolvedPhotoUrl: string | null,
) {
  return {
    alias: cloudAlias('local', submission.id),
    profileId: profile.id,
    dishSlug: submissionDishSlug(submission, dish),
    title: submission.title,
    description: submission.description,
    ingredients: submission.ingredients,
    steps: submission.instructions,
    // Prefer the caller-resolved (already-uploaded) public URL. Fall back
    // to the local URI which `normalizePublicMediaUrl` reduces to null
    // when it is a file:// or content:// URI. The cloud-side
    // `bc_submissions_photo_url_https` constraint accepts only https or
    // null.
    photoUrl: resolvedPhotoUrl ?? normalizePublicMediaUrl(submission.photoUri),
    // Authoring-time language when the row has one (V31); the current app
    // language is only the fallback for pre-V31 rows.
    language: submission.language ?? getUgcLanguage(),
  };
}

export async function ensureCloudSubmissionForDemoSubmission(
  profile: SocialProfile,
  submission: DemoSubmission,
  options: { allowDemoCloudAliases?: boolean } = {},
): Promise<string | null> {
  const allowed = options.allowDemoCloudAliases ?? canCreateDemoCloudAlias();
  if (!allowed) return null;

  const dish = localDishForSubmission(submission);
  if (!dish) return null;

  const result = await ensureSubmissionAlias(demoAliasInput(profile, submission, dish));
  return result.ok ? result.data : null;
}

export async function ensureCloudSubmissionForLocalSubmission(
  profile: SocialProfile,
  submission: LocalSubmission,
  options: { resolvedPhotoUrl?: string | null } = {},
): Promise<string | null> {
  const resolvedPhotoUrl = options.resolvedPhotoUrl ?? null;
  const result = await ensureSubmissionAlias(
    localAliasInput(
      profile,
      submission,
      localDishForSubmission(submission),
      resolvedPhotoUrl,
    ),
  );
  return result.ok ? result.data : null;
}

export async function ensureCloudSubmissionForAppId(
  db: DatabaseAdapter,
  profile: SocialProfile,
  submissionId: string | null | undefined,
): Promise<string | null> {
  const resolution = await resolveCloudSubmissionForAppId(db, profile, submissionId);
  return resolution.ok ? resolution.cloudId : null;
}

/**
 * Like ensureCloudSubmissionForAppId, but distinguishes "this submission no
 * longer exists anywhere" (permanent) from "the alias bridge call failed"
 * (transient, e.g. offline). The background proof-draft sweep needs the
 * distinction to avoid permanently failing queued votes on a dead network.
 */
export type CloudSubmissionResolution =
  | { ok: true; cloudId: string }
  | { ok: false; permanent: boolean };

export async function resolveCloudSubmissionForAppId(
  db: DatabaseAdapter,
  profile: SocialProfile,
  submissionId: string | null | undefined,
): Promise<CloudSubmissionResolution> {
  if (!submissionId) return { ok: false, permanent: true };
  if (isCloudSubmissionId(submissionId)) return { ok: true, cloudId: submissionId };

  const demoSubmission = DEMO_SUBMISSIONS.find((submission) => submission.id === submissionId);
  if (demoSubmission) {
    // Policy-gated demo aliases and missing dishes never resolve; only the
    // network call itself is worth retrying.
    if (!canCreateDemoCloudAlias() || !localDishForSubmission(demoSubmission)) {
      return { ok: false, permanent: true };
    }
    const cloudId = await ensureCloudSubmissionForDemoSubmission(profile, demoSubmission);
    return cloudId ? { ok: true, cloudId } : { ok: false, permanent: false };
  }

  const localSubmission = getLocalSubmission(db, submissionId);
  if (localSubmission) {
    const cloudId = await ensureCloudSubmissionForLocalSubmission(profile, localSubmission);
    return cloudId ? { ok: true, cloudId } : { ok: false, permanent: false };
  }

  return { ok: false, permanent: true };
}

function mapCloudSubmission(
  submission: CloudSubmission,
  title: string,
  description: string | null,
  ingredients: string[],
  steps: string[],
  profile: SocialProfile | null,
  publicProfile: SubmissionProfileSummary | null | undefined,
  dishId: string,
): DemoSubmission {
  const isMine = profile?.id === submission.profileId;
  const chefName = isMine
    ? profile.displayName
    : publicProfile?.displayName ?? 'BestChef Cook';
  const chefHandle = isMine
    ? profile.handle
    : publicProfile?.handle ?? 'bestchef';

  return {
    id: submission.id,
    dishId,
    chefId: submission.profileId,
    chefName,
    chefHandle,
    title,
    description: description ?? '',
    photoUrl: submission.photoUrl ?? undefined,
    voteScore: submission.voteScore,
    likeCount: submission.likeCount,
    rank: submission.rank ?? 1,
    photoVerified: submission.photoVerified,
    createdAt: formatCloudDate(submission.createdAt),
    tags: [],
    ingredients,
    steps,
    upvoteCount: submission.upvoteCount ?? 0,
    downvoteCount: submission.downvoteCount ?? 0,
    reviewedCount: submission.reviewedCount ?? 0,
  };
}

export async function getCloudSubmissionViewModel(
  submissionId: string,
  profile: SocialProfile | null,
): Promise<DemoSubmission | null> {
  if (!isCloudSubmissionId(submissionId)) return null;

  const result = await getSubmissionById(submissionId);
  if (!result.ok) return null;

  const dishResult = await getDishById(result.data.submission.dishId);
  const localDishId = dishResult.ok
    ? DEMO_DISHES.find((dish) => dish.slug === dishResult.data.dish.slug)?.id
      ?? result.data.submission.dishId
    : result.data.submission.dishId;

  return mapCloudSubmission(
    result.data.submission,
    result.data.snapshot.title,
    result.data.snapshot.description,
    recipeIngredientLines(result.data.snapshot.ingredientsJson),
    recipeStepLines(result.data.snapshot.stepsJson),
    profile,
    result.data.profile,
    localDishId,
  );
}
