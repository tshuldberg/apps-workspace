# Scoring Rubric -- Skill Opportunity Ranking

## Factors

### Impact (30%)

How much time, effort, or quality improvement does this skill deliver?

| Score | Criteria |
|-------|----------|
| 5 | Saves 30+ minutes per use or prevents critical errors |
| 4 | Saves 15-30 minutes or significantly improves output quality |
| 3 | Saves 5-15 minutes or noticeably improves consistency |
| 2 | Saves 1-5 minutes or provides minor convenience |
| 1 | Marginal improvement, mostly cosmetic |

### Frequency (25%)

How often would this skill be triggered in normal development workflow?

| Score | Criteria |
|-------|----------|
| 5 | Multiple times per session (daily driver) |
| 4 | Once per session on most sessions |
| 3 | Weekly -- used regularly but not every session |
| 2 | Monthly -- situational but recurring |
| 1 | Rare -- only during specific events (releases, migrations) |

### Complexity (20%)

Is the task complex enough to justify encoding as a skill? Skills for trivial
tasks waste context budget. Skills for impossibly complex tasks fail unreliably.

| Score | Criteria |
|-------|----------|
| 5 | Multi-step with branching, requires domain expertise, high error risk |
| 4 | Multi-step with clear sequence, some expertise needed |
| 3 | Moderate -- 3-5 steps, straightforward but tedious |
| 2 | Simple -- 1-2 steps but with useful standardization |
| 1 | Trivial -- not worth the context cost of a skill |

### Testability (15%)

Can we write concrete, verifiable eval assertions for this skill?

| Score | Criteria |
|-------|----------|
| 5 | Deterministic output, clear pass/fail criteria, scriptable validation |
| 4 | Mostly deterministic, 2-3 strong assertions possible |
| 3 | Semi-structured output, assertions possible but some subjectivity |
| 2 | Creative/flexible output, only structural assertions possible |
| 1 | Entirely subjective output, no reliable assertions |

### Gap (10%)

Is this area currently unserved by existing skills?

| Score | Criteria |
|-------|----------|
| 5 | No existing skill covers this area at all |
| 4 | Existing skills touch this area tangentially but don't cover it well |
| 3 | Partial coverage exists but with significant gaps |
| 2 | Good coverage exists but could be improved |
| 1 | Well-covered by existing skills -- adding more would be redundant |

## Scoring Formula

```
total = (impact * 0.30) + (frequency * 0.25) + (complexity * 0.20) + (testability * 0.15) + (gap * 0.10)
```

**Thresholds:**
- **4.0+**: High priority -- build immediately
- **3.0-3.9**: Medium priority -- build after high-priority skills
- **2.5-2.9**: Low priority -- consider for future iterations
- **Below 2.5**: Discard -- not worth the context cost

## Scoring Template

Use this format for each opportunity in the report:

```markdown
### [rank]. [proposed-skill-name] -- Score: X.X/5.0

| Factor | Score | Justification |
|--------|-------|---------------|
| Impact | X/5 | [brief evidence] |
| Frequency | X/5 | [brief evidence] |
| Complexity | X/5 | [brief evidence] |
| Testability | X/5 | [brief evidence] |
| Gap | X/5 | [brief evidence] |
| **Weighted Total** | **X.X/5.0** | |

**Dimension:** [primary analysis dimension]
**Evidence:** [file paths and patterns]
**Proposed triggers:** "[example user prompts that should activate this]"
**Eval sketch:** [1-2 sentence description of what evals would test]
```

## Tie-Breaking Rules

When two opportunities have the same score:
1. Prefer higher Impact score
2. Prefer higher Testability score (benchmarkable skills compound value)
3. Prefer the one serving more projects (cross-project > single-project)
4. Prefer the one in a lower-tier project (more room for improvement)
