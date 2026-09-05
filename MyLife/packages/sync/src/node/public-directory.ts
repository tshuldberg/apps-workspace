/**
 * Public directory client (Plan 19, Meerkat Public Social Layer -- P2).
 *
 * The PUBLIC twin of node/host-registry.ts, DELIBERATELY NOT sealed. Where
 * host-registry seals each host record under a contentId-derived key (only
 * share-link holders can read it), a publication is meant to be discoverable and
 * readable by ANYONE, so the record is the signed PublicationDescriptor stored
 * verbatim. Trust is restored on READ rather than by a channel secret: the client
 * verifies the Ed25519 owner signature -- which implicitly recomputes the
 * content-addressed publicationId -- before trusting ANY field. A record that
 * does not parse, fails verification, was signed by the wrong key, or is killed is
 * DROPPED fail-closed, so a forged descriptor can never surface in a result.
 *
 * Privacy posture (honest): there is NO confidentiality against the relay here,
 * and that is by design. Category is a fixed 9-value public enum and the rid HKDF
 * uses no secret salt, so anyone (including the relay) can precompute all category
 * rids and dictionary-attack common term rids. The rids buy only DOMAIN SEPARATION
 * (the category and search namespaces never collide) and FIXED-WIDTH OPAQUE LABELS
 * (uniform 64-hex keys), not secrecy. Public directory metadata -- category,
 * search terms, and the titles/descriptions inside each record -- is inherently
 * observable; for open public discovery that is unavoidable.
 *
 * Bucket placement is authenticated on READ, not on write. The relay's announce
 * verb is open, so anyone can re-announce a real, validly-signed publication under
 * the WRONG rid: the signature attests the descriptor's CONTENTS (its true
 * category, title, description) but NOT where it was filed. browse/search
 * therefore cross-check placement after verification -- a record only counts for a
 * category if its descriptor self-categorizes there, and only counts for a search
 * term if that term genuinely tokenizes out of its title/description.
 *
 * Genesis-only scope: announcePublication requires verifyPublication(signed) ===
 * 'ok', which fails closed for any revision > 1 presented without its predecessor
 * (the directory holds one standalone record, with no chain to validate against).
 * So this client surfaces GENESIS (revision 1) descriptors only. Revision-chain
 * maintenance, latest-revision selection, and unpublish()/DescriptorKill removal
 * enforcement (Plan 19 AC-7) are the P3 directory NODE's responsibility, not this
 * read/announce client's.
 *
 * RN-safe: depends only on hkdf, the registry-client (global WebSocket), the
 * host-registry, and the pure publication protocol -- no node:crypto/fs at import
 * time, so it runs unchanged from index.native.
 */

import { hkdf, sha512Hex } from './hkdf';
import {
  announceHost,
  lookupHosts,
  type RegistryClientOptions,
} from '../transport/registry-client';
import { lookupContentHosts } from './host-registry';
import {
  verifyPublication,
  type PublicationDescriptor,
  type PublicCategory,
  type SignedPublicationDescriptor,
} from '../protocol/publication';

const encoder = new TextEncoder();

const CATEGORY_RID_INFO = 'meerkat-public-directory-category-v1';
const SEARCH_RID_INFO = 'meerkat-public-directory-search-v1';

/** Minimum meaningful token length; shorter fragments are dropped from indexing. */
const MIN_TOKEN_LENGTH = 3;
/** Hard cap on the fan-out: at most this many term rids per announce/search. */
const MAX_TOKENS = 24;

/** Common English filler with no discovery value (kept small and symmetric). */
const STOPWORDS: ReadonlySet<string> = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had',
  'has', 'her', 'his', 'how', 'its', 'one', 'our', 'out', 'she', 'was', 'who',
  'why', 'yes', 'him', 'that', 'this', 'with', 'from', 'have', 'will', 'they',
  'them', 'then', 'than', 'what', 'when', 'were', 'been', 'into', 'over', 'only',
  'also', 'some', 'such', 'more', 'most', 'very', 'just', 'your', 'about', 'like',
  'which', 'where', 'these', 'those', 'their',
]);

