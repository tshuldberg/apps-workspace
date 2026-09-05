# Performance Docs

This directory stores curated performance documentation.

## What belongs here

- Process docs and guidance, for example `function-quality-gate.md`
- Small, human-maintained reference files

## What does not belong here

- Generated inventory dumps
- Generated remediation plans
- Large machine-generated artifacts

## Generate reports

Run:

```bash
pnpm audit:functions
```

Generated reports are written to:

```text
artifacts/perf-audit/
```

## Guardrail

Run this before pushing changes:

```bash
pnpm check:generated-artifacts
```
