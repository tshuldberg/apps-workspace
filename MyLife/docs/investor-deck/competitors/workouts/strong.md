# Strong — Deep Dive (vs MyWorkouts)

**Module:** workouts
**Tier:** direct (gym workout tracker)
**Founded:** 2015
**HQ:** Netherlands / distributed (indie)
**Status:** private (indie, bootstrapped)

## One-line
The original clean-design gym log — 5M+ users, tight Apple Health integration, near-zero marketing, a beloved indie that proved you could charge $30/yr for a workout tracker and keep the app free of social noise.

## Product
- Workout logging with custom exercise library
- Rest timer, plate calculator, 1RM calculator
- Progress graphs per exercise (weight, volume, 1RM trend)
- Workout templates and routines
- Apple Health sync, Apple Watch companion
- Platforms: iOS, Android, Apple Watch, Wear OS
- Pricing: Free (3 routines) / Strong Pro $4.99/mo or $29.99/yr
- Distinguishing UX choice: zero social feed, zero "explore other users" — pure log-your-lift

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | ~$5M est. | N/D | N/D | indie baseline; ~$400K/mo |
| 2024 | ~$6M est. | N/D | N/D | competitor-financials baseline ~$500K/mo |
| 2025 | ~$6-8M est. | N/D | N/D | Hevy and Fitbod taking share |

**Revenue mix:** subscriptions ~95%, one-time IAP ~5%. No ads, no data sold.
**Profit / burn:** profitable; team <10 per LinkedIn.
**Runway:** N/A (bootstrapped).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Self-funded | 2015 | founder savings | — | — | Kirill Bourovoi (founder) |
| No disclosed VC | ongoing | N/A | N/A | N/A | Bootstrapped from App Store revenue |

Founders: Kirill Bourovoi and small team. No institutional holders disclosed.
Sources: Crunchbase (sparse), founder LinkedIn, App Store developer profile.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2015 | Self-funded | founder savings | — | — | — | Crunchbase |
| — | — | $0 VC | — | — | — | Bootstrap |

Total raised: $0 outside capital disclosed
Current stage: Bootstrapped indie (Kirill Bourovoi-controlled; team <10)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2015 | Kirill Bourovoi launched Strong for iOS | clean-design gym-log thesis |
| 2017 | Android version released | cross-platform parity |
| 2019 | Apple Health + Apple Watch tight integration | ecosystem lock-in |
| 2021 | Crossed 5M users | consumer scale |
| 2023 | Hevy catching up; price parity pressure | competitive pressure |
| 2024 | ~$6M revenue est.; lifestyle-profitable | stable indie |
| 2026 | ~$6-8M revenue est.; Hevy overtaking in growth | plateau phase |

## Acquisition / Exit
Independent as of 2026-04. Most recent round: never raised. No public acquisition talks; Kirill Bourovoi operates as indie founder-CEO. Potential acquirers: Apple (Fitness+), MyFitnessPal, or Hevy (category consolidation). Lifestyle-business profile suggests founder preference for independence; no exit urgency signals.

## Users
- 5M+ users (company statement)
- MAU: ~500K-1M est.
- Geography: US, UK, Germany, Australia strong; indie globally
- Conversion rate: est. ~6-8% free→Pro

## How they make money (precise)
1. **Strong Pro** ($4.99/mo or $29.99/yr): unlimited routines, advanced graphs, body measurement tracking.
2. Lifetime one-time purchase historical (discontinued for most users in 2023).
3. No ads, no data licensing.

Unit economics: tiny team + App Store = >80% gross margin; lifestyle-business profitable.

## Wedge MyLife can exploit
- **No cross-module intelligence**: Strong tracks lifts in isolation. MyWorkouts has 6 cross-module insight detectors (mood-lift correlation, fasting performance, protein recovery, time-of-day, volume-mood, sleep impact) that read from mo_ / nu_ / ft_ tables — no Strong user can see how their mood affects their lifts.
- **No workout player state machine**: Strong is a flat log UX. MyWorkouts ships a state machine (idle / playing / paused / rest / completed), warmups, supersets, voice commands (20 phrases).
- **No AI workout generation**: Strong doesn't generate workouts. MyWorkouts has rule-based AI generator local on device (src/ai/generator.ts).
- **No progressive overload automation**: Strong shows historical weights, user must manually plan progression. MyWorkouts has an overload engine (src/overload/engine.ts, V4 schema).
- **Suite economics**: Strong Pro $29.99/yr for one category; MyLife $99/yr for 30 modules including workouts + nutrition + mood + fasting + presence.

## Logo
`../../assets/logos/strong.png` — Apple iTunes App Store artwork, 512x512 rendered.

## Logo Source
- URL: `https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/3d/70/ff/3d70ff4e-edb1-5141-6ecf-1713a77db6ff/AppIcon_PROD-0-1x_U007emarketing-0-8-0-sRGB-85-220-0.png/512x512bb.jpg`
- License: Apple App Store artwork, used for identification/commentary.

## Sources
- https://www.strong.app/
- https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id1128032408
- https://www.crunchbase.com/organization/strong-app
- https://www.reddit.com/r/StrongApp/ (user base scale + sentiment)