/**
 * Derive the OPAQUE relay rid for a public category. A fixed HKDF namespace gives
 * a fixed-width 64-hex label and guarantees it never collides with a same-string
 * search rid (domain separation). This is NOT confidential: the 9 categories are a
 * public enum, so every category rid is trivially precomputable by anyone.
 */
export function deriveCategoryRid(category: PublicCategory): string {
  return sha512Hex(hkdf(encoder.encode(category), CATEGORY_RID_INFO)).slice(0, 64);
}

/**
 * Normalize a single term so announce and search agree on its rid. NFKC folds
 * composed and decomposed forms (precomposed "é" U+00E9 vs "e" + combining acute
 * U+0301) to the same bytes, so a query and a title term derive the same rid.
 */
function normalizeTerm(term: string): string {
  return term.normalize('NFKC').trim().toLowerCase();
}

/**
 * CJK ideographs + kana + hangul: scripts written without word spaces, so a
 * single character is a meaningful token and whitespace splitting finds nothing.
 */
const CJK_CHAR = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/**
 * Derive the OPAQUE relay rid for a single normalized search term. Distinct HKDF
 * namespace from category rids (domain separation), fixed-width label, no secrecy:
 * common term rids are dictionary-attackable, which is inherent to public search.
 */
export function deriveSearchRid(termToken: string): string {
  return sha512Hex(hkdf(encoder.encode(normalizeTerm(termToken)), SEARCH_RID_INFO)).slice(0, 64);
}

/** Emit CJK tokens: adjacent bigrams for a run (so a multi-char query matches a
 * substring), or a unigram for a lone ideograph. Bigrams are the standard CJK
 * search compromise: precise enough without a dictionary segmenter. */
function pushCjkRun(run: string, push: (token: string) => void): void {
  const chars = [...run];
  if (chars.length === 1) {
    push(chars[0]!);
    return;
  }
  for (let i = 0; i < chars.length - 1; i += 1) push(chars[i]! + chars[i + 1]!);
}

/** Segment one split token: CJK runs -> bigrams/unigram; non-CJK runs keep the
 * MIN_TOKEN_LENGTH + stopword filter. A mixed token (e.g. "iphone手機") yields
 * both its Latin word and its CJK bigrams. */
function segmentToken(token: string, push: (token: string) => void): void {
  let buf = '';
  let bufIsCjk = false;
  const flush = (): void => {
    if (!buf) return;
    if (bufIsCjk) {
      pushCjkRun(buf, push);
    } else if (buf.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(buf)) {
      push(buf);
    }
    buf = '';
  };
  for (const ch of token) {
    const isCjk = CJK_CHAR.test(ch);
    if (buf && isCjk !== bufIsCjk) flush();
    buf += ch;
    bufIsCjk = isCjk;
  }
  flush();
}

/**
 * Tokenize text into meaningful discovery terms, Unicode-aware. NFKC-fold +
 * lowercase, then split on any run of non-(letter/number) so every script
 * survives -- the old `[^a-z0-9]+` split dropped all non-ASCII ("café" -> "caf",
 * Cyrillic / CJK -> nothing). Within a token, CJK runs are bigram-segmented (so
 * space-less scripts index and match, and the flat 3-char minimum no longer drops
 * short CJK words); non-CJK runs keep the MIN_TOKEN_LENGTH + stopword filter.
 * Dedupes and caps at MAX_TOKENS. Used SYMMETRICALLY for announce and search, so a
 * given word resolves to the same rid on both sides and the read-side placement
 * check stays consistent with the write side.
 */
function tokenize(...parts: string[]): string[] {
  const seen = new Set<string>();
  let full = false;
  const push = (token: string): void => {
    if (full || !token || seen.has(token)) return;
    seen.add(token);
    if (seen.size >= MAX_TOKENS) full = true;
  };
  for (const part of parts) {
    if (full) break;
    const folded = part.normalize('NFKC').toLowerCase();
    for (const token of folded.split(/[^\p{L}\p{N}]+/u)) {
      if (full) break;
      if (token) segmentToken(token, push);
    }
  }
  return [...seen];
}

