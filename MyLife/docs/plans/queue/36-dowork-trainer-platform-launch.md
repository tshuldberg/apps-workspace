# Feature Spec: DoWork Trainer Platform Launch (Plan 36)

> Takes DoWork from its current state (P0-P8 code-complete, security-hardened, no
> playback, no trainer surfaces, no monetization) to a shipped $4.99 App Store app whose
> first user is a working personal trainer. He uploads his filmed workout library, gets a
> shareable public profile to win clients, runs a private coaching loop with each client
> (form-check videos + timestamped feedback), and every viewer controls video playback
> hands-free by voice ("slow down", "back up") while training.
> Grounded in the June 9 production audit's 19 findings, now incorporated here,
> plus founder decisions
> locked 2026-07-03.

## Metadata

- **Surfaces:** `apps/dowork` (screens, providers, data clients), `modules/workouts`
  (voice engine), `supabase/migrations` + `supabase/functions` (dw_* schema v2, 6 edge
  functions), `scripts/check-dowork-parity.mjs`, App Store Connect + RevenueCat
  (founder-ops).
- **Branch:** `feature/dowork-trainer-launch` (worktree off main `4ae6d19e`).
- **Estimated CC time:** 3-4 focused build weeks (report estimated P9 8-10d, P10 6-8d,
  P12 3-5d; this plan adds voice player ~3-4d, coaching loop ~4-5d, hardening ~3d).
- **Depends on (hard):** founder-ops ledger F1-F8 below. No other queue plan.
- **Mandates honored:** founder no-deferral rule (everything at launch, full function);
  privacy-first (on-device speech recognition, zero analytics); transport honesty
  (no fake capability, signed-URL playback only, honest offline states).

## Founder decisions locked 2026-07-03

1. **DoWork standalone** is the trainer platform (not the hub module).
2. **Voice control is hands-free**: on-device speech recognition runs continuously
   whenever a video plays, with visible listening state, a settings toggle, and a
   push-to-talk mic fallback for loud gyms.
3. **Full trainer-client coaching loop ships at launch**: private per-client space,
   form-check video exchange, timestamped trainer feedback, optional video replies.
4. **Full monetization ships in the first build** (P10 as specced): 8-tier RevenueCat
   subscription ladder, webhook ledger, DB-enforced premium gate, earnings screen.
   The trainer can mark videos free while onboarding.
5. **Trainer's clients get his premium library**: an active `dw_client_links` row counts
   as entitled, same as a paid subscription (coaching is the higher-touch product).

## Ground truth baseline (2026-07-03, verified in-repo)

Green and real: 41+ screens ported (P5), cloud social layer (P6), all 7 critical
security findings closed (P7: RLS split policies, storage buckets with owner-folder RLS,
signed-only trainer video reads), real signed upload pipeline
`dowork-upload-finalize` sign + finalize with server-written rows (P8, 10 min / 500 MB
caps), real account deletion, report/block/blocked-users, profiles with generated
handles, offline queues in `hub_settings`. 63/63 app tests, 67/67 edge fn tests,
`check:dowork-parity` 173 checks.

Missing, in order of user pain:
- **No video playback anywhere.** Only `upload-video.tsx` touches `expo-av`. No player
  screen, no `dowork-playback-url` function, no signed-URL client.
- **Voice engine is a dead parser.** `modules/workouts/src/voice.ts` `parseVoiceCommand`
  supports "slow down"/"speed up"/"back"/pause with tests, but zero UI wiring and no
  speech-recognition dependency anywhere in the repo.
- **No trainer surfaces**: no Trainers tab, directory, profile, Studio, invites.
- **No coaching loop** (new scope, not in the 06-09 report).
- **No monetization**, no push, no deep links, no downloads.
- `expo-av` is deprecated; new playback must use `expo-video` (SDK 54).

---

## Phase 1: Cloud spine (schema v2 + 6 edge functions)

Everything else reads through this. All SQL idempotent (`if not exists`, `or replace`).

### 1.1 Migration `supabase/migrations/20260703000001_dowork_trainer_platform_v2.sql`

New tables (all RLS-enabled):

