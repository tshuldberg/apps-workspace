# MyLife Platform Consolidation Review

**Date:** 2026-03-07  
**Primary target:** `/Users/trey/Desktop/Apps/MyLife`  
**Comparison repos:** `/Users/trey/Desktop/Apps/iOS-Hub`, `/Users/trey/Desktop/Apps/rork-my-recipes-module`  
**Requirements baseline:** `/Users/trey/Desktop/Apps/MyLife/docs/specs`

## Executive Summary

The correct base for the final product is **MyLife**, not `iOS-Hub` and not `rork-my-recipes-module`.

`MyLife` is the only repository that already encodes the actual business problem: one suite product, many contained apps, shared account/subscription concerns, module lifecycle, parity rules, and cross-platform delivery. The other two repos are useful, but they are not alternative platform foundations:

- `iOS-Hub` is a strong **visual shell prototype**.
- `rork-my-recipes-module` is a useful **native module experiment**.
- `MyLife` is the only repo that is already a **platform**.

The best path is **not** a full rebuild. The best path is to keep `MyLife` as the canonical suite product, tighten its architecture around **standalone-first module ownership**, absorb the best shell ideas from `iOS-Hub`, and selectively harvest specific interaction patterns or algorithms from `rork-my-recipes-module`.

The real problem is not "which repo should win." The real problem is **how to stop adapter drift** between standalone apps and hub implementations, especially on mobile.

## Review Method

This review was based on direct inspection of:

- `MyLife/AGENTS.md`
- `MyLife/CLAUDE.md`
- `MyLife/docs/specs/SPEC-mylife-simple.md`
- `MyLife/docs/specs/SPEC-myrecipes.md`
- `MyLife/docs/specs/HANDOFF-master.md`
- `MyLife/docs/reports/REPORT-competitive-feature-analysis-2026-03-05.md`
- `MyLife/apps/web/test/parity/standalone-passthrough-matrix.test.ts`
- `MyLife/apps/web/app/recipes/**`
- `MyLife/apps/mobile/app/(recipes)/**`
- `MyLife/MyRecipes/**`
- `iOS-Hub/expo/constants/hub.ts`
- `iOS-Hub/expo/app/index.tsx`
- `iOS-Hub/expo/app/apps/[appId].tsx`
- `rork-my-recipes-module/ios/MyRecipes/**`

I also used repository history, file counts, dependency manifests, and testing/CI surface to assess production readiness.

## Product Baseline From `MyLife/docs/specs`

The specs folder describes a product much larger than the currently production-ready implementation surface.

### What the specs imply

- The final suite target is at least **22 named modules** in the current baseline spec.
- `HANDOFF-master.md` documents **22 detailed module specs** totaling **86,497 lines**.
- Of those 22 specs:
  - **8** are fully complete
  - **1** is nearly complete
  - **5** are mostly complete
  - **8** are still partial

### Strategic implication

The vision is real and well-specified, but the codebase is still in a **maturity gradient**, not a finished unified product. That matters because production strategy should optimize for:

- a clean shell
- high-confidence shared architecture
- launch-tier module quality
- controlled admission of lower-maturity modules

It should not optimize for "get every spec into the UI immediately."

## Repo-by-Repo Assessment

## 1. MyLife

### Observed facts

| Dimension | Finding |
|---|---|
| Purpose | Unified hub app plus contained standalone apps and hub modules |
| Stack | TypeScript, Expo, Next.js 15, SQLite, Turborepo, pnpm, Zod, Vitest |
| Git history | 64 commits from 2026-02-22 to 2026-03-05 |
| CI | Present, with parity, lint, typecheck, test, coverage, and web e2e jobs |
| Documentation | Very strong. Project instructions, timeline, specs, plans, audits, and reports exist |
| Scale | 13,313 non-build files after pruning heavy vendor folders; 3,544 source-like files; 437 test-like files; 428 doc-like files |
| Current product status | Competitive analysis report says 13 modules are implemented and 13 are scaffolded stubs/navigation-only |

