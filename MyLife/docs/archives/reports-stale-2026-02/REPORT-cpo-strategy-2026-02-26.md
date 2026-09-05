# CPO Strategy Report: MyLife Suite

**Date:** 2026-02-26
**Author:** CPO Agent (Team Review Synthesis)
**Branch:** `feature/mysurf-full-parity`

---

## Executive Summary

MyLife is a privacy-first personal app suite consolidating 13 registered modules and 23 standalone submodule repositories into a unified cross-platform hub (iOS, Android, web). After ~3 days of intensive development (2026-02-24 through 2026-02-26), the project has advanced from monorepo foundation through hub wiring, module migration, dual-model business architecture, standalone/hub parity infrastructure, social features, self-host deployment, and substantial test coverage. The velocity is extraordinary, but the breadth of the vision demands disciplined prioritization to reach a shippable product.

This report assesses the product from a Chief Product Officer perspective, covering vision coherence, prioritization, market positioning, revenue strategy, risk assessment, and a recommended 3-month roadmap.

---

## 1. Product Vision Assessment

### Is the Suite Vision Coherent?

**Yes, with caveats.** The core thesis -- "one privacy-first app replacing 11+ siloed tools, all data on-device, single subscription" -- is clear and compelling. The module system architecture (enable/disable from hub dashboard, shared SQLite with prefixed tables, single app binary) is well-designed to support this.

However, the current 23-submodule scope (MyBooks, MyBudget, MyCar, MyCloset, MyCycle, MyFast, MyFlash, MyGarden, MyHabits, MyHomes, MyJournal, MyMeds, MyMood, MyNotes, MyPets, MyRecipes, MyRSVP, MyStars, MySubs, MySurf, MyTrails, MyVoice, MyWords, MyWorkouts) stretches the vision far beyond what any single subscription should attempt to ship simultaneously. Some modules (MyCloset, MyCycle, MyFlash, MyGarden, MyMood, MyNotes, MyPets, MyStars, MyTrails) exist only as design docs or empty scaffolds. Shipping 13+ modules at once risks each feeling half-baked rather than 5-6 feeling excellent.

### Core Value Proposition Modules

The modules that form the strongest value cluster fall into three tiers:

**Tier 1 -- Ship First (highest daily-use frequency, broadest appeal):**
- **MyBooks** -- Most mature module. Full CRUD, e-reader, social sharing, passthrough parity complete. Real differentiator vs. Goodreads (privacy-first, no ads, local-first).
- **MyBudget** -- Strong implementation: envelopes, transactions, accounts, goals, bank sync foundation. YNAB competitor angle with privacy advantage.
- **MyFast** -- Simple, sticky, daily-use. Free tier driver. Low maintenance cost.
- **MySubs** -- Subscription tracker. Free tier driver. Complements MyBudget. 215-entry catalog.

**Tier 2 -- Ship Soon (strong use cases, moderate completeness):**
- **MyWorkouts** -- Body-map guided workouts, builder, exercise catalog, form recordings. Passthrough parity complete for web. Supabase cloud integration started.
- **MyWords** -- Dictionary/thesaurus in 270 languages, Word Helper. Passthrough parity complete for web. Unique utility module.
- **MyRecipes** -- Personal cookbook with grocery list and meal planning. Standalone exists but hub integration is adapter-only.

**Tier 3 -- Ship Later (less mature or niche):**
- **MySurf** -- Niche audience (surfers). Full feature surface built but requires Supabase cloud and real data pipeline. California-only MVP.
- **MyHomes** -- Niche (house hunters). Requires Drizzle + tRPC cloud backend. Most complex infrastructure dependency.
- **MyCar** -- Vehicle maintenance tracker. Scaffold exists, adapter-only integration. Useful but not sticky enough for launch.
- **MyHabits** -- Habit tracking. Design-doc phase with passthrough plumbing started. Competitive market (Streaks, Habitica).
- **MyMeds** -- Medication reminders. Design-doc only. Regulatory sensitivity.

---

## 2. Prioritization Matrix

