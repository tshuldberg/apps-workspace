# Jubilee Surrounded Argument Atlas

**Date:** 2026-09-02

**Scope:** Transcript inventory and argument synthesis only

**Primary artifact:** [Open the full interactive atlas](../../apps/meerkat/docs/reports/RESEARCH-jubilee-surrounded-left-right-argument-atlas-2026-09-02.html)

**Canonical source:** [Markdown report](../../apps/meerkat/docs/reports/RESEARCH-jubilee-surrounded-left-right-argument-atlas-2026-09-02.md)

## What was completed

Reviewed the full available English automatic-caption tracks for Jubilee Surrounded uploads in the inclusive one-year window from 2025-09-02 through 2026-09-02. The final corpus contains:

- 39 screened uploads
- 27 entries found in Jubilee's official Surrounded playlist
- 12 Surrounded follow-ups or reactions found on Jubilee's channel but omitted from the playlist
- 661,484 cleaned caption words
- 54 hours and 13 minutes of video
- 23 argument themes
- 132 paired argument and counterargument families

Six health, longevity, veganism, and body-positivity uploads were screened in full but not forced into left-right categories. One year-end compilation reused earlier clips and was not counted as independent support. The political, civic, identity, and cross-ideological synthesis therefore draws on 32 unique non-compilation discussion uploads.

## Method

1. Used the official [Jubilee channel](https://www.youtube.com/@jubilee) and [Surrounded playlist](https://www.youtube.com/playlist?list=PLBVNJo7nhINQ6qGkFlgtK-0GW0_NOS4k7) to establish the corpus boundary.
2. Unioned the playlist entries with channel uploads whose titles identified them as Surrounded follow-ups or reactions.
3. Downloaded each available English automatic-caption track and video metadata to a temporary working directory.
4. Converted captions into clean, timestamped text and reviewed every track beyond the creator-supplied chapter headings.
5. Consolidated repeated claims into generalizable proposition-and-reason families. Ads, host mechanics, applause, insults, biography without a general claim, and duplicate clips were not counted as new arguments.
6. Paired each argument with the opposing response expressed in the corpus and added a phase-two verification hook.
7. Used position-specific labels for foreign-policy, Israel-Palestine, public-health, voting, and conspiracy themes where a left-right label would falsely assign a cross-ideological position.
8. Added a 39-video source ledger with runtimes, transcript sizes, discovery paths, classifications, and timestamped creator chapters.
9. Added a 14-workstream fact-checking queue for the next research phase.

## Follow-up layout revision

The first HTML edition constrained the report to a 1,280px desktop shell. After user review, the browser edition was rebuilt to use nearly the full viewport up to 2,200px.

- The hero, corpus metrics, navigation, and report body now share the wider canvas.
- The desktop navigation rail was tightened so more width belongs to the research content.
- At 1,600px and wider, each argument card becomes a three-zone comparison with both positions beside the verification task.
- Synthesis cards expand from two to four columns on wide displays.
- Introductory prose retains a controlled line length for readability.
- Tablet and phone breakpoints remain stacked and unchanged in behavior.
- The companion session page now overrides Pandoc's 36em body limit, removes its duplicate generated title, eliminates the outer margin and card frame, and presents the atlas link as the primary action.

## Editorial decisions

- The report is an argument inventory, not a verdict on truth.
- “All arguments” means all distinct generalizable argument families, not a line-by-line transcript concordance.
- Automatic captions are fallible. Timestamped video remains the source of record.
- Full transcripts were not reproduced. The report uses paraphrase and short navigational descriptions.
- Participants are not treated as representative samples of every person on the left or right.
- The stronger factual research phase remains separate so this inventory does not smuggle in premature conclusions.

## Files changed

- `apps/meerkat/docs/reports/RESEARCH-jubilee-surrounded-left-right-argument-atlas-2026-09-02.md`
- `apps/meerkat/docs/reports/RESEARCH-jubilee-surrounded-left-right-argument-atlas-2026-09-02.html`
- `apps/meerkat/docs/README.md`
- `docs/README.md`
- `docs/reports/README.md`
- `docs/sessions/2026-09-02-jubilee-surrounded-argument-atlas.md`
- `docs/sessions/2026-09-02-jubilee-surrounded-argument-atlas.html`
- `memory.md`

## Verification

- Confirmed all 39 metadata records have complete caption files.
- Confirmed every report source ID exists in the corpus and every cited timestamp falls within the video's runtime.
- Confirmed the HTML contains 23 theme sections, 132 argument cards, and 39 episode rows.
- Audited left and right column orientation and corrected reversed argument pairs before final generation.
- Rendered the self-contained HTML in headless Chrome at 1440 by 1100 and 1920 by 1200, then inspected both layouts.
- Opened the final HTML artifact locally after generation.
- Checked new report content for missing template values, invalid numeric output, and prohibited long-dash characters.
- Ran `pnpm check:generated-artifacts` from the MyLife repository root.
- Skipped `pnpm gate:function:changed` because no function or product logic changed.

## Remaining work

The requested second phase has not started. It should atomize the claims, retrieve primary evidence, steelman both sides, grade source quality, issue claim-level verdicts with confidence and uncertainty, and identify where each argument or counterargument fails to answer the same proposition.
