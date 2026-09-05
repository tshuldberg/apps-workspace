# Prompt Templates

## 1) Feature Add (Backend + UI)
```text
Implement this feature in MyLife:
<feature request>

Requirements:
- Keep local-only behavior intact.
- Keep self-host and hosted API contracts aligned.
- Update DB schema/migrations if needed.
- Add/adjust tests and run typecheck.
- List all changed files and risks.
```

## 2) UI Change Only
```text
Update this screen:
<screen + desired UX>

Constraints:
- No API or schema changes.
- Keep current visual system and tokens.
- Show exact file diffs and run typecheck.
```

## 3) Bug Fix
```text
Debug and fix:
<bug description + reproduction>

Output:
- Root cause
- Minimal patch
- Regression test
- Verification commands and results
```

## 4) Self-Host Reliability Improvement
```text
Improve self-host reliability for:
<issue>

Include:
- Docker/infra changes
- health/troubleshooting updates
- migration/backup implications
- rollback plan
```

## 5) Refactor Without Behavior Change
```text
Refactor this area:
<path/module>

Constraints:
- No behavior change
- Preserve API/schema contracts
- Add tests for unchanged behavior where coverage is weak
- Show before/after architecture summary
```
