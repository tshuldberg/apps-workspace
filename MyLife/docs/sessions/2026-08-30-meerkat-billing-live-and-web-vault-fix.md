# 2026-08-30: Meerkat billing unblocked end to end + web secret-vault durability fix

## Headline

The Apple payment blocker is CLEARED and the first no-bypass build is out. Two real defects
were found by running the app (not by tests) and both are fixed.

## Billing (founder-ops, now done on the Apple side)

- **Paid Apps Agreement: ACTIVE.** Founder completed the updated Developer Program License
  Agreement, added a bank account (Active), and submitted U.S. Form W-9 (Active). Until this
  flipped, StoreKit vended no products and even a free sandbox purchase was impossible.
- Digital Services Act trader info submitted (27 EU countries, In Review). FLAGGED TWICE to the
  founder: DSA trader status publicly displays address/phone/email on the App Store product
  page, and the address on file is a home address. Reversible while In Review; worth counsel.
- IAP product `meerkat_app_unlock` (Apple ID 6806448603, Non-Consumable, $4.99, 175 territories,
  EN localization) was created earlier in the session via browser control.
- RevenueCat project created by the founder, App Store app on bundle `com.mylife.meerkat`,
  In-App Purchase key `FZB8Q53WYL` uploaded. Public SDK key handed over and wired.

## Code changes

1. **RevenueCat key wired, both dev-unlock overrides REMOVED** (`58c6ffce`).
   `EXPO_PUBLIC_MEERKAT_RC_KEY_IOS` set on the testflight profile; deleted mobile
   `data/dev-unlock.ts`, its `_layout.tsx` call and guard test; removed the uncommitted web
   override. **Kept the `check-build-env.mjs` production block permanently** so no entitlement
   bypass can ever reach a store build. Build 17 is the first real-purchase build.
2. **Template create no longer hangs.** `CommunityTemplatePicker.onCreate` had no try/catch, so a
   throw left the button on "Creating..." forever showing nothing. Now catches, releases, and
   shows the real error.
3. **Secret-vault multi-tab clobber fixed** (the serious one). See below.

## The vault bug (found live, worth remembering)

Symptom: the web app had an identity row whose signing private key was gone, so it could sign
nothing and community creation threw. Recovery required clearing site data.

Mechanism: the browser secret vault is a SINGLE encrypted IndexedDB record containing every
secret. Each tab loads it into its own in-memory Map at boot and `persistNow` wrote that whole
map back wholesale, with no cross-tab coordination. Two tabs open at once means the last writer
destroys the other's keys, while the SQLite identity row (a separate store) survives. That is
how you get an identity that cannot sign.

Fix: persist is now a read-modify-write merge under a `navigator.locks` Web Lock (origin-scoped,
so it serializes across tabs). Under the lock we re-read the stored vault, apply only this tab's
explicit writes/deletes on top, and adopt the merged view so the tab also learns keys another tab
added. Two regression tests (concurrent-tab preservation, delete-through-merge), mutation-checked
by removing the re-read (the concurrency test fails without it).

Note the class: this is the web cousin of MK-001. Identity durability needs the same care in a
browser as in a keychain, and "one blob holding everything, written wholesale" is the trap.

## Verification

- meerkat app: 1592 tests green. meerkat-web: 1121 tests green, typecheck clean.
- Function gate green on both packages during commit.

## Still open (NOT done, founder-ops)

- **Web payment rail is untouched.** Web unlocks through Stripe via the hosted billing service,
  not RevenueCat. Needs: two Stripe prices, deploy `meerkat-hosted-service.mjs` (refuses to boot
  without 7 env vars incl. `REVENUECAT_REST_API_KEY`), then point `VITE_MEERKAT_HOSTED_API_URL`
  at it. Until then web correctly says "Hosted checkout is not configured in this build."
  Guide: `docs/guides/meerkat-billing-unblock-and-next-session-2026-08-29.md` (A5-A7).
- Cross-surface link code (buy on one surface, redeem on the other) is unproven live.
- Plan 56 C3/C4/C5 remain (multi-week feature chunks, not launch blockers).
- Counsel, NCMEC/DMCA registration, public-tier services: unchanged, still open.
