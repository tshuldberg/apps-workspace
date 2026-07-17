# Documentation Summaries Index

> Master index of all project and workspace documentation summaries.
> Generated: 2026-02-08

## Purpose

These summaries provide a birds-eye view of all documentation across the `/Apps` workspace. Each summary covers every markdown file in its scope, organized by category, with cross-references showing how project-level and workspace-level docs connect to each other.

## Summaries

| Summary | Covers | Doc Count | Key Topics |
|---------|--------|-----------|------------|
| [EasyStreet](easystreet-docs-summary.md) | `Parks/EasyStreet/docs/` + `Parks/easystreet-monorepo/docs/` | ~26 files | Android expansion, iOS MVP, app store launch, multi-city, agent teams |
| [Receipts (Receeps)](receipts-docs-summary.md) | `receipts/docs/` | ~35 files | Filter overhaul, audit program (8 playbooks), algorithm profiles, launch execution |
| [ShipHawk Ecosystem](shiphawk-ecosystem-docs-summary.md) | `SH/automation-hub/docs/` + `shiphawk-templates/docs/` | ~11 files | Slack automation, template development, repo reorganization, variable reference |
| [Workspace Docs](workspace-docs-summary.md) | `/Apps/docs/` (guides, reports, templates) | ~20 files | Plugin/MCP guides, research reports, API/commit standards, templates |

**Total documentation reviewed:** ~92 markdown files across 6 directories.

## How to Use

1. **Start with a project summary** to understand that project's documentation landscape
2. **Check the "Cross-References" section** at the bottom of each summary to find related workspace-level docs
3. **The workspace summary provides the reverse mapping** — from workspace docs to project docs
4. **Use cross-references to connect the dots** — e.g., the receipts research report in `/Apps/docs/reports/` provides the architectural baseline that receipts' 35+ plan docs build upon

## Cross-Reference Map

The summaries form a two-way reference network:

```
Project Docs                    Workspace Docs (/Apps/docs/)
─────────────                   ────────────────────────────
EasyStreet/docs/plans/ ←──────→ reports/easystreet-*-research
                        ←──────→ reports/72-hour-summary

receipts/docs/plans/   ←──────→ reports/receipts-research
receipts/docs/filter-  ←──────→ reports/api-standards-review
  overhaul/            ←──────→ reports/commit-pr-policy-review

shiphawk-templates/    ←──────→ reports/shiphawk-templates-research
  docs/                ←──────→ reports/72-hour-summary

SH/automation-hub/     ←──────→ reports/72-hour-summary
  docs/                         (automation-hub not yet researched)
```

## See Also

- [/Apps/CLAUDE.md](../../CLAUDE.md) — Workspace-level project instructions and standards
- [/Apps/docs/README.md](../README.md) — Documentation hub index (guides, reports, templates)
- [/Apps/timeline.md](../../timeline.md) — Workspace-level action log
