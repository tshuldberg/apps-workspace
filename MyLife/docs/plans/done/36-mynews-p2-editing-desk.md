# Feature Spec: MyNews Phase 2, The Open Editing Desk

> MyNews launch plan 36, Phase 2 of 8. The open editing system goes live end to end: suggest mode with typed diffs and citations, suggestion threads, near-dupe collapse, the journalist review queue (side-by-side diff, batch copyedit accept, partial apply with counter-edit), the credibility ledger serving real levels and profiles, newsrooms with RLS membership and embargo review, plus the auth-session layer and nw_profiles registration that publishing has been waiting on. Founder mandate: build order only, no scope cuts.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. This plan pins contracts verbatim and specifies tasks at file level; tests are TDD-first per task. Workers must read `docs/plans/done/34-mynews-p0-scaffold.md` and `35-mynews-p1-publish-read.md` Status Deltas plus `docs/sessions/2026-07-03-mynews-handoff.md` Section 4 (invariants) before editing anything.

**Goal:** An editor can select a span of a published article, compose a typed cited suggestion, and discuss it in a thread; the journalist triages a review queue, batch-accepts copyedits, reviews substantive changes side by side, and merges with a new self-signed revision; credibility accrues by the published formula and renders as auditable profiles; co-authors and invited Trusted Editors collaborate on embargoed drafts in newsrooms; and a fresh device can register a profile so publish/suggest stop returning `no-profile`.

**Architecture:** Anonymous-first Supabase auth via `@mylife/auth/client` (`getSupabaseClient` + `createExpoSecureStorage`, BestChef/DoWork precedent) confined to the Expo app; the session token rides the existing `getAccessToken` seam in `createMyNewsCloudAdapter`, so `modules/mynews` and `apps/mynews-web` stay supabase-js-free. All new business logic (diff combination, near-dupe detection, review orchestration) lives in the module as pure tested functions with Deno twins pinned by parity tests. New server surface (newsrooms, dupes, aggregates v2, batch accept) arrives in one new append-only migration plus revised DI edge handlers. No canonical-bytes change anywhere: batch accept reuses the existing multi-entry changelog in `REVISION_SIGNING_DOMAIN` v1, so the golden fixture is untouched.

**Tech Stack:** `@mylife/auth/client` (supabase-js confined to Expo app), pure-fetch PostgREST (module), WebCrypto Ed25519 (Deno), Next.js 15 SSR, Vitest.

## Metadata

- **Surfaces:** `modules/mynews`, `supabase/migrations/20260703000003`, `supabase/functions/mynews-{publish,suggest,review}` + `_shared`, `apps/mynews`, `apps/mynews-web`, `scripts/check-mynews-parity.mjs`
- **Priority Score:** 43 / 50 (critical path; blocks Phase 3 trust spine and Phase 4 payments UX)
- **Depends On (hard):** plans 34 + 35 (done, this branch)
- **Depends On (soft):** live Supabase project for e2e (founder-ops; every path unit-verified without it). Founder-ops addition from this plan: enable **anonymous sign-in** in Supabase Auth settings and configure the email (magic link) template + `mynews://auth-callback` redirect allowlist.
- **Blocks:** Phase 3 (verification center, corrections, track record), Phase 4 (support/payments UX)
- **Honesty boundary:** every authenticated control (suggest, comment, review, register, newsrooms) renders disabled with plain copy when cloud env is unconfigured or there is no session/profile; the `no-profile` error routes to the real registration flow, never a fake success. Editor levels computed from the real public ledger only; `section_editor` remains unreachable until Phase 3 ships verification + endorsements and the UI says so. Web keeps SSR reads only; its "Suggest an edit" card honestly says editing happens in the app.
- **Invariant guard (handoff Section 4):** author-only acceptance (server never composes text); canonical bytes untouched (no new domain needed, fixture untouched; any future payload change needs a new version-suffixed domain); RSC-safe subpaths only in web server code; `nw_` cache tables stay `personal_replica`-capped; no supabase-js in `modules/mynews`/`apps/mynews-web`; no `@mylife/ui` in mynews-web; no em dashes.

---

## Pinned contracts (all tasks build against these)

### C1. Auth session (Expo app only)

`apps/mynews/app/(root)/providers/AuthProvider.tsx` + `app/(root)/data/auth-session.ts` (pure logic, DI for tests):

```ts
export type MyNewsAuthStatus = 'unconfigured' | 'loading' | 'signed-out' | 'anonymous' | 'linked';
export interface MyNewsAuth {
  status: MyNewsAuthStatus;
  userId: string | null;
  email: string | null;
  ensureSession(): Promise<{ ok: true; userId: string } | { ok: false; error: string }>;
  linkEmail(email: string): Promise<{ ok: boolean; error?: string }>;   // anonymous -> updateUser({ email })
  signInWithEmail(email: string): Promise<{ ok: boolean; error?: string }>; // returning device -> signInWithOtp
  signOut(): Promise<void>;
  getAccessToken(): Promise<string | null>;  // session access_token or null
}
export function useMyNewsAuth(): MyNewsAuth;
```

- Client from `getSupabaseClient({ url, anonKey, storage: createExpoSecureStorage(SecureStore) })` (`@mylife/auth/client` + `@mylife/auth/secure-storage`); config from the existing `getMyNewsCloudConfig()`. Unconfigured env -> status `'unconfigured'`, all methods return honest errors, no client constructed.
- `ensureSession()` = `getSession()` else `signInAnonymously()`. `status` maps: no session -> `signed-out`, `user.is_anonymous` -> `anonymous`, else `linked`.
- Magic-link deep link: `emailRedirectTo: Linking.createURL('auth-callback')` under the existing `mynews` scheme; callback handling follows `apps/bestchef/app/(root)/providers/BestChefCloudProvider.tsx` (parse URL fragment, `setSession`). ZERO new dependencies: `@mylife/auth`, `expo-linking`, `expo-secure-store` are already declared in `apps/mynews/package.json`.
- Provider order becomes `DatabaseProvider > AuthProvider > CloudProvider > IdentityProvider`; `CloudProvider` passes `getAccessToken` into `createMyNewsCloudAdapter` (the seam at `modules/mynews/src/data/cloud-fetch.ts:35` exists and defaults to anon key).
- supabase-js enters the app bundle transitively through `@mylife/auth` (already a declared dep). It must NOT be added to `apps/mynews/package.json` directly, and never to `modules/mynews` or `apps/mynews-web`.

### C2. Profile registration and identity binding

