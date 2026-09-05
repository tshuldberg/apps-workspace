# Meerkat User-First Privacy Agent Prompts

Date: 2026-06-23

## Summary

Created a self-contained HTML prompt board for running Meerkat implementation
slices with fresh agent context. The artifact turns the user-first privacy spec
and the existing consumer front-door decomposition into repeatable prompts that
can be pasted one at a time into agents after clearing context.

## Files Changed

- `apps/meerkat/docs/plans/meerkat-user-first-privacy-agent-prompts-2026-06-23.html`
- `memory.md`
- `docs/sessions/2026-06-23-meerkat-user-first-privacy-agent-prompts.md`

## What The HTML Covers

- Global context prompt for every fresh agent.
- Locked product decisions: $4.99 paid app, users and privacy first, hosted
  public reach as a paid service, reply audience inheritance, and
  user-controlled feeds.
- Repo rules: TypeScript-first, read AGENTS/CLAUDE docs, preserve dirty user
  work, keep mobile/web behavior aligned, run function gates when function
  logic changes, and avoid em dashes.
- Ten slice prompts:
  - current-state map
  - information architecture
  - onboarding
  - audience rules
  - posts and replies
  - feed engine
  - friends and messages
  - communities and safety
  - hosted boundaries
  - profiles and pseudonyms
  - Apple-level polish
- Required handoff contract so each agent leaves enough context for the next
  context-cleared run.

## Verification

- Checked the new HTML for literal em dash characters with `rg -n "\x{2014}"`.
- No runtime code changed, so function gate was not required.

## Remaining Work

- Use Prompt 00 if the implementation has drifted before code work starts.
- Otherwise start with Prompt 01 to move Meerkat from node-first tabs to the
  user-first navigation model.