```sql
create table if not exists public.dw_trainer_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                     -- 12-char A-Z2-9, server-generated
  created_by uuid references auth.users(id) on delete set null,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);
-- No public policies at all: redemption happens inside dowork-redeem-invite
-- (service role), which prevents code enumeration.

create table if not exists public.dw_trainer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trainer_id uuid not null references public.dw_trainers(id) on delete cascade,
  product_id text not null,
  store text not null check (store in ('app_store','play_store')),
  status text not null check (status in ('active','cancelled','expired','billing_issue')),
  current_period_end timestamptz,
  rc_app_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, trainer_id)
);
-- Written only by dowork-rc-webhook (service role). Self-read + trainer-read policies.

create table if not exists public.dw_purchase_events (
  id uuid primary key default gen_random_uuid(),
  rc_event_id text not null unique,              -- idempotency key
  event_type text not null,
  user_id uuid,
  trainer_id uuid,
  product_id text,
  price_usd numeric(10,2),
  raw jsonb not null,
  created_at timestamptz not null default now()
);
-- Append-only ledger, service role only. Trainer earnings read through the
-- dw_trainer_earnings view below, never the raw table.

create table if not exists public.dw_client_links (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.dw_trainers(id) on delete cascade,
  client_user_id uuid references auth.users(id) on delete cascade,
  invite_code text not null unique,              -- per-client code the trainer shares
  status text not null default 'invited' check (status in ('invited','active','ended')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  ended_at timestamptz,
  unique (trainer_id, client_user_id)
);
-- Trainer full CRUD on own rows; client can select own row and update
-- status invited->active only (join by code goes through an RPC that looks the
-- code up with security definer, so codes are not enumerable).

create table if not exists public.dw_form_checks (
  id uuid primary key default gen_random_uuid(),
  client_link_id uuid not null references public.dw_client_links(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  exercise_slug text,
  storage_path text not null,                    -- dowork-form-checks bucket, private
  thumbnail_path text,
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  note text,
  status text not null default 'pending' check (status in ('pending','reviewed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.dw_form_feedback (
  id uuid primary key default gen_random_uuid(),
  form_check_id uuid not null references public.dw_form_checks(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text,
  video_timestamp_seconds numeric(8,2),          -- anchors feedback to a moment
  reply_storage_path text,                       -- optional video reply, same bucket
  created_at timestamptz not null default now(),
  check (body is not null or reply_storage_path is not null)
);
-- Both form tables: read/write only for the two participants of the client link
-- (exists subquery against dw_client_links joining dw_trainers.user_id).

create table if not exists public.dw_video_view_marks (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.dw_trainer_videos(id) on delete cascade,
  hour_bucket timestamptz not null,
  primary key (user_id, video_id, hour_bucket)
);
-- Service-role only (written by dowork-playback-url); dedupes view_count bumps
-- to one per user per video per hour.

create table if not exists public.dw_push_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_token text not null,
  platform text not null check (platform in ('ios','android')),
  updated_at timestamptz not null default now(),
  primary key (user_id, expo_token)
);
-- Owner-only CRUD. dowork-notify reads with service role.
```

Altered tables:

```sql
alter table public.dw_trainers
  add column if not exists handle text unique,
  add column if not exists headline text,
  add column if not exists specialties text[] not null default '{}',
  add column if not exists instagram text,
  add column if not exists website text,
  add column if not exists hero_image_path text,
  add column if not exists price_tier integer not null default 1
    check (price_tier between 1 and 8),
  add column if not exists subscriber_count integer not null default 0;
-- Protect trigger (extends the P7 pattern): owner updates may not change
-- is_verified, is_active, subscriber_count; price_tier changes allowed but logged.
-- Trainer rows are created ONLY by dowork-redeem-invite (drop any residual
-- owner-insert path; keep the P7 is_verified=false insert guard as belt).

alter table public.dw_trainer_videos
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists is_premium boolean not null default false,
  add column if not exists view_count integer not null default 0,
  add column if not exists published_at timestamptz default now();

-- THE paywall, enforced in the database, not the client:
drop policy if exists dw_trainer_videos_select_public on public.dw_trainer_videos;
create policy dw_trainer_videos_select_entitled
  on public.dw_trainer_videos for select
  using (
    is_hidden = false and (
      is_premium = false
      or exists (select 1 from public.dw_trainers t
                 where t.id = trainer_id and t.user_id = auth.uid())
      or exists (select 1 from public.dw_trainer_subscriptions s
                 where s.trainer_id = dw_trainer_videos.trainer_id
                   and s.user_id = auth.uid() and s.status = 'active'
                   and (s.current_period_end is null or s.current_period_end > now()))
      or exists (select 1 from public.dw_client_links c
                 where c.trainer_id = dw_trainer_videos.trainer_id
                   and c.client_user_id = auth.uid() and c.status = 'active')
    )
  );

-- Earnings: implemented as SECURITY DEFINER function dw_get_trainer_earnings()
-- returning (month, paid_events, gross_usd) scoped to the caller's own trainer row
-- (a security_invoker view would see nothing because dw_purchase_events carries no
-- policies). Phase 5 earnings screen MUST call this RPC, not select a view.
```

