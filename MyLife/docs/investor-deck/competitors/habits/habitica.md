# Habitica — Deep Dive (vs MyHabits)

**Module:** habits
**Tier:** direct
**Founded:** 2013
**HQ:** Santa Monica, CA
**Status:** private (bootstrapped + Kickstarter)

## One-line
RPG-gamified habit tracker where real-life tasks feed an 8-bit character, spawning guilds, parties, and quests around accountability.

## Lifetime
- Habit/daily/to-do CRUD with streaks, difficulty, and stat damage mechanics
- Parties + guilds + challenges (social accountability layer)
- Avatar + equipment + pets + class system (Warrior/Mage/Healer/Rogue)
- Open-source (GPLv3) with community-maintained web, iOS, Android
- Pricing: free core, Subscription $4.99/mo or $47.99/yr (unlocks gems, pets)

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | ~$5M est. | N/D | N/D | Kona Equity |
| 2024 | ~$5.3M est. | N/D | N/D | Kona Equity, Growjo |
| 2025 | N/D | N/D | N/D | — |

**Revenue mix:** subscriptions ~95% (gems + Subscription), merchandise <5% (Kickstarter 2019 funded physical goods), no ads, no data licensing.
**Profit / burn:** estimated profitable on ~11-person team (Kona Equity).
**Runway:** N/A (no recent VC; bootstrapped post-Kickstarter).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Kickstarter #1 | Jan 2013 | $41,191 | crowd (2,817 backers) | N/A | seed for v1 |
| Kickstarter #2 | 2019 | undisclosed (merch) | crowd | N/A | physical merchandise |
| Seed VC | N/D | undisclosed, small | N/D | N/D | Crunchbase shows minimal institutional |

Notes: Founder Tyler Renelle (OCDevel). No major institutional holders disclosed. Company is effectively founder-owned plus open-source contributors. No ESOP disclosed.
Sources: Crunchbase, Wikipedia, Habitica Fandom wiki.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2013 Jan | Kickstarter | $41,191 | crowd (2,817 backers) | — | — | Kickstarter |
| 2019 | Kickstarter merch | undisclosed | crowd | — | — | Kickstarter |
| — | — | minimal | — | — | — | no institutional round |

Total raised: ~$50K crowdfunded
Current stage: Indie / open-source community project (MIT license)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2012 | Founded by Tyler Renelle as HabitRPG | RPG-habits thesis |
| 2013 | Kickstarter #1 funded ($41K) | early community validation |
| 2015 | Rebranded Habitica; open-sourced on GitHub | OSS-first sustainability |
| 2017 | iOS + Android apps mature; party/guild features | social-RPG retention |
| 2019 | Second Kickstarter for physical merch | community commerce |
| 2024 | 4M+ registered users (cumulative) | niche loyal following |
| 2026 | Still community-operated; estimated <$1M ARR | long-tail OSS economics |

## Acquisition / Exit
Independent as of 2026-04. No external capital; MIT-licensed codebase mitigates acquisition value (anyone can fork). Most likely outcomes are (a) continued indie operation, (b) foundation transition if Renelle steps back, or (c) rare acqui-hire by a habit-tracking or gamified-productivity consolidator.

## Users
- 4M+ registered users (HelloLeads, Wikipedia)
- N/D MAU/DAU split
- Geography: heavy English-speaking (US/UK/CA), Habitica has no localized pricing tiers
- Conversion free→paid: N/D, estimated <5% given $5.3M rev / 4M users

## How they make money (precise)
1. **Subscriptions** ($4.99/mo, $47.99/yr): recurring gems + cosmetic unlocks. Primary line.
2. **One-time gem packs**: microtransactions for gear/pets.
3. **Merch** (Kickstarter-funded T-shirts, stickers): negligible.
No ads, no B2B, no data licensing. Unit economics: ~$1-2 ARPU/yr across total base; paying subs likely $40+.

## Wedge MyLife can exploit
- **No local-first story.** Habitica requires an account; all progress is server-side. MyHabits is SQLite-on-device.
- **Single-category app.** Habitica players still need separate apps for sobriety, Pomodoro, time-tracking, HealthKit. MyHabits absorbs I Am Sober + Forest + Toggl in one module at $99/yr bundle.
- **No HealthKit / Siri / location triggers.** Habitica never auto-completes; user must self-report. MyHabits has `src/healthkit`, `src/siri`, `src/location/engine.ts` shipped.
- **Privacy.** Habitica markets accountability via public parties; MyLife's audience wants a private RPG that never phones home.

## Logo
`../../assets/logos/habitica.png` — PNG, 625x159, rendered from Wikipedia.

## Logo Source
URL: https://upload.wikimedia.org/wikipedia/en/6/61/Habitica_Logo%2C_from_gamification_website_by_OCDevel.png
License: likely fair use (Wikipedia infobox). Trademark Habitica / Tyler Renelle.

## Sources
- [Habitica Wikipedia](https://en.wikipedia.org/wiki/Habitica)
- [Kona Equity — Habitica $5.3M revenue](https://www.konaequity.com/company/habitica-4391692381/)
- [Growjo — Habitica competitors](https://growjo.com/company/Habitica)
- [HelloLeads — 20 Habitica stats](https://www.helloleads.io/blog/stats-facts/20-amazing-habitica-stats-and-facts/)
- [Habitica Fandom — Kickstarter history](https://habitica.fandom.com/wiki/Kickstarter)