export interface DirectoryEntry {
  descriptor: PublicationDescriptor;
  signature: string;
  /** REAL distinct serving-host count from the host-registry. Never fabricated. */
  announcingHosts: number;
  /** 0 in P2: comes from the verified public snapshot (populated in a later phase). */
  eventCount: number;
  /** '' in P2: comes from the verified public snapshot (populated in a later phase). */
  latestWall: string;
  /** The directory url that served this entry. */
  sourceHost: string;
  /** True only after verifyPublication === 'ok'. */
  verified: boolean;
}

export interface AnnouncePublicationInput extends RegistryClientOptions {
  url: string;
  /** The signed publication to publish into the directory. */
  signed: SignedPublicationDescriptor;
  /** Requested TTL; the relay clamps to its own maximum. */
  ttlMs?: number;
}

export interface BrowsePublicationsInput extends RegistryClientOptions {
  url: string;
  category: PublicCategory;
}

export interface SearchPublicationsInput extends RegistryClientOptions {
  url: string;
  terms: string[];
}

export interface LookupPublicationHostsInput extends RegistryClientOptions {
  url: string;
  /** The public snapshot contentId from the descriptor. */
  contentId: string;
}

function relayOptions(input: RegistryClientOptions): RegistryClientOptions {
  return {
    webSocketImpl: input.webSocketImpl,
    timeoutMs: input.timeoutMs,
    entitlementToken: input.entitlementToken,
  };
}

/**
 * Announce a signed publication so browse(category) and search(terms) can find
 * it. The descriptor is verified 'ok' (an owner-signed genesis) BEFORE any
 * network call, so the directory never carries a record the client would later
 * drop, and the search rids derive from an owner-attested title/description. The
 * SAME verbatim record is announced under the category rid and each term rid; the
 * tokenizer caps the fan-out at 1 + MAX_TOKENS round-trips so a long description
 * cannot trigger hundreds of connections (self-DoS / relay spam).
 */
export async function announcePublication(input: AnnouncePublicationInput): Promise<void> {
  if (verifyPublication(input.signed) !== 'ok') {
    throw new Error('announcePublication: descriptor must be a valid, owner-signed publication.');
  }
  const d = input.signed.descriptor;
  const rec = JSON.stringify(input.signed);
  const rids = new Set<string>([deriveCategoryRid(d.category)]);
  for (const token of tokenize(d.title, d.description)) rids.add(deriveSearchRid(token));
  const opts = relayOptions(input);
  for (const rid of rids) {
    await announceHost({ url: input.url, rid, record: rec, ttlMs: input.ttlMs, ...opts });
  }
}

/** Parse one opaque record into a signed descriptor; null on any garbage/shape
 *  mismatch (fail-closed, never throws on a malicious rec). */
function parseSigned(rec: string): SignedPublicationDescriptor | null {
  try {
    const parsed = JSON.parse(rec) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as { descriptor?: unknown; signature?: unknown };
    if (typeof candidate.descriptor !== 'object' || candidate.descriptor === null) return null;
    if (typeof candidate.signature !== 'string') return null;
    return parsed as SignedPublicationDescriptor;
  } catch {
    return null;
  }
}

/** Parse + verify one record, returning the trusted signed descriptor or null.
 *  Only verdict 'ok' survives, so forged / invalid / not_owner / killed records
 *  are dropped fail-closed. */
function verifyRecord(rec: string): SignedPublicationDescriptor | null {
  const signed = parseSigned(rec);
  if (!signed) return null;
  if (verifyPublication(signed) !== 'ok') return null;
  return signed;
}

