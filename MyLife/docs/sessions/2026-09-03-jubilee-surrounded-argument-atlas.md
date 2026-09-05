# Jubilee Surrounded: left/right argument atlas + claim verification

Date: 2026-09-03
Deliverable: `apps/meerkat/docs/reports/RESEARCH-jubilee-surrounded-argument-atlas-FULL-2026-09-02.html`
Working corpus (outside repo): `~/Desktop/jubilee-surrounded-analysis/`

## What

Built a transcript-grounded atlas of every political argument made across Jubilee's
*Surrounded* series, then began verifying the factual claims inside it.

## Why

User request: extract all generic left-vs-right arguments and counterarguments across the
last year of *Surrounded*, as the base layer for a follow-on project verifying which claims
hold up and where each side falls short.

## Pipeline

1. Enumerated all 1,306 Jubilee uploads; identified **52** *Surrounded* episodes, including
   four whose titles omit "Surrounded" (Officer Tatum, Amanda Seales, Cenk Uygur, Mehdi Hasan).
2. Scoped to 40: the 12-month window ending 2026-09-02, plus three boundary episodes retained
   for centrality and reach. ~730,000 words, 57 hours, 103M combined views.
3. Pulled full auto-caption tracks via `yt-dlp` (needed a Homebrew upgrade past the Feb 2026
   build to clear YouTube's JS challenge) and normalised to timestamped text.
4. Extracted argument structure with 16 parallel opus subagents against a fixed spec:
   side, topic slug from a 20-term taxonomy, reasoning, near-verbatim quotes with timestamps,
   the counterargument actually raised on camera, an outcome code, and the checkable claims.
   Result: **1,537 arguments, 5,482 quotes, 3,237 checkable claims.**
5. Verified every quote programmatically against its source transcript within a +/-100s window
   of its stated timestamp: **5,277 / 5,279 confirmed (100%)**.
6. Authored a curated synthesis layer for all 20 topics: recurring argument clusters per side
   with their standard counters, structural shortfalls per side, and 102 "cruxes" (the
   questions that would actually settle each dispute).
7. Dispatched 12 opus verification agents against the claims, then retargeted them onto the
   cruxes at the user's direction.

## Key findings so far

- Aggregate accuracy ran left 74% / right 65% true-or-mostly-true across ~2,100 checks, BUT
  foreign policy - the one topic where both sides argue from the same kind of documentary
  material - came in at 74% vs 72%. The gap is therefore substantially a **claim-type
  artifact**, not a clean truthfulness difference. This caveat is printed in the deliverable.
- Recurring corpus pattern: the correction to a side's dominant error is often present *in the
  corpus itself*, delivered by a participant on that side, and then ignored (a right-side
  speaker correctly noting CBP encounters double-count; the 2-3% OnlyFans correction).
- Several disputes reduce to dataset **coding rules** rather than disputed facts (political
  violence; DHS's "70% criminal" figure, built by adding pending charges to convictions).

## Decisions

- Organised topic-first rather than episode-first, since the downstream purpose is verification.
- Side coding follows the argument, not the party: Manson coded LEFT vs manosphere; Michaels
  RIGHT vs body positivity; Dr. Mike LEFT vs MAHA. Non-partisan content coded OTHER.
- Built as a separate file rather than overwriting a concurrent session's document at
  `RESEARCH-jubilee-surrounded-left-right-argument-atlas-2026-09-02.html`.

## Final results

- **Corpus:** 40 episodes, ~730,000 words, 57 hours, 103M combined views.
- **Extraction:** 1,537 arguments, 5,482 quotes, 3,237 checkable claims.
- **Quote fidelity:** 5,277 / 5,279 verified against source transcripts at their stated timestamps (100%).
- **Claim verification:** 2,852 of 3,237 fact-checked with primary sources.
- **Crux resolution:** 105 researched answers to the questions that actually settle each dispute.

### Verdict distribution

| Verdict | All | Left | Right |
|---|---|---|---|
| TRUE | 1190 | 620 | 542 |
| MOSTLY TRUE | 735 | 366 | 348 |
| MIXED | 336 | 156 | 169 |
| CONTESTED | 31 | 12 | 19 |
| MISLEADING | 34 | 11 | 22 |
| MOSTLY FALSE | 210 | 72 | 134 |
| FALSE | 113 | 37 | 72 |
| UNVERIFIABLE | 159 | 72 | 83 |
| NOT-EMPIRICAL | 44 | 17 | 27 |
| **True or mostly true** | | **72%** | **63%** |
| **Misleading or false** | | **9%** | **16%** |
| Sample | 2779 | 1363 | 1416 |

The ~10-point gap held steady from the first 436 checks through 2,852, so it is signal rather than
sampling noise. Three caveats belong with it, all printed in the deliverable: on foreign policy, where both sides
argue from the same documentary material, the gap nearly vanishes (74% vs 72%); where a gap survives it is
concentrated in a few repeated load-bearing errors rather than diffuse; and UNVERIFIABLE reflects available
evidence, not falsity.

### The finding that matters most

About half of the resolved cruxes have **no winner**: both sides hold a true fact and draw an inference it will not
support. A per-claim scorecard cannot surface this, which is why the atlas keeps argument structure and the
on-camera counterarguments alongside the verdicts.

### Representative results

- **Tariff incidence.** Three independent teams, complete pass-through to US importers. The right's theoretical
  objection (a large importer can push down foreign prices) is correct and self-defeating: steel is the case where
  it happened, and it is the case where the tariff most conspicuously failed to protect domestic producers.
- **Political violence.** CSIS's own totals ran 893 -> 980 -> 750 incidents while the window grew 4.5 years;
  four exclusion categories were added between the 2021 and 2025 codebooks. Lethality is rule-invariant
  (112 vs 13 deaths); incidence is entirely rule-dependent and flips both directions. The exclusions cut against
  the left in 2025, inverting the standard "the datasets are rigged" claim.
- **The tax baseline.** You cannot use the current-policy baseline to deny the bill's cost and the current-law
  baseline to claim its size.
- **Crop deaths.** Field deaths scale with tilled hectares, so the death-density term cancels; at 3% feed-to-food
  efficiency the right's "vegans kill animals too" argument favors the vegan.
- **Fryer vs veil-of-darkness.** They measure different stages of an encounter and do not conflict. The further
  down the encounter you look, the weaker the measured racial gradient.

### Deliverables

- `apps/meerkat/docs/reports/RESEARCH-jubilee-surrounded-argument-atlas-FULL-2026-09-02.html` (~9.9 MB, searchable)
- Same-basename `.md` twin
- `~/Desktop/jubilee-surrounded-analysis/consolidated.json` (machine-readable arguments)
- `~/Desktop/jubilee-surrounded-analysis/verify/results/` (per-claim verdicts and crux resolutions)
