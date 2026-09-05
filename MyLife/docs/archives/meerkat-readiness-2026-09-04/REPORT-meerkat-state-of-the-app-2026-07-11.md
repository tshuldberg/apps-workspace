# Meerkat: State of the App - 2026-07-11

Canonical markdown twin of `REPORT-meerkat-state-of-the-app-2026-07-11.html` (the full
visual report with HTML recreations of every screen). Verified against the repository on
2026-07-11: main `6f8e6545`, in-flight branch `feature/meerkat-plan43` (12 commits ahead).

## Verdict

**NO-GO for public release**, unchanged since the 2026-07-09 Blackglass adversarial audit
(release readiness 63/100; implemented code paths 86/100; security controls 88/100). All
seven original critical defects and the 12-finding challenge pass are closed and evidenced
(4,397/4,397 Meerkat tests green at remediation commit `47f452d3`). The remaining gap is
dominated by infrastructure provisioning, physical-device proof, live provider credentials,
safety and legal operations, and two unstarted launch-hard product programs (Plan 41 storage
destinations, Plan 25 calls and rooms).

## What the HTML report contains

1. **Exact current state** by area (mobile, web, relay/server, sync, push/native transports,
   moderation/safety, monetization) with the full audit findings status table and test/gate
   evidence. Monetization is genuinely wired, not stubbed: RevenueCat SDK 10.2.2 on mobile,
   signed server grants on web, dependency-free Stripe REST/webhook client on the relay. No
   live transaction has been processed yet.
2. **46 HTML screen recreations** of the mobile app (17 core frames: onboarding, the five
   tabs Feed/Communities/Public/Messages/Me, community detail and settings with the owner
   review queue, channel chat, post thread, DM, files, downloads, add-friend; 29 extended
   frames: the public layer, My Library, settings/identity/sync/node/diagnostics, the $4.99
   unlock screen) in the Open Burrow light palette with exact copy quoted from source.
3. **15 web app browser frames**: three-column shell, channel view, feed, messages/DM,
   files/downloads, share inbox, library, public explore/reader/compose with verify-to-view
   and posting-unlock gates, community settings review queue, settings overlay with the
   AppUnlock and HostedServices sections (verbatim pricing copy), onboarding, locked state,
   and key dialogs, plus the hosted-boundary gating matrix.
4. **10 end-to-end user workflows** as step strips with exact button labels: onboarding,
   create community + invite, join via invite, message + attach file, report + owner review
   (uphold "Mark reviewed, keep hidden" vs "Un-hide for me"), publish publicly, download a
   file, link own device, $4.99 unlock purchase, DM a friend.
5. **Production readiness runbook (Phases 0-9)**: the ordered founder path from NO-GO to
   App Store/Play production and first revenue, every step tagged [CODE], [FOUNDER-OPS], or
   [EVIDENCE], with commands, console paths, and file citations. Highlights:
   - Phase 0 (code): finish Plan 43 packets WP-43E..J, close the Plan 42 O(n) push-gateway
     gap, Plan 40 residuals R1-R3, and the founder decision on Plans 41/25 (build vs formal
     scope cut with copy stripped); then re-run the audit clean and pick the release SHA.
   - Phases 1-4 (ops+evidence): production accounts, deploy the connectivity spine (relay,
     community node, directory, TURN), PostgreSQL + object storage + backups + restore
     drills, first signed release pipeline run with manifest/canary/rollback.
   - Phase 5 (safety/legal): licensed abuse-hash source (community node exits fatally
     without it), NCMEC CyberTipline onboarding + real filing client, DMCA registered
     agent, AV scanner, hosted legal pages, moderation staffing, tabletop drills.
   - Phase 6 (billing): create `meerkat_app_unlock` ($4.99 one-time, non-consumable) in
     App Store Connect + Play, RevenueCat config, Stripe `meerkat_hosted_monthly`
     ($4.99/mo), server-side receipt validation, sandbox purchase matrix. Pricing is
     founder-locked in `packages/billing-config/src/index.ts:144,158`.
   - Phase 7 (push): APNs key, FCM service account, VAPID keys into the deployed push
     gateway.
   - Phase 8 (submission): EAS production builds, TestFlight/internal tracks, export
     compliance (note: `app.json:22` ships `ITSAppUsesNonExemptEncryption: false`, likely
     wrong for an E2E-encrypted app; review with counsel), privacy + UGC declarations,
     honest store copy, reviewer notes.
   - Phase 9 (proof + GO): 10x load test, 48h soak, physical-device matrix, release
     evidence ledger, Blackglass rerun, named GO signature, revenue turn-on.
   - Rough total: 6-12 weeks, dominated by Phase 0 scope decision and Phase 5 vendor lead
     times.

## Sources

Screen recreations derive from reading every route/view source under
`apps/meerkat/app/(root)/` and `apps/meerkat-web/src/ui/`. State and runbook claims cite
`memory.md`, the Blackglass audit, plans 40-44 and the 42 status ledger, session logs,
`packages/billing-config`, `packages/meerkat-relay`, and git history. Produced by the Fable
orchestrator with four research agents (mobile inventory, web inventory, state synthesis,
runbook) and four builder agents, with orchestrator verification of load-bearing claims.
