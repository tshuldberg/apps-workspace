# MyNews Production Audit — 2026-07-05

Scope: `modules/mynews`, `apps/mynews` (Expo), `apps/mynews-web` (Next.js SSR), `supabase/functions/mynews-*`, `supabase/migrations/20260703000001..3` (nw_ tables, RLS, RPCs). Code security + production readiness. Read-only audit; no code changed.

## Verdict

The code that is built (Phases 0-2: scaffold, publish/read, editing desk) is production-grade and green. 505 tests pass (module 302, app 158, web 45), plus typecheck on all surfaces, the web production build, and `check:mynews-parity`. The trust boundary is carefully designed: articles and suggestions are Ed25519-signed client-side, the server verifies on write and stores signatures so the corpus is re-verifiable, and the private key never leaves the device (SecureStore).

MyNews is **not launch-ready as a public app.** The blocker is not the built code; it is what is not built. MyNews is a public user-generated-content (UGC) journalism platform, and the entire moderation and legal safety floor (Phase 3) does not exist yet. That floor is a hard gate for App Store approval (Guideline 1.2), DMCA safe harbor, and EU DSA obligations. On top of that, the app is not deployed, and there are two real security fixes and one deployment guardrail to close first.

Bottom line: the honest "launch" is 3 to 5 weeks of focused work away (build the safety floor, fix the security items, deploy, submit). An invite-only beta is available much sooner if you want real end-to-end validation while the floor is built, but the two security fixes and deployment are required even for that.

## Security findings

### F1 — HIGH — Direct client INSERT into `nw_edit_suggestions` bypasses the edge function
`supabase/migrations/20260703000003_mynews_editing_desk.sql:170-182` (and `...000001:176-179`)

The RLS policy `nw_edit_suggestions_editor_insert` lets any authenticated user INSERT a suggestion row directly through PostgREST with the anon key, as long as `editor_id` maps to their own `auth.uid()` and the article is visible to them. Every legitimate suggestion instead rides the `mynews-suggest` edge function under the service-role key (`supabase/functions/_shared/mynews-store.ts:491`; client path confirmed at `modules/mynews/src/data/publish.ts:159`), which bypasses RLS. So this insert policy is used by no legitimate client path. It is pure attack surface.

A direct insert bypasses everything the edge function enforces: Ed25519 signature verification (the `signature` column defaults to `''`), the level-based open-suggestion cap, and near-dupe collapse. The database only enforces the citation-count floor via CHECK, not the signature or the `https://` scheme on citations.

Impact:
- Unsigned suggestions enter the "re-verifiable corpus," breaking a core product promise (they are detectably unsigned, not forged, since `editor_id` must equal the caller).
- An attacker can flood any visible article's open-suggestion queue past the cap (harassment vector on a target author).
- It is the write path that makes F2 a live stored-XSS vector: a crafted `javascript:` citation reaches the DB unvalidated.

`nw_articles` and `nw_journalists` already have client-guard triggers that force writes through the service-role RPCs. Suggestions were simply missed.

Fix: drop the `nw_edit_suggestions_editor_insert` policy (all suggestions ride the service-role edge function), or add a trigger that blocks direct `authenticated`/`anon` inserts, mirroring `nw_articles_guard_client_update`.

### F2 — HIGH (chained with F1) — Web renders citation URLs as unvalidated `href` (stored XSS on click)
`apps/mynews-web/app/a/[slug]/suggestions/page.tsx:100-102`; shared mapper `modules/mynews/src/data/cloud-fetch.ts:460-463`

The web suggestions page renders `<a href={url} rel="nofollow noopener noreferrer">{url}</a>` with no scheme validation. The shared read mapper `toCitations` accepts any string (`typeof c === 'string'`), so it provides no defense either. `rel` attributes do not neutralize the `javascript:` scheme, and React 19 does not sanitize `href`.

The edge function validates `https://` at insert (`supabase/functions/mynews-suggest/index.ts:58`) and `HttpsUrlSchema` exists in `modules/mynews/src/models.ts:14`, but neither applies on the read/render path. Combined with F1 (which lets a `javascript:...` citation into the DB unvalidated), any visitor to a public article's suggestions page who clicks the crafted citation executes attacker JavaScript on the mynews.app origin.

Note the asymmetry: the Expo app defends here (`apps/mynews/app/(root)/suggestion/[id].tsx:329` gates `Linking.openURL` on `url.startsWith('https://')`); the web does not.

Fix: filter/validate citation URLs to `http:`/`https:` in `toCitations` (fixes both surfaces) and defensively at render.

### F3 — MEDIUM — `verify_jwt` deploy trap on `mynews-review`
`supabase/functions/_shared/mynews-http.ts:41-52`; `supabase/config.toml:418-432`

`mynews-review`'s author gate authorizes off `parseJwtSub(req)`, which decodes the JWT payload without verifying its signature. It relies entirely on Supabase's platform-level `verify_jwt = true`. `config.toml` correctly omits the mynews functions (so they default to `verify_jwt = true`), and the comment there explicitly warns that user-facing functions must not be listed with `verify_jwt = false`. So the default deploy is safe.

The risk is operational: the founder-ops docs say only "deploy the 3 mynews functions" without pinning that `mynews-review` must keep `verify_jwt` ON. If someone copies the BestChef `--no-verify-jwt` deploy pattern, any attacker can forge a `sub` and accept/reject suggestions as any author.

Fix: pin an explicit deploy note (plain `supabase functions deploy mynews-review`, never `--no-verify-jwt`) and add a post-deploy check that an unauthenticated review call returns 401.

## What is clean (verified positive)

