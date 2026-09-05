# MyLife Funding Strategy — Session Summary
**Session date range:** 2026-04-18 → 2026-04-19
**Author of doc:** Claude (acting as financial/strategic analyst)
**Status:** Foundational decisions made, execution playbook ready
**Companion doc:** `handoff-next-session.md`

---

## TL;DR — What Was Decided

After ~5 hours of structured analysis covering market sizing, competitor financials, pricing models, funding paths, and growth strategy, the following decisions were made and are now committed:

1. **Pricing:** **$12/year ($1.49/month)** for full Pro access. Free tier: 5 modules (fast, journal, mood, notes, voice). Optional Family ($24/yr) and Lifetime ($99-149) tiers.
2. **Mission lock:** Mission-driven, anti-extraction posture. No paid acquisition. No data sales. No price increases on existing subscribers ever. No private equity acquisition. No bot networks for marketing.
3. **Funding strategy:** Avoid traditional venture capital. Raise ~$1.1-1.6M across four non-traditional sources over 18 months: Kickstarter Lifetime pre-sale ($150-500K) + aligned angel round ($500-750K) + revenue-based financing in Y2 ($200-500K) + grants ($150-400K).
4. **Growth strategy:** Organic-only. Founder-led content (AI-amplified), aligned creator partnerships (free), subreddit and Mastodon community participation, press cycles tied to incumbent crises, App Store optimization, Lifetime gifting virality.
5. **Timeline:** 8-year horizon to Signal-scale (40-60M installs, 10-15M paid, ~$100-160M ARR). Profitable by Y4. Not a 5-year venture sprint. Not a unicorn play. A durable, founder-controlled, mission-aligned institution.
6. **Legal structure:** User has an LLC. Conversion to Delaware Public Benefit Corp will likely be required before institutional angel round (most accredited investors require C-corp / PBC). Kickstarter and grants can run from current LLC.
7. **Existing product:** 30 modules built, 28 wired on mobile, 19 on web, TestFlight verified with 306 web + 118 mobile tests green. Production-release Phases 1-4 complete. Remaining work: native GPS / wake-lock on mobile, IAP polish, marketing launch.

---

## How We Arrived Here — Key Decision Threads

### Thread 1: Pricing — From $79.99 → $5 → $12

Initial financial model assumed **$79.99/yr** pricing (in line with Calm, Strava, AllTrails). This produced a base case of 600K paid subs and $48M ARR by Y5, with 48% EBITDA margin.

User pushed back on "extreme prices by competitors" and proposed **$5/yr** as a market-disruption play. Analysis showed:
- $5/yr has sound unit economics IF growth is purely organic (LTV $24 vs CAC ceiling $8)
- $5/yr structurally precludes paid acquisition (Meta/Google install costs of $20-50 require $70+ pricing to recoup)
- $5/yr signals "tip jar" / hobby project to consumers and investors
- Most $5-10/yr apps in history (Pinboard, Fastmail, Overcast, Obsidian) hit growth ceilings at 50K-2M users

User and I converged on **$12/yr ($1.49/mo monthly equivalent)** as the optimal price:
- Net ARPU after 15% store fee: $10.88
- Conversion expected: 18-22% install→paid (vs 2-6% at $80, 25-30% at $5)
- Annual retention: 78%
- LTV per paid sub: $49
- Maximum CAC budget: $16 per paid sub (organic + cheap creator channels only)
- Marketing tagline: **"$1 a month. Every app you're paying for, in one."**
- Y5 base case: 6.5M paid subs, $71M exit ARR, 39% EBITDA margin

### Thread 2: Why competitors charge $60-120/yr

Detailed analysis of why incumbents are structurally locked into high prices:

