# Self-Sufficient Codex System: Setup and Implementation Guide

This guide sets up a Codex system that is:
- autonomous for routine work
- strict about guardrails and risk
- proactive about learning recurring patterns
- explicit about when to escalate major scope/design decisions

The end state is a closed-loop "SkillOps" system:
1. Codex executes work.
2. Codex logs what it did, where friction happened, and which skills helped.
3. Codex detects repeated patterns and proposes skill create/update actions.
4. You approve only high-impact design/scope choices.
5. The skill system improves continuously.

## 1) Operating Model

Use three control layers together:

1. `AGENTS.md` (behavior and decision policy)
2. profiles and runtime config (`~/.codex/config.toml`)
3. command guardrails (`~/.codex/rules/*.rules`)

Add a fourth layer for continuous improvement:

4. SkillOps loop (`.codex/skillops/*` in each repo)

## 2) Directory Layout (Recommended)

Use this exact layout to keep it clean and predictable.

```text
~/.codex/
  AGENTS.md
  config.toml
  rules/
    default.rules

<repo>/
  AGENTS.md
  .codex/
    skillops/
      observations.ndjson
      candidates.md
      accepted.md
      rejected.md
      metrics.json
      design-questions.md
    templates/
      candidate-template.md
      escalation-template.md
  tools/
    skillops/
      analyze_patterns.sh
      summarize_candidates.sh
```

## 3) Global Runtime Configuration

Create or update `~/.codex/config.toml`.

```toml
model = "gpt-5-codex"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
web_search = "cached"

project_doc_fallback_filenames = ["AGENT.md", ".agents.md"]
project_doc_max_bytes = 65536
project_root_markers = [".git", ".hg", ".sl"]

[profiles.safe-review]
approval_policy = "on-failure"
sandbox_mode = "read-only"
web_search = "disabled"
model_reasoning_effort = "low"
model_verbosity = "low"

[profiles.delivery]
approval_policy = "on-request"
sandbox_mode = "workspace-write"
web_search = "cached"
model_reasoning_effort = "medium"
model_verbosity = "medium"

[profiles.explore]
approval_policy = "on-request"
sandbox_mode = "workspace-write"
web_search = "live"
model_reasoning_effort = "high"
model_verbosity = "high"

[profiles.maintenance-auto]
approval_policy = "never"
sandbox_mode = "workspace-write"
model_reasoning_effort = "high"
hide_agent_reasoning = true
```

Use profile intent:
- `safe-review`: code review and audits
- `delivery`: default execution profile
- `explore`: architecture or uncertain tasks
- `maintenance-auto`: unattended recurring maintenance tasks

## 4) Global AGENTS.md (Autonomy Contract)

Put this into `~/.codex/AGENTS.md` and customize names/paths.

```md
## Mission
Execute routine engineering work autonomously. Escalate only when decisions materially change product scope, architecture, risk, or irreversible state.

## Decision Policy
Act without asking when the change is:
- reversible
- low risk
- local to current scope
- consistent with repo conventions

Escalate to user when any condition is true:
- architecture-level tradeoff with long-term consequences
- scope expansion beyond user request
- dependency or vendor change with lock-in/cost implications
- security/privacy/compliance ambiguity
- destructive or irreversible operations
- conflicting product direction with no clear default

## Escalation Format
When escalation is required, provide:
1. decision to make
2. option A (recommended) and option B
3. impact, risks, and migration cost
4. temporary default if user is unavailable

## SkillOps Logging (Required)
After each significant task, append one JSON line to `<repo>/.codex/skillops/observations.ndjson` containing:
- timestamp
- task summary
- commands/workflow steps used
- repeated manual steps observed
- friction points
- skill used (if any)
- proposed skill candidate or update (if any)
- confidence (0-1)

## SkillOps Trigger Rules
Create or update a skill proposal when either condition is met:
- same workflow repeated >= 3 times in 14 days
- same friction/workaround repeated >= 2 times in 14 days

Prefer updating an existing skill over creating a new skill when overlap > 60%.

## Safety Rules
Never bypass sandbox or approval policy.
Never run destructive commands without explicit user consent.
Prefer narrow, auditable changes.
```

## 5) Repo AGENTS.md (Project-Specific Behavior)

Add this in each repo at `<repo>/AGENTS.md`.

```md
## Project Defaults
- prioritize shipping changes with tests
- keep diffs focused and reversible
- follow existing style and architecture

## Local Autonomy Limits
Escalate for:
- new service boundaries
- schema migrations with data loss risk
- auth/permissions model changes
- public API contract changes

Proceed autonomously for:
- bug fixes
- refactors without behavior change
- test creation and hardening
- documentation and tooling improvements

## SkillOps Local Rules
Write skill candidates to `.codex/skillops/candidates.md`.
When a candidate is accepted, either:
- create a new skill, or
- update the closest existing skill

Record final decision in `.codex/skillops/accepted.md` or `.codex/skillops/rejected.md`.
```

## 6) Guardrails With Rules

Create `~/.codex/rules/default.rules` with these policy goals:

1. allow harmless read-only inspection commands by default
2. prompt for medium-risk operations (package changes, external network ops)
3. forbid known dangerous operations unless user explicitly asks

Minimum policy set:
- `forbidden`: destructive resets, blind deletes, credential exfiltration patterns
- `prompt`: dependency install/update, outbound publish/deploy, permission changes
- `allow`: read-only search/list/status/log commands

Keep rules narrow and prefix-based where possible.

