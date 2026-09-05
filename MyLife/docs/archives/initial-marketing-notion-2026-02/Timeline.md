# MyLife Market Research & Marketing Sprint - Decision Timeline

**Date:** 2026-02-27
**Objective:** Comprehensive market analysis, pricing validation, and production marketing content for MyLife app suite.

---

## Decision Log Format

Each entry captures:
- **Decision:** What was decided
- **Context:** Why this decision point arose
- **Options Considered:** Alternatives evaluated
- **Pros/Cons:** Trade-offs at time of decision
- **Outcome:** What was chosen and why
- **Agent(s):** Which agent(s) were involved

---

## [20:05] Decision #1: Team Structure & Agent Allocation

**Decision:** Create a 12+ agent team organized by research domain, analysis, marketing, and development.

**Context:** The user requested a comprehensive operation spanning market research for 20+ app categories, pricing model evaluation, marketing content production, and a landing page build. This requires significant parallelization to complete efficiently.

**Options Considered:**
1. **Sequential single-agent approach** - One agent does everything in order
   - Pros: Simple coordination, no conflicts
   - Cons: Extremely slow, context window limitations, no specialization
2. **Small team (3-4 agents)** - Generalist agents handle multiple domains
   - Pros: Less coordination overhead
   - Cons: Each agent overloaded, slower completion, less depth per domain
3. **Large specialized team (12+ agents)** - Domain-specific researchers + specialists
   - Pros: Maximum parallelism, deep domain expertise, faster completion
   - Cons: More coordination needed, potential for redundant work, higher resource usage

**Outcome:** Option 3 selected. The breadth of research (20+ app markets, prediction markets, pricing analysis) combined with the need for production-quality marketing output justifies a large team. Research agents grouped by market adjacency to enable cross-pollination within groups.

**Agent(s):** Lead (coordinator)

---

## [20:05] Decision #2: Research Grouping Strategy

**Decision:** Group MyLife modules into 6 market research clusters based on market adjacency, plus a dedicated prediction markets analyst.

**Context:** MyLife has 20+ standalone modules spanning health, finance, fitness, reading, home management, and lifestyle. Researching each individually would require 20+ agents. Grouping by adjacent markets lets one agent research related competitors that share investor reports and market data.

**Groups:**
1. Health & Wellness: MyFast, MyHabits, MyMeds, MyMood, MyCycle
2. Personal Finance: MyBudget (includes subscription tracking from MySubs)
3. Reading & Learning: MyBooks, MyWords, MyFlash
4. Fitness & Outdoors: MyWorkouts, MySurf, MyTrails
5. Home & Auto: MyHomes, MyCar, MyGarden, MyPets
6. Lifestyle & Social: MyRecipes, MyRSVP, MyVoice, MyJournal, MyNotes, MyCloset, MyStars

**Pros of this grouping:**
- Related markets share data sources (e.g., Sensor Tower reports cover adjacent categories)
- Competitors often span multiple categories within a group
- Reduces agent count while maintaining depth

**Cons:**
- Group 6 (Lifestyle) is large and diverse, may need splitting
- Some modules like MySurf are niche enough to warrant solo research

**Outcome:** Proceeding with 6 groups. Will monitor Group 6 output quality and split if needed.

**Agent(s):** Lead (coordinator)

---

## [20:05] Decision #3: Timeline Format as Decision Journal

**Decision:** Structure the timeline as a retroactive decision journal rather than a chronological action log.

**Context:** User specified they want to review "every decision throughout the process and what the pros and cons were at the time of the decision" to enable retroactive analysis of agent interactions and reasoning.

**Outcome:** Each entry captures the decision, context, alternatives, trade-offs, and which agent(s) were involved. This enables post-mortem analysis of the research and marketing strategy development process.

**Agent(s):** Lead (coordinator)

---

## [20:05] Decision #4: Pricing Tiers to Evaluate

**Decision:** Evaluate three pricing tiers: $2/individual app, $5/any 5 apps, $20/full suite.