| Module | User Value | Completeness | Effort to Ship | Priority Score | Recommendation |
|--------|-----------|-------------|----------------|---------------|----------------|
| MyBooks | High (daily use) | 85% | Low | **A** | Launch module |
| MyBudget | High (daily use) | 75% | Medium | **A** | Launch module |
| MyFast | Medium (daily use) | 70% | Low | **A** | Launch module (free tier) |
| MySubs | Medium (weekly use) | 50% | Medium | **B+** | Launch module (free tier) |
| MyWorkouts | High (3-5x/week) | 65% | Medium | **B+** | Launch module |
| MyWords | Medium (on-demand) | 70% | Low | **B** | Launch module |
| MyRecipes | Medium (weekly use) | 50% | Medium | **B** | v1.1 target |
| MyCar | Low-Medium | 35% | Medium | **C** | v1.2 target |
| MyHabits | Medium (daily use) | 20% | High | **C** | v1.2 target |
| MySurf | Low (niche) | 60% | High | **D** | Phase 4 |
| MyHomes | Low (niche) | 30% | High | **D** | Phase 4 |
| MyMeds | Medium (daily use) | 10% | High | **D** | Future |
| MyRSVP | Low (event-driven) | 15% | High | **D** | Future |

### Recommended Launch Bundle (v1.0)

**6 modules at launch:**
1. MyBooks (premium)
2. MyBudget (premium)
3. MyWorkouts (premium)
4. MyWords (premium)
5. MyFast (free)
6. MySubs (free)

This gives users 2 free modules to experience the hub, and 4 premium modules that cover daily personal productivity (reading, budgeting, fitness, language). The remaining modules launch in post-1.0 releases with marketing moments for each.

---

## 3. Market Positioning

### How MyLife Differentiates

**Primary positioning: "The anti-cloud personal app suite."**

Key differentiators:
1. **Privacy-first, local-first** -- All data stored on-device in SQLite. Zero analytics, zero telemetry. This is the polar opposite of Google, Apple ecosystem lock-in, and SaaS data harvesting.
2. **Single subscription, many apps** -- One price ($4.99/mo) replaces Goodreads + YNAB + workout tracker + recipe manager + dictionary. Unbundling fatigue is real.
3. **Dual-model choice** -- Hosted convenience OR self-host sovereignty. No other consumer app suite offers this. The self-host angle appeals to the growing privacy/sovereignty community.
4. **AI customization** -- "Change your app with a paragraph." Self-host users can modify their instance with natural language. This is genuinely novel for consumer software.
5. **Cross-platform parity** -- iOS, Android, and web from day one, with identical feature sets.

### Competitive Landscape

| Competitor | Category | MyLife Advantage |
|-----------|----------|-----------------|
| YNAB | Budgeting | No cloud dependency, included in suite |
| Goodreads | Books | Private, no ads, local-first, e-reader |
| Surfline | Surf forecasting | Privacy-first, included in suite |
| Streaks/Habitica | Habits | Integrated with other life data |
| Paprika/Mealime | Recipes | Privacy-first, included in suite |
| Notion | Notes/life-OS | Purpose-built modules vs. generic blocks |

### Target User Segments

1. **Privacy advocates** -- Users who actively avoid Google/Apple cloud services. Growing segment post-GDPR, post-surveillance awareness.
2. **Subscription fatigued** -- Users paying $5-15/mo each for 3-5 separate apps. MyLife replaces the bundle.
3. **Self-hosters** -- Technical users who run their own infrastructure (Home Assistant, Nextcloud users). The $5 one-time self-host license targets this directly.
4. **Digital minimalists** -- Users who want fewer apps, not more. One hub app vs. 11 app icons.

---

## 4. Revenue Strategy

### Current Pricing Design Assessment

| Plan | Price | Assessment |
|------|-------|------------|
| Hosted Monthly | $5/mo | **Appropriate for launch.** Below YNAB ($14.99/mo) and Surfline ($8.99/mo). Good trial price. |
| Hosted Yearly | $25/yr | **Strong value.** Effectively $2.08/mo. Good conversion driver from monthly. |
| Self-Host License | $5 one-time | **Underpriced.** Consider $10-15 once deployed modules justify it. At $5 it may signal "toy." |
| Update Pack | $5/yr | **Good model.** Annual feature access without subscription pressure. |

