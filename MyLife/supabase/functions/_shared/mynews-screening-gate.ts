// Pre-publication screening gate for the MyNews write edges (plan 48 WP8).
//
// One implementation shared by publish, suggest, review, and comment so the
// four paths cannot diverge on the thing that matters: whether flagged content
// reaches readers. Each edge calls runScreeningGate after its own validation and
// before its store write, then acts on the typed verdict.
//
// Fail-closed rules encoded here:
//   a screening read or write failure is 'unavailable' (retryable 503), never an
//     implicit allow: content that could not be screened is not published
//   an external vendor is optional, is never trusted to clear anything, and an
//     absent vendor is an explicit state rather than a verdict
//   an approved allowance short-circuits screening for those exact bytes only,
//     which is what makes an approved resubmission terminable

import {
  isQuarantined,
  screenWithProvider,
  type ScreeningContentKind as EngineContentKind,
  type ScreeningProvider,
  type ScreeningSignature,
  type ScreeningVerdict,
} from './mynews-screening.ts';
import type { MyNewsStore, ScreeningContentKind } from './mynews-store.ts';

/** Env keys for the optional external vendor. Absent means local-only. */
export const ENV_SCREENING_VENDOR_URL = 'MYNEWS_SCREENING_VENDOR_URL';
export const ENV_SCREENING_VENDOR_KEY = 'MYNEWS_SCREENING_VENDOR_KEY';
export const ENV_SCREENING_VENDOR_NAME = 'MYNEWS_SCREENING_VENDOR_NAME';

export type ScreeningGateOutcome =
  | { decision: 'allow'; verdict: ScreeningVerdict | null; contentSha256: string; allowance: boolean }
  | { decision: 'hold'; verdict: ScreeningVerdict; contentSha256: string }
  | { decision: 'unavailable'; detail: string };

export interface ScreeningGateInput {
  store: MyNewsStore;
  /** The store's content-kind vocabulary; mapped to the engine's below. */
  kind: ScreeningContentKind;
  /** The profile that authored the bytes, for allowances and flood history. */
  authorProfileId: string;
  /** Primary prose. */
  text: string;
  /** Short secondary prose: headline, dek, or rationale. */
  title?: string;
  /** Author-declared links (citations). */
  links?: readonly string[];
  env?: (key: string) => string | undefined;
  /** Injected in tests. */
  fetchImpl?: typeof fetch;
  provider?: ScreeningProvider | null;
}

/**
 * Canonical bytes the hash and the verdict both cover. Field separators are
 * unit-separator characters so no field boundary can be forged from content, and
 * the kind is included so identical text approved as a comment does not become
 * an allowance for an article.
 */
export function canonicalScreeningPayload(input: {
  kind: string;
  text: string;
  title?: string;
  links?: readonly string[];
}): string {
  const US = '\u001f';
  return [
    input.kind,
    input.title ?? '',
    input.text,
    (input.links ?? []).join('\u001e'),
  ].join(US);
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The store kinds that map onto an engine content kind. */
function engineKind(kind: ScreeningContentKind): EngineContentKind {
  switch (kind) {
    case 'suggestion':
      return 'suggestion';
    case 'comment':
      return 'comment';
    case 'article':
      return 'article';
    case 'revision':
    case 'revision-proposal':
    default:
      return 'revision';
  }
}

/**
 * HTTP vendor provider, active only when both the URL and the key are set. It
 * reads per-class scores from the response and ignores everything else: a vendor
 * cannot return a decision, only evidence.
 *
 * Failure mapping is deliberate. A non-2xx response or a body that is not
 * score-shaped is a vendor FAILURE and throws, so the gate records
 * 'failed' rather than the softer 'declined'. Only a well-formed response with
 * no scores counts as the vendor finding nothing. Either way the local verdict
 * stands, but the recorded provider state stays honest about what happened.
 */
export function resolveScreeningProvider(
  env: (key: string) => string | undefined,
  fetchImpl: typeof fetch,
): ScreeningProvider | null {
  const url = env(ENV_SCREENING_VENDOR_URL);
  const key = env(ENV_SCREENING_VENDOR_KEY);
  if (!url || !key) return null;
  const name = env(ENV_SCREENING_VENDOR_NAME) || 'vendor';
  return {
    name,
    async screen(input) {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ kind: input.kind, text: input.text, title: input.title ?? '' }),
      });
      if (!res.ok) {
        throw new Error(`mynews screening vendor returned ${res.status}`);
      }
      const body = (await res.json()) as { classScores?: Record<string, unknown> } | null;
      if (!body || typeof body !== 'object' || typeof body.classScores !== 'object') {
        throw new Error('mynews screening vendor returned a body with no classScores');
      }
      const scores: Record<string, number> = {};
      for (const [cls, value] of Object.entries(body.classScores ?? {})) {
        if (typeof value === 'number' && Number.isFinite(value)) scores[cls] = value;
      }
      return { classScores: scores as never };
    },
  };
}

