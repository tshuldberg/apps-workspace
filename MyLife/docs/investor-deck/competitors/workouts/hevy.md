# Hevy — Deep Dive (vs MyWorkouts)

**Module:** workouts
**Tier:** direct (gym workout tracker)
**Founded:** 2019
**HQ:** London, UK (distributed)
**Status:** private (bootstrapped, profitable)

## One-line
The fastest-growing gym tracker of 2023-2025 — Strong alternative with a live social feed, now 10M+ users and ~$7M+ ARR, profitable since early days with a small distributed team.

## Product
- Workout logging with exercise library (400+)
- Social feed: follow friends, kudos on PRs, comments
- Routines, supersets, rest timer, plate calc, 1RM
- Progress graphs, volume tracking, body measurements
- Hevy Coach (2024 launch): B2B for personal trainers to program clients remotely
- Platforms: iOS, Android, Apple Watch, Wear OS, Web
- Pricing: Free (robust) / Pro $5.99/mo or $39.99/yr
- Distinguishing UX choice: friend feed + kudos — Strava's social model applied to lifting

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | ~$4-5M est. | N/D | N/D | Indie Hackers interview baseline |
| 2024 | ~$7M+ est. | N/D | N/D | competitor-financials baseline, $600K/mo |
| 2025 | ~$10-15M est. | N/D | N/D | 10M user + Coach B2B product |

**Revenue mix:** consumer Pro subscriptions ~85%, Hevy Coach B2B (~2024+) ~15%.
**Profit / burn:** profitable; bootstrapped with lean team (~15-25 people per public LinkedIn).
**Runway:** N/A (profitable).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Self-funded | 2019 | founder savings | — | — | Mario Bondioli, Niko Zennaro founders |
| No disclosed VC | ongoing | N/A | N/A | N/A | Bootstrapped from Day 1 |

Founders: Mario Bondioli, Niko Zennaro (Italian founders based in London). No institutional investors.
Sources: Indie Hackers interview 2022, founder LinkedIn, Hevy About page.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2019 | Self-funded | founder savings | — | — | — | Crunchbase |
| — | — | $0 VC | — | — | — | Bootstrap from Day 1 |

Total raised: $0 outside capital disclosed
Current stage: Bootstrapped profitable (Mario Bondioli + Niko Zennaro; distributed team ~15-25)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2019 | Mario Bondioli + Niko Zennaro founded Hevy in London | social gym-tracker thesis |
| 2020 | Pandemic home-gym wave; fast iOS growth | category tailwind |
| 2022 | Indie Hackers interview; first profitability | bootstrapped sustainable |
| 2023 | Crossed ~$4-5M revenue; Strong overtaking signal | category challenger |
| 2024 | Hevy Coach B2B launched; ~$7M revenue | product expansion |
| 2025 | 10M+ users; ~$10-15M revenue est. | category leader trajectory |

## Acquisition / Exit
Independent as of 2026-04. Most recent round: never raised. No public acquisition talks; Mario Bondioli + Niko Zennaro operate as bootstrapped founder-CEO duo. Potential acquirers: Apple (Fitness+), Strava, or Under Armour. Given profitable ops and 10M user scale, Hevy founders have leverage to hold for large exit or continue independently.

## Users
- 10M+ users (company, 2025)
- MAU: est. 1.5-3M (category-leading growth curve)
- Geography: US, UK, Germany, Brazil, Australia
- Conversion rate: ~5-8% est., ~150-300K paying

## How they make money (precise)
1. **Hevy Pro** ($5.99/mo or $39.99/yr): unlimited routines, advanced stats, custom exercises, photo logs.
2. **Hevy Coach** (B2B, launched 2024): trainers pay per client slot ($15-30/mo per trainer tier).
3. No ads, no data sold.

Unit economics: high gross margin (>75%) on subs; Coach has higher ACV and net retention. Lean ops keep costs low.

## Wedge MyLife can exploit
- **Social pressure + cloud feed**: Hevy's feed requires posting workouts publicly. MyWorkouts has opt-in privacy-filtered social (src/social/privacy.ts) with explicit applyPrivacyFilter gates. Users default to private.
- **No cross-module intelligence**: Hevy tracks lifts; doesn't read mood, nutrition, fasting. MyWorkouts' 6 cross-module insight detectors are impossible for a workout-only app to replicate.
- **No recovery heatmap**: Hevy shows workouts, not muscle-group recovery. MyWorkouts has a 14-group recovery heatmap (src/recovery/engine.ts).
- **Suite pricing**: $39.99/yr for one category; MyLife $99/yr for 30 modules.
- **Bootstrapped growth cap**: Hevy's growth is impressive but unfunded, which slows enterprise expansion. MyLife's suite model monetizes differently and doesn't need to win only on lifts.

## Logo
`../../assets/logos/hevy.png` — Apple iTunes App Store artwork, 512x512 rendered.

## Logo Source
- URL: `https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/5a/99/28/5a99283f-aee1-bfbb-a741-d97e8a324160/AppIcon-0-0-1x_U007emarketing-0-7-0-sRGB-85-220.png/512x512bb.jpg`
- License: Apple App Store artwork, used for identification/commentary.

## Sources
- https://www.hevyapp.com/
- https://www.indiehackers.com/interview/hevy-bootstrapped (founder interview, 2022)
- https://www.hevycoach.com/ (Coach B2B product)
- https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458763634