## 7) Implement the SkillOps Feedback Loop

### 7.1 Observation Schema

Use one NDJSON record per meaningful task in `<repo>/.codex/skillops/observations.ndjson`.

```json
{"timestamp":"2026-02-07T16:00:00Z","task":"Add retry to webhook sync","workflows":["inspect logs","patch service","add test","run test"],"repeated_steps":["manually locate retry policy file"],"frictions":["config path discoverability"],"skills_used":["none"],"proposed_action":{"type":"update-skill","target":"backend-debugging","reason":"missing retry-policy navigation"},"confidence":0.78}
```

### 7.2 Pattern Detection Rules

Run pattern analysis daily or weekly:

- Frequency score: how often same workflow appears
- Friction score: repeated blockers/time sinks
- Benefit score: estimated time saved if skill exists
- Confidence score: signal quality from repeated evidence

Promotion thresholds:
- create new skill when `frequency >= 3` and `benefit >= medium`
- update skill when `friction >= 2` and existing skill overlap is high
- defer when confidence is low or patterns are too broad

### 7.3 Candidate Backlog Format

Use `.codex/skillops/candidates.md` entries in this form:

```md
## Candidate: retry-policy-troubleshooting
- Type: update existing skill
- Target skill: backend-debugging
- Trigger evidence: 4 tasks in 12 days
- Repeated friction: locating retry config and expected defaults
- Proposed change:
  - add "retry policy quick path" section
  - add script to locate retry-related files
  - add troubleshooting decision tree
- Expected impact: save 10-15 min per incident task
- Confidence: 0.81
- Needs user decision: no
```

## 8) Decision Escalation Matrix

Use this matrix so Codex asks you only when it should.

1. Low impact + reversible + no policy risk: auto-decide
2. Medium impact + reversible + local scope: auto-decide and log rationale
3. High impact or cross-cutting architecture: escalate
4. Irreversible/destructive/security-sensitive: escalate always

Required escalation template in `.codex/templates/escalation-template.md`:

```md
## Decision Required
- Topic:
- Why this matters now:
- Option A (recommended):
- Option B:
- Tradeoffs:
- Default if no reply in 24h:
- Rollback plan:
```

## 9) Skill Lifecycle Policy

Use this lifecycle for each skill:

1. Candidate detected
2. Drafted (create/update proposal)
3. Validated on real task
4. Adopted (active)
5. Monitored
6. Retired or merged

Governance rules:
- prefer updating over skill proliferation
- retire skills unused for 60+ days unless mission critical
- merge overlapping skills when scope duplication > 50%
- keep SKILL.md concise and move heavy details to `references/`

## 10) Weekly and Monthly Routines

Weekly SkillOps review (30-45 min):
1. run pattern analyzer
2. rank top 3 candidates by impact
3. implement 1 create/update action
4. validate with one real task
5. log outcome in `.codex/skillops/metrics.json`

Monthly system tuning (60 min):
1. measure intervention rate (how often user had to step in)
2. measure repeat friction count
3. measure skill hit rate (how often skills are used successfully)
4. tighten or loosen escalation thresholds
5. prune stale skills and noisy triggers

## 11) Success Metrics

Track these 6 metrics:

1. autonomy rate: percent of tasks completed without escalation
2. appropriate escalation rate: percent of escalations that were truly high-impact
3. repeat-friction trend: should decline month over month
4. skill reuse rate: how often existing skills were correctly reused
5. skill ROI: median time saved per task after skill adoption
6. rollback rate: regressions caused by autonomous actions

Target ranges to start:
- autonomy rate: 70-85%
- appropriate escalation rate: > 90%
- repeat-friction trend: down by at least 20% quarterly
- rollback rate: < 5%

## 12) Implementation Sequence (Practical)

Execute in this order:

1. configure profiles in `~/.codex/config.toml`
2. install global autonomy contract in `~/.codex/AGENTS.md`
3. add repo `AGENTS.md` autonomy limits
4. set guardrails in `~/.codex/rules/default.rules`
5. create `.codex/skillops/` files and templates
6. start logging observations immediately
7. run first weekly pattern review after 7 days
8. ship first skill update based on evidence
9. tune thresholds monthly

## 13) Common Failure Modes and Fixes

1. Too many escalations
- Cause: thresholds too strict
- Fix: increase auto-decision scope for reversible local changes

2. Wrong autonomous decisions
- Cause: autonomy scope too broad
- Fix: tighten repo AGENTS escalation triggers and rules prompts

3. Too many low-value skills
- Cause: weak promotion criteria
- Fix: require stronger evidence and higher expected benefit

4. Skills becoming bloated
- Cause: SKILL.md carries too much detail
- Fix: move details into `references/` and keep SKILL.md procedural

5. No measurable improvement
- Cause: no metrics discipline
- Fix: enforce weekly metrics updates and monthly tuning reviews

## 14) First 14-Day Rollout Plan

1. Days 1-2: baseline config, AGENTS, rules, and templates
2. Days 3-7: run normal work with mandatory observations logging
3. Day 8: analyze first week and select top candidates
4. Days 9-12: implement one skill update and one new candidate draft
5. Day 13: validate on real tasks
6. Day 14: tune thresholds and finalize v1 operating policy

---

If you want this system to be stricter or more autonomous, tune only these three knobs first:
1. escalation thresholds in AGENTS
2. profile `approval_policy`
3. candidate promotion thresholds in SkillOps

Changing those three gives most of the behavior shift with minimal complexity.