1. **Paid acquisition arithmetic.** Facebook/TikTok/Google installs cost $15-50 per install in lifestyle verticals. With 2-5% install→paid conversion, CAC per paid sub is $300-2,000. Cannot recover at $5-12. Forces $70+ pricing.
2. **Real per-user content/infra costs.** Calm licenses celebrities ($50M+/yr content). Headspace pays meditation teachers. Noom employs 1,000+ human coaches. Their per-user COGS is $5-30/year.
3. **Venture capital math.** Once a company takes $200M+ in VC, the cap table requires $1B+ revenue path. At $5 ARPU that requires 250M paid subs (impossible outside FAANG). They are mathematically locked into high pricing by their cap table.
4. **B2B sales overhead.** Headspace 40% B2B revenue funded by enterprise sales reps at $500K-1M loaded cost.
5. **Quality signaling.** Consumer psychology research shows low prices reduce perceived value and engagement.

MyLife's structural asymmetries: 30 modules already built (sunk cost), local-first architecture (~$0 infra/user for 26/30 modules), no content licensing, no venture overhang yet, founder-led AI-amplified production.

### Thread 3: AI acceleration — what it does and doesn't change

User argued that historical organic-growth timelines (Signal 7yrs, DuckDuckGo 12yrs, Proton 10yrs) are dated because AI compresses founder production capacity.