- **Secrets:** no tracked `.env`, no hardcoded Supabase keys, no service-role key anywhere in client or web source. Client/web use only the anon key and `EXPO_PUBLIC_MYNEWS_*` / `MYNEWS_SUPABASE_*` (anon-safe).
- **RLS hardening:** the editing-desk migration's adversarial-review appendix closed real leaks (draft thread visibility via `using(true)`, the client publish/insert bypass, and a membership oracle that disclosed other users' newsroom memberships). Money/job/verification tables carry RLS with zero client policies. Public-URL columns are CHECK-forced to `https://`.
- **Markdown rendering:** no markdown-to-HTML pipeline exists; `body_md` renders as escaped React text on both surfaces. No `dangerouslySetInnerHTML` in any app/web source.
- **Honesty boundary:** unconfigured/unreachable/signed-out/no-profile all render honest states; no fabricated counts, no demo adapter in the runtime path, publish/share never fake success.
- **Auth session + key custody (Expo):** session token in SecureStore (Keychain/Keystore), never logged or sent cross-origin; Ed25519 private key generated once and held in SecureStore; only signature + pubkey ever leave the device.
- **Build guard:** `apps/mynews/scripts/check-build-env.mjs` fails production EAS builds with no RevenueCat key (dead-paywall guard) and blocks `ENTITLEMENTS_TEST_MODE=true` from reaching production.

## Production-readiness gaps (not code bugs)

### R1 — CRITICAL for a public launch — No UGC moderation or legal floor
This is the true launch blocker. MyNews lets anyone publish articles and suggestions that become public on the web, but:
- `nw_reports` exists as a table with an insert policy, but **no client code writes to it** — users cannot report content.
- No block, mute, or hide UI anywhere in the app.
- No moderation console (BestChef has `apps/bestchef-console`; MyNews has nothing equivalent wired).
- No DMCA designated agent or repeat-infringer policy; no NCII / TAKE IT DOWN 48-hour pipeline; no DSA Article 16/17 notice-and-action or EU contact.
- No legal documents (Terms, Privacy, Community Guidelines) in the app.

Apple Guideline 1.2 requires UGC apps to have a content filter, a report mechanism, a block-abusive-users mechanism, and published contact info. These are launch-blocking for a public submission and for DMCA safe harbor. This is Phase 3 of the build plan and is unbuilt.

### R2 — Not deployed (founder-ops)
No Supabase project, `DEFAULT` env empty, functions undeployed. To go live: create the Supabase project; `supabase db push` all three nw_ migrations; deploy the three functions (keeping `verify_jwt` on for review); enable anonymous sign-in and allowlist `mynews://auth-callback`; set app env (`EXPO_PUBLIC_MYNEWS_SUPABASE_URL/_ANON_KEY/_FUNCTIONS_URL`, RevenueCat keys) and web env (`MYNEWS_SUPABASE_URL/_ANON_KEY/_PUBLIC_ORIGIN`); run live end-to-end (register, publish, suggest, review, read on web, RSS); device QA the magic-link deep link. Longer track: Stripe Connect for tips, EAS/ASC, RevenueCat products, domain decision (the fallback origin `https://mynews.app` at `apps/mynews-web/lib/origin.ts:7` is a placeholder), 501(c)(3) if the science arm ships.

### Minor
- `apps/mynews-web/lib/cloud.ts` is server-only by discipline (comment), not by the `server-only` package. No secret at risk (anon key is public), but the guardrail is not compile-enforced.
- Fallback OG/RSS origin is a placeholder domain pending a decision.

## Final production-readiness plan

Sequenced so security and the safety floor land before any public exposure.

**Track 0 — Security fixes (before any deploy, ~1 day).** Small branch off main.
1. F1: drop `nw_edit_suggestions_editor_insert` (or add a client-guard trigger) in a new migration `20260705...`. Add a parity/RLS test proving a direct anon/authenticated insert is rejected.
2. F2: validate citation scheme to `http`/`https` in `toCitations` and defensively at the web render; add a test with a `javascript:` citation.
3. F3: add the `verify_jwt`-on deploy note and a post-deploy 401 check to the founder-ops runbook.
4. Run `pnpm gate:function:changed`, the mynews baseline block, and `check:mynews-parity`. Land to main.

**Track 1 — UGC safety + legal floor (Phase 3 subset that is launch-blocking, ~2 to 3 weeks).** Author a plan (next queue number; 37 is taken by Meerkat) covering: report flow wired to `nw_reports` (article/revision/suggestion/profile/media) on app and web; block/mute UI + enforcement; a moderation console (or a minimal reviewer surface over `nw_reports`); DMCA designated-agent registration + repeat-infringer policy + takedown path; NCII/TAKE IT DOWN 48h pipeline; DSA Art 16/17 notice-and-action + EU contact; in-app Terms / Privacy / Community Guidelines + acceptance (`nw_terms_acceptance` already exists). This is the real gate to a public submission.

**Track 2 — Deploy + go-live (founder-ops, parallel with Track 1, ~2 to 4 days of hands-on).** R2 checklist above. Free-tier Supabase pauses after 7 idle days; keep it warm or upgrade before launch.

**Track 3 — Submit.** Full public path: complete Tracks 0-2, run device QA, App Store 1.2 self-check, submit. Interim option: an invite-only TestFlight beta with a known-user allowlist can start after Tracks 0 and 2 (no public UGC exposure defers the 1.2 floor), giving real end-to-end validation while Track 1 builds toward public GA.

The launch target (full public GA vs invite-only beta first) is a founder decision because it changes what must ship before the first build goes out.

---

*Audit method: manual read of the trust-boundary code (edge functions, RLS migrations, RPCs, triggers), a parallel read-only review of the client/web surfaces, and the green baseline gate. Not a substitute for a professional penetration test before a public launch handling PII and payments.*