### 1.2 Migration `20260703000002_dowork_form_check_storage.sql`

`dowork-form-checks` private bucket (signed-only, 500 MB / 10 min cap parity with
trainer videos, `video/mp4` + `video/quicktime` MIME), RLS: participants of the
client link only, enforced by folder convention `<client_link_id>/<uuid>.mp4` and
policies that join through `dw_client_links`.

### 1.3 Edge functions (`supabase/functions/`)

| Function | Status | Contract |
|---|---|---|
| `dowork-redeem-invite` | new | POST `{ code }` with user JWT. Validates unclaimed + unexpired, creates `dw_trainers` row (service role; handle generated from display name + collision retry), marks invite claimed. The only path that creates trainers. Returns the trainer row. |
| `dowork-playback-url` | new | POST `{ videoId }` or `{ formCheckId }`. Re-checks entitlement server-side (free, owner, active sub, active client link; form checks: participants only). Returns 60-minute signed URL + metadata. Increments `view_count` (fire-and-forget, deduped per user+video+hour via upsert into `dw_video_view_marks`). |
| `dowork-rc-webhook` | new | RevenueCat webhook, `Authorization` header verified against `RC_WEBHOOK_SECRET`. Upserts `dw_trainer_subscriptions` from INITIAL_PURCHASE / RENEWAL / CANCELLATION / EXPIRATION / BILLING_ISSUE, appends `dw_purchase_events` (idempotent on `rc_event_id`), recomputes `subscriber_count`. |
| `dowork-notify` | new | Internal fan-out: called by upload-finalize (new published video -> subscribers + active clients of that trainer) and by Database Webhooks on `dw_form_checks` insert (-> trainer) and `dw_form_feedback` insert (-> the other participant). Reads `dw_push_tokens`, posts to Expo push API in 100-token chunks, prunes `DeviceNotRegistered`. |
| `dowork-upload-finalize` | upgrade | Sign step accepts `kind: 'trainer_video' | 'share_media' | 'avatar' | 'form_check'`; form_check requires an active client link and signs into `dowork-form-checks/<link_id>/`. Finalize writes title/description/is_premium/exercise_slug for trainer videos and the `dw_form_checks` row for form checks (server-written rows, same C3 discipline). Triggers dowork-notify. |
| `dowork-delete-account` | upgrade | Cascade extends to the 7 new tables + form-check storage prefixes on both sides + RevenueCat subscriber note in response payload. |

Each function keeps the existing Deno test pattern (P8 landed 67 tests; target +40).

### Phase 1 acceptance

- `supabase db reset`-style local apply of all migrations is clean and idempotent.
- Deno tests green per function; entitlement matrix test covers all 4 grant paths
  plus the denial path; webhook idempotency proven by replaying the same event.
- `check:dowork-parity` extended to assert the new migrations + functions exist.

---

## Phase 2: Voice-controlled player (the marquee feature)

### 2.1 New deps (`apps/dowork/package.json`)

`expo-video` (player; `expo-av` stays only until upload preview migrates, then is
removed), `expo-video-thumbnails` (client thumbs for Studio), `expo-keep-awake`,
`expo-speech-recognition` (on-device STT; iOS `SFSpeechRecognizer` with
`requiresOnDeviceRecognition`, Android `SpeechRecognizer`), `expo-notifications`
(Phase 6 consumer, installed once here). Config plugin entries + iOS strings
(`NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`) in `app.json`.
Fetch current API docs via Context7 (`/expo/expo`) before wiring.