**Context:** User specified these tiers. The pricing analyst will calculate Total Addressable Market (TAM) at each tier and compare against competitor pricing. Note: user initially mentioned "$3 sales price" then refined to "$2 individual" - using the more specific numbers.

**Options:**
- One-time purchase vs subscription (needs evaluation)
- Per-app vs bundle-only (user wants both)

**Outcome:** Evaluate all three tiers against market size data from research agents. The prediction markets comparison (Polymarket/Kalshi/DraftKings) will inform the disruption narrative.

**Agent(s):** Lead, pricing-analyst (pending)

---

## [20:10] Decision #5: Opportunity Scout Agent

**Decision:** Add an 8th agent ("opportunity-scout") that cross-pollinates research findings and identifies new market opportunities.

**Context:** User noted that app ideas often surface through casual conversation (e.g., someone mentioned wanting a recipe app, which MyLife already has as MyRecipes). This suggests there are many more "I wish I had an app for X" moments that MyLife could capture with new modules.

**Options Considered:**
1. **Wait for all research to complete, then analyze gaps** - Sequential, slower discovery
   - Pros: Complete data before analyzing
   - Cons: Misses cross-pollination opportunities, delays insights
2. **Add a dedicated scout agent that monitors all researchers in real-time** - Active intelligence gathering
   - Pros: Cross-pollinates findings as they emerge, catches adjacent opportunities early, documents the "casual conversation" use cases
   - Cons: Additional coordination overhead, may generate noise

**Outcome:** Option 2 selected. The scout agent will check in with each researcher multiple times, grab their partial findings, and build a running document of new app ideas and market gaps at `newideas.md`. This captures the "someone mentioned they wanted X" pattern at scale.

**Agent(s):** Lead (coordinator), opportunity-scout (new)

---

## [20:10] Agent Roster (Wave 1)

| Agent | Task | Status |
|-------|------|--------|
| health-researcher | Task #1: Health & Wellness markets | Running |
| finance-researcher | Task #2: Personal Finance markets | Running |
| media-researcher | Task #3: Reading & Learning markets | Running |
| fitness-researcher | Task #4: Fitness & Outdoors markets | Running |
| home-researcher | Task #5: Home & Lifestyle markets | Running |
| lifestyle-researcher | Task #6: Productivity & Content markets | Running |
| predictions-analyst | Task #7: Prediction markets disruption | Running |
| opportunity-scout | Task #21: New app opportunities | Running |

