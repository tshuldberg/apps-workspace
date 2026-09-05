# Skill Description Budget Reduction

Date: 2026-04-24

## Summary

Investigated the warning:

`Exceeded skills context budget of 2%. Loaded skill descriptions were truncated by an average of 123 characters per skill.`

The warning is emitted before task work begins when Codex loads skill metadata into session context. The active Codex skill inventory includes global skills from `/Users/trey/.codex/skills` plus plugin-provided skills from `/Users/trey/.codex/plugins/cache`.

## Findings

- Global Codex skills: `69` skill files, `19,275` description characters before cleanup.
- Plugin skills: `8` skill files, `1,961` description characters.
- Total loaded descriptions before cleanup: `77` skills, `21,236` characters, average `276` characters per skill.
- The warning's reported average truncation of `123` characters implies an effective target of about `153` description characters per skill.
- MyLife also had a project-local gstack checkout under `.claude/skills/gstack/` with `81` repo-local skill files and `31,955` description characters. That was a separate Claude Code risk because repo-local scanners could see long generated descriptions and duplicate `.agents` copies.
- `.claude/plugins.md` was referenced by the startup checklist but did not exist.
- `memory.md` had grown to `108` lines, above the repo's `80` line context budget.

## Changes

- Shortened the `description` frontmatter in all `69` global Codex skill files under `/Users/trey/.codex/skills`.
- Kept skill bodies, supporting scripts, references, and assets unchanged.
- Refreshed `.claude/skills-available.md` to reflect the current `69` global skill count.
- Shortened gstack `description` frontmatter in generated `SKILL.md` files and `SKILL.md.tmpl` templates.
- Removed the ignored generated `.claude/skills/gstack/.agents/` duplicate skill inventory from the working tree.
- Added `.claude/plugins.md` with the current Codex plugin inventory, Codex MCP configuration, Claude Code plugin flags, and re-verification steps.
- Archived noisy `memory.md` rows to `docs/archives/memory-sessions-2026-04-19-to-04-24.md`.

## Verification

- After cleanup, global skill descriptions total `6,405` characters, average `93` characters per skill.
- Global plus plugin descriptions now total `8,366` characters, average `109` characters per skill.
- This is below the inferred truncation threshold, so future Codex sessions should avoid the skill description budget warning unless more long descriptions are added.
- Visible repo-local gstack skill descriptions now total `3,476` characters across `45` skill files, average `77` characters per skill.
- Visible repo-local skills now total `4,518` description characters across `54` skill files, average `84` characters per skill.
- `memory.md` is now `35` lines.
