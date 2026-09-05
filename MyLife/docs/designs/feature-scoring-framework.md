# Feature Prioritization Scoring Framework

## Purpose
Systematic methodology to rank all 217 remaining features across 29 modules. Optimizes for: maximum draw of competitor paid users while deferring implementation complexity. Every feature gets a score that an AI agent or human developer can use to understand priority and context.

## Scoring Formula

```
PRIORITY_SCORE = (Market_Impact x 3) + (Switching_Motivation x 3) + (Complexity_Inverse x 2) + (Cross_Module_Value x 1) + (Paid_User_Likelihood x 1)
```

Maximum score: 50 (each factor 0-5, weighted)

### Factor Definitions

#### 1. Market Impact (0-5, weight 3x)
How many potential users does this feature attract?

| Score | Definition |
|-------|-----------|
| 5 | Feature serves a market >100M users (e.g., cycle tracking, notes) |
| 4 | Feature serves a market 50-100M users (e.g., workouts, nutrition) |
| 3 | Feature serves a market 10-50M users (e.g., books, habits, mood) |
| 2 | Feature serves a market 1-10M users (e.g., meds, pets, car) |
| 1 | Feature serves a niche market <1M users (e.g., surf, stars) |
| 0 | Feature is internal/infrastructure only |

#### 2. Switching Motivation (0-5, weight 3x)
How strongly does this feature motivate a user to switch FROM a competitor TO our app?

| Score | Definition |
|-------|-----------|
| 5 | Core functionality -- users can't use the module without it (e.g., HealthKit integration for Health) |
| 4 | Top-3 reason users pay for the competitor (e.g., rest timer in workout apps) |
| 3 | Frequently requested feature in competitor app reviews (e.g., offline maps for trails) |
| 2 | Nice-to-have that improves the experience (e.g., progress photos in workouts) |
| 1 | Advanced/power-user feature (e.g., CGM integration in meds) |
| 0 | Feature that only matters after the user has committed to the platform |

#### 3. Complexity Inverse (0-5, weight 2x)
How simple is this to implement? (Inverted: simpler = higher score)

| Score | Definition | CC+gstack Time |
|-------|-----------|----------------|
| 5 | Trivial -- UI change, config, or small logic addition | <15 min |
| 4 | Small -- single module change, <200 lines | 15-30 min |
| 3 | Medium -- multi-file change, new component or service | 30-60 min |
| 2 | Large -- new package or major feature, 500+ lines | 1-2 hours |
| 1 | Complex -- cross-module, new infrastructure, external API | 2-4 hours |
| 0 | Massive -- new platform capability, major architectural change | 4+ hours |

#### 4. Cross-Module Value (0-5, weight 1x)
Does this feature create value BECAUSE it exists in a unified app?

| Score | Definition |
|-------|-----------|
| 5 | Impossible without cross-module data (e.g., mood-medication correlation) |
| 4 | Significantly enhanced by cross-module context (e.g., nutrition + fasting integration) |
| 3 | Mildly enhanced by other modules (e.g., budget category from recipes) |
| 1-2 | Standalone value only |
| 0 | No cross-module relevance |

#### 5. Paid User Likelihood (0-5, weight 1x)
Does this feature specifically attract users who currently PAY for competitor apps?

| Score | Definition |
|-------|-----------|
| 5 | Feature is the #1 reason users pay for the competitor (e.g., YNAB envelope budgeting) |
| 4 | Feature is behind the competitor's paywall (e.g., MyFitnessPal food diary) |
| 3 | Feature differentiates premium from free tier in competitor |
| 2 | Feature exists in free competitor but our version is better |
| 1 | Feature targets free users |
| 0 | Feature targets users who don't currently use any app in this space |

## Priority Tiers (from score)

| Score Range | Tier | Action |
|-------------|------|--------|
| 40-50 | **S-Tier** | Build in Sprint 1 (pre-launch). These features are why users switch. |
| 30-39 | **A-Tier** | Build in Sprint 2 (launch month). Core experience improvements. |
| 20-29 | **B-Tier** | Build in Sprint 3-4 (post-launch). Enhanced experience. |
| 10-19 | **C-Tier** | Build in Sprint 5-8 (quarter 2+). Nice-to-have. |
| 0-9 | **D-Tier** | Backlog. Build when resources allow or users request. |

## Application Process

For each of the 217 features in COMPETITIVE-MATRIX.md:
1. Score each of the 5 factors (0-5)
2. Apply weights and sum
3. Assign to tier
4. Within each tier, order by score (highest first)
5. If two features have the same score, prefer the one in a higher-completeness module (easier to integrate)

## Example Scoring

### Feature: Rest Timer (Workouts module)
- Market Impact: 4 (214M workout app users)
- Switching Motivation: 5 (top feature complaint -- P0 in competitive matrix)
- Complexity Inverse: 5 (simple timer UI, <15 min CC)
- Cross-Module Value: 1 (standalone)
- Paid User Likelihood: 4 (Hevy/Strong paid users want this)
- **SCORE: (4x3) + (5x3) + (5x2) + (1x1) + (4x1) = 12 + 15 + 10 + 1 + 4 = 42 (S-Tier)**

### Feature: CGM Integration (Meds module)
- Market Impact: 2 (8M meds app users)
- Switching Motivation: 1 (advanced feature, niche)
- Complexity Inverse: 1 (hardware integration, external API, complex)
- Cross-Module Value: 3 (connects health + meds + nutrition)
- Paid User Likelihood: 2 (CareClinic paid users)
- **SCORE: (2x3) + (1x3) + (1x2) + (3x1) + (2x1) = 6 + 3 + 2 + 3 + 2 = 16 (C-Tier)**

### Feature: Calendar Sync iCal (RSVP module)
- Market Impact: 2 (21M events app users)
- Switching Motivation: 5 (P0 in competitive matrix, core missing feature)
- Complexity Inverse: 4 (iCal export is a well-known format, straightforward)
- Cross-Module Value: 2 (could integrate with other modules)
- Paid User Likelihood: 3 (RSVPify users expect this)
- **SCORE: (2x3) + (5x3) + (4x2) + (2x1) + (3x1) = 6 + 15 + 8 + 2 + 3 = 34 (A-Tier)**

## Integration with Agent Specs

Every agent spec template must include:
- The feature's priority score and tier
- The scoring breakdown (so the agent understands WHY this feature matters)
- Which competitor's paid users this feature targets
- The acceptance criteria (minimum 3-5, no cap)
