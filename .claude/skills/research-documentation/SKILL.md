---
name: research-documentation
description: Research official documentation for AGENTS.md, CLAUDE.md, tools, APIs, or framework workflows, then produce cited and actionable guidance.
argument-hint: [topic-or-question]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(ls:*), Bash(wc:*), Bash(date:*), Bash(curl:*), Bash(git:*)
---

# Research Documentation

Research a documentation topic using primary sources and generate a concise, cited recommendation.

## Input

`$ARGUMENTS` — topic, question, or scope.

If empty, infer scope from the user request and state the assumption.

## Source Priorities

Use official documentation first:

1. **OpenAI / Codex**
   - `developers.openai.com`
   - `platform.openai.com`
   - Prefer MCP docs access when available.
2. **Claude / Anthropic**
   - `code.claude.com/docs`
   - `docs.anthropic.com`
3. **Framework/vendor docs**
   - Use the framework's official documentation site.

Do not rely on third-party summaries when official docs are available.

## Workflow

1. Clarify what must be answered.
2. Collect primary-source links and extract the exact rules/constraints.
3. Distinguish:
   - **Documented facts** (with links)
   - **Recommendations/inference** (clearly labeled)
4. If the findings imply instruction updates, list exactly which files should change.
5. Write a report to:
   - `/Users/trey/Desktop/Apps/docs/reports/REPORT-docs-<slug>-<YYYY-MM-DD>.md`
   - `slug` should be lowercase with hyphens.

## Report Template

```markdown
# Documentation Research: <Topic>

Date: YYYY-MM-DD
Scope: <question/scope>

## Sources (Official)
- <URL>
- <URL>

## Findings (Documented Facts)
1. ...
2. ...

## Recommendations
1. ...
2. ...

## Proposed Instruction Updates
- <file path>: <change summary>
```

## Completion Output

After writing the report, return:

- Report path
- Top 3 findings
- Top 3 recommended actions