### Pricing Recommendations

1. **Keep $4.99/mo at launch.** This is an aggressive entry price that reduces friction. Raise to $6.99/mo after establishing a user base and proving value.
2. **Raise self-host to $9.99 one-time.** The self-host bundle includes deployment kit, AI customization guides, and repo access. $5 undervalues this. Technical users have higher willingness to pay for self-hosted solutions.
3. **Consider lifetime hosted option.** $79.99 lifetime (as noted in CLAUDE.md) is a strong early-adopter play. Generates upfront capital and locks in evangelists.

### Free Tier Strategy

**MyFast + MySubs as free tier is the right call.**

- **MyFast** is sticky (daily timer use) and simple. Users open the app daily, building the hub habit. Low support burden.
- **MySubs** is utility-forward (track what you already pay for). Natural upsell moment: "You're tracking $150/mo in subscriptions; for $5/mo more, manage your whole budget with MyBudget."

The free tier should NOT include high-value modules like MyBooks or MyBudget, as those are the primary conversion drivers.

### Revenue Projections (Conservative)

With 6 launch modules and aggressive privacy positioning:
- Month 1-3: Focus on early adopters, target 500-1,000 users
- Month 3-6: Word-of-mouth in privacy communities, target 2,000-5,000 users
- Conversion rate estimate: 15-20% free-to-paid (higher than typical due to clear value proposition)
- ARPU: ~$4/mo blended (mix of monthly/yearly/self-host)

---

## 5. Risk Assessment

### Critical Risks

**Risk 1: Scope Creep (SEVERITY: HIGH)**
- 23 submodule repositories for a solo/small team product. The parity enforcement system (standalone must equal hub) multiplies every change by 2x effort.
- Mitigation: Ship 6 modules at launch. Freeze new module creation until post-launch. Each subsequent module is a "product launch" event with its own timeline.

**Risk 2: Parity Burden (SEVERITY: HIGH)**
- The standalone/hub parity requirement means every feature change touches two codebases. The passthrough pattern helps (thin wrappers over standalone code), but only 4 modules have web passthrough today (budget, words, workouts, habits). Mobile passthrough is zero.
- Mitigation: Complete web passthrough for all launch modules before v1.0. Defer mobile passthrough to post-launch. Accept adapter mode for mobile initially.

**Risk 3: Cloud Module Fragmentation (SEVERITY: MEDIUM)**
- Three different storage backends (SQLite, Supabase, Drizzle + tRPC) create operational complexity. MySurf needs Supabase. MyHomes needs Drizzle + tRPC. Everything else uses SQLite.
- Mitigation: Defer cloud modules (MySurf, MyHomes) to Phase 4. Launch with SQLite-only modules to keep infrastructure simple.

**Risk 4: Self-Host Complexity (SEVERITY: MEDIUM)**
- The self-host offering (Docker compose, federation, direct messaging, actor identity) has grown significantly. Self-host API contract is at v0.5.0 with federation transport. This is enterprise-grade infrastructure for a consumer product.
- Mitigation: Ship self-host as a "power user" offering. Do not market it as primary. Keep hosted as the default path. Self-host docs should be excellent but expect < 5% of users to use it.

**Risk 5: No Real Users Yet (SEVERITY: MEDIUM)**
- All development is pre-launch. No user feedback on which modules matter, what UX friction exists, or whether the suite model resonates.
- Mitigation: Ship a TestFlight/beta within 4 weeks. Get 20-50 real users providing feedback before committing to v1.0 feature freeze.

**Risk 6: Market Timing (SEVERITY: LOW-MEDIUM)**
- Privacy-first apps are trending, but the market is also crowded with individual best-in-class tools. Users need a compelling reason to switch from established tools to a suite.
- Mitigation: Lead with the 2 strongest modules (MyBooks, MyBudget) and position as "switch one, discover the rest."

### Low-Severity Risks (Monitor)