The account triangle: Supabase `user_id` (session, review authz) + `nw_profiles.pubkey_ed25519` (device signing key, publish/suggest authz) + `handle` (public identity). Registration binds all three in one client-direct RLS insert (policy `nw_profiles_self_insert` already exists).

New port methods (C3) back this flow. Screen copy (product review, Auth + Me screens): "Reading? No account needed."; "Your keys, created on this device"; handle rule `^[a-z0-9_]{3,30}$` validated client-side before the insert. `kind` stays `'reader'` at registration; `becomeJournalist` creates the `nw_journalists` row (tier always `'open'`; `'verified'` is Phase 3 service-role only). Publishing/suggesting surfaces catch `no-profile` and route to the registration screen instead of showing a dead error.

### C3. `MyNewsCloudPort` extension (additive)

Add to `modules/mynews/src/data/cloud.ts` (implemented by `InMemoryCloudAdapter` AND `createMyNewsCloudAdapter`; view models live beside the existing ones):

```ts
export interface SuggestionView {
  id: string; articleId: string; articleSlug: string; articleHeadline: string;
  baseRev: number; editorId: string; editorHandle: string; editorDisplayName: string;
  type: SuggestionType; diff: StructuredDiff; citations: string[]; rationale: string;
  status: 'open' | 'accepted' | 'partial' | 'rejected' | 'stale'; createdAt: string;
  endorsements: number;   // count of nw_suggestion_dupes rows
}
export interface SuggestionEventView {
  id: string; suggestionId: string; actorId: string; actorHandle: string;
  action: 'comment' | 'accept' | 'reject' | 'partial' | 'rebase';
  payload: Record<string, unknown>; createdAt: string;
}
export interface ProfileView {
  id: string; userId: string; handle: string; displayName: string;
  pubkeyEd25519: string; kind: 'reader' | 'editor' | 'journalist';
}
export interface LedgerRowView {
  id: string; editorId: string; suggestionId: string; basePoints: number;
  diversityMult: number; standingMult: number; awardedAt: string;
  type: SuggestionType | null; authorId: string | null;  // joined via suggestion -> article for pair concentration
}
export interface EditorProfileView {
  profile: Pick<ProfileView, 'id' | 'handle' | 'displayName' | 'kind'>;
  ledger: LedgerRowView[];
  aggregates: { openCount: number; acceptanceRate: number; decidedSampleSize: number; distinctAuthors: number };
}
export interface NewsroomView { id: string; ownerId: string; name: string; createdAt: string; }
export interface NewsroomMemberView { newsroomId: string; profileId: string; handle: string; displayName: string; role: 'owner' | 'coauthor' | 'reviewer'; }
export interface NewsroomDraftView { articleId: string; slug: string; headline: string; rev: number; updatedAt: string; embargoUntil: string | null; authorHandle: string; }

export interface MyNewsCloudPort {
  // ...existing five methods unchanged...
  getMyProfile(): Promise<ProfileView | null>;                       // session bearer; null when signed out or no row
  isHandleAvailable(handle: string): Promise<boolean>;
  registerProfile(input: { userId: string; handle: string; displayName: string; pubkeyEd25519: string }): Promise<{ ok: true; profile: ProfileView } | { ok: false; error: 'handle-taken' | 'not-signed-in' | string }>;
  becomeJournalist(input: { profileId: string; bio: string; beats: string[]; region: string }): Promise<{ ok: boolean; error?: string }>;
  getSuggestionsForArticle(articleId: string, opts?: { status?: SuggestionView['status'] }): Promise<SuggestionView[]>;
  getSuggestion(id: string): Promise<SuggestionView | null>;
  getMySuggestions(editorProfileId: string): Promise<SuggestionView[]>;
  getReviewQueue(authorProfileId: string): Promise<SuggestionView[]>;  // open suggestions across my articles
  getSuggestionEvents(suggestionId: string): Promise<SuggestionEventView[]>;
  postSuggestionComment(input: { suggestionId: string; actorProfileId: string; body: string }): Promise<{ ok: boolean; error?: string }>;  // session bearer, RLS action='comment'
  getEditorProfile(handle: string): Promise<EditorProfileView | null>;
  listMyNewsrooms(profileId: string): Promise<NewsroomView[]>;
  createNewsroom(input: { ownerId: string; name: string }): Promise<{ ok: true; newsroom: NewsroomView } | { ok: false; error: string }>;
  getNewsroom(id: string): Promise<{ newsroom: NewsroomView; members: NewsroomMemberView[]; drafts: NewsroomDraftView[] } | null>;
  addNewsroomMember(input: { newsroomId: string; handle: string; role: 'coauthor' | 'reviewer'; invitedBy: string }): Promise<{ ok: boolean; error?: 'unknown-handle' | string }>;
  removeNewsroomMember(input: { newsroomId: string; profileId: string }): Promise<{ ok: boolean; error?: string }>;
  getDraftArticle(articleId: string): Promise<ArticleView | null>;    // session bearer (RLS: author or newsroom member)
}
```

Fetch-adapter rules: reads are PostgREST GETs (anon key, or session bearer where RLS needs it: `getMyProfile`, `getDraftArticle`, newsroom reads); writes (`registerProfile`, `becomeJournalist`, `postSuggestionComment`, newsroom CRUD) are PostgREST POST/DELETE with the session bearer from `getAccessToken`, mapping PostgREST 409 unique-violation on handle to `'handle-taken'`. Every new URL builder gets an exported pure function + tests that compare `decodeURIComponent(url)` (the P1 parens trap). Web keeps using only the read methods it already uses plus the new public reads; it never calls authenticated methods.

### C4. Function envelope changes (additive; canonical bytes untouched)

```ts
// POST mynews-suggest  (unchanged request; NEW success variant)
// -> ok: { suggestionId, collapsed?: true }
//    collapsed=true means near-dupe of an existing open suggestion on the same
//    article+baseRev: no new suggestion row; an endorsement row was recorded
//    against suggestionId (the ORIGINAL suggestion's id).
// NEW error: 'draft-access' (suggesting on a draft article without newsroom membership)

// POST mynews-review  (author JWT required; single form unchanged)
{ suggestionId?: string, suggestionIds?: string[],   // exactly one of the two
  decision: 'accept' | 'reject' | 'partial',
  revision?: {...}, signatureHex?: string,
  note?: string }                                     // reject only, optional, <= 2000 chars
// Batch rules: suggestionIds requires decision='accept', all suggestions open,
// all on the SAME article, revision.changelog must contain an entry for EVERY
// id in suggestionIds (server validates coverage; extra entries rejected),
// one atomic RPC commits revision + N status flips + N events + N ledger rows.
// NEW errors: 'batch-mixed-articles' | 'changelog-mismatch'
// reject with note: note is stored in the reject event payload { note }.
```

