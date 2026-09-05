# Quizlet — Deep Dive (vs MyFlash)

**Module:** flash
**Tier:** direct
**Founded:** 2005
**HQ:** San Francisco, USA
**Status:** private (VC-backed, $1B+ valuation)

## One-line
The dominant consumer flashcard and study platform, pivoting to AI ("Q-Chat", "Magic Notes") to defend against the post-ChatGPT collapse in its traditional SEO traffic.

## Product
- User-generated flashcard sets + study modes (learn, test, match, blast)
- AI features: Q-Chat tutor, Magic Notes (summarize lecture notes to flashcards), AI-generated questions
- Quizlet Plus + Quizlet Live (classroom multiplayer) + Spanish
- Platforms: iOS, Android, Web
- Pricing: Free (ad-supported, limited AI) / Plus $7.99/mo or $35.99/yr
- Distinguishing UX: massive UGC library (500M+ sets) and the Match game competitive element

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | ~$110M est. | N/D | $1B (2020 last round) | Sensor Tower + Forbes |
| 2024 | ~$130M est. | N/D | $1B (flat) | MyLife baseline competitor-financials-2024-2026.md |
| 2025 | $139M | N/D | $1B (reported down-round talks) | Baseline + Bloomberg |

**Revenue mix:** ~60-70% subscriptions (Plus + school licenses), ~25% ads, ~5-10% B2B/education licensing.
**Profit / burn:** reported profitable in 2024 after layoffs; AI investment keeps burn high.
**Runway:** N/D; strong revenue base and no immediate capital need per Bloomberg.

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Bootstrap | 2005-2015 | $0 external | Andrew Sutherland (founder, HS student) | N/A | Solo-built for 10 years |
| Series A | 2015 | $12M | Union Square Ventures + Costanoa | ~$50M est. | Notable late first round |
| Series B | 2018 | $20M | General Atlantic | ~$350M | General Atlantic lead |
| Series C | 2020 | $30M | General Atlantic | $1B | Unicorn status achieved |
| Total disclosed | - | ~$62M | - | - | Founder retains meaningful stake; USV + Costanoa + General Atlantic institutional |

Sources: Crunchbase, TechCrunch, CEO Matthew Glotzbach public statements.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2005-2014 | Bootstrapped | $0 external | Andrew Sutherland | — | — | Crunchbase |
| 2015 | Series A | $12M | Union Square Ventures + Costanoa | Altos Ventures | ~$50M | TechCrunch |
| 2018 | Series B | $20M | General Atlantic | USV | ~$350M | TechCrunch |
| 2020 | Series C | $30M | General Atlantic | — | $1B | TechCrunch (first unicorn milestone) |

Total raised: ~$62M primary
Current stage: Late-stage private; reports of down-round talks (Bloomberg)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2005 | Founded by Andrew Sutherland at age 15 (high school student, San Francisco) | iconic HS origin story |
| 2010 | Crossed 1M registered users; still solo-built | early viral |
| 2015 | Andrew Sutherland stepped aside; Matthew Glotzbach (ex-YouTube) joined as CEO; Series A at $50M | professionalization |
| 2020 | Series C at $1B unicorn valuation during pandemic study boom | peak |
| 2023 | Google AI Overviews cannibalized SEO traffic; layoffs begin | existential threat |
| 2023 | Q-Chat AI tutor launched | AI pivot |
| 2024 | Layoffs; reported profitability | rightsizing |
| 2025 | Revenue $139M; reported down-round talks | valuation reset risk |

## Acquisition / Exit
Independent as of 2026-04. Most recent round: 2020 Series C at $1B. No public acquisition talks but Bloomberg reported potential down-round in 2025. Previously rumored IPO candidate (pre-ChatGPT era). Founder Andrew Sutherland remains on board, no longer day-to-day.

## Users
- MAU: 60M+ (per company statements, 2024)
- DAU: N/D
- Paying subscribers: ~1M (MyLife baseline)
- Geography: US-heavy (60%+), significant LATAM + India growth
- Conversion: ~1.5% free-to-paid — characteristic of ad-supported freemium education

## How they make money (precise)
1. **Quizlet Plus subscription** $35.99/yr — unlocks AI features, offline, ad removal, unlimited practice tests.
2. **Display advertising** across the free tier — declining as Google SEO traffic shrinks post-AI-Overviews.
3. **Quizlet for Schools** (licensed LMS tier) — growing B2B leg.
4. **Data licensing** (reportedly piloted with LLM training partners, not confirmed).

Unit economics: low marginal cost per set (user-generated); AI features add inference cost. Ad RPM crashed 2023-2024 as students shift to ChatGPT. Company response: force-fit AI inside Plus to justify the subscription.

## Wedge MyLife can exploit
- **SEO collapse:** Quizlet's moat was Google SERP dominance for study terms. AI Overviews cannibalized 40-60% of that traffic. MyFlash has no SEO dependency.
- **Ad-funded free tier:** Quizlet shows ads to K-12 students; MyLife is subscription-only, no ads.
- **No image occlusion, no proper FSRS:** Quizlet's scheduler is simple spaced repetition. MyFlash ships FSRS-inspired scheduling and rect/ellipse image occlusion.
- **No .apkg import:** switching from Anki is a manual rebuild. MyFlash ships a full .apkg parser preserving scheduling state.
- **Suite bundle pricing:** $7.99/mo for Quizlet alone vs $7-10/mo for MyLife's 30-module suite including flashcards.

## Logo
`../assets/logos/quizlet.png` — 512x512 App Store icon.

## Logo Source
- URL: https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/d9/98/02/d99802b2-9a74-ffa7-f8f5-22244564d454/AppIcon-production-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg
- License: Apple App Store marketing artwork, editorial / comparative use.

## Sources
- https://quizlet.com/
- https://www.crunchbase.com/organization/quizlet
- https://techcrunch.com/2020/05/12/quizlet-unicorn/
- MyLife baseline: docs/business-plan/competitor-financials-2024-2026.md §2