- **App Store review** -- Suite apps sometimes face scrutiny for "too many unrelated features." Module-based architecture should satisfy reviewers since each module is coherent.
- **SQLite performance at scale** -- Single file with 13 modules' tables. Should be fine for personal-use data volumes, but monitor.
- **Submodule management** -- 23 git submodules is operationally complex for builds and CI. Consider whether design-doc-only repos need to be submodules.

---

## 6. Recommended 3-Month Product Roadmap

### Month 1 (Weeks 1-4): "Ship the Core"

**Goal:** Closed beta with 6 launch modules on iOS + web.

| Week | Milestone | Key Deliverables |
|------|-----------|-----------------|
| 1 | Complete web passthrough for launch modules | MyBooks passthrough (done), MyBudget passthrough (done), MyWorkouts passthrough (done), MyWords passthrough (done) |
| 1-2 | Mobile stability pass | Fix remaining adapter-mode issues on mobile for all 6 launch modules. Full test pass. |
| 2 | Auth + subscription infrastructure | Complete entitlement issuance (DM-013), RevenueCat integration for iOS, Stripe for web |
| 2-3 | Paywall + pricing UI | Implement pricing screen, purchase flow, entitlement gating for premium modules |
| 3 | TestFlight beta | First external build. 20-50 beta testers. Focus on MyBooks + MyBudget feedback. |
| 4 | Beta feedback triage | Fix top 10 user-reported issues. UX polish pass on hub dashboard and module switching. |

**Success Criteria:**
- 6 modules functional on iOS + web
- Purchase flow works end-to-end (subscribe, entitlement granted, premium modules unlock)
- 20+ beta testers providing feedback
- All parity checks passing (`pnpm check:parity`)

### Month 2 (Weeks 5-8): "Polish and Android"

**Goal:** Public beta. Android parity. App Store submission.

| Week | Milestone | Key Deliverables |
|------|-----------|-----------------|
| 5 | Android build stabilization | Verify all 6 launch modules work on Android. Fix platform-specific issues. |
| 5-6 | UX polish sprint | Hub dashboard design pass, onboarding flow, empty states, error states, loading states |
| 6 | MyRecipes promotion to launch bundle | If beta feedback supports it, add MyRecipes as 7th launch module |
| 7 | App Store / Play Store prep | Screenshots, descriptions, privacy policy, review guidelines compliance |
| 8 | Submission + web launch | Submit iOS/Android. Launch web at mylife.app (or similar) with Stripe payments. |

**Success Criteria:**
- Android feature parity with iOS
- App Store submission accepted
- Web app live with functional payment flow
- 100+ beta users
- Net Promoter Score baseline established

### Month 3 (Weeks 9-12): "Launch and Iterate"

**Goal:** Public launch. First revenue. Post-launch module expansion.

| Week | Milestone | Key Deliverables |
|------|-----------|-----------------|
| 9 | Public launch | iOS + Android + web simultaneously. Launch marketing (privacy communities, Reddit, HN, Product Hunt) |
| 9-10 | Self-host offering launch | Publish self-host Docker kit as add-on purchase. Documentation finalized. |
| 10 | Post-launch hotfix sprint | Address critical bugs from public launch feedback |
| 11 | MyRecipes / MyCar module launch | Ship 1-2 additional modules as v1.1 content. Marketing moment. |
| 12 | Retention analysis + Q2 planning | Analyze free-to-paid conversion, module usage distribution, churn signals. Plan Q2 module roadmap. |

**Success Criteria:**
- Live on all 3 platforms with paying customers
- Self-host kit available for purchase
- 500+ total users (free + paid)
- 15%+ free-to-paid conversion rate
- Retention: 60%+ D7, 40%+ D30

---

## 7. Strategic Recommendations

### Do Now (This Week)

1. **Freeze module scope at 6 for launch.** Remove non-launch modules from the default-enable bootstrap. Users can discover and request them, but the hub should feel curated, not sprawling.
2. **Prioritize auth + subscription over new features.** The billing/entitlement infrastructure (DM-013 through DM-017) is the critical path to revenue. No more module features until purchase flow works.
3. **Start TestFlight build pipeline.** Even a rough beta is more valuable than another module scaffold.

### Do Next (This Month)

