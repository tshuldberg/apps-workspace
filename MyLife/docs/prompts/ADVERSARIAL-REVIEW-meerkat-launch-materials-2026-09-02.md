# Adversarial review: Meerkat launch materials, commits 6b15926d and 3654f12a

You are reviewing two documentation commits made by a previous session. Your job is to
break them, not to admire them. Assume the previous session was careless, over-claimed,
and told the user it had verified things it had not. Your default posture is that at
least one substantive error is present. Find it, or prove convincingly that it is not
there. Do not accept any claim in the session log as evidence for itself.

Repository: `/Users/trey/Desktop/Apps/MyLife`
Branch: `fix/meerkat-orphan-watchdog`

## Exact scope

Review ONLY these two commits and only their doc changes:

- `6b15926d` docs(meerkat): sell the creation layer and the public layer in the launch materials
- `3654f12a` docs(meerkat): write the launch materials for a person, not an engineer

Baseline for diffing is `0c54ab2b` (the parent of `6b15926d`).

Files in scope (six, three pairs):

- `docs/reports/meerkat-investor-pitch-2026-09-01.md` and `.html`
- `docs/guides/meerkat-launch-marketing-guide-2026-09-01.md` and `.html`
- `docs/guides/meerkat-complete-user-guide-2026-09-01.md` and `.html`