/**
 * Materialize a deduped map of verified descriptors into directory entries,
 * resolving each publication's REAL distinct serving-host count from the
 * host-registry. The per-entry host lookups run in PARALLEL (Promise.all), bounded
 * by the relay's per-rid announcer cap, instead of a sequential N+1 of fresh
 * WebSockets. P2 surfaces only this raw real count; the authoritative
 * trending/ranking signal is the P3 directory node's job.
 */
async function materialize(
  byId: Map<string, SignedPublicationDescriptor>,
  sourceHost: string,
  opts: RegistryClientOptions,
): Promise<DirectoryEntry[]> {
  const signedList = [...byId.values()];
  const hostLists = await Promise.all(
    signedList.map((signed) =>
      lookupContentHosts({ url: sourceHost, contentId: signed.descriptor.contentId, ...opts })),
  );
  return signedList.map((signed, i) => ({
    descriptor: signed.descriptor,
    signature: signed.signature,
    announcingHosts: hostLists[i]!.length,
    // eventCount / latestWall come from the verified public snapshot, which P2
    // does not fetch here; they are populated in a later phase, never invented.
    eventCount: 0,
    latestWall: '',
    sourceHost,
    verified: true,
  }));
}

/**
 * Browse the public directory for a category. Resolves the category rid, fetches
 * every opaque record announced under it, verifies each, and keeps only entries
 * whose descriptor self-categorizes as the browsed category -- so a real signed
 * publication misfiled under the wrong category rid by a spammer is dropped. A
 * verified publication with zero serving hosts is still listed (it exists);
 * `announcingHosts` is the trending signal, not a visibility filter.
 */
export async function browsePublications(input: BrowsePublicationsInput): Promise<DirectoryEntry[]> {
  const opts = relayOptions(input);
  const recs = await lookupHosts({ url: input.url, rid: deriveCategoryRid(input.category), ...opts });
  const byId = new Map<string, SignedPublicationDescriptor>();
  for (const rec of recs) {
    const signed = verifyRecord(rec);
    if (!signed) continue;
    // Authenticate bucket placement: the open relay lets anyone file a real signed
    // pub under any rid; the signature attests contents, not placement.
    if (signed.descriptor.category !== input.category) continue;
    byId.set(signed.descriptor.publicationId, signed);
  }
  return materialize(byId, input.url, opts);
}

/**
 * Search the public directory for publications matching any of the supplied terms.
 * Each normalized term resolves to a search rid; for every record found under that
 * rid, the entry is kept ONLY IF the term genuinely tokenizes out of the
 * descriptor's title/description -- so a real pub stuffed into an unrelated term
 * rid is dropped. Surviving entries are deduped by publicationId, so a pub matched
 * by several terms is returned once.
 */
export async function searchPublications(input: SearchPublicationsInput): Promise<DirectoryEntry[]> {
  const opts = relayOptions(input);
  const tokens = tokenize(...input.terms);
  // No meaningful query terms: return empty without touching the relay.
  if (tokens.length === 0) return [];
  const byId = new Map<string, SignedPublicationDescriptor>();
  for (const token of tokens) {
    const recs = await lookupHosts({ url: input.url, rid: deriveSearchRid(token), ...opts });
    for (const rec of recs) {
      const signed = verifyRecord(rec);
      if (!signed) continue;
      const descriptorTokens = tokenize(signed.descriptor.title, signed.descriptor.description);
      if (!descriptorTokens.includes(token)) continue;
      byId.set(signed.descriptor.publicationId, signed);
    }
  }
  return materialize(byId, input.url, opts);
}

/**
 * Resolve the REAL distinct serving-host list for a publication's content. Reuses
 * the host-registry lookup, so the count behind `announcingHosts` is exactly the
 * set of reachable hosts that announced they serve this content -- never a
 * fabricated metric. Returns a deduped list; an empty list means "no host
 * announced" (a normal, not-trending outcome).
 */
export async function lookupPublicationHosts(input: LookupPublicationHostsInput): Promise<string[]> {
  return lookupContentHosts({
    url: input.url,
    contentId: input.contentId,
    ...relayOptions(input),
  });
}