function asSignatures(rows: unknown[]): ScreeningSignature[] {
  const out: ScreeningSignature[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const candidate = row as { version?: unknown; seed?: unknown; slots?: unknown };
    if (
      typeof candidate.version === 'number' &&
      typeof candidate.seed === 'number' &&
      Array.isArray(candidate.slots) &&
      candidate.slots.every((slot) => typeof slot === 'number')
    ) {
      out.push({
        version: candidate.version,
        seed: candidate.seed,
        slots: candidate.slots as number[],
      });
    }
  }
  return out;
}

/**
 * Run the gate. Returns 'allow' (publish normally), 'hold' (store non-public and
 * tell the author), or 'unavailable' (retryable failure; nothing was written).
 */
export async function runScreeningGate(
  input: ScreeningGateInput,
): Promise<ScreeningGateOutcome> {
  const payload = canonicalScreeningPayload({
    kind: input.kind,
    text: input.text,
    title: input.title,
    links: input.links,
  });

  let contentSha256: string;
  try {
    contentSha256 = await sha256Hex(payload);
  } catch (error) {
    console.error('mynews screening hash failed', error);
    return { decision: 'unavailable', detail: 'screening is temporarily unavailable' };
  }

  try {
    if (await input.store.screeningAllowanceExists(input.authorProfileId, contentSha256)) {
      // A human already approved these exact bytes from this author. Screening
      // them again would re-hold approved content forever.
      return { decision: 'allow', verdict: null, contentSha256, allowance: true };
    }
  } catch (error) {
    console.error('mynews screening allowance read failed', error);
    return { decision: 'unavailable', detail: 'screening is temporarily unavailable' };
  }

  let recentSignatures: ScreeningSignature[] = [];
  try {
    recentSignatures = asSignatures(
      await input.store.getRecentContentSignatures(input.authorProfileId, 25),
    );
  } catch (error) {
    // Flood history is an enrichment, not a gate. Losing it weakens one signal;
    // it does not mean the submission escaped screening, so this is not a
    // fail-closed condition. The verdict below still runs on the content.
    console.error('mynews screening signature history read failed', error);
  }

  const env = input.env ?? (() => undefined);
  const provider =
    input.provider !== undefined
      ? input.provider
      : resolveScreeningProvider(env, input.fetchImpl ?? fetch);

  let screened: Awaited<ReturnType<typeof screenWithProvider>>;
  try {
    screened = await screenWithProvider(
      {
        kind: engineKind(input.kind),
        text: input.text,
        title: input.title,
        links: input.links,
        recentSignatures,
      },
      { provider },
    );
  } catch (error) {
    console.error('mynews screening engine failed', error);
    return { decision: 'unavailable', detail: 'screening is temporarily unavailable' };
  }

  const verdict: ScreeningVerdict = {
    ...screened.verdict,
    // Persist what actually happened on the vendor leg. The console shows this
    // verbatim so it never implies a vendor reviewed something it did not see.
    explanations: [...screened.verdict.explanations, screened.providerNote],
  };
  const verdictForStore = { ...verdict, providerState: screened.providerState };

  try {
    await input.store.recordContentSignature({
      authorProfileId: input.authorProfileId,
      contentKind: input.kind,
      signature: verdict.signature,
    });
  } catch (error) {
    // Same reasoning as the history read: this only affects future flood
    // detection, so it is logged rather than turned into a refusal.
    console.error('mynews screening signature write failed', error);
  }

  if (isQuarantined(verdict)) {
    return { decision: 'hold', verdict: verdictForStore, contentSha256 };
  }
  return { decision: 'allow', verdict: verdictForStore, contentSha256, allowance: false };
}

/**
 * Author-facing copy for a hold. Honest by construction: the content is not
 * public, a person will look at it, and the class is named without handing back
 * the detector's internals.
 */
export function screeningHoldDetail(verdict: ScreeningVerdict): string {
  const cls = verdict.topClass ? verdict.topClass.replace(/-/g, ' ') : 'policy';
  return `This submission is not published. It was flagged for ${cls} review and is waiting for a person to look at it. You can appeal from your account.`;
}

/**
 * Record a below-threshold allow when the verdict asked to be recorded. Failure
 * to record is logged and swallowed: the content is already publishable, and
 * losing a measurement row must not fail a legitimate publish.
 */
export async function recordScreeningAllowIfNeeded(input: {
  store: MyNewsStore;
  kind: ScreeningContentKind;
  contentId: string;
  contentRev: number | null;
  authorProfileId: string;
  contentSha256: string;
  verdict: ScreeningVerdict | null;
}): Promise<void> {
  if (!input.verdict || !input.verdict.recorded) return;
  try {
    await input.store.recordScreeningAllow({
      contentKind: input.kind,
      contentId: input.contentId,
      contentRev: input.contentRev,
      authorProfileId: input.authorProfileId,
      contentSha256: input.contentSha256,
      verdict: input.verdict,
    });
  } catch (error) {
    console.error('mynews screening allow record failed', error);
  }
}