**Concession:** I revised the timeline from 10-15 years to 6-8 years. AI-era compression is real for:
- Founder production capacity (5-10x throughput)
- Content production
- Research and competitive intelligence
- Customer support
- ASO and creative iteration
- Algorithmic virality (TikTok/Reels/Shorts didn't exist in 2014)
- Mature creator economy (50-200 aligned creators ready to recommend privacy-first products for free)
- Cultural readiness for privacy (post-Cambridge-Analytica, post-Flo, post-Mint moments)

**Push-back retained:** AI does NOT compress:
- Trust acquisition (3-6 month minimum for users to hand over health/cycle/journal data)
- Habit formation (21-66 day biological clock per Lally et al. 2010)
- Word-of-mouth K-factor (capped at 0.3-0.7 even for best products in history)
- App Store review accumulation (linear)
- Category awareness (Rule of 7 still applies)
- The fact that competitors have AI too

Net: 6-8 years to scale, not 3-5. ChatGPT/Threads-style 0-to-100M growth is misleading reference class for trust-sensitive consumer lifestyle bundles.

### Thread 4: AI bot networks for marketing — rejected

User proposed running thousands of AI accounts on TikTok/Instagram/X for promotion. Hard rejection on multiple grounds:

1. **Mission destruction.** A privacy-first/anti-extraction brand caught running bot networks is destroyed irreversibly. The exact users MyLife targets (privacy-conscious, anti-manipulation) are the most sensitive to this betrayal.
2. **Detection certainty.** Platform integrity ML, behavioral fingerprinting, content embedding clustering, journalist/researcher hunting, competitor intelligence, contractor leaks. Detection horizon: months not years.
3. **Legal exposure.** FTC Act §5, FTC Fake Reviews Rule (Oct 2024), state consumer deception statutes, App Store delisting risk, defamation/impersonation liability.
4. **Operational cost.** $15-40K/month sustained for 1000+ accounts (phone numbers, residential proxies, device farms, account churn, content generation, human supervision). Same money spent on a real PR/community FTE compounds rather than depreciates.
5. **Decreasing efficacy.** Algorithmic shadow-demotion of low-trust accounts; rising user skepticism of AI content; engagement quality signals discount bot interaction.

**Legitimate AI use:** drafting founder content, research synthesis, press list building, transcription/repurposing, creator identification, ASO keyword research, customer support inside the product. All amplify the real founder voice. None impersonate.

### Thread 5: Funding sources — VC rejected, four-source stack adopted

Traditional VC explicitly rejected because cap-table mathematics forces 10x return obligations that mandate price increases and engagement extraction. The Netflix/streaming-services collusion-on-price pattern is the predictable end state of investor-owned consumer companies.

**Adopted four-source capital stack:**

| Source | Amount | Terms | Timing |
|--------|--------|-------|--------|
| Founder self-fund | $50-100K | Personal | Pre-launch |
| Kickstarter Lifetime pre-sale | $150-500K | Pre-sales, no equity | Month 5 |
| Aligned angel round | $500-750K | SAFE/Convertible Note + PBC side letter | Months 6-11 |
| Revenue-based financing | $200-500K | 1.3-1.7x repayment from revenue | Months 14-16 |
| Grants | $150-400K | Non-dilutive, non-repayable | Months 3-18 (rolling) |
| **Total cumulative** | **$1.1-1.6M** | **~7-10% dilution** | **18 months** |

Compared to traditional $3M VC seed at $15M post: half the capital, ~80% less dilution, complete mission control, no obligation to 10x exit. The mission-aligned capital stack is harder to assemble but is the only path that survives the cap table over 10+ years.

### Thread 6: Mission-aligned investor pool

Specific funds and individuals identified as appropriate for the round:

**Funds:** Obvious Ventures, Collab Fund, Kapor Capital, Omidyar Network, Acumen, Patagonia Tin Shed Ventures, Draper Richards Kaplan, Echoing Green, Long Journey Ventures.

**Individual angel categories:** Mission-aligned consumer founders (Allbirds, Patagonia, Bombas, Toms, Honest Co., Olipop), privacy/tech ethicists (Aza Raskin, Tristan Harris network, Cory Doctorow network, DHH, Maciej Ceglowski), notable indie SaaS founders (Pieter Levels, Adam Wathan, Steph Smith), Substack writers on privacy/wellness, therapists/doctors/financial planners with angel capacity, Kickstarter top-tier backers.

### Thread 7: Grant-funded path

Sixteen grant programs identified as fit:

**Highest priority (apply first):**
- ~~Mozilla Foundation Open Source Support (MOSS)~~ **DEFUNCT since 2020 -- removed**
- NLnet Foundation NGI0 Commons Fund — EUR 5-50K, **deadline June 1, 2026** (apply NOW)
- Open Technology Fund (OTF) Internet Freedom — $50-200K typical, rolling (submit concept note)
- Reset.tech — $50-200K, rolling, anti-surveillance-capitalism mandate
- Echoing Green Fellowship — $90K + 2yr support, December 2026 deadline

**Mid-priority:** Knight Foundation, Ford Foundation Public Interest Tech, Sloan Foundation, Schmidt Futures, Reset.tech, Omidyar Network grants, Skoll Foundation, Halcyon Fellowship, Common Future Capital, Patrick J. McGovern Foundation, Apple Entrepreneur Camp, Google for Startups Founders Fund.

Strategy: 12 applications over 18 months → 3-4 wins. Open-source one foundational component (encryption engine or sync engine) to unlock most tech grants.

### Thread 8: 8-year revised growth projection

Final committed projection (organic-only, mission-aligned, $12/yr):

| Year | Installs | Paid subs | Net ARR | Notes |
|------|----------|-----------|---------|-------|
| Y1 | 80K | 8K | $85K | Launch press + founder content engine |
| Y2 | 400K | 55K | $600K | First aligned creator wave + first viral module |
| Y3 | 1.5M | 250K | $2.7M | Press narrative compounds, cash-flow positive |
| Y4 | 4M | 800K | $8.7M | Category awareness inflection |
| Y5 | 10M | 2.3M | $25M | Signal-era scale |
| Y6 | 22M | 5.5M | $60M | Category leader |
| Y7 | 40M | 10M | $109M | Mainstream |
| Y8 | 60M | 15M | $163M | Durable institution |

---

## Decision Log

| Decision | Outcome | Rationale |
|----------|---------|-----------|
| Pricing | $12/yr / $1.49/mo | Optimal balance of accessibility, signal, and unit economics |
| Acquisition strategy | Organic-only | Mission alignment + structural CAC math at $12/yr |
| Bot network for marketing | Rejected | Mission destruction, detection certainty, legal exposure |
| Capital stack | 4-source non-VC ($1.1-1.6M) | Cap-table mission preservation |
| Legal structure | Existing LLC; convert to PBC C-corp before angel round | Investors require C-corp; PBC locks mission |
| Growth horizon | 8 years to scale | Trust/habit timescales not compressible by AI |
| Open source | One foundational component (TBD) | Unlocks grants and developer credibility |
| Exit ambition | $50-300M strategic over 10+ years OR generational independent | Compatible with mission and capital structure |

---

## Open Questions for Future Sessions

These were raised but not fully resolved and should be revisited:

1. **PBC C-corp conversion timing.** Before angel round close. Need lawyer ($2-4K). Choose between full PBC C-corp conversion or PBC LLC where state allows.
2. **Which component to open-source first.** Recommended candidates: encryption engine, local-first sync engine, module-registry framework, design system tokens. Decision needed Month 1.
3. **Lifetime tier price point.** Recommended $89-149. Final number depends on perceived value testing during pre-launch list building.
4. **Family plan structure.** Whether to ship Family at launch ($24/yr, 4 accounts) or wait for Y2 to test demand.
5. **B Corp certification timing.** Free assessment available now. Full certification 4-9 months. Start in Month 1 to have badge for angel round.
6. **First viral module bet.** RSVP and flash modules identified as most likely viral catalysts. Allocate marketing focus accordingly.
7. **Press relationship building list.** Need to identify 30-50 specific journalists and start cold relationships in Month 1-2.
8. **First-cohort creator outreach list.** Need 200 mission-aligned creators identified by Month 3 for Kickstarter launch and ongoing seeding.

---

## What This Session Did Not Cover

For transparency, these are areas not addressed and would benefit from dedicated sessions:

- International pricing and localization (USD $12 vs euro/yen/pound equivalents)
- VAT, sales tax, EU DSA compliance, GDPR architecture review
- App Store review process strategy and rejection mitigation
- Detailed product roadmap for native GPS/wake-lock and remaining production work
- Brand identity refresh (logo, typography, motion system)
- Press kit design and assembly
- Trademark filings (US + key international)
- Data Processing Agreements for forums/market modules
- Customer support stack (Plain, Pylon, or community-based)
- Analytics-free telemetry architecture (PostHog self-hosted, Plausible)
- Family plan technical implementation (account linking, billing)
- Lifetime tier accounting treatment (deferred revenue handling)

---

## Reference Files Created This Session

- `/Users/trey/Desktop/Apps/MyLife/docs/plans/investor-pitch/financial-analysis-2026-04-18.md` — Original 17-section investor financial analysis (built at $79.99/yr, then revised to $5/yr; superseded by decisions in this summary but retains useful competitive financials and TAM/SAM/SOM data)
- `/Users/trey/Desktop/Apps/MyLife/docs/plans/investor-pitch/session-summary-2026-04-19.md` — This document
- `/Users/trey/Desktop/Apps/MyLife/docs/plans/investor-pitch/handoff-next-session.md` — Companion handoff with full content for manifesto, Kickstarter narrative, 12-slide deck, 1-pager, data room checklist, instrument decision framework, and Claude Design prompts

---

## Key Data Sources Referenced

- Business of Apps statistics (Calm, Headspace, Strava, Flo, Duolingo, Notion, AllTrails)
- RevenueCat State of Subscription Apps 2025
- Adapty In-App Subscription Benchmarks 2026
- Sacra.com (Oura, Otter, Noom, Partiful)
- PitchBook, Crunchbase, CB Insights private company data
- Grand View Research, Straits Research market sizing
- Latka (getlatka.com) revenue snapshots
- Duolingo Q3 2025 shareholder letter, Rocket Companies 2024 10-K
- TechCrunch, CNBC, MobiHealthNews funding announcements
- Lally et al. 2010, *European Journal of Social Psychology* (habit formation timescales)
- Pew Research Center 2024 study on AI content detection
- FTC Endorsement Guides 2023 revision and FTC Fake Reviews Rule (October 2024)