No signing change: a batch-accept revision is an ordinary C1(v1) revision whose `changelogTriples` carries one `[suggestionId, editorKey, type]` per accepted suggestion. The golden fixture `signing-vectors.json` is untouched; any test needing multi-entry changelogs builds fresh vectors with the existing helpers, never edits the fixture.

```ts
// POST mynews-publish  (request gains optional article fields; response unchanged)
{ article: { id, slug, kind, authorPubkey, newsroomId?: string, draft?: boolean }, revision, signatureHex }
// draft=true  -> row status 'draft', published_at null (newsroomId required with draft)
// draft absent/false on an EXISTING draft article -> RPC transitions draft->published,
//   sets published_at, and still requires rev = current_rev + 1 with the new revision
//   (publish-the-draft always ships a fresh signed revision; no silent status flips).
// NEW errors: 'not-newsroom-member' (author lacks owner/coauthor role in newsroomId)
```

### C5. New module engine functions (Deno twins + parity tests)

`modules/mynews/src/engines/diff.ts` gains:

```ts
export type CombineResult =
  | { ok: true; diff: StructuredDiff }
  | { ok: false; conflicts: Array<{ baseIndex: number; diffIndexes: number[] }> };
// Merge N diffs that share the same baseHash into one diff. Two ops conflict
// when they touch the same baseIndex (replace/delete) or insert at the same
// baseIndex. Ops are concatenated sorted by baseIndex; conflict -> ok:false
// listing every collision so the UI can exclude one side.
export function combineDiffs(diffs: StructuredDiff[]): CombineResult;
```

New `modules/mynews/src/engines/dupes.ts`:

```ts
export function normalizedAddedText(diff: StructuredDiff): string;   // newBlocks joined, lowercased, whitespace-collapsed
export function suggestionContentHash(diff: StructuredDiff): string; // FNV-1a hex over normalizedAddedText + sorted op kinds/baseIndexes
export function suggestionSimilarity(a: StructuredDiff, b: StructuredDiff): number; // Jaccard over word token sets of normalizedAddedText, 0..1
export const NEAR_DUPE_THRESHOLD = 0.85;
export function isNearDupe(a: StructuredDiff, b: StructuredDiff): boolean; // identical hash OR similarity >= threshold, and same-op-footprint guard (shared baseIndex overlap >= 1)
```

`modules/mynews/src/engines/credibility.ts` is already complete; the server twin `supabase/functions/_shared/mynews-cred.ts` gains `LEVEL_CAPS`, `levelFor`, `decayFactor`, `computeScore` twins. New `_shared/mynews-dupes.ts` twins the dupes engine. Twin-parity tests (in the edge `__tests__` suites, module-import style like the existing cred parity test at `mynews-review/__tests__`) assert equality across a sample grid; near-dupe sample pairs live in a small shared fixture `modules/mynews/src/engines/__fixtures__/dupe-vectors.json` asserted by both sides.

### C6. Migration `supabase/migrations/20260703000003_mynews_editing_desk.sql` (append-only; the two P0/P1 migrations are never edited)

Tables:

```sql
create table if not exists public.nw_newsrooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.nw_profiles (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
create table if not exists public.nw_newsroom_members (
  newsroom_id uuid not null references public.nw_newsrooms (id) on delete cascade,
  profile_id uuid not null references public.nw_profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'coauthor', 'reviewer')),
  invited_by uuid references public.nw_profiles (id),
  created_at timestamptz not null default now(),
  primary key (newsroom_id, profile_id)
);
create table if not exists public.nw_suggestion_dupes (
  id uuid primary key default gen_random_uuid(),
  original_id uuid not null references public.nw_edit_suggestions (id) on delete cascade,
  endorser_id uuid not null references public.nw_profiles (id) on delete cascade,
  similarity real not null check (similarity >= 0 and similarity <= 1),
  created_at timestamptz not null default now(),
  unique (original_id, endorser_id)
);
```