### Architectural strengths

- `MyLife` already solves the hardest product question: how many apps can coexist inside one suite without collapsing into a single unstructured codebase.
- It has explicit rules for **standalone canonical ownership** and **hub parity**.
- It has a real quality model. The parity gates are not hand-wavy aspirations. They are encoded in scripts, tests, and CI.
- It already supports the right long-term separation of concerns:
  - standalone apps as product sources of truth
  - hub shell as suite composition layer
  - shared packages for registry, UI, database, auth, subscription, and migration
- It already contains the strongest reusable product asset in this review: the standalone `MyRecipes` app, plus hub passthrough on web.

### Strategic strengths

- It matches the business goal exactly: one branded suite with contained individual products.
- It preserves optionality. Standalone apps can survive independently while still feeding the hub.
- It is the only repo that can reasonably support:
  - staged launch
  - module enable/disable behavior
  - suite subscriptions
  - discoverability
  - future macOS support
  - long-term cross-module integration

### Technical strengths

- The web recipes surface already uses the right pattern: **thin passthrough wrappers** to standalone `MyRecipes` web routes, enforced by parity tests.
- The repo has real operational discipline:
  - CI
  - testing
  - docs
  - explicit phases
  - agent/team ownership zones
- This is the only repo in the set with a credible path to large-scale maintenance.

### Weaknesses and risks

- The current repo is broad and operationally heavy. It contains hub code, contained standalone repos, module packages, specs, plans, and many in-progress areas.
- The architecture is strongest on web and weaker on mobile. Recipes shows this clearly:
  - `apps/web/app/recipes/**` is strict passthrough to standalone `MyRecipes`
  - `apps/mobile/app/(recipes)/**` is still its own adapter implementation with different navigation and product shape
- The competitive analysis report is explicit that many modules are still stubs. That means the suite vision is ahead of the suite delivery.
- A single suite can become visually messy if shell rules are weak. MyLife has good architecture, but its final visual language is not yet as crisp or iconic as the `iOS-Hub` shell prototype.
- Shared SQLite is powerful, but it increases migration discipline requirements. If table governance is sloppy, the suite becomes brittle fast.

### Honest verdict

`MyLife` is the **correct product chassis**. It does not need to be replaced. It needs to be **tightened**.

## 2. iOS-Hub

### Observed facts

| Dimension | Finding |
|---|---|
| Purpose | Launcher-shell prototype for the MyLife concept |
| Stack | Expo Router, React Native, Rork-generated workflow |
| Git history | 3 commits from 2026-03-06 to 2026-03-07 |
| CI | None present |
| Tests | None present |
| Scale | 28 non-build files; 19 source-like files; 0 test-like files |
| Core implementation | One polished launcher screen, one generic dynamic module detail screen, static module metadata |

### Strengths

- It has the cleanest immediate visual concept in the comparison set.
- The home screen metaphor is legible at a glance. It communicates "suite of contained personal apps" immediately.
- The metadata model is good for shell ideation:
  - icon
  - color
  - tagline
  - description
  - tabs
  - premium/free tier
- It is very fast to iterate because the scope is intentionally narrow.

### Weaknesses

- It is **not a real product platform**.
- There is no real module execution model. The launcher opens a generic detail page driven by static `MODULE_FEATURES`.
- There is no persistence layer, no module registry, no parity system, no auth/subscription architecture, no production-grade testing, and no CI.
- Repo hygiene is weak. The actual Rork app lives under `/expo`, while an extra root `/app` template still exists unused. That is fine for an experiment and poor for a canonical base.
- It is structurally tied to a Rork workflow instead of a deliberate long-term suite architecture.

### Honest verdict

`iOS-Hub` is a **design and navigation prototype**, not a foundation. Its value is real, but its value is **directional**, not architectural.

Use it as a shell reference, not as the repo to build on.

## 3. rork-my-recipes-module