**Wave 2 (blocked, waiting on Wave 1):**
- pricing-analyst (Task #8) - blocked by Tasks 1-6
- report-compiler (Task #9) - blocked by Tasks 1-8
- marketing-strategist (Task #10) - blocked by Task 9
- content-creator (Task #11) - blocked by Task 10
- landing-page-dev (Task #12) - blocked by Task 11
- notion-agent (Task #13) - blocked by Tasks 9-11

---

## [20:25] Milestone: Finance Research Complete (Task #2)

**Agent:** finance-researcher
**Quality Assessment:** High. Report includes cited sources, real financial data (YNAB ARR, Monarch valuation, Rocket Money acquisition), competitive tables, and actionable insights.

**Key Data Points Captured:**
- Rocket Money acquisition: $1.275B (validates subscription tracking as billion-dollar category)
- Monarch Money: $850M valuation on $12.6M ARR (67x revenue multiple)
- YNAB: ~$49M ARR, repeated price hikes driving churn
- Post-Mint displacement: 20M+ users, most still underserved
- MyBudget's pricing advantage: 73% cheaper than YNAB at MyLife Pro tier
- Offline-first eliminates Plaid costs ($0.25-$3.00/connection/month)

**Decision Point:** The finding that no major competitor combines envelope budgeting + subscription tracking + privacy-first validates MyBudget's positioning. This will inform the pricing analyst's work (Task #8) and the marketing strategist's messaging (Task #10).

**Remaining Wave 1 agents:** 6 of 7 still running (health, media, fitness, home, lifestyle, predictions) + opportunity scout.

---

## [20:50] Milestone: All Wave 1 Research Complete

**All 7 research reports delivered.** 2,309 lines of market research across 8 files (7 reports + newideas.md).

| Report | Lines | Key Finding |
|--------|-------|-------------|
| Health & Wellness | 372 | Flo Health: $1B+ valuation, 380M downloads. Fasting apps: Zero 200M+. Market: $8.5B+ |
| Personal Finance | 327 | Mint displaced 20M users. Rocket Money: $1.275B acq. YNAB: ~$49M ARR |
| Reading & Learning | 258 | Goodreads: 150M users but stagnant. Quizlet: $1B+ acquisition |
| Fitness & Outdoors | 244 | AllTrails: $750M val, 60M users. Strava: 120M users. Peloton (PTON) public financials |
| Home & Lifestyle | 306 | Zillow: $1.9B rev. Rover: $2.3B acq. Planta: 10M+ downloads |
| Productivity & Content | 298 | Notion: $10B val. Otter.ai: 25M+ users. Eventbrite (EB) public |
| Prediction Markets | 267 | Polymarket: $9B+ volume. DraftKings: $3.7B rev. Disruption pattern analysis |
| New Ideas (scout) | 237 | 15+ new module opportunities identified across meditation, sleep, water, travel, etc. |

**Decision Point:** With all research in, Wave 2 can begin. Launching pricing analyst + report compiler.

---

## [20:50] Decision #6: Full Tool/Skill/MCP Inventory for Wave 2

**Decision:** Conduct complete tool audit before launching marketing agents to ensure no capabilities are missed.

**Inventory Results:**
- **108+ skills** across workspace (7), marketing (25), receipts (8), global Codex (67), humanizer (1)
- **7 MCP servers:** macos-hub (32 tools), Figma, Slack, Playwright, Context7, Google Calendar, OpenAI Docs
- **22 plugins** enabled at hub level
- **7 custom agent definitions** (4 workspace + 3 MyLife-specific)

**Key tools relevant for Wave 2 marketing work:**
- 25 marketing skills (copywriting, email sequences, social content, pricing strategy, launch strategy, etc.)
- `humanizer` skill for natural-sounding copy
- `imagegen` skill for marketing visuals
- Figma MCP for design assets
- Playwright MCP for competitor page analysis
- `firecrawl` plugin for web scraping
- `cloudflare-deploy` skill for landing page deployment
- `frontend-design` plugin for landing page development
- macos-hub Notes MCP for Notion-alternative storage

**Outcome:** Wave 2 agents will be equipped with references to all relevant tools. The marketing strategist will have access to all 25 marketing skills. The landing page developer will use frontend-design plugin + Figma MCP.

---

## [20:50] Wave 2 Launch: Pricing Analyst + Report Compiler

Launching pricing-analyst (Task #8) immediately since all 6 market research reports are complete. Report compiler (Task #9) will start after pricing analysis completes.

---

## [20:55] Decision #7: Early Landing Page Dev Launch

**Decision:** Launch landing page developer now, before marketing copy is finalized.

**Context:** The landing page has two independent workstreams: (1) structure, animations, design, and responsive layout, (2) actual copy/content. Workstream 1 can start immediately using research data for placeholder content. Workstream 2 depends on the marketing content agent (Task #11).

**Options:**
1. Wait for full dependency chain (pricing -> report -> strategy -> content -> landing page)
   - Pros: Page has final copy from day one
   - Cons: Landing page dev sits idle for 4+ task completions
2. Start structure/design now, inject copy later
   - Pros: Parallel work, faster completion, dev can use research data as realistic placeholders
   - Cons: May need copy adjustments after insertion

**Outcome:** Option 2. The landing page developer will build the full scrollable experience (hero, problem, solution, module showcase, pricing, CTA) with placeholder content drawn from research reports. Final marketing copy will be swapped in when the content creator finishes.

---

## [20:55] Decision #8: Wave 1 Agent Shutdown

**Decision:** Shut down all 8 Wave 1 agents after task completion.

**Rationale:** All research tasks complete. Rather than keeping idle agents alive consuming resources, shut them down cleanly. New specialized agents will be spawned for Wave 2/3 tasks. Agent outputs persist in the report files regardless.

**Agents shut down:** health-researcher, finance-researcher, media-researcher, fitness-researcher, home-researcher, lifestyle-researcher, predictions-analyst, opportunity-scout

---

## [20:55] Consolidated Wave 1 Research Findings

### Market Size Summary (from all 7 reports)

| Category | TAM | Key Competitor | Competitor Revenue |
|----------|-----|---------------|-------------------|
| Health/Wellness (5 modules) | $51-72B | Flo Health | $200M+ bookings, $1B+ val |
| Personal Finance | $10-30B | YNAB ~$49M ARR | Rocket Money acq. $1.275B |
| Reading/Learning (3 modules) | $8.6B | Goodreads 150M users | Quizlet acq. $1B+ |
| Fitness/Outdoors (3 modules) | $10.6B | Strava 180M users | AllTrails $750M-1B val |
| Home/Lifestyle (5 modules) | $45.7B (PropTech alone) | Zillow $2.6B rev | Rover acq. $2.3B |
| Productivity/Content (6 modules) | $28-55B | Notion $600M ARR | Otter.ai $100M ARR |
| **Combined TAM** | **$150-240B+** | | |

### Top Strategic Insights
1. **Privacy scandals in every category** validate offline-first as a genuine moat
2. **Acquisition graveyards** (Mint, Evernote, Yummly, MagicSeaweed) create displacement windows
3. **Cross-module correlation** is MyLife's exclusive advantage (no standalone app can do it)
4. **Bundle economics crush standalone pricing** ($20 for 20+ apps vs $100-300/yr for a few)
5. **New module opportunities:** MyMeditate ($2.25B), MySleep ($5.49B), MyCalories ($6.13B), MyContacts ($14.6B)

---

## [21:00] Milestone: Pricing Analysis Complete (Task #8)

**Agent:** pricing-analyst
**Key Finding:** The "App Subscription Tax" - users spend $820+/yr on 10 standalone apps. MyLife replaces all for $20 one-time (97.6% Year 1 savings).

**Revenue Projections:**
| Capture Rate | Revenue |
|-------------|---------|
| 0.1% US | $1.5M |
| 1% US | $15M |
| 5% US | $75M |

**Pricing Recommendation:** $2/$5/$20 tiers validated. One-time pricing IS the marketing message. Optional Cloud Sync MRR add-on ($1-2/mo) recommended for investor metrics.

---

## [21:00] Decision #9: Parallel Launch of Report Compiler + Marketing Strategist

**Decision:** Launch both Task #9 (report compilation) and Task #10 (marketing strategy) simultaneously, breaking the strict sequential dependency.

**Context:** Task #10 was blocked by Task #9 (compile unified report). But the marketing strategist can read all 8 raw research reports + pricing analysis directly. The unified report is a compilation, not new analysis. Waiting for it would add unnecessary delay.

**Options:**
1. **Strict sequential:** Wait for report compiler -> then launch strategist
   - Pros: Strategist gets a single clean document
   - Cons: Idle time, both agents read the same source material
2. **Parallel launch:** Both read raw reports simultaneously
   - Pros: Faster pipeline, strategist starts immediately
   - Cons: Strategist doesn't get the unified summary (minor, since raw data is more detailed)

**Outcome:** Option 2. Marketing strategist gets a pointer to all 9 source files. Report compiler works in parallel. The strategist's output (marketing strategy) feeds into the content creator (Task #11).

---

## [21:00] Milestone: Landing Page Complete (Task #12)

**Agent:** landing-page-dev
**Output:** 1,895-line production HTML at `docs/2/27/landing-page/index.html`
**Quality:** Full self-contained page with embedded CSS/JS, zero external dependencies, dark theme, responsive, Intersection Observer animations, real research data in every section. No placeholder content.

**Technical highlights:**
- CSS custom properties matching MyLife brand tokens
- `clamp()` for fluid typography
- Frosted glass navbar with backdrop-filter
- Animated number counters with cubic easing
- Category filter tabs on module showcase
- Staggered reveal animations
- Mobile breakpoints at 960px and 640px
- All 23 modules with icons, taglines, and competitor replacements

**Opened in browser for preview.**

---

## [21:05] Milestone: Marketing Strategy Complete (Task #10)

**Agent:** marketing-strategist
**Output:** Comprehensive go-to-market playbook at `marketing-strategy.md`

**Key Strategic Decisions from the Playbook:**
- Primary tagline: "20 apps. $20. Once."
- Launch lead modules: MyFast (free hook), MyBudget (Mint refugees), MyBooks (Goodreads exiles)
- Programmatic SEO: 50+ "Alternative to [X]" pages
- Reddit seeding across 12 target subreddits
- Referral program: "Give a Module, Get a Module"
- Year 1 marketing budget: $50-75K
- Psychological hooks: Anchor at $820/yr, then reveal $20

---

## [21:05] Decision #10: Content Creator Launch

**Decision:** Launch content creator immediately after marketing strategy completion.

**Context:** Task #11 depends on Task #10 (marketing strategy). Strategy is now complete with specific messaging, positioning, and channel recommendations. Content creator has everything needed to produce production-ready copy.

**Deliverables assigned:** 7 files covering App Store descriptions, landing page copy, email sequence (7 emails), social media posts (25+ posts), ad copy (16+ variants), competitor comparison pages (5 pages), and brand tagline toolkit.

---

## [21:06] Milestone: Unified Market Report Complete (Task #9)

**Agent:** report-compiler
**Output:** Publication-quality report at `REPORT-mylife-market-research.md`
**Structure:** 7 major sections + 2 appendices, 35+ competitor entries, all sourced from 9 research reports.

---

## [21:06] Decision #11: Notion Integration Approach

**Decision:** No Notion MCP tools are available in this workspace. Will evaluate alternatives.

**Options:**
1. Use macos-hub Notes MCP (create Apple Notes with report content)
2. Manual Notion import (prepare markdown files in Notion-compatible format)
3. Skip Notion, deliver all content as markdown files (already done)

**Outcome:** Pending user input. The markdown reports are already structured for easy Notion import (headers, tables, clean formatting). Will document the manual import path if no MCP is available.

---

## [21:10] Milestone: All Marketing Content Complete (Task #11)

**Agent:** content-creator
**Output:** 7 production-ready files totaling ~108KB in `marketing-content/`

| File | Size | Contents |
|------|------|----------|
| taglines-and-slogans.md | 7.8KB | Primary tagline + 10 secondary + 23 module taglines |
| app-store-descriptions.md | 26.9KB | Hub listing + 23 standalone module listings |
| landing-page-copy.md | 13.2KB | 3 hero variants, full section copy, FAQ, SEO meta |
| email-sequence.md | 12.5KB | 7-email onboarding sequence over 21 days |
| social-media-posts.md | 19.6KB | 25+ posts across Twitter, Reddit, Instagram, LinkedIn, Product Hunt |
| ad-copy.md | 12.2KB | 16+ ad variants for Google, App Store, Facebook, Reddit |
| competitor-pages.md | 16.2KB | 5 "MyLife vs [X]" SEO pages |

---

## [21:10] Sprint Complete - Final Summary

### Total Deliverables: 18 files

**Research Phase (8 files, ~156KB):**
- 7 market research reports covering 50+ competitors across 20+ categories
- 1 new module opportunities report (15+ new ideas)

**Analysis Phase (2 files, ~40KB):**
- 1 pricing model and TAM analysis
- 1 unified market research report (publication-quality)

**Strategy Phase (1 file, ~25KB):**
- 1 comprehensive marketing strategy playbook

**Content Phase (7 files, ~108KB):**
- 7 production-ready marketing content files

**Development Phase (1 file, 60KB):**
- 1 scrollable landing page (1,895 lines, self-contained HTML)

### Agent Utilization: 12 agents across 3 waves
- Wave 1 (8 agents): 7 researchers + 1 opportunity scout
- Wave 2 (2 agents): pricing analyst + report compiler
- Wave 3 (3 agents): marketing strategist + content creator + landing page dev

### Key Numbers from Research
- Combined TAM: $150-240B+
- App Subscription Tax: $820+/yr for typical user
- MyLife alternative: $20 one-time (97.6% savings)
- Revenue at 1% US capture: $15M
- Revenue at 5% US capture: $75M
- Privacy scandals documented across all categories

### Decision Journal Entries: 11 major decisions tracked with pros/cons/outcomes

---

## [21:25] Decision #12: Notion + Figma MCP Integration

**Decision:** Deploy two integration agents to push sprint deliverables into Notion and Figma.

**Context:** User connected Notion and Figma MCP servers. Both have rich APIs that can add significant value to the sprint output.

**Notion Use Case Assessment:**
- **Best fit:** Structured knowledge base with all 18 reports as interconnected Notion pages
- **Value add:** Enhanced formatting (callouts, toggles, tables, color coding), team collaboration, commenting, sharing
- **Approach:** Create parent page with hierarchical sub-pages, color-coded by category (blue=research, green=strategy, purple=marketing)

**Figma Use Case Assessment:**
- **Best fit:** Capture the landing page HTML into an editable Figma design file for designer iteration
- **Value add:** Design handoff, component extraction, responsive variant creation, design system documentation
- **Approach:** Serve landing page locally, use generate_figma_design to capture into new Figma file, create design system rules for future Figma-to-code workflows

**Agents launched:**
- notion-agent: Creates 19 Notion pages in hierarchical structure
- figma-agent: Captures landing page to Figma, generates design system rules

---

## [21:55] Decision #13: Figma Full-Page Re-Capture

**Decision:** Re-capture the landing page to Figma with all scroll sections visible.

**Context:** The initial Figma capture only captured the hero section because the landing page uses Intersection Observer scroll animations. Elements below the fold start with `opacity: 0` and only become visible when scrolled into view. Figma's capture tool renders the page in a virtual browser without scrolling, so it missed 7 of 8 sections.

**Options Considered:**
1. **Playwright scroll + Figma screenshot** - Use Playwright to scroll through page triggering animations, then screenshot
   - Pros: Quick, Playwright already running
   - Cons: Figma captures via its own renderer, not Playwright's browser
2. **Temporarily disable animations in CSS + re-capture** - Add `!important` overrides to force all reveal elements visible, then let Figma's own capture tool render the full page
   - Pros: Figma captures the real page with all content visible, proper Figma file output
   - Cons: Requires temporary code edit (must revert)
3. **Remove Intersection Observer entirely** - Delete the JS observer code
   - Pros: Permanent fix for captures
   - Cons: Destroys the scroll UX for real users

**Outcome:** Option 2 selected. Added temporary CSS overrides (`.reveal, .reveal-left, .reveal-right, .reveal-scale { opacity: 1 !important; transform: none !important; }`) and injected the Figma capture script. Captured all 8 sections successfully, then reverted all temporary changes.

**New Figma File:** [MyLife Landing Page - Full](https://www.figma.com/integrations/claim/Y4gGFiyqpUAjif6GXGKqTp)
- All 8 sections captured: Hero, App Subscription Tax, One App Solution, Module Showcase (23 modules), Markets Ready for Disruption, Pricing ($2/$5/$20), Privacy Promise, CTA/Footer

---

*Timeline continues below as agents report findings and decisions are made...*