### 2.2 Voice engine: `modules/workouts/src/voice/player-commands.ts` (TDD first)

```typescript
export type PlayerVoiceAction =
  | { kind: 'pause' } | { kind: 'play' }
  | { kind: 'seek'; deltaSeconds: number }        // negative = back
  | { kind: 'restart' }
  | { kind: 'rate_step'; direction: 'down' | 'up' }
  | { kind: 'rate_set'; rate: number }            // "normal speed", "half speed"
  | { kind: 'info'; query: 'current_exercise' | 'time_remaining' };

export interface PlayerVoiceMatch {
  action: PlayerVoiceAction;
  confidence: number;   // 1.0 exact phrase, 0.8 contained
  raw: string;
}

export const PLAYER_RATE_LADDER = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export function parsePlayerCommand(transcript: string): PlayerVoiceMatch | null;
export function stepRate(current: number, direction: 'down' | 'up'): number;
```

Grammar (all case-insensitive, contained-match like the existing parser):
"slow down"/"slower" -> rate_step down; "speed up"/"faster" -> rate_step up;
"normal speed"/"regular speed" -> rate_set 1; "half speed" -> rate_set 0.5;
"back up"/"go back"/"rewind" -> seek -10 default; "skip ahead"/"go forward" -> seek +10;
spoken and numeric durations ("back up thirty seconds", "go back 15", "forward one
minute") via a small word-number table (one..sixty, "half a minute", "a minute");
"pause"/"stop"/"hold on" -> pause; "play"/"resume"/"keep going"/"go" -> play;
"start over"/"from the top"/"restart" -> restart.
False-trigger guard: transcripts longer than 6 words with no command phrase in the
final 4 words return null (gym conversation protection). Full vitest matrix including
noise phrases that must NOT match ("don't slow down yet" DOES match by contained-match
design; document this and require the 1.5 s debounce in the hook instead).
Existing `parseVoiceCommand` stays untouched for compat; barrel exports both.

### 2.3 Player screen: `apps/dowork/app/(root)/player.tsx`

Route `player?videoId=` and `player?formCheckId=`. Fetches signed URL via new
`data/cloud-playback.ts` (`getPlaybackSource(videoIdOrFormCheck)`, refresh path on
expiry or 403 mid-session), `useVideoPlayer` from expo-video, custom control rail
(scrub bar, minus/plus 10 s, rate chip cycling the ladder, fullscreen, PiP), keep-awake
while playing, landscape allowed on this screen only, view resume position persisted
to `hub_settings` KV per video.

### 2.4 Hands-free layer: `apps/dowork/app/(root)/components/VoiceCoach.tsx` + `lib/voice/useVoiceCoach.ts`

- Starts continuous on-device recognition when playback starts and the setting is on;
  stops on pause caused by the user, background, or screen blur. Recognition results
  (interim + final) run through `parsePlayerCommand` with a 1.5 s same-command debounce.
- Executes actions against the expo-video player instance; every accepted command fires
  haptic + a 1.2 s command toast ("Slowed to 0.75x", "Back 10 s").
- Visible listening state: pulsing mic pill on the player. Tap pill = push-to-talk when
  the continuous toggle is off. Settings: "Voice control while watching" toggle +
  default seek length (5/10/15/30 s).
- Audio session: recognition must not duck playback into silence; on iOS configure
  playAndRecord + mixWithOthers via the library's category options. **Spike task first**
  (simultaneous playback + mic on a real device); if a platform blocks simultaneous
  capture at some OS state, surface an honest inline notice and the push-to-talk pill
  still works. Never fake a listening state.
- Permission flow: pre-permission explainer sheet, then OS prompts; denial leaves the
  player fully usable with the pill in an off state linking to Settings.

### Phase 2 acceptance

- Parser: full vitest matrix green (target ~40 cases) in `modules/workouts`.
- Player plays a signed URL end to end against a local/staging project, rate + seek +
  restart + pause/play all reachable by voice with the device mic in a real room.
- `pnpm gate:function:changed` green; parity checks extended for the new screen.

---

## Phase 3: Trainer platform UI (P9)

- `(tabs)/trainers.tsx` 6th tab: directory of active trainers (featured hero card,
  specialties chips, subscriber counts), search by name/specialty.
- `trainer/[handle].tsx` public profile: hero, headline, socials, free vs premium
  library split, Subscribe CTA (Phase 5 paywall), "Work with me" client CTA
  (Phase 4), video grid -> player.
- `studio.tsx` Trainer Studio (gated on own `dw_trainers` row): upload queue with
  multi-select from library (expo-image-picker video mode), per-video metadata editor
  (title, description, exercise link, angle, premium flag), serial background uploads
  with progress + retry using the existing `cloud-media.ts` pipeline, client-side
  thumbnails via expo-video-thumbnails; manage grid (edit, hide, delete, set primary,
  per-video view counts); profile editor (headline, specialties, socials, hero, price
  tier).
- `redeem-invite.tsx` onboarding: code entry -> `dowork-redeem-invite` -> Studio
  welcome. Entry point on Settings and on the Trainers tab footer ("Are you a trainer?").
- Exercise detail screen gains the trainer rail (primary demo video per exercise ->
  player), replacing the local-only `wk_trainers` mirror path.
- Data clients: `data/cloud-trainers.ts` (extend), `cloud-trainer-videos.ts` (extend
  for metadata + view counts), new `cloud-invites.ts`.

### Phase 3 acceptance

Invite -> trainer -> bulk upload 3 real videos -> they appear on profile + exercise
rail -> playback through the player with voice, all on device against staging.
Tests for every data client branch; parity extension for the new routes.

---

## Phase 4: Coaching loop UI

- Studio gains a Clients section: roster (active/invited/ended), "Invite a client"
  generates a `dw_client_links` code + share sheet (QR + `dowork://client-invite/CODE`),
  per-client thread of form checks with status badges.
- Client side: `my-trainer.tsx` reachable from Settings + Home card when a link is
  active: trainer header, premium library (entitled via client link), "Send a form
  check" (record or pick video -> upload kind `form_check` -> trainer notified), thread
  of own form checks with feedback.
- `form-check/[id].tsx` review screen (both roles): player on the form-check video,
  feedback list anchored to timestamps (tap -> seek), trainer composer with "attach
  current timestamp" and optional video reply (records through the same pipeline);
  posting feedback marks reviewed + notifies the client.
- Join flow: `client-invite.tsx` deep-link target, code entry fallback, RPC
  `dw_redeem_client_invite(code)` (security definer) flips the link to active.
- Data client: `data/cloud-coaching.ts` (links, form checks, feedback, all
  entitlement-aware and offline-queue friendly for text feedback).

### Phase 4 acceptance

Two-account round trip on device: trainer invites, client joins by QR, client uploads
form check filmed in the gym, trainer gets push, reviews with 2 timestamped notes +
a video reply, client gets push and sees both anchored in the player. RLS negative
tests: a third account can read nothing in either direction.

---

## Phase 5: Monetization (P10)

- `react-native-purchases` + RevenueCat: identify with Supabase user id (aliasing),
  8 products `dowork_trainer_tier_1` ($4.99/mo) .. `tier_8` ($39.99/mo) in one
  subscription group; trainer `price_tier` selects the product on their profile.
- Paywall sheet from the profile Subscribe CTA: price, renewal terms, what is included,
  full disclosure copy, links to hosted Terms/Privacy; purchase -> RC -> webhook ->
  `dw_trainer_subscriptions` -> the DB entitlement flips (client re-fetch confirms
  server truth, never trusts the local receipt alone).
- Settings: Restore Purchases, Manage Subscription (OS deep link).
- Studio: earnings screen off `dw_trainer_earnings` (monthly gross, paid events,
  subscriber count, honest "Apple takes its cut before payout" note; the revenue split
  itself is founder decision F4).
- Sandbox matrix executed and logged: subscribe, renew, cancel, expire, restore,
  refund, re-subscribe; webhook replay idempotency.

---

## Phase 6: Launch hardening + improvements sweep

Additional items identified 2026-07-03 to meet the launch goal (first user works with
real clients daily):

1. **Push wiring end to end**: token registration on sign-in (`data/push.ts`),
   notification preferences screen (new video, form checks, feedback, marketing off by
   default), deep-link routing from notification tap into player/form-check/thread.
2. **Deep links + QR**: `dowork://trainer/[handle]`, `dowork://video/[id]`,
   `dowork://client-invite/[code]` + universal links config placeholder; trainer
   profile share sheet with QR poster (he puts it on the gym wall).
3. **Offline downloads**: entitled videos downloadable to app sandbox
   (`FileSystem` + signed URL, re-verified entitlement at download time, files keyed by
   video id, wiped on sign-out/entitlement loss check at open, honest storage meter in
   Settings). Player prefers local file when present.
4. **Day-1 truth pass**: `shouldShowDemoContent` fixtures never render in production
   builds (re-verify), every new screen has real loading/empty/error/success states,
   empty Trainers tab shows the invite CTA not a fake directory.
5. **A11y + Dynamic Type** on all new screens (BestChef N-series lesson: clamp layouts,
   label controls, VoiceOver order on the player rail).
6. **Gate + parity extension**: `scripts/check-dowork-parity.mjs` gains checks for new
   routes, functions, migrations, and the voice engine exports; all suites green:
   `pnpm --filter @mylife/dowork-app test`, `--filter @mylife/workouts test`,
   typechecks, `pnpm check:parity`, `pnpm gate:function:changed`.
7. **Docs**: update `apps/dowork/CLAUDE.md`, `Tickets/launch-plan.md` (P9-P12 rows),
   runbook additions for the new functions + webhooks + RevenueCat.

---

## Phase 7: Store ops + white-glove QA (P12)

Code-side: review-notes doc with demo trainer + demo subscriber credentials, QA
checklist run, adaptive icon + splash final assets wired, version/build stamping.

White-glove TestFlight script with the first trainer (from the report, extended):
redeem the first real invite, bulk-upload his actual filmed library, publish profile,
first client joins via QR, client subscribes from a second account (sandbox), form
check round trip, and a full voice session in his actual gym (noise reality check for
the recognizer thresholds). Findings feed `Tickets/` and `errors_log.md` before submit.

## Execution contracts locked (2026-07-03, wave 2 dispatch)

These bind Phases 1.3 and 2 so parallel workers stay compatible. Do not re-decide.

- **`dowork-playback-url` contract.** POST, user JWT. Body exactly one of
  `{ videoId }` or `{ formCheckId, feedbackId? }` (feedbackId returns that feedback's
  `reply_storage_path` after the same participant check). 200 response:
  `{ url, expiresAt (ISO), kind: 'trainer_video' | 'form_check', title: string | null,
  durationSeconds: number | null }`. Errors: 400 bad body, 401 no JWT,
  403 `{ error: 'not_entitled' }`, 404 `{ error: 'not_found' }` (hidden video = 404).
  60-minute signed URL. View dedup: upsert `dw_video_view_marks`
  (user, video, hour bucket); only a NEW mark bumps `view_count`; view failures never
  break playback. The client half is `apps/dowork/app/(root)/data/cloud-playback.ts`
  `getPlaybackSource(params)` returning the house `{ ok: true, ... } | { ok: false,
  error }` shape, plus `isExpired(expiresAt, skewMs = 60_000)`.
- **RC webhook trainer resolution.** The app sets a RevenueCat subscriber attribute
  `trainer_id` at purchase time; `dowork-rc-webhook` reads it from
  `event.subscriber_attributes`. If absent, the event is still appended to
  `dw_purchase_events` (idempotent on `rc_event_id`, replay returns
  `{ ok: true, duplicate: true }` without reapplying) but NO subscription row is
  written (`{ ok: true, unmatched: true }`, never guess). Auth: `Authorization`
  header equals `RC_WEBHOOK_SECRET`. After upsert, recompute
  `dw_trainers.subscriber_count` from active rows.
- **`dowork-notify` auth.** Header `x-dowork-internal` equals `DOWORK_INTERNAL_SECRET`.
  Callers: `dowork-upload-finalize` (best-effort, failures never fail the caller) and
  Supabase Database Webhooks on `dw_form_checks` / `dw_form_feedback` inserts
  (configured with that header, founder-ops F1). Types: `new_video` (active
  subscribers + active clients, deduped), `form_check` (link's trainer),
  `form_feedback` (the other participant). Expo push in chunks of 100; prune
  `dw_push_tokens` on `DeviceNotRegistered`.
- **Earnings.** `dw_get_trainer_earnings()` RPC (security definer), NOT a view.
- **Player dependencies.** `pnpm --filter @mylife/dowork-app exec expo install
  expo-video expo-keep-awake expo-video-thumbnails expo-notifications
  expo-screen-orientation` then `pnpm --filter @mylife/dowork-app add
  expo-speech-recognition` (jamsch community package; check its config plugin), then
  root `pnpm install`. `expo-av` stays until `upload-video.tsx` migrates. iOS strings:
  `NSMicrophoneUsageDescription` + `NSSpeechRecognitionUsageDescription` (on-device,
  audio never leaves the device).
- **Voice architecture.** Pure controller `apps/dowork/lib/voice/voice-coach-core.ts`
  (`createVoiceCoachState()`, `processTranscript(state, transcript, nowMs)` with a
  1500 ms same-command debounce, `describeCommand()`) + React hook
  `apps/dowork/lib/voice/useVoiceCoach.ts` with status
  `off | denied | listening | paused | unavailable`. Never render a fake listening
  state; if simultaneous playback + capture is unsupported, status is `unavailable`
  with an honest reason and the push-to-talk pill still works.
- **Voice settings.** `apps/dowork/lib/voice/voice-settings.ts`, zod shape
  `{ enabled: boolean; seekSeconds: 5 | 10 | 15 | 30 }` in `hub_settings` KV. The
  settings seek length overrides ONLY bare seek commands (parser default 10);
  spoken durations always win, sign preserved.
- **File ownership per wave.** Exactly one agent per wave owns
  `scripts/check-dowork-parity.mjs` (wave 2: the edge-functions agent). Sibling
  agents must not edit it. Agents `git add` specific paths only and retry on
  `index.lock`.

## Founder-ops ledger (start now, gates later phases)

| # | Item | Gates |
|---|---|---|
| F1 | Supabase prod project, `supabase db push`, deploy all 6 functions, create the 4 buckets, configure Database Webhooks (form_checks, form_feedback -> dowork-notify), set secrets (`RC_WEBHOOK_SECRET`, service keys) | Phases 1-4 live QA |
| F2 | `eas init` + projectId, bundle `com.dowork.dowork`, ASC app at $4.99 paid tier | Phase 7 |
| F3 | RevenueCat account, 8 subscription products in ASC + RC, webhook URL wiring (Authorization header = RC_WEBHOOK_SECRET), AND per-platform public SDK keys injected into the EAS build env: `EXPO_PUBLIC_DOWORK_RC_KEY_IOS` (appl_) + `EXPO_PUBLIC_DOWORK_RC_KEY_ANDROID` (goog_); without them the paywall shows its honest unavailable state. Consider mirroring Manhattan's eas-build-pre-install env guard (code-side, Phase 7) | Phase 5 |
| F4 | Revenue split decision with the trainer (his cut of subscription gross) | Phase 5 earnings copy |
| F5 | Hosted legal: Terms, Privacy, Community Guidelines, trainer content license at dowork.app. The shipped paywall links exactly https://dowork.app/terms and https://dowork.app/privacy | Phase 5 paywall + App Review |
| F6 | Apple Developer push key (APNs) + FCM for expo-notifications | Phase 6 |
| F7 | TestFlight testers: the trainer + 1-2 of his clients | Phase 7 |
| F8 | App icon / splash final art approval | Phase 7 |

## Build order and verification cadence

Phase 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7. Phases 3 and 4 can overlap once 1 lands.
Voice engine (2.2) is pure TDD and can start immediately in parallel with Phase 1.
Every phase: Conventional Commits on `feature/dowork-trainer-launch`, function gate +
parity green before each commit, `errors_log.md` + `memory.md` discipline, Open Brain
capture per milestone ("personal, mylife").
