# MyLife Dual-Model Product Design

Date: 2026-02-24

## 1) Offer Design

## Hosted Plan (your servers)
- Price: $5/month or $25/year
- Includes:
  - Managed backend + sync + sharing/friends
  - Managed auth, backups, updates
  - Zero infra setup by customer
- Ideal for: people who want convenience

## Self-Host Plan (customer servers)
- Price: $5 one-time (software license, as-is)
- Includes:
  - App software snapshot (current version)
  - Self-host deployment kit + docs
  - Private repo section access for self-host code/docs
  - AI customization guide (natural-language workflow)
- Excludes (important):
  - Managed hosting/support/SLA
  - Automatic future major releases unless user buys update pack
- Ideal for: privacy-focused and technical users

## Optional Update Pack
- Price: $5/year (applies to both hosted and self-host customers)
- Unlocks:
  - New major feature releases for that year
  - New self-host deployment templates/migrations

## 2) Packaging Rules

- Keep one app binary per platform.
- Unlock behavior via entitlements, not separate apps.
- App mode is selected during onboarding:
  1. Hosted
  2. Self-host
  3. Local-only (if no backend wanted)

## 3) Entitlement Model

Add a common entitlement layer used by all apps.

```ts
export type PlanMode = 'hosted' | 'self_host' | 'local_only';

export interface Entitlements {
  appId: string;
  mode: PlanMode;
  hostedActive: boolean;
  selfHostLicense: boolean;
  updatePackYear?: number;
  features: string[];
  issuedAt: string;
  expiresAt?: string;
  signature: string;
}
```

Rules:
- `hostedActive=true` => hosted APIs available.
- `selfHostLicense=true` => self-host connector + self-host docs/repo access.
- `updatePackYear` => major releases for that year.
- Local-only core features remain usable even if no paid entitlement.

## 4) App UX Design

## Pricing Screen
- Card A: `Hosted` ($5/mo or $25/yr)
- Card B: `Self-Host` ($5 once)
- Comparison rows:
  - Managed infra: Hosted yes / Self-host no
  - Friend sharing: Hosted yes / Self-host yes (once configured)
  - Data ownership: both yes (different operations model)
  - Setup time: Hosted minutes / Self-host 15-45 minutes
  - Support: Hosted standard / Self-host docs + AI guide

## Onboarding Flow
1. Choose mode (Hosted, Self-host, Local-only)
2. Hosted path:
   - sign in
   - create/import profile
3. Self-host path:
   - enter server URL + license token
   - run connection test
   - complete setup checklist
4. Local-only path:
   - create local profile
   - optional later upgrade to hosted/self-host

## Settings
- `Mode`: show current mode + switch controls
- `Server`: hosted endpoint or custom self-host endpoint
- `Entitlements`: active licenses + update pack status
- `AI Customization`: links to local repo guide + prompt templates

## 5) Technical Architecture

Use one backend codebase with two deployment targets:
1. MyLife-hosted production
2. Customer self-host Docker deployment

Core backend components:
- API service
- Postgres
- Object storage (S3-compatible)
- Realtime channel (optional)
- Background worker

Self-host bundle:
- `docker-compose.selfhost.yml`
- `.env.example`
- one-command bootstrap script
- migration + backup scripts

### Adapter Pattern
Replace provider lock-in with adapters:
- Auth adapter
- Storage adapter
- Realtime adapter
- AI adapter (BYO keys)

This lets hosted and self-host run the same app logic.

## 6) Existing App Migration Plan

## Apps already local-first (easier)
- MyBooks, MyBudget, MyFast, MyRecipes, MyVoice
- Add optional hosted/self-host sync + friend features via adapter layer.

## Apps currently cloud-heavy (harder)
- MySurf, MyHomes, MyWorkouts
- Refactor from provider-specific flows to deployable generic stack:
  - Keep hosted default
  - Offer self-host by shipping compose + infra docs

## Design-only apps
- Build directly on dual-mode contract from day 1.

## 7) Repo Access After Self-Host Purchase

Create a gated repo section structure:

- `docs/self-host/`
- `deploy/self-host/`
- `infra/templates/`
- `ai-customization/`

Access flow:
1. User buys self-host license.
2. Billing webhook issues signed license token.
3. Automation grants GitHub access (or provides downloadable release bundle).
4. User follows self-host guide and connects app to their server.

Recommended automation:
- Stripe/Lemon Squeezy webhook -> Entitlement service -> GitHub team invite.

## 8) AI Customization Experience

Goal: “change behavior with a paragraph + assistance”.

Ship these artifacts in gated repo:
- `ai-customization/quickstart.md`
- `ai-customization/prompt-templates.md`
- `ai-customization/change-safe-checklist.md`
- `scripts/dev/plan-from-request.ts`
- `scripts/dev/run-regression-suite.sh`

Workflow for user:
1. Describe change in plain language.
2. Assistant generates implementation plan + patch.
3. User runs tests/migrations locally.
4. Deploy updated containers.

Minimum safety checks:
- schema migration dry-run
- backup before deploy
- rollback command documented

## 9) Self-Host Guide Structure

`docs/self-host/README.md`
1. Prereqs (domain, machine, Docker)
2. Install (single command)
3. Configure DNS + TLS
4. Add AI provider keys (optional)
5. Connect mobile/web clients
6. Invite friends
7. Backups and restore
8. Upgrades
9. Troubleshooting

## 10) Friend Sharing Without Your Servers

Support both modes:
- Hosted: your managed relay/API.
- Self-host: user’s own API instance + direct invites.

Data model for sharing (common):
- profile
- friendship/invite
- direct message thread + message receipt state
- shared object (book rating, review, list, etc.)
- visibility (`private`, `friends`, `public`)

All apps should implement the same sharing primitives so features are reusable.

## 11) Billing + Store Implementation

Mobile:
- Hosted: subscription SKU (`monthly`, `yearly`).
- Self-host: non-consumable purchase (`self_host_license`).
- Update pack: annual non-consumable (`update_pack_2026`, etc.) or renewal subscription mapped to updates.

Web:
- Same entitlements via Stripe checkout.

## 12) Legal + License Positioning

Recommended customer-facing language:
- Hosted: “Service subscription”
- Self-host: “Software license (as-is) + deployment docs”
- Update pack: “Optional annual feature/update access”

License model:
- Keep your source-available strategy (for example FSL path) for gated code.
- Explicitly define what self-host buyers can modify and redistribute.

## 13) Rollout Sequence

Phase 1 (2-4 weeks)
- Entitlement service + app mode selector
- Pricing UI + checkout plumbing
- Initial self-host docs skeleton

Phase 2 (4-8 weeks)
- Pilot on MyBooks:
  - hosted + self-host endpoints
  - friend sharing MVP
  - gated repo access flow

Phase 3 (8-12 weeks)
- Extend shared dual-mode architecture to MySubs and MyRecipes
- Start cloud-heavy refactors (MySurf/MyHomes/MyWorkouts)

## 14) Success Metrics

- Conversion split: hosted vs self-host
- 30-day retention by mode
- self-host setup completion rate
- % of users who connect BYO AI keys
- update pack attach rate
- support burden by mode (tickets per 100 users)

## 15) Non-Negotiables

- Local data ownership remains default.
- Self-host does not require persistent phone-home checks.
- Hosted and self-host should share the same feature contract as much as possible.
- AI customization is opt-in, transparent, and reversible.