### Observed facts

| Dimension | Finding |
|---|---|
| Purpose | Native iOS recipe app/module prototype |
| Stack | SwiftUI, SwiftData, Xcode project |
| Git history | 2 commits on 2026-03-07 |
| CI | None present |
| Tests | 3 default test files, all effectively placeholders |
| Scale | 55 non-build files; 49 source-like files; 45 Swift files |
| Functional breadth | Real native screens and services for recipes, meal planning, garden, events, shopping, parsing, import, and settings |

### Strengths

- Unlike `iOS-Hub`, this repo is not only visual. It contains a meaningful vertical slice.
- It demonstrates real native interaction patterns for:
  - recipe list/detail
  - meal planner
  - shopping list
  - garden views
  - events
  - import/parsing services
- Several service objects are genuinely useful references:
  - `IngredientParser`
  - `ShoppingListService`
  - `AllergenDetectionService`
  - `WebImportService`
- For future Apple-native work, this repo is a credible sketch of how the domain feels in SwiftUI.

### Weaknesses

- It is single-platform and isolated.
- It diverges from the target MyLife architecture in a major way:
  - SwiftData instead of the current TypeScript/shared SQLite contract
  - no shared web story
  - no suite-level module lifecycle
  - no parity relationship with MyLife
- The automated testing surface is not production-grade. The unit test is literally an example placeholder, and the UI tests are standard generated scaffolds.
- The repo is extremely young. Any claim of full production readiness would be fiction.
- It duplicates domain work that already exists in the standalone `MyRecipes` app inside `MyLife`.

### Honest verdict

`rork-my-recipes-module` is a **useful native exploration repo**, not a canonical product base. It should be mined for ideas, not merged as-is.

## 4. Standalone `MyRecipes` Inside MyLife

This repo was not part of the requested comparison headline, but it is too important to ignore because it changes the decision materially.

### Observed facts

| Dimension | Finding |
|---|---|
| Purpose | Canonical standalone `MyRecipes` product inside the MyLife ecosystem |
| Stack | TypeScript, Expo, Next.js 15, shared packages, SQLite |
| Git history | 11 commits from 2026-02-22 to 2026-03-02 |
| Tests | 19 test-like files in shared logic |
| Scale | 262 non-build files; 244 source-like files |
| Current role | Already powers MyLife web recipe passthrough |

### Why this matters

This is already the most strategically aligned recipes asset:

- same language family as MyLife
- same shared-package philosophy
- same cross-platform direction
- already connected to MyLife web parity
- more serious automated logic coverage than the Rork Swift prototype

### Key architectural finding

For recipes, the real decision is not:

- "Should we pick MyLife recipes or rork recipes?"

The real decision is:

- "Should MyLife lean harder into the existing standalone `MyRecipes` canonical model, especially on mobile?"

The answer is **yes**.

## Comparative Matrix

| Dimension | MyLife | iOS-Hub | rork-my-recipes-module |
|---|---|---|---|
| Strategic fit for one suite product | Strong | Weak | Weak |
| Cross-platform coverage | Strong | Moderate prototype | Weak |
| Architecture for many modules | Strong | Weak | Weak |
| Visual shell clarity | Moderate | Strong | Moderate |
| Real business logic | Strong | Weak | Moderate |
| Testing and CI maturity | Strong | Weak | Weak |
| Data model fit with final target | Strong | Weak | Moderate to weak |
| Reuse value | Strong | Moderate as design source | Moderate as native reference |
| Production readiness | Moderate for selected modules | Low | Low to moderate for exploration only |
| Should become canonical base | Yes | No | No |

## The Most Important Structural Problem

The biggest issue is **not** that MyLife lacks another repo to merge.

The biggest issue is that MyLife currently mixes **two integration styles**:

- **direct passthrough** on web for some modules, which is good
- **hub-side adapter reimplementation** on mobile for some modules, which is risky

Recipes is the clearest example:

- Web recipes is already enforcing standalone passthrough.
- Mobile recipes is still a separate hub-side implementation with a different tab structure and different product framing.

That pattern does not scale cleanly across 20+ modules. If it continues, production quality will degrade through:

- duplicated logic
- duplicated QA burden
- inconsistent UX
- divergence between standalone and hub behavior

## Decision Options

## Option A - Keep MyLife as the platform, harden standalone-first federation

**What it means**

- Keep `MyLife` as the canonical suite repo.
- Keep standalone apps as canonical module products.
- Expand passthrough/shared-package reuse, especially on mobile.
- Use `iOS-Hub` only as a shell design source.
- Use `rork-my-recipes-module` only as an idea/reference source for native UX.

**Pros**

- Preserves the strongest existing architecture.
- Avoids deleting weeks of real platform work.
- Aligns with current parity doctrine instead of fighting it.
- Makes future module growth manageable.
- Lets you ship one app while keeping each module intellectually separate.

**Cons**

- Requires architectural discipline now.
- Forces hard decisions about what is launch-tier versus stub-tier.
- Some mobile module surfaces will need rework to reduce adapter drift.

**Risk**

Medium. This is the lowest-risk path that still moves the product forward.

**Verdict**

Recommended.

## Option B - Rebuild MyLife around the iOS-Hub shell

**What it means**

- Treat `iOS-Hub` as the new base repo.
- Rebuild module architecture, database, parity rules, subscriptions, and cross-platform composition into that shell.

**Pros**

- Fastest route to a cleaner-looking launcher.
- Lower cognitive load in the first week.

**Cons**

- Throws away the repo that already solves the actual platform problem.
- Reintroduces all the hard problems MyLife already started solving.
- Converts a visual prototype into a systems repo by force.
- Almost guarantees a long rewrite with weak backend/QA discipline.

**Risk**

High.

**Verdict**

Not recommended.

## Option C - Adopt `rork-my-recipes-module` as the new recipes base

**What it means**

- Treat the SwiftUI prototype as the canonical recipes product.
- Back-port or re-port it into MyLife.

**Pros**

- Strong native feel for Apple platforms.
- Useful if the suite becomes Apple-native-first later.

**Cons**

- Breaks current cross-platform alignment.
- Splits recipes away from the shared TypeScript/package ecosystem.
- Creates a second canonical recipes implementation.
- Weak test and CI posture.

**Risk**

High if used as a replacement. Low if used only as reference.

**Verdict**

Do not use as canonical source. Use only as a reference lab.

## Option D - Full greenfield rebuild of MyLife

**What it means**

- Start over with a new repo and a cleaner architecture.

**Pros**

- Emotional reset.
- Chance to simplify repo topology.

**Cons**

- Deletes real progress while preserving the hardest strategic uncertainty.
- Most of the current pain points are governance problems, not proof that the architecture is unsalvageable.
- High delay risk.
- High scope creep risk.

**Risk**

Very high.

**Verdict**

Not recommended.

## Recommended Restructure Specification

## 1. Product topology spec

- `MyLife` remains the only suite-level product.
- Individual apps remain separate product domains, whether they live as submodules or dedicated module packages.
- The hub owns:
  - shell
  - discover
  - settings
  - entitlements
  - migration/import surfaces
  - suite navigation
- Standalone apps own:
  - domain behavior
  - route/screen behavior
  - user-visible labels
  - core data model intent
  - module-specific UX

## 2. Reuse spec

- Preferred reuse mode for mature modules: **direct passthrough or direct shared-component composition**.
- Avoid adapter rewrites unless there is a hard platform constraint.
- If a hub module differs from the standalone product, that difference must be treated as a bug or a deliberate platform exception, not normal drift.

## 3. UI composition spec

- Borrow the `iOS-Hub` visual direction for the suite shell:
  - clearer icon grid
  - stronger launch identity
  - better visual hierarchy
  - cleaner discover/settings framing