4. **Reduce the submodule count.** Design-doc-only repos (MyCloset, MyCycle, MyFlash, MyGarden, MyJournal, MyMood, MyNotes, MyPets, MyStars, MyTrails) should be tracked as ideas in a planning document, not as 10+ git submodules that inflate checkout time and maintenance overhead.
5. **Complete mobile passthrough for MyBooks + MyBudget.** Web passthrough is done; mobile is still all adapter mode. This matters for long-term maintainability.
6. **Write landing page copy.** Privacy-first positioning needs a public face before launch.

### Do Later (Next Quarter)

7. **Cloud module refactor (MySurf, MyHomes, MyWorkouts).** These need real backend infrastructure. Do not rush them into a local-first launch.
8. **Evaluate federation.** The self-host federation transport (server-to-server messaging) is architecturally impressive but may be premature for a product with zero users. Monitor demand.
9. **Consider individual module pricing.** If usage data shows users only want 1-2 modules, offer individual module purchases ($1.99/mo each) as an alternative to the suite.

---

## 8. Key Metrics to Track

| Metric | Target (Month 1) | Target (Month 3) |
|--------|-----------------|-----------------|
| Beta users | 50 | 500+ |
| Free-to-paid conversion | -- | 15%+ |
| Monthly revenue | -- | $1,000+ |
| D7 retention | 50%+ | 60%+ |
| D30 retention | 30%+ | 40%+ |
| Modules enabled per user (avg) | 3+ | 4+ |
| Self-host adoption rate | -- | <5% of paid |
| Parity test pass rate | 100% | 100% |
| App Store rating | -- | 4.5+ |

---

## Appendix A: Module Maturity Snapshot (2026-02-26)

| Module | Standalone | Hub Module | Web Parity | Mobile Parity | Test Coverage |
|--------|-----------|------------|-----------|---------------|---------------|
| MyBooks | Mature | Implemented | Passthrough | Adapter | Good |
| MyBudget | Mature | Implemented | Passthrough | Adapter | Good |
| MyWorkouts | Mature | Implemented | Passthrough | Adapter | Moderate |
| MyWords | Functional | Implemented | Passthrough | Adapter | Moderate |
| MyFast | Functional | Implemented | Adapter | Adapter | Moderate |
| MySubs | Design+Scaffold | Implemented | Adapter | Adapter | Low |
| MyRecipes | Functional | Implemented | Adapter | Adapter | Low |
| MyCar | Scaffold | Implemented | Adapter | Adapter | Low |
| MyHabits | Design+Scaffold | Implemented | Passthrough | Adapter | Minimal |
| MySurf | Mature (standalone) | Implemented | Adapter | Adapter | Moderate |
| MyHomes | Scaffold | Implemented | Adapter | Adapter | Minimal |
| MyMeds | Design only | Implemented | Design only | Design only | None |
| MyRSVP | Scaffold | Implemented | Adapter | Adapter | None |

## Appendix B: Revenue Model Summary

```
Hosted Monthly:     $5/mo   (auto-renewing subscription)
Hosted Yearly:      $25/yr  (auto-renewing subscription)
Self-Host License:  $5 once (one-time, as-is software license)
Update Pack:        $5/yr   (annual feature access, optional)
Lifetime Hosted:    $79.99  (one-time, permanent hosted access)
```

## Appendix C: Competitive Pricing Context

| Product | Price | Scope |
|---------|-------|-------|
| YNAB | $14.99/mo | Budgeting only |
| Surfline | $8.99/mo | Surf forecasting only |
| Paprika | $4.99 one-time | Recipes only |
| Goodreads | Free (ad-supported) | Books (privacy concerns) |
| Streaks | $4.99 one-time | Habits only |
| **MyLife** | **$4.99/mo** | **6+ modules, privacy-first** |

---

*Report generated from review of: timeline.md (1025 lines), CLAUDE.md, module-registry constants/types, billing-sku-matrix.md, dual-model-product-design.md, dual-model-implementation-tickets.md (53 tickets), standalone-parity-universal-implementation-plan.md, CI configuration, git log (17 commits), and team reviewer findings.*
