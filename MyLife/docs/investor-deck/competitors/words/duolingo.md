# Duolingo — Deep Dive (vs MyWords)

**Module:** words
**Tier:** adjacent (vocabulary learning at massive scale)
**Founded:** 2011
**HQ:** Pittsburgh, Pennsylvania, USA
**Status:** public (NASDAQ: DUOL)

## One-line
The world's largest language-learning platform, 116M+ MAU, public since 2021, pivoting hard into AI (Duolingo Max) with Roblox-scale gamification — a vocabulary giant by volume if not by dictionary depth.

## Product
- 40+ languages with gamified lessons (XP, streaks, leagues, hearts)
- Vocabulary decks and contextual word learning
- Duolingo Max: GPT-4-powered Explain My Answer + Roleplay
- Duolingo ABC (literacy for kids), Duolingo Math, Duolingo Music, Duolingo Chess (launched 2025)
- Platforms: iOS, Android, Web
- Pricing: Free (ad-supported) / Super $83.99/yr / Max $29.99/mo (AI features)
- Distinguishing UX choice: streak as primary retention hook; gamification as compulsion loop

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | $531M | N/D | ~$8B market cap | 10-K FY2023 |
| 2024 | $748M | N/D | $9.5B+ | 10-K FY2024 |
| 2025 | ~$1.0B+ run-rate | N/D | $13-18B range (volatile) | Q3 2025 earnings |

**Revenue mix:** subscriptions ~80% (Super + Max), advertising ~10%, Duolingo English Test ~7%, in-app purchases ~3%.
**Profit / burn:** profitable since 2023; GAAP net income $88.6M (FY2024); record profitability.
**Runway:** N/A (public, cash-rich).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Seed | 2011 | $3.3M | Union Square Ventures | N/D | Luis von Ahn + Severin Hacker |
| Series A-F | 2012-2020 | ~$183M cumulative | Kleiner Perkins, Google Capital, Durable | — | Pre-IPO rounds |
| IPO | Jul 2021 | $521M raised | — | $6.5B open | NASDAQ: DUOL |
| Public | 2022-2026 | N/A | — | $9.5B+ | Insiders + float |

Founders: Luis von Ahn (CEO, co-inventor reCAPTCHA), Severin Hacker (CTO). Major public holders: Vanguard, BlackRock, Invesco (standard index stakes).
Sources: Duolingo S-1 (SEC), 10-K filings, Q3 2025 earnings release.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2011 | Seed | $3.3M | Union Square Ventures | — | N/D | Crunchbase |
| 2012 | Series A | $15M | NEA | — | N/D | TechCrunch |
| 2014 | Series C | $20M | Kleiner Perkins | — | ~$470M | TechCrunch |
| 2015 | Series D | $45M | Google Capital | — | $470M | TechCrunch |
| 2017 | Series E | $25M | Drive Capital | — | $700M | TechCrunch |
| 2019 | Series F | $30M | CapitalG (Google) | — | $1.5B | TechCrunch |
| 2020 | Secondary | $35M | General Atlantic | — | $2.4B | TechCrunch |
| 2021 | Pre-IPO | $35M | Durable Capital | — | $2.4B+ | TechCrunch |
| 2021 | IPO | $521M | Morgan Stanley, Goldman | — | $6.5B open | S-1 |

Total raised: ~$183M private + $521M IPO
Current stage: Public (NASDAQ: DUOL since Jul 2021)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2011 | Luis von Ahn (reCAPTCHA co-inventor) + Severin Hacker founded Duolingo at CMU | Carnegie Mellon spinout |
| 2014 | Crossed 25M users; Spanish + French dominant | consumer scale |
| 2019 | CapitalG Series F at $1.5B | unicorn status |
| 2021 | NASDAQ IPO (Jul 2021) at $6.5B open | public company |
| 2023 | First GAAP profitable full year; Duolingo Max launched | AI pivot + profitability |
| 2024 | Revenue $748M; 116M+ MAU | category-dominant |
| 2025 | ~$1B run-rate; $13-18B market cap | mature growth co |

## Acquisition / Exit
Independent as of 2026-04 (public). Luis von Ahn and Severin Hacker remain CEO/CTO with dual-class voting protection. IPO in Jul 2021 on NASDAQ. No acquisition talks; Duolingo is an acquirer (multiple small language-tech tuck-ins). Continues to expand beyond language (Math, Music, Chess 2025) signaling long-term independence.

## Users
- 116.7M MAU (Q4 2024)
- 50M+ DAU
- ~10M+ paying subscribers (Super + Max)
- Geography: global; US largest single market, India + Brazil huge volume
- Conversion rate: ~8-9% free→paid (category-leading)

## How they make money (precise)
1. **Super Duolingo subscription** ($83.99/yr): ad-free, unlimited hearts, streak freeze.
2. **Duolingo Max** ($29.99/mo): AI tutoring features, Roleplay, Explain My Answer.
3. **Advertising** on free tier.
4. **Duolingo English Test** (DET): $65 per test, competitive vs TOEFL.
5. **In-app purchases** (gems, streak freezes).

Unit economics: gross margin ~72% (FY2024); operating margin turning positive. AI features have higher COGS (GPT-4 API calls) pressuring margin of Max.

## Wedge MyLife can exploit
- **Compulsion-loop ethics**: Duolingo's streak mechanics are clinically habit-forming and notorious for aggressive notifications (meme'd as the "Duolingo bird threat"). MyLife's anti-enshittification pledge bans manipulative streaks.
- **Gamified vocabulary, not dictionary**: Duolingo teaches vocabulary in lesson flow but is not a reference. MyWords is a proper dictionary for 270+ languages with etymology + thesaurus.
- **No personal library**: you cannot save a word you encounter in the world into Duolingo. MyWords has saved_words + word_lists (V1 schema) with FTS5 search.
- **Heavy ads on free tier**: Duolingo's free tier is ad-heavy by design. MyWords has zero ads.
- **Suite economics**: Duolingo Super is $83.99/yr for one category. MyLife is $99/yr for 30 modules including MyWords, MyFlash, MyNotes, MyJournal — a complete learning + reference + productivity stack.

## Logo
`../../assets/logos/duolingo.png` — Apple iTunes App Store artwork, 512x512 rendered.

## Logo Source
- URL: `https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/ce/c5/22/cec52280-46c7-e2d3-4087-143cd1bbf8c0/AppIcon-0-0-1x_U007epad-0-1-85-220.png/512x512bb.jpg`
- License: Apple App Store artwork, used for identification/commentary.

## Sources
- https://investors.duolingo.com/ (10-K filings)
- https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001562088
- https://en.wikipedia.org/wiki/Duolingo
- https://www.theverge.com/2024/... (Max launch coverage)