- Do **not** borrow `iOS-Hub` as a codebase foundation.
- Keep shell chrome unified, but let module interiors retain their own visual identity within defined bounds.

## 4. Data ownership spec

- `MyLife` should remain the orchestration layer, not the place where every module is independently reinvented.
- Shared local data contracts need one authority per module.
- For recipes, that authority should be the standalone `MyRecipes` domain packages, not the hub adapter and not the Rork Swift prototype.

## 5. Module readiness spec

No module should be treated as production-ready inside the suite unless it passes all of the following:

- full screen map and navigation defined
- standalone and hub parity verified
- data migration or bootstrap story defined
- empty, loading, error, and offline states implemented
- automated tests present for core logic
- CI path exists or is covered through the suite CI
- visual polish reviewed against suite shell rules

## 6. Launch packaging spec

- The final suite can contain all modules in **Discover**, roadmap, or preview form.
- The production home experience should prioritize only the modules that are both mature and differentiated.
- Suggested **launch-tier candidates** based on current evidence:
  - MyBooks
  - MyBudget
  - MyFast
  - MyRecipes
  - MyHabits
  - MyMeds
  - MyRSVP
  - MyCar
- Suggested **conditional tier** after more platform hardening:
  - MyHealth
  - MyWorkouts
  - MySurf
  - MyHomes
- Suggested **preview or hidden tier** until parity and feature depth are real:
  - MyCloset
  - MyCycle
  - MyFlash
  - MyGarden
  - MyJournal
  - MyMail
  - MyMood
  - MyNotes
  - MyPets
  - MyStars
  - MySubs
  - MyTrails
  - MyVoice

This preserves the "one app" strategy without pretending every module is equally production-ready on day one.

## Recommended Production Path

### Recommendation

Use **Option A**.

In plain terms:

- Keep **MyLife**.
- Do **not** rebuild around `iOS-Hub`.
- Do **not** treat `rork-my-recipes-module` as a replacement product repo.
- Make `iOS-Hub` the **visual inspiration** for the shell.
- Make standalone apps, especially `MyRecipes`, the **behavioral source of truth**.
- Reduce mobile adapter drift until web and mobile follow the same ownership model.

### Why this is the best answer

- It preserves the one repo that is already architected for a suite.
- It keeps the best UI idea without inheriting the weakest codebase.
- It keeps the best native experiment without creating dual-canonical logic.
- It converts the current problem from "rewrite the company" into "clean the boundaries."

## 90-Day Execution Plan

## Days 1-30

- Freeze new module proliferation.
- Define launch-tier modules versus stub-tier modules.
- Port the `iOS-Hub` shell language into MyLife's hub screen and discover/settings surfaces.
- Produce a module maturity matrix using the specs and actual code status.

## Days 31-60

- Convert recipes mobile toward standalone-first reuse.
- Audit the same issue across books, fast, budget, and other mature modules.
- Standardize shell-to-module transitions, back navigation, tab framing, and visual spacing.
- Establish one release gate for parity-impacting changes.

## Days 61-90

- Finish launch-tier module polish.
- Reduce cross-module visual inconsistency.
- Harden auth/subscription only where truly needed.
- Push lower-maturity modules behind preview, beta, or disabled states instead of pretending they are launch-ready.

## Final Recommendation

If the question is "Which repo should become the one app?", the answer is:

**MyLife should be the one app.**

If the question is "What should happen to the other repos?", the answer is:

- `iOS-Hub` should be treated as a **design shell reference**.
- `rork-my-recipes-module` should be treated as a **native reference implementation**.
- standalone apps like `MyRecipes` should be treated as **canonical domain sources**.

If the question is "Should we rebuild?", the answer is:

**No full rebuild. Clean the architecture you already have, make reuse more direct, and launch in tiers.**

That is the highest-leverage way to reach a smooth production interface without sacrificing architectural integrity.

That path gives you the highest chance of ending with one smooth, visually clean, production-grade app without destroying the most valuable work already done.
