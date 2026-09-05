# 2026-08-31 - Meerkat animated user workflows (all surfaces)

## What

Reviewed Meerkat git history (main at `6ed8ce97`: plan 56 C0-C3 composition platform, billing live, 8-set hardening sweep) and current screen structure on both surfaces, then built a self-contained animated HTML showing the five founder-requested user journeys:

1. App: open, see new DMs (real badge after mailbox drain), read, reply (Sending -> Sent -> Delivered off receipts).
2. App: new community posts, open Trail Crew post thread, react + reply.
3. App: Public tab reddit/X-style feed, scroll, open thread, "Verify I'm human" blind-credential check, comment anonymously.
4. Phone browser: same three journeys in meerkat-web's responsive layout (MobilePrimaryNav).
5. Mac browser: same three journeys in the desktop AppShell (community rail + nav column + two-pane views).

## Why

Founder asked for an animated HTML of the app's core user workflows grounded in the real product.

## Files

- `apps/meerkat/docs/reports/REPORT-meerkat-user-workflows-animated-2026-08-31.html` (new; JS step machine + CSS keyframes, Open Burrow palette from `theme/tokens.ts`, IntersectionObserver-paced looping scenarios, clickable step rails, light/dark).
- `docs/reports/README.md` (catalog row added, date bumped).

## Verification

- Copy sourced from code: tab titles (Feed/Communities/Public/Messages/Me), DM statuses ("Sending…", "Sent", "Delivered", "Read by 1", "Safety code checked"), Public tab strings ("Verify I'm human", honest not-connected copy), web nav labels (MobilePrimaryNav), route names.
- Headless browse check: page loads with zero console errors; screenshots of sections 1, 2, 3, 5 mid-animation all render correctly.
- Transport honesty preserved throughout: no faked connectivity, badges/receipts/counts annotated as real recorded events; verify-to-participate shown as the only public gate.
- No function logic changed; gate:function skipped on that basis. Parity untouched (docs only).

## Part 2 (same session): phone-browser entry animation + community-server research

- Founder follow-up 1: workflow 4 lacked the "open my link in a browser to reach my data" entry. Added two animated steps (saved-link new tab, real "Checking your purchase…" unlock gate from `App.tsx`), fixed the notch overlapping the browser URL bar, renumbered steps, re-verified headless. Commit `915d1176`.
- Founder follow-up 2: research + review of public server management for communities (Discord-like onboarding for users who do not want local-only). Ran 3 parallel agents (Discord mechanics, federated server-choice UX, full code map); lead re-verified the two load-bearing code claims (no client writer to the community node; `hosts` never populated).
- Deliverable: `apps/meerkat/docs/reports/REPORT-meerkat-community-server-onboarding-2026-08-31.md` + HTML twin (opened). Headline: the always-on community node + hosted tiers already exist server-side and are orphaned; recommendation is the Minecraft Realms pattern (creator-only one-card choice: Meerkat Keeper / self-host / device-only default), invite-carried host address, durable join queue + push wake + admin delegation, opt-in instant-join bearer links, workstreams W1-W8, honest state copy table.

## Remaining / notes

- Pre-existing LSP diagnostic surfaced (not from this session): `dev-unlock.ts` `import.meta.env` typing errors (Property 'env' does not exist on type 'ImportMeta'), likely a tsconfig types gap in meerkat-web. Untouched here.
- Sample people/communities/posts in the animation are illustrative; the footer says so.
