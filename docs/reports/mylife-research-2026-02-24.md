# MyLife Research Report (2026-02-24)

## Scope
- Repository reviewed: `/Users/trey/Desktop/Apps/MyLife`
- Goal reviewed: user-owned data, optional friend sharing without company servers as intermediaries, sustainable $5 purchase model, optional paid updates, user-modifiable apps with their own AI subscriptions.

## Executive Summary
MyLife is currently split between:
1. A new hub monorepo (`apps/`, `modules/`, `packages/`) that is early-stage and mostly local-first.
2. A set of standalone app repos (`My*` submodules), where 8 apps have working code and 14 apps are design-only drafts.

The vision (privacy-first, no-middleman, low one-time price) is technically achievable, but only if architecture is standardized now around:
- Local-first storage as default.
- Optional decentralized sync/sharing as add-on, not baseline requirement.
- BYO-AI provider keys.
- Paid “feature packs” (optional annual purchase) rather than mandatory subscriptions.

## Repo Facts (Observed)

### Root MyLife (hub monorepo)
- Commits: 3
- First commit: 2026-02-22 22:43:34 -0800
- Last commit: 2026-02-22 23:18:11 -0800
- Stack: TypeScript, Expo, Next.js, SQLite-first, Turborepo.
- Current module implementation status:
  - Implemented module packages: `books`, `fast`, `subs`
  - Placeholder-only module packages: `budget`, `car`, `habits`, `homes`, `meds`, `recipes`, `surf`, `workouts`
- Current host app wiring:
  - Mobile routes include hub + books only.
  - Web routes include hub + books + fast only.
  - `subs` module exists in code and registry wiring but has no route pages in web/mobile.

### Standalone app inventory

#### Built (code present)
- `MyBooks` (91 code files)
- `MyBudget` (88)
- `MyFast` (60)
- `MyHomes` (73)
- `MyRecipes` (74)
- `MySurf` (178)
- `MyVoice 2` (22)
- `MyWorkouts 2` (101)

#### Design-only (draft spec, no product code yet)
- `MyCar`, `MyCloset`, `MyCycle`, `MyFlash`, `MyGarden`, `MyHabits`, `MyJournal`, `MyMeds`, `MyMood`, `MyNotes`, `MyPets`, `MyStars`, `MySubs`, `MyTrails`
- Each has `DESIGN.md` and typically a strong privacy-first + one-time-pricing concept, but no implementation yet.

## App-by-App Review Against “No Middleman” Goal

### Strong alignment today (local-first already)
- MyBooks
- MyBudget
- MyFast
- MyRecipes
- MyVoice (on-device whisper flow)

These are closest to the target: user data local, low server dependency.

### Partial / conflict with target (cloud-centered currently)
- MySurf (Supabase + external marine/weather data + AI narrative pipeline)
- MyHomes (backend/API/service-heavy architecture)
- MyWorkouts (Supabase/Auth/coach portal/payment webhooks)

These are valuable apps, but currently assume hosted service architecture and do not match “no company servers in the middle” without redesign.

### Planned but not built yet
- 14 draft apps have strong positioning and pricing narratives, but are still specs.

## Core Gap Analysis

### What is missing for Goodreads-like friend sharing without your servers
1. No shared identity model across apps for friend relationships.
2. No decentralized sync layer (P2P, federated, or user-hosted relay).
3. No common object model for social items (rating, review, reaction, follow, visibility controls).
4. No standard encryption/access-control model for private friend sharing.
5. No turnkey self-host deployment recipe for non-technical users.

### What is missing for your pricing/open-modifiable model
1. No unified BYO-AI key framework (provider adapters + local secret storage + usage controls).
2. No annual paid update entitlement strategy implemented.
3. No “prompt-to-customization” layer to let users modify apps via natural-language instructions safely.

## Market + Tech Research (Primary Sources)

### Privacy demand is real
- Pew reports major concern around loss of control over personal data and perceived inability to avoid collection.
- Source: https://www.pewresearch.org/internet/2019/11/15/americans-and-privacy-concerned-confused-and-feeling-lack-of-control-over-their-personal-information/

### Protocol options for social/friend features

#### ActivityPub (federated social)
- Mature W3C standard and fits social timelines/follows.
- Security/auth is intentionally not fully standardized in-protocol, so implementation choices matter.
- Source: https://www.w3.org/TR/activitypub/

#### BookWyrm proof-point (Goodreads-like + federation)
- Federated social reading software based on ActivityPub.
- Supports privacy/visibility controls per post.
- Sources:
  - https://joinbookwyrm.com/
  - https://docs.joinbookwyrm.com/user/privacy.html

#### Matrix (private messaging/groups)
- Open standard for interoperable communication.
- Supports end-to-end encrypted communication and federated homeservers.
- Sources:
  - https://matrix.org/ecosystem/
  - https://matrix.org/blog/2022/01/05/types-of-communication-in-matrix/

#### Syncthing (direct device sync)
- Device-to-device sync with encrypted transport and optional relay when direct path unavailable.
- Good low-complexity way to sync app data between trusted devices/users.
- Sources:
  - https://syncthing.net/
  - https://docs.syncthing.net/users/security.html

#### Tailscale / Headscale (self-host networking bootstrap)
- Makes home-host/user-host connectivity practical behind NAT.
- Headscale gives self-hosted control plane option.
- Sources:
  - https://tailscale.com/kb/1232/derp-servers
  - https://headscale.net/

