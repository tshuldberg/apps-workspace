# 2026-07-03: MyNews Product Review HTML (Interactive Screens)

## What was done

Built the design-review twin of the 2026-07-01 MyNews build plan: a full interactive HTML recreation of the product, opened in the browser. No code in apps/ or modules/ was written; this is the screens-before-code artifact for founder review, following the BestChef/Yearn/Meerkat recreation precedent.

Artifact: `docs/reports/REPORT-mynews-product-review-2026-07-03.html` (~69 KB, untracked per generated-artifact precedent).

## Contents

- Part 1: working iPhone simulator (vanilla JS state machine, 18 screen templates, 5-tab bar). Four complete flows with real state: read article (source-context card, editor credits, revision history), suggest-an-edit (typed correction with required citation, appears in Desk as open), journalist review queue (role toggle, diff review, Accept publishes rev 4 with editor credited and article text updating), support pledge (live 2% + Stripe fee split on the sheet, supporter statement updates). Plus 3-screen onboarding replay and reset.
- Part 2: 13 static annotated gallery frames covering the rest of the 34-screen inventory: Composer, Publish flow (sign/screen/reach with honesty-gated archive line), Verification center (incl. at-risk manual path), Earnings dashboard, Newsroom (embargo scope caps), Search, Topic page, Feed builder ($4.99), Blindspot ($4.99, on-device computation stated in UI), Journalist profile, Report flow (UGC four, NCII 48h), Moderation transparency (quarterly stats + fee disclosure), Auth (anonymous-first, on-device keys).
- Part 3: web surface mockups (mynews.app article permalink with corrected-span highlight + right rail; @rosamarin journalist public page with RSS/signed archive/support).
- Part 4: founder redline guide (payment-sheet copy voice, suggest-edit friction, correction-notice default, neutrality chrome check).

## Verification

- No em dashes (grep clean), single closing html tag.
- Inline simulator JS extracted and passed `node --check`; all `simGo()` targets verified against defined SCREENS keys.
- chrome-devtools MCP render check was blocked by a stale browser profile lock (pkill denied by permissions); noted, not logged as an error (transient tooling, artifact verified via syntax + structural checks instead).

## Remaining items

- Founder redlines on the artifact, then green-light Phase 0 (`docs/plans/queue/30-mynews-p0-scaffold.md`).
- Stale chrome-devtools-mcp browser instance holds the profile lock; kill it manually or restart the MCP server before the next /browse-style session.