Out of scope, do not review or touch: `a3152851`, `af37da66`, `7a40639d` (a different
session's audit remediation), and every file those touched, including
`docs/reports/REPORT-claude-code-performance-instruction-audit-2026-09-02.*`.

Useful commands:

```
git -C /Users/trey/Desktop/Apps/MyLife diff 0c54ab2b..3654f12a -- docs/guides docs/reports
git -C /Users/trey/Desktop/Apps/MyLife show 0c54ab2b:docs/guides/meerkat-complete-user-guide-2026-09-01.md
```

## What the previous session claimed

Two changes were made, in this order.

**Commit 1** added the "creation layer" (community customization) and the public layer to
all three documents as first-class selling points, on the founder's direction that the
differentiating value is the freedom to shape a community into anything (a webstore, a
Pinterest board, a Reddit, a Twitter), private or public, on the game-modding precedent.
It claimed to have verified shipped-versus-planned against source code first.

It claimed these are SHIPPED (Plan 56 C0/C1/C2 plus the Plaza and pixel board, both
mobile and web):

- owner-signed `cm_layout` composition, 16 block types, 9 block-backed channel kinds
- layout editors on both surfaces, copyable layout template codes
- 16 canvas node types across 6 canvas kinds (commons, channel_topper, profile, post,
  pixel_board, page), free and flow layout modes
- Pages directory with owner promote/demote, per-community profile design with
  copy-forward, asset packs, badges, personas, milestones, polls, guestbooks,
  receiver render dials
- theme editor with generate-from-a-color and shareable theme codes/QR
- 6 community starting templates: Family Space, Media Library, Club, Course Hub,
  Newsroom, Blank
- the public layer: signed publications, anonymous reading with warm-tail paging,
  owner-signed open join grants, blind-signed anonymous credential, owner report review

It claimed these are NOT SHIPPED (Plan 58, queued) and are marketed only as planned:
tier key lanes, claim codes, storefront listings and sealed-grant delivery, per-block
audiences, the upgraded editor with an audience picker, the open-web page renderer with
custom domains, the 10-archetype template gallery, the delegated agent.

It claimed a specific honesty detail: the `store` and `tiers` blocks CAN be placed in a
layout today and render `CAPABILITY_UNAVAILABLE_COPY`, so all three documents now
explicitly forbid demonstrating a placed block as a working shop.

**Commit 2** was a plain-language pass targeting an average 15-year-old reader, triggered
by the founder flagging this sentence: "Meerkat creates a local cryptographic identity.
It does not silently turn that identity into a social account, upload plaintext content,
or claim delivery without a real recorded event."

It claimed the rule was "register only, never truth value": every rewrite says exactly
what the original said, including every honesty hedge, and every literal on-screen string
quoted by the user guide was left byte-identical because matching the screen is the
guide's whole value. It claimed the user guide now averages 14.2 words per sentence.

## Attack it along these seven axes

### 1. Fabricated or drifted capability claims (highest priority)

Every capability claim in the three documents must be verifiable in code at the reviewed
tree. Go find it. Do not trust the counts.

- Count `KNOWN_BLOCK_TYPES` and `BLOCK_CHANNEL_KINDS` in
  `apps/meerkat/app/(root)/data/block-registry-core.ts`. Is it really 16 and 9? The docs
  say "nine channel kinds" in prose; `BLOCK_CHANNEL_KINDS` and the docs' enumerated list
  may not be the same length. Check the enumerated list in the investor pitch section 4
  and in the marketing guide's creation-layer section against the constant, item by item.
- Count `CANVAS_NODE_TYPES` in `apps/meerkat/app/(root)/data/canvas-node-registry-core.ts`
  and the canvas kinds in `canvas-core.ts`. Is it really 16 and 6? Are the six named
  surfaces in the docs the same six kinds in the code?
- Verify the 6 community templates in `apps/meerkat/app/(root)/data/community-templates.ts`
  match the six names the user guide tells a person they will see.
- Verify the web twins exist for everything claimed on "both surfaces"
  (`apps/meerkat-web/src/lib/`, `apps/meerkat-web/src/ui/`). A claim of parity that only
  holds on mobile is a defect.
- Verify `CAPABILITY_UNAVAILABLE_COPY` exists and that the exact string quoted in the
  documents ("The storefront is enabled here, but this build has no billing service
  configured.") is character-for-character correct.
- Check whether anything in the Plan 58 "not shipped" list is in fact partly shipped, or
  anything in the "shipped" list is in fact partial, dev-build-only, or web-missing.
  Pay particular attention to Plan 56 C3 (soundboard, profile songs, time machine,
  limited editions), which the session concluded was NOT shipped except for the Plaza and
  the pixel board. Confirm or refute that.

### 2. Every quoted on-screen string in the user guide

The user guide's value is that its quotes match the app. For EVERY string in backticks in
`docs/guides/meerkat-complete-user-guide-2026-09-01.md` and every `<code>` in the HTML
that purports to be an app label, grep the source and confirm it exists verbatim. Flag any
that do not, and any that exist only on one surface while the guide implies both.

The newly added builder workflows are the highest risk, because they were written last and
fastest. Check every label in these sections against source:

- `Open layout editor`, `Add a block`, `Preview`, `Publish layout`, `Surface`, `Template`,
  `Capabilities`, `Reset to classic layout`, `Import into draft`,
  `Copy layout template`, `Paste a meerkat-layout template or link`,
  `That doesn't look like a Meerkat layout.`, `Only the community owner can edit its layout.`
- `Open community pages`, `Pages`, `New page`, `Promote to a tab`, `Tab name`, `Promote`,
  `Demote`, `No pages yet. Build the first one.`, `Build`, `Done building`, `Templates`,
  `Move`, `Size`, `Turn`, `Stack`, `Front`, `Back`, `Remove`
- `Design my profile`, `Use one of my other designs`,
  `Not currently a member of this community.`
- `Community theme`, `Use my theme`, `Use community theme`, `Adopt this theme`,
  `High contrast`, `Create custom theme`, `Generate from a color`, `Import a theme`,
  `Paste a theme code`, `Scan QR`, `Share`
- `Your role cannot place on this layer here.`, `Only its author can change it.`,
  `As a curator you can remove it.`
- `Start from a template` and the six template names

Also verify the navigation paths are real: does `Community settings` actually contain a
section headed `Layout` with `Open layout editor`? Is `Open community pages` reachable
from where the guide says? Is the member profile reached the way the guide describes? An
invented navigation path is a worse defect than an invented label.

### 3. Truth-value drift in the plain-language pass (second highest priority)

This is where a careless rewrite does real damage. Diff every changed sentence against its
original in `0c54ab2b` and ask: does the new sentence claim MORE than the old one?

Specifically hunt for:

- A hedge that was dropped. "only when", "not until", "does not claim", "real", "verified",
  "honest", "opt-in", "off by default", "build-dependent" are all load-bearing.
- A conditional turned into an unconditional. Example shape to look for: "encrypted when X"
  becoming "encrypted".
- An absolute that the code does not support. The rewrites use "nobody can fake",
  "cannot be matched up", "never sees anything readable", "nowhere to put a web address",
  "physically unable to call that service", "there is no user table to breach". Each of
  those is a strong security claim. For each one, find the code or test that backs it, or
  flag it. In particular:
  - "the private side of the app is physically unable to call that service, and a test
    fails the build if anyone changes that" - does `app/__tests__/account-isolation.test.ts`
    actually enforce this, and is it in the default test run?
  - "a server in the middle sees how big a message is and when it went. Not who sent it,
    not what kind it is, not the contents" - check the pairwise frame envelope claim in
    `packages/sync/src/protocol/sync-session.ts`. Is it true for ALL frames, or only after
    negotiation?
  - "nothing readable is ever uploaded anywhere" - is this true given OS share intake,
    backup destinations, and the public layer? Or is it an over-claim the original's
    narrower "upload plaintext content" avoided?
  - "There is simply nowhere for a member's creation to put a web address" - check the
    NO-URL rule actually covers every config field and every canvas node schema, including
    `link_card` and `embed`, which sound like counterexamples.
- Any place where a "planned" thing now reads as shipped, or a service-dependent thing now
  reads as unconditional.

Report each as: original sentence, new sentence, the specific claim that changed, and the
code that settles it.

### 4. Structural and rendering integrity

- Do the three HTML files render? Open them. Check for visibly broken layout, orphaned
  markup, a slide or section that collapsed, text overflowing its card, or a grid with a
  stray empty cell.
- The investor deck renumbered slides `s4`-`s14` to `s5`-`s15` and inserted a new `s4`.
  Verify the ids are contiguous, the eyebrow numbers match the ids, the footer line numbers
  match, and the JS-generated rail dot navigation still targets every slide.
- The marketing guide renumbered sections `04`-`10` to `05`-`11` and inserted `04`. Same
  checks.
- The marketing guide's pillar stack was widened from 3 to 4 columns with an inline style,
  and a fourth audience card was added to a 3-column grid. Look at both in a browser at
  desktop and mobile widths. Does the fourth card orphan?
- The user guide's chapter 4 was extended with three new mockups and four workflow cards.
  The `.workflow` class is a 2-column grid; confirm the added blocks pair correctly and
  the `.fail` class used standalone for the capabilities note does not look like an error.
- Verify md and HTML twins do not contradict each other. Section numbering, chapter titles,
  the label legend, the platform table, and the troubleshooting table were edited in both.

### 5. Internal consistency across the three documents

The same fact must not be stated three different ways.

- Pricing. Founder-locked at `$4.99` one-time plus `$4.99`/month hosted with storage
  included. Check every mention in all six files. Any other number, or any implication of
  a different model, is a serious defect.
- The shipped/planned line for the storefront and tiers. Does every document draw it the
  same way?
- Block, node, channel-kind, surface, and template counts. Consistent everywhere?
- The public layer's service dependency. Stated everywhere it is claimed?
- Does the marketing guide's "Never claim" list contradict anything the investor pitch or
  user guide actually says? This is the highest-value consistency check: the marketing
  guide forbids claims, and the other two documents might make them.

### 6. Instruction-file compliance

- `AGENTS.md` (workspace and MyLife): no em dashes in documents. Grep all six files for
  `—` and `–`.
- The Instruction Writing standard requires every human-facing step to state Where, What
  you will see, What to click or type, What happens next, Done when, and If it fails, in
  that order, with real labels. Audit the five NEW user-guide workflows against all six
  points. Flag any that skip one or bury a label.
- MyLife `AGENTS.md` transport-honesty and the Meerkat `AGENTS.md` "Writing Style: do not
  fake transport or connectivity in UI copy". Does any new copy line breach it?
- Report artifacts rule: md canonical, same-basename HTML twin. Both present and in sync?

### 7. Claims made to the user in chat that were not in the files

The session told the founder several things it presented as verified. Check them:

- "the user guide now averages 14.2 words per sentence". Recompute independently. If the
  measure is not reproducible or was computed in a way that flatters the result (for
  example by stripping tables and code spans), say so.
- "SpaceHey reached roughly 1.9 million registered users". This appears in all three
  documents as a factual market claim. The session took it from an in-repo plan
  (`docs/plans/active/56-meerkat-canvas-freeform-creation-layer.md`) rather than from a
  primary source. Treat it as unverified until you check it. If you cannot verify it from
  a citable source, it should be flagged for the founder, because it is a claim in an
  INVESTOR document.
- The Skyrim / Grand Theft Auto / Super Mario Maker modding argument is now in the investor
  pitch as a commercial argument. Is it defensible as written, or is it a vibe dressed as
  evidence? Say plainly which.
- "2,567 user-visible strings across 127 files" and the Plan 58/59 status descriptions were
  repeated from prior reports. Spot-check rather than assume.

## Rules for you

- Verify against code, git history, and rendered output. The session log
  (`docs/sessions/2026-09-02-meerkat-creation-layer-marketing.md`) is a CLAIM, not evidence.
- Read the pre-change versions from `0c54ab2b` before judging any rewrite. You cannot
  detect truth-value drift without the original.
- Do not fix anything yet. Report first. The founder decides what gets changed.
- Rank findings by severity, most severe first, using this scale:
  - **P0** a false capability claim, a fabricated on-screen string or navigation path, an
    unsupported security absolute, a pricing error, or a "planned" thing reading as shipped
  - **P1** truth-value drift that weakens an honesty hedge, an md/HTML contradiction, or a
    broken render
  - **P2** internal inconsistency, instruction-file breach, unverified factual claim
  - **P3** style, readability, or polish
- For every finding give: file and line, the exact text, why it is wrong, the specific
  evidence that settles it (a source path and line, a command's output, or a screenshot),
  and the minimal correct replacement.
- If a claim is correct, say so in one line and move on. Do not pad the report.
- If you find nothing at P0 or P1, say that plainly and state exactly what you checked to
  reach it, so the founder can judge whether your coverage was real. A review that finds
  nothing and cannot say what it covered is worthless.

Deliver the report as `docs/reports/REPORT-meerkat-launch-materials-adversarial-review-2026-09-04.md`
with a same-basename self-contained HTML twin beside it, and open the HTML in the browser.