#### AT Protocol self-hosting (higher complexity)
- Self-hosting a Bluesky PDS is possible, but requires VPS, domain, and multiple public ports.
- Better for public social graph portability than private friend sync simplicity.
- Source: https://github.com/bluesky-social/pds

### Local-first collaboration tech
- Automerge: local-first by design with conflict-free sync model.
- Yjs: network-agnostic CRDT and offline support.
- Sources:
  - https://automerge.org/
  - https://docs.yjs.dev/

### Pricing and store mechanics
- Apple supports one-time paid apps + non-consumable IAP (lifetime unlock) and subscriptions.
- Apple Small Business Program has reduced commission terms for eligible developers.
- Google Play supports one-time products and configurable purchase options.
- Sources:
  - https://developer.apple.com/app-store/subscriptions/
  - https://developer.apple.com/help/app-store-connect/reference/in-app-purchase-types/
  - https://developer.apple.com/app-store/small-business-program/
  - https://support.google.com/googleplay/android-developer/answer/16430488
  - https://support.google.com/googleplay/android-developer/answer/6334373

### Licensing path for source-access + eventual open source
- FSL allows source availability now with automatic Apache conversion after period (e.g., 2 years in examples).
- Source: https://fsl.software/

## Recommended Product/Architecture Direction

## Direction A (Recommended): Local-first core + optional decentralized sharing

### Baseline guarantees
- App always works single-player/local-only with zero required accounts.
- User data stored locally first.
- Networking only occurs if user enables sharing/sync.

### Social/sharing layer (phased)
1. Phase 1: “Export/import + Syncthing folder sync”
- Lowest complexity, fastest path, no permanent server dependency.

2. Phase 2: “Private social via Matrix bridge”
- End-to-end encrypted friend groups, invites, and share events.
- Good for private friend networks.

3. Phase 3: “Public federation via ActivityPub”
- Optional public profiles/feeds for users who want discoverability (BookWyrm-style).

### Why not ATProto first
- Too much operational overhead for typical $5 consumer app buyers.
- Better introduced later as optional advanced connector.

## Direction B (Not recommended now): Build full custom P2P stack first
- Highest engineering risk.
- Hardest UX around NAT, identity recovery, and conflict resolution.
- Slows shipping core value.

## Concrete Monetization Plan (Fits Your Goal)

### Plan structure
1. Core app: $4.99 one-time.
2. Optional annual “Feature Pack” entitlement: $4.99 (non-consumable IAP per year label or equivalent SKU strategy).
3. Existing users keep what they bought; no forced lockout.

### UX messaging
- “Buy once, own forever.”
- “Optional yearly upgrade pack if you want new major features.”
- “No subscription required to keep using your app.”

### Store implementation options
- Option 1: Single app + annual non-consumable feature packs (`2027 Pack`, `2028 Pack`).
- Option 2: New yearly app SKU + bundle migration discounts (if platform constraints require).

## BYO-AI + User Modifiability Plan

### Technical pattern
- Provider adapters: OpenAI / Anthropic / local model endpoint.
- Keys stored locally (OS keychain/secure storage), never sent to your servers.
- Per-feature model config in plain JSON/YAML.
- Prompt templates editable by user.

### “Modify with a paragraph” workflow
1. User writes request in natural language.
2. App generates patch proposal against local templates/config.
3. User previews diff + approves.
4. Changes applied locally; optional git commit helper.

This creates real user ownership while keeping supportable boundaries.

## Prioritized Build Roadmap

### 0-30 days
1. Define cross-app “ownership contract”:
- local storage standard
- export format standard
- identity keys standard

2. Ship one flagship social pilot:
- MyBooks friend sharing (ratings/reviews visibility controls)
- start with export/import + optional Syncthing sync

3. Add BYO-AI config kernel package for all apps.

### 31-90 days
1. Add Matrix-based private friend channel prototype.
2. Add one-click self-host kit (Docker Compose + Tailscale/Headscale guide).
3. Add optional annual feature pack entitlement plumbing.

### 91-180 days
1. Add optional ActivityPub connector for public social discovery.
2. Standardize trust/safety controls (blocking, visibility, report/export).
3. Expand same architecture to MySubs and MyRecipes sharing use cases.

## Immediate Recommendations

### Immediate
1. Decide and document one canonical social sync model for v1 (recommend: local-only + Syncthing optional).
2. Freeze cloud-heavy module scope in root MyLife until decentralized baseline contract is defined.
3. Pick a single paid-update mechanism now (annual feature pack labels).

### Short-term
1. Build MyBooks as the reference implementation of friend sharing.
2. Publish “self-host in 15 minutes” guide with Tailscale/Headscale options.
3. Add “Own your AI keys” settings in one app and templatize it.

### Long-term
1. Add federation connector layer (ActivityPub optional).
2. Add migration tooling between standalone app repos and hub modules.
3. Consider an SDK so external contributors can build modules with the same ownership contract.

## Bottom Line
Your positioning is strong and differentiated: private, local, low-cost, own-your-data software. The missing piece is not ideas; it is protocol/packaging standardization. If you standardize local-first + optional decentralized sharing now, you can support your $5 model, optional paid updates, and user-driven customization without becoming another SaaS gatekeeper.