RLS (exact policy intents; SQL in Task 3):
- `nw_newsrooms`: SELECT for members (exists in `nw_newsroom_members` for `auth.uid()`'s profile) or owner; INSERT with check owner_id is own profile; UPDATE/DELETE owner only. Creating a newsroom also inserts the owner membership row (`role='owner'`) in the same client transaction (two inserts; INSERT policy on members below allows the owner path).
- `nw_newsroom_members`: SELECT for members of the same room; INSERT with check the acting user is the room OWNER (or is inserting their own `role='owner'` row for a room they own); DELETE for owner (remove anyone) or self (leave).
- `nw_suggestion_dupes`: public SELECT; writes service-role only (no client policies): endorsements are recorded by `mynews-suggest`.
- Draft visibility for newsroom members (new SELECT policies, additive alongside the owner policies): `nw_articles`, `nw_article_revisions`, `nw_edit_suggestions`, `nw_suggestion_events` each gain a `..._newsroom_member_select` policy allowing rows whose article has `status='draft'` and `newsroom_id` in the acting profile's memberships.
- Suggestion insert tightening: drop and recreate `nw_edit_suggestions_editor_insert` so the with check ALSO requires the target article to be visible to the editor (non-draft OR newsroom membership).
- Trust hardening: drop and recreate `nw_journalists_self_insert` / `nw_journalists_self_update` adding `with check (tier = 'open')` so clients can never self-assign `'verified'` (Phase 3 service-role only). Add a `nw_articles_client_guard` trigger blocking non-service-role UPDATEs that change `current_rev` or set `status='published'` directly (retract stays allowed; publishing only via RPCs).

RPCs (all `security definer`, EXECUTE granted to `service_role` only, matching migration 2's revoke pattern):

```sql
-- replaces (create or replace) the P1 stub; returns the raw stat block the
-- edge functions feed into the TS cred twin (levels are computed in TS, once):
create or replace function public.nw_editor_aggregates(p_editor uuid) returns jsonb;
-- { openCount, decidedSampleSize, acceptanceRate, acceptedTotal, acceptedCopyedits,
--   distinctAuthors, endorsementsReceived, maxPairShare,        -- pair concentration 0..1
--   sanctionsInLast90d (0 until Phase 5 moderation), authorStanding }  -- see C7

create or replace function public.nw_reject_suggestion(p_suggestion_id uuid, p_actor uuid, p_note text default null) returns text;
-- as before + note lands in the reject event payload jsonb {'note': p_note} when present

create function public.nw_accept_suggestions_batch(p_suggestion_ids uuid[], p_actor uuid, p_revision jsonb, p_awards jsonb) returns text;
-- FOR UPDATE all suggestions (all open, all same article) + the article;
-- rev = current_rev + 1; insert revision; bump head; per suggestion: status
-- 'accepted' + accept event {rev} + ledger row from p_awards (keyed by
-- suggestion id). Returns 'ok' | 'rev-conflict' | 'not-open' | 'mixed-articles'.

create or replace function public.nw_publish_article(p_article jsonb, p_revision jsonb, p_published_at timestamptz) returns text;
-- v2: honors p_article draft/newsroomId per C4; draft insert sets status 'draft',
-- published_at null; publishing an existing draft transitions status and stamps
-- published_at atomically with the head bump. Return codes unchanged.
```

### C7. Level and standing computation (single source of truth)

- The RPC returns RAW stats only. Level, cap, and weighted score are computed in TypeScript: module `engines/credibility.ts` (client) and `_shared/mynews-cred.ts` (server), pinned equal by parity tests. `effectiveCap` input `levelCap` now comes from `LEVEL_CAPS[levelFor(stats)]` server-side (the P1 5/8 floor retires).
- `authorStanding` in P2 is data-driven but interim: `0.5` baseline, `0.75` when the accepting author's journalist tier is `'verified'`. The full accuracy-based standing arrives with Phase 3 track-record materialization; the plan and the credibility screen both state this plainly.
- `EditorStats.topicScore = 0`, `endorsements = 0` (Trusted Editor endorsements, distinct from dupe endorsements), `identityVerified = false` in P2, so `levelFor` can mathematically never return `section_editor` until Phase 3; the profile screen shows the real requirements with "arrives with verification (Phase 3)" copy.
- Editor profile screens (app and web) compute the weighted score CLIENT-side from the public ledger rows via the module engine, proving the "formula + full ledger public" claim; the number the server uses for caps comes from the same twinned math.

### C8. Screen contracts (exact approved copy; Obsidian Noir + accent `#8BCFF0`; tokens from `app/(root)/theme/tokens.ts`)

Every state below has honest loading/empty/error variants via the existing `LoadingView`/`MessageView`/`EmptyState` components. All authenticated actions gate on session + profile with plain-copy disabled states.

1. **Suggest composer** `app/(root)/suggest/[slug].tsx` (pushed from the article page; replaces the disabled stub at `article/[slug].tsx:144-147`): header "Suggest an edit" + "Against rev {N} · anchored to paragraph {i}"; block picker (paragraphs via `splitBlocks`); per-block editor producing the diff preview card (ctx/del/add rows); type picker "Copyedit · Clarity · Correction · Context · Translation · Headline" with "[citation required]" tag on correction/context; citations list (https URLs, add/remove); rationale field; primary "Submit suggestion"; footer "Signed with your editor key · only {author} can apply it". Submit runs `submitSuggestion` (exists, `data/publish.ts:109`); error mapping: `citation-floor` inline on citations, `cap-exceeded` shows the real cap message, `no-profile` routes to registration, `collapsed: true` success shows "Your fix matches one already in the queue. Recorded as an endorsement of the earlier suggestion." Success screen copy: "Suggestion sent" + "{author} reviews it in her queue. If accepted, the article becomes revision {N+1} and you are credited in the public changelog."
2. **Desk rework** `(tabs)/desk.tsx`: segmented control "As editor / As journalist" (persisted in `nw_settings` key `desk.role`).
   - Editor view: subtitle "Your suggestions · {acceptanceRate}% acceptance"; suggestion rows with status chips `[open]`, `[accepted -> rev N]` "+{pts} pts · credited in changelog", `[rejected with note]` "'{note}' No penalty.", `[stale]`; level card (level name, weighted pts, progress bar to next level, tap -> credibility screen).
   - Journalist view: existing Drafts section stays (top); "Review queue" section, subtitle "{openCount} suggestions on {articleCount} articles"; singles sorted by severity rank (correction > context > translation > clarity > headline > copyedit) then oldest-first, row shows type, rev, editor chip (level from public ledger), first-line preview, tap -> suggestion detail; copyedit batch row "Copyedits × {n} [batch] Tap to review all." -> batch screen; footer card "Nothing merges without you. Every acceptance creates a new revision signed with your key."
3. **Suggestion detail** `app/(root)/suggestion/[id].tsx` (fills the `suggestion-detail` slot already declared in `definition.ts`): diff card; evidence links (https, external open); rationale; editor chip; endorsements line ("{n} editors endorsed this fix") when > 0; thread (events with `action='comment'` + decision events rendered as system rows) + composer (auth-gated, `postSuggestionComment`); when the viewer is the article's author AND status is open: primary "Accept · publish rev {N+1}", secondary "Edit + accept" (inline editor prefilled with `applyDiff` output; submit = decision `'partial'` with the author-edited body), tertiary "Reject" (optional-note dialog, copy "Rejection asks for an optional reason; no penalty to honest disagreement"). Accept flows run the C9 review orchestrators; `base-mismatch` (article moved past baseRev) shows the rebase state: run `rebaseDiff`; `rebased` -> proceed against the new head with a fresh preview; `stale` -> mark visually "needs refresh" and block accept with honest copy.
4. **Batch copyedit review** `app/(root)/review-batch/[articleId].tsx`: lists every open copyedit on the article base rev with include/exclude toggles; `combineDiffs` runs live; conflicting pairs render "These two touch the same paragraph. Keep one." with exclusion enforced; preview of the combined body; primary "Accept {n} · publish rev {N+1}" -> `acceptBatch` orchestrator; per-suggestion credits listed under "Accepting creates revision {N+1}. Signed by you. {names} credited in the public changelog."
5. **Me tab real** `(tabs)/me.tsx`: identity card (short pubkey, key age via `relativeTime`); account card (status: "Reading anonymously" / anonymous-session / linked email; buttons "Create account" = ensureSession + registration, "Link email" = magic-link dialog, "Sign in with email" for returning devices, "Sign out"); profile card (handle, display name, kind; "Register to publish or suggest" CTA when no profile); "Start publishing" row -> `becomeJournalist` form (bio, beats, region) when profile exists and kind is not journalist; credibility summary card (weighted pts, accepted count, distinct authors, "formula + full ledger public") -> breakdown screen; "Export signed ledger" (fetch own ledger rows, `Share.share` the JSON; copy "Your record is provable without MyNews").
6. **Registration** `app/(root)/register.tsx`: explains the triangle ("Your identity is an on-device key. A handle makes it public."); handle field with live availability check + rule copy; display name; primary "Create profile" = `ensureSession()` then `registerProfile` with the device `pubkeyHex`; `handle-taken` inline error; success returns to the origin surface (params carry `returnTo`).
7. **Credibility breakdown** `app/(root)/credibility/[handle].tsx`: line items per type ("Corrections accepted (9) +90 base" etc. from ledger), "Acceptance diversity ({n} authors) × {mult}", "Author standing × {mult}", "Recency decay (12 mo half-life)", total "Weighted score {n}"; next-level card with real requirements; anti-gaming card "Pair concentration: {healthy|elevated} (max {p}% from one author) · Self-edits: 0 pts · Open-suggestion cap: {cap}". Data: `getEditorProfile` + module engine math. Used for own profile (from Me) and other editors (from suggestion rows).
8. **Newsrooms** `app/(root)/newsrooms.tsx` (list + create, entered from Desk journalist view "Newsrooms" row) and `app/(root)/newsroom/[id].tsx` (detail: drafts list with "[embargo {date}]" labels from `nw_article_meta.embargo_until`; members list with role chips + "Invited for pre-publication review · can read + suggest, never publish" copy on reviewer rows; owner: invite-by-handle form (role coauthor/reviewer), remove member; member: leave). Compose gains "Save to newsroom" picker (publishes with `draft: true` + `newsroomId`); newsroom draft rows open `article/[slug]` which now also renders drafts the session can see (via `getDraftArticle` fallback when the public read 404s) with a "Draft · {newsroom}" banner, suggest enabled for members, and an author-only "Publish" button that ships a fresh signed revision through the C4 draft-to-published path.
9. **Discover search** `(tabs)/discover.tsx`: replaces the placeholder with a search field over the existing tested `port.search()` (debounced, result rows -> article pages) plus a "Latest" list from `getFeed` with no follow filter; honest empty/unconfigured states stay. (Closes the P1 reader-surface gap; no new port methods.)

### C9. Client review orchestrators (module, pure, DI)

New `modules/mynews/src/data/review.ts` (mirrors `publish.ts` style):

```ts
export type ReviewErrorCode = 'validation' | 'bad-signature' | 'not-author' | 'not-open'
  | 'rev-conflict' | 'changelog-mismatch' | 'batch-mixed-articles' | 'base-mismatch'
  | 'stale' | 'network' | 'unknown';
export interface AcceptInput {
  suggestion: SuggestionView; article: ArticleView;   // head text = article.bodyMd at article.rev
  identity: AuthorIdentity; port: MyNewsCloudPort; nowIso: string;
  editedBodyMd?: string;   // present -> decision 'partial' (counter-edit)
}
export function acceptSuggestion(input: AcceptInput): Promise<{ ok: true; rev: number } | { ok: false; code: ReviewErrorCode; detail?: string }>;
// applyDiff (or take editedBodyMd), build SignableRevision (headline/dek from head
// unless the suggestion type is 'headline', in which case the diff's newBlocks
// feed headline/dek), changelog [[suggestionId, editorPubkey, type]], sign,
// callFunction('mynews-review', ...). base-mismatch -> attempt rebaseDiff against
// the head; stale -> { ok:false, code:'stale' }. Never mutates local state.
export function acceptBatch(input: { suggestions: SuggestionView[]; article: ArticleView; identity: AuthorIdentity; port: MyNewsCloudPort; nowIso: string }): Promise<{ ok: true; rev: number } | { ok: false; code: ReviewErrorCode; conflicts?: Array<{ baseIndex: number; diffIndexes: number[] }> }>;
// combineDiffs -> applyDiff -> one revision whose changelog carries every id -> 'mynews-review' batch form
export function rejectSuggestion(input: { suggestionId: string; note?: string; port: MyNewsCloudPort }): Promise<{ ok: boolean; code?: ReviewErrorCode }>;
```

### C10. Web surfaces (SSR reads only) + RSC-safe engines subpath

- `modules/mynews/package.json` gains `"./engines": "./src/engines-public.ts"`; that file re-exports ONLY the pure engines (`engines/diff`, `engines/credibility`, `engines/dupes`) and `models` types. It must import nothing from `data/`, `signing/`, or any React/`@mylife/sync` surface (a shell test in mynews-web asserts the import graph stays clean the same way the P1 subpath is guarded).
- `/a/[slug]`: sidebar-style cards under the existing revision history: "Improved by {n} editors" (distinct editors in all changelogs + per-type accepted counts + latest acceptance line) and open-suggestions marginalia "{n} open suggestions, {m} corrections with citations" linking to the new suggestions page; "Suggest an edit" card copy: "Spotted an error? Propose a fix; {author} decides. Accepted work is credited publicly. Suggesting happens in the MyNews app." linking to `/about/editing`.
- `/a/[slug]/suggestions/page.tsx`: SSR list of suggestions (public RLS) with per-suggestion threads (events), diff rendered as del/add blocks, endorsement counts. Read-only, `notFound()` honest gates.
- `/e/[handle]/page.tsx`: editor credibility profile SSR: breakdown computed from the public ledger via `@mylife/mynews/engines` (same numbers as the app; the page states "Computed from the public signed ledger · nothing hand-assigned").
- `/about/editing/page.tsx`: static explainer (lifecycle DRAFT -> PUBLISH -> SUGGEST -> REVIEW -> MERGE, the six types table, the author-only rule "only the article's author can change the article's words", credibility formula summary).
- No client components, no auth, no new deps in mynews-web; `lib/cloud.ts` keeps importing `@mylife/mynews/cloud-fetch` (plus the new `@mylife/mynews/engines` subpath) only.

---

## Tasks

Worker rules: TDD per task (write failing tests, run, implement, re-run green, commit with the given message). Run `pnpm --filter <pkg> test` + `typecheck` for every touched package before each commit; the husky staged gate enforces this too. NEVER run `pnpm install` in parallel with another worker (lead pre-provisions; this plan adds zero new dependencies). No em dashes in any file. Do not edit `signing-vectors.json`, migrations 000001/000002, or anything under `packages/sync`.

### Task 1: diff combination + near-dupe engines (module)
- Files: `modules/mynews/src/engines/diff.ts` (+`combineDiffs`), NEW `engines/dupes.ts`, NEW `engines/__fixtures__/dupe-vectors.json`, tests in `engines/diff.test.ts` + NEW `engines/dupes.test.ts`.
- TDD: combineDiffs merges disjoint diffs (order-independent input, sorted output, applyDiff of combined equals sequential intent), detects replace/replace, replace/delete, insert/insert collisions listing every pair; empty input -> ok with empty ops; mixed baseHash -> validation throw. Dupes: identical diff -> hash equal + isNearDupe true; paraphrase above/below threshold cases; disjoint-block diffs with similar words -> NOT near-dupes (footprint guard); property test (seeded, 200 trials) that isNearDupe(a,a) always true and similarity symmetric. Fixture: 6 labeled pairs (dupe/not) written by the test helper once, asserted stable.
- Barrel: export both from `src/index.ts`; dupes + combine also re-exported later via `engines-public.ts` (Task 10).
- Commit: `feat(mynews): combineDiffs + near-dupe engines with shared vectors`

### Task 2: port extension + fetch adapter (module)
- Files: `modules/mynews/src/data/cloud.ts` (C3 types + port + `InMemoryCloudAdapter` support incl. seedable suggestions/events/profiles/newsrooms/ledger + `functionHandler` reuse), `data/cloud-fetch.ts` (URL builders + row mappers + authenticated write paths), tests `data/cloud.test.ts` + `data/cloud-fetch.test.ts`.
- TDD: in-memory contract suite for every new method; fetch adapter against the recorded-fetch fake asserting exact URLs (via `decodeURIComponent`), headers (anon vs session bearer per C3 rules), bodies, and mappings; `registerProfile` maps PostgREST 409 -> `handle-taken`; `postSuggestionComment` without token -> `{ok:false,error:'not-signed-in'}` locally (no network call).
- Commit: `feat(mynews): editing-desk cloud port (suggestions, threads, profiles, newsrooms) on the pure-fetch adapter`

### Task 3: client review orchestrators (module)
- Files: NEW `modules/mynews/src/data/review.ts` (C9), tests `data/review.test.ts`; barrel export.
- TDD: accept happy path (applyDiff text, changelog triple, signed envelope shape asserted against the in-memory port's captured body, signature verifies via `verifyRevisionSignature`); headline-type acceptance feeds headline; counter-edit -> decision `partial` with `editedBodyMd`; base-mismatch -> rebase -> proceeds; rebase stale -> `stale`; batch: combine, conflicts bubble, changelog covers all ids, batch envelope form; reject with/without note; every server error code mapped; port failure -> `network`.
- Commit: `feat(mynews): author review orchestrators (accept, counter-edit partial, batch, reject)`

### Task 4: editing-desk migration (SQL)
- Files: NEW `supabase/migrations/20260703000003_mynews_editing_desk.sql` (C6 verbatim: 3 tables, RLS policies incl. the 4 newsroom-member draft-visibility policies, editor-insert tightening, journalists tier hardening with check, `nw_articles_client_guard` trigger, aggregates v2, reject v2, batch RPC, publish v2, grants/revokes matching migration 2).
- Static verification only (house pattern): SQL reviewed against C6, `check:mynews-parity` gains the file, and the store/edge tests (Tasks 5-7) pin the behavioral contract the SQL must satisfy at `db push` time. Add a `-- founder-ops:` header note (enable anonymous sign-in; redeploy functions).
- Commit: `feat(mynews): editing-desk migration (newsrooms, dupes, aggregates v2, batch accept, trust hardening)`

### Task 5: shared twins + store extension (edge)
- Files: `supabase/functions/_shared/mynews-cred.ts` (+`LEVEL_CAPS`, `levelFor`, `decayFactor`, `computeScore`), NEW `_shared/mynews-dupes.ts`, `_shared/mynews-store.ts` (port + BOTH impls: `getOpenSuggestionsForArticle(articleId, baseRev)`, `insertDupeEndorsement`, `getCredibilityLedger(editorId)`, `getNewsroomRole(newsroomId, profileId)`, `acceptSuggestionsBatch`, `rejectSuggestion(id, actor, note?)` update, `publishArticle` v2 args, aggregates v2 passthrough), parity tests asserting cred + dupes twins equal the module engines over sample grids + the dupe fixture.
- Commit: `feat(mynews): server twins (levels, scoring, dupes) + editing-desk store surface`

### Task 6: mynews-suggest v2 (edge)
- Files: `supabase/functions/mynews-suggest/index.ts`, `__tests__/index.test.ts`.
- Flow additions after profile lookup: draft-article gate (article status draft -> editor must have a newsroom role or be the author, else `draft-access` 403); near-dupe scan over open suggestions on the same article+baseRev via `_shared/mynews-dupes` -> endorsement insert + `{suggestionId: original.id, collapsed: true}` (dupe path skips the cap check and inserts no suggestion); cap check now uses `levelFor`/`LEVEL_CAPS` from aggregates v2.
- TDD: dupe collapse (identical + paraphrase), non-dupe passes through, endorsement dedup (unique original+endorser -> a second endorsement is idempotent ok), draft access allowed for member / denied for stranger, cap from real level (copyeditor stats -> 12).
- Commit: `feat(mynews): suggest near-dupe collapse + draft-scope gate`

### Task 7: mynews-review v2 + mynews-publish v2 (edge)
- Files: `supabase/functions/mynews-review/index.ts` + tests; `supabase/functions/mynews-publish/index.ts` + tests.
- Review: C4 batch form (validation: exactly one of suggestionId/suggestionIds; batch => accept; same-article; all open; changelog coverage check BEFORE signature-independent failures leak info; awards computed per suggestion with aggregates v2 standing), reject `note` threading, single-path regression suite untouched and re-asserted.
- Publish: C4 draft/newsroom fields (draft requires newsroomId; membership owner/coauthor via `getNewsroomRole`, else `not-newsroom-member`; draft->published transition path requires author + fresh revision), existing paths regression-asserted.
- TDD: batch happy path bumps rev once + N ledger rows + N events; changelog-mismatch; mixed-articles; batch with one non-open -> `not-open`, nothing committed (in-memory store asserts no partial writes); reject note lands in event payload; draft publish then publish-transition e2e through the in-memory store; reviewer role cannot publish (`not-newsroom-member`).
- Commit: `feat(mynews): review batch accept + reject notes; publish newsroom drafts (author-only merge intact)`

### Task 8: app auth, registration, Me (Expo)
- Files: NEW `app/(root)/data/auth-session.ts` (pure session logic, DI supabase-shaped fake) + NEW `providers/AuthProvider.tsx` (C1), `providers/CloudProvider.tsx` (wire `getAccessToken`), `app/(root)/_layout.tsx` (provider order + new stack screens), NEW `app/(root)/register.tsx`, `(tabs)/me.tsx` (C8.5), NEW `app/(root)/credibility/[handle].tsx` (C8.7), NEW `lib/desk-errors.ts` (envelope error -> user copy map incl. `no-profile` -> registration route), tests for auth-session (ensureSession creates anon session once, status mapping, token passthrough, unconfigured honesty), registration flow against in-memory port (`handle-taken`, success binds pubkey), credibility math parity with module engine on a seeded ledger.
- Commit: `feat(mynews): anonymous-first auth sessions, profile registration, real Me tab + credibility breakdown`

### Task 9: app editing desk (Expo)
- Files: NEW `app/(root)/suggest/[slug].tsx` (C8.1), `(tabs)/desk.tsx` rework (C8.2), NEW `app/(root)/suggestion/[id].tsx` (C8.3), NEW `app/(root)/review-batch/[articleId].tsx` (C8.4), `article/[slug].tsx` (enable the Suggest button -> route; draft banner + publish button per C8.8), `(tabs)/discover.tsx` (C8.9), NEW `lib/suggest.ts` + `lib/desk.ts` (screen-side data hooks over the port, pure + tested), module `definition.ts` navigation.screens gains `suggest`, `review-batch`, `credibility`, `newsrooms`, `newsroom-detail`, `register`.
- Tests: hooks against the in-memory port (queue sorting severity+age, editor/journalist view models, batch include/exclude -> combineDiffs conflicts surfaced, suggest submit error mapping incl. collapsed, rebase-stale handling), discover search debounce logic. UI smoke via typecheck (device QA founder-ops).
- Commit: `feat(mynews): suggest mode, review queue, suggestion threads, batch copyedit desk on Expo`

### Task 10: app newsrooms (Expo)
- Files: NEW `app/(root)/newsrooms.tsx`, NEW `app/(root)/newsroom/[id].tsx` (C8.8), `compose.tsx` ("Save to newsroom" picker -> draft publish path), NEW `lib/newsrooms.ts` hooks + tests (create inserts owner membership, invite by handle -> `unknown-handle` mapping, reviewer copy rule, draft publish transition calls C4 form).
- Commit: `feat(mynews): newsrooms with membership, embargo labels, draft-to-publish flow`

### Task 11: web editing surfaces (Next.js)
- Files: `modules/mynews/package.json` + NEW `src/engines-public.ts` (C10 subpath), `apps/mynews-web/lib/cloud.ts` (new read loaders), NEW `lib/editing.ts` (pure: improved-by aggregation from revision changelogs, marginalia counts, ledger -> breakdown lines via `@mylife/mynews/engines`), `app/a/[slug]/page.tsx` (cards per C10), NEW `app/a/[slug]/suggestions/page.tsx`, NEW `app/e/[handle]/page.tsx`, NEW `app/about/editing/page.tsx`, `app/sitemap.ts` (+about/editing), tests: `lib` units + shell invariants extended (engines subpath import-graph guard, still no supabase-js/@mylife/ui, new routes exist).
- Commit: `feat(mynews): web editing surfaces (improved-by, suggestion threads, editor profiles, how-editing-works)`

### Task 12: parity + gates close-out
- Files: `scripts/check-mynews-parity.mjs` (add: engines/dupes.ts, data/review.ts, engines-public.ts + `"./engines"` export, migration 000003, all new app screens, all new web routes, `AuthProvider.tsx`), verify `check:parity` chain.
- Full gates in order: `pnpm --filter @mylife/mynews test`, `--filter @mylife/mynews-app test` + `typecheck`, `--filter mynews-web test` + `typecheck` + `build`, `pnpm check:mynews-parity`, `pnpm check:parity`, `pnpm gate:function:changed`, `pnpm check:generated-artifacts`.
- Commit: `chore(mynews): parity gate covers the editing desk`

## Verification

- Handoff baseline block re-run green (Section 3 of `docs/sessions/2026-07-03-mynews-handoff.md`).
- Twin-parity: signing fixture untouched (`git diff --exit-code` on `signing-vectors.json`); cred + dupes twins asserted; batch revision verifies with existing v1 domain.
- Author-only acceptance re-proven: review tests assert the server NEVER writes article text that did not arrive in an author-signed revision (incl. batch + partial paths).
- Honesty sweep: unconfigured/signed-out/no-profile states on every new screen render plain copy; no fabricated counts (endorsements/levels come from real rows).
- Status Delta on this plan; move to `done/` when Tasks 1-12 are green; memory.md + errors_log + session log + Open Brain.

## Explicitly out (next phases, per the build plan)

- Phase 3: verification center (domain email/ORCID/byline/manual), accuracy-based author standing, corrections flow, portable export bundles beyond the raw ledger JSON, Trusted Editor endorsements + `section_editor` reachability, track-record crons.
- Phase 4: support/pledges/Stripe surfaces (Support tab stays an honest placeholder).
- Phase 5: moderation pipeline (sanctions stay 0 in aggregates), DMCA/NCII ops.
- Phase 6: bias/Blindspot, community notes, composable feed builder, open-science surfaces.
- Interactive editing on the web (web stays SSR read-only per the build plan's web architecture; the app is the editing surface).
- Task 14 of plan 34 (`ChannelPostType` widening) stays gated on the Meerkat merge; unrelated to this plan.

## Self-Review (writing-plans checklist)

- **Spec coverage:** build plan Phase 2 bullet 1 (suggest mode, typed+cited suggestions, threads, near-dupe collapse) -> Tasks 1, 2, 5, 6, 9 + C4/C5; bullet 2 (review queue, side-by-side diff, batch copyedit, partial apply with counter-edit, transactional merge + changelog credits) -> Tasks 3, 5, 7, 9 + C4/C9; bullet 3 (credibility live: multipliers, decay, throttles, levels, editor profiles; newsrooms with RLS membership + embargo review) -> Tasks 4, 5, 8, 10 + C6/C7; handoff open item auth decision + `nw_profiles` registration gap -> C1/C2 + Task 8; P1 Discover leftover -> C8.9 + Task 9; web surfaces -> C10 + Task 11.
- **Placeholder scan:** no TBDs; interim values (`authorStanding` 0.5/0.75, `topicScore`/`endorsements`/`identityVerified` zeros) are pinned decisions with user-facing honesty copy and Phase 3 owners, not deferrals of Phase 2 scope.
- **Type consistency:** `SuggestionView.diff` is the `StructuredDiff` from `engines/diff.ts` (same type the orchestrators and `combineDiffs` consume); `ReviewErrorCode` covers every C4 error string; port method names match between C3, tasks, and screen contracts; `LEVEL_CAPS`/`levelFor` names match the existing module engine exports.
- **Invariant check:** no canonical-bytes change (fixture untouched, no new domain); web imports only `cloud-fetch` + new pure `engines` subpath; no new deps anywhere (auth rides existing declared deps); migrations append-only; module and web stay supabase-js-free.

## Status Delta (2026-07-04, execution session)

Tasks 1-12 EXECUTED and green on `feature/mynews-p0-scaffold` (same worktree, 21 commits `d05036fe..0564e2f2` incl. plan docs). Subagent-driven development: fresh implementer per task + spec review + quality review, fixes looped until approved, plus a final whole-implementation cross-task review. Verified at close: module 302 tests, Expo app 158 + typecheck, web 45 + typecheck + prod build (routes `/a/[slug]/suggestions` + `/e/[handle]` dynamic, `/about/editing` static); extended `check:mynews-parity` (+21 checks), full `check:parity`, `gate:function:changed`, `check:generated-artifacts` all exit 0. Signing fixture byte-identical (no canonical-bytes change anywhere; batch accept rides v1 multi-entry changelogs).

Deviations from the written plan, all lead-approved during execution and all verified:

1. **C3 bearer rule amended:** suggestion/event reads carry the session bearer opportunistically (anon otherwise) so newsroom members can see draft threads under the new RLS policies. `SuggestionView` gained `editorPubkey` (changelog triples need it); `ArticleView.status` widened to include `'draft'` after review caught the mapper silently dropping drafts (feeds still exclude drafts, tested). `registerProfile` 409 disambiguated (`handle-taken` vs `already-registered`, recovery via `getMyProfile`). Empty-decided-sample `acceptanceRate` aligned to the server's 1.
2. **C3 additions:** `getLatest(limit?)` (C8.9's "no new port methods" was unimplementable: `getFeed` with empty follows returns `[]` by P1 contract that Today depends on) and `setArticleEmbargo` (embargo labels are settable, not dead UI; `nw_article_meta` owner upsert). `SuggestResult` gained the C4 `collapsed` passthrough.
3. **C9 additions:** `editedHeadline`/`editedDek` counter-edit fields + the exported `headlineDoc`/`splitHeadlineDoc` pseudo-document convention (headline suggestions diff against it); mismatched counter-edit fields fail closed; multi-block deks survive; batch rejects headline types and never auto-rebases; suggestion/article id cross-checks; unchanged counter-edits downgrade to plain accept with full credit.
4. **C6 hardening beyond the pinned text** (adversarial SQL review of the unreleased migration, sealed in `ed9c3763`): events public-select restricted to non-draft articles (the P0 `using(true)` policy would have leaked draft threads); comment-insert visibility gate; dupes select draft guard; `nw_articles` client-guard trigger extended to INSERT + all status transitions except retract (closed a verify-then-insert bypass via direct INSERT); `nw_article_revisions` owner policy downgraded to SELECT-only; `nw_article_meta` newsroom-member select (embargo labels); journalist tier pinned by trigger instead of WITH CHECK (verified journalists keep bio editability); `nw_is_newsroom_member` answers only for `auth.uid()` (membership oracle closed). Also: `nw_reject_suggestion` drop-then-create (kills the ambiguous 2-arg overload), batch RPC validates everything before any write (plpgsql `return` does not roll back), batch return codes include `bad-award` (the C6 comment was stale).
5. **C7 award semantics:** the aggregates RPC returns raw stats only (`levelCap` dropped; level/cap computed in the twinned TS via `LEVEL_CAPS`/`levelFor`); awards use `authorStandingForTier(head.authorTier)` (0.5 open / 0.75 verified); self-edits earn `basePoints = 0` with the ledger row kept for audit (plan section 5.3 anti-gaming). Shared `ledgerWeightedScore`/`editorStatsFromAggregates`/`MIN_POSSIBLE_CAP` extracted into the cred twin pair; ledger reads bounded (desc, limit 500) and open-suggestion scans bounded (asc, limit 200).
6. **Server hardening beyond C4:** changelog credit validation on single AND batch accepts (exact id set, per-entry type + editorKey vs registered pubkey via new `getProfilePubkeys`); the draft-publish membership gate keys off `article.newsroomId ?? head.newsroomId` (omission bypass closed; removed members cannot publish room drafts); `serveEnvelope` wrapper returns envelope-shaped 500s from all three functions; suggest's draft gate runs before the dupe scan (no draft id leak) with a self-endorsement guard.
7. **C1 auth judgment call:** no auto anonymous session on mount (deviation from BestChef): "Reading anonymously" is a true signed-out state; sessions are minted only by explicit flows. Magic-link failures surface via `lastAuthError` in the Me account card. Publish surfaces route `no-profile` to registration like suggest (final-review fix `0564e2f2`).
8. **Interrupted-agent recovery (Task 10):** the first implementer hit a session limit after the module-side work; a fresh agent verified and kept the partial diff, fixed a typecheck break it carried (`errors_log.md` row, Resolved), and completed the screens.

Known follow-ups deliberately NOT in scope (recorded, not deferrals of pinned Phase 2 scope): app/web credibility builders are an unpinned fourth twin (each parity-tested against the module engine but not against each other; a shared vector would close copy-drift); draft-phase RLS makes public `/e/[handle]` math briefly conservative vs service-role aggregates until drafts publish; server cap-side ledger truncates at 500 newest (conservative); clients can still INSERT shell draft/retracted article rows (security-neutral since revisions are RPC-only; Phase 3 cleanup); `screen-hold` remains a defined-but-never-emitted P1 code; `mynews-store.ts` should split three ways when next touched; Phase 3 must not call `nw_is_newsroom_member` under service role (returns false by design).

Founder-ops to go live (adds to plan 34's list): enable **anonymous sign-in** in Supabase Auth and allowlist the `mynews://auth-callback` redirect; `db push` now covers three migrations; redeploy the three functions; device QA of the magic-link deep link and the new screens.

## Self-Review addendum

Every pinned C-contract was either implemented verbatim or amended above; the review pipeline surfaced at least one real finding per task (two Criticals and one HIGH among them) before dependent work built on it, which is the strongest argument this plan's two-stage-review requirement should carry into Phase 3.
