# Fitbod — Deep Dive (vs MyWorkouts)

**Module:** workouts
**Tier:** direct (AI-personalized workout planner)
**Founded:** 2015
**HQ:** San Francisco, California, USA
**Status:** private

## One-line
The premium AI workout planner — learns your recovery, available equipment, and goals, then generates today's workout — positioned upmarket at $95.99/yr with a one-time lifetime option at $359.99.

## Product
- AI-personalized daily workouts (fatigue model across muscle groups)
- 1,500+ exercise library with HD video demos
- Gym-equipment customization (home gym, full gym, dumbbells only, etc.)
- Recovery tracking and muscle fatigue heatmap
- Apple Watch, Apple Fitness+ companion
- Platforms: iOS, Android, Apple Watch, Wear OS
- Pricing: Free trial / $15.99/mo or $95.99/yr / Lifetime $359.99 (promo $299)
- Distinguishing UX choice: algorithmic next-workout — you don't plan, Fitbod plans for you

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | ~$18-22M est. | N/D | N/D | SensorTower + press |
| 2024 | ~$24M est. | N/D | N/D | competitor-financials baseline $2M/mo |
| 2025 | ~$28-34M est. | N/D | N/D | premium pricing + strong retention |

**Revenue mix:** subscriptions ~95%, lifetime purchase ~5% (high ARPU but infrequent).
**Profit / burn:** N/D; estimated profitable given premium pricing, 30+ person team.
**Runway:** N/A.

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Seed | 2015 | ~$1.2M | angels | N/D | Allen Chen, Jesse Venticinque founders |
| Seed follow-on | 2016-2018 | ~$1.2M est. | various | N/D | Crunchbase aggregate $2.4M |
| — | 2019+ | N/A | — | — | Capital-efficient; no disclosed follow-on |

Founders: Allen Chen (CEO), Jesse Venticinque. ~$2.4M total raised per Crunchbase.
Sources: Crunchbase, founder LinkedIn, App Store developer profile.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2015 | Seed | ~$1.2M | Angels | — | N/D | Crunchbase |
| 2016-2018 | Seed follow-on | ~$1.2M | Various | — | N/D | Crunchbase |

Total raised: ~$2.4M disclosed
Current stage: Seed-stage private (capital-efficient; Allen Chen-led; no disclosed follow-on since 2018)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2015 | Allen Chen + Jesse Venticinque founded Fitbod in SF | AI-personalized workout thesis |
| 2018 | Crossed seed follow-on; bootstrap from here | capital efficiency |
| 2020 | Pandemic home-gym boom drove app-store top rankings | category tailwind |
| 2022 | Crossed 1M users (company) | consumer scale |
| 2024 | ~$24M revenue est.; 30+ person team | profitable premium indie |
| 2026 | ~$28-34M revenue est. | category premium leader |

## Acquisition / Exit
Independent as of 2026-04. Most recent round: 2018 seed follow-on (no raises in 7+ years). No public acquisition talks. Potential acquirers: Apple (Fitness+ integration), Peloton, Garmin, or Under Armour (MapMyFitness legacy). Given profitable operations and tiny cap table, Allen Chen has latitude to hold for larger outcome.

## Users
- 1M+ users (company)
- MAU: ~200-400K est.
- Geography: US, UK, Canada, Australia
- Conversion rate: ~15-20% est. trial→paid (high, premium positioning)

## How they make money (precise)
1. **Subscriptions** ($15.99/mo or $95.99/yr): unlock algorithm, full library, video demos.
2. **Lifetime** ($359.99): one-time whale purchase.
3. No ads, no data sold.

Unit economics: premium pricing pushes LTV high; retention stronger than Hevy/Strong (per category tracking). Gross margin >80% on subs.

## Wedge MyLife can exploit
- **Premium pricing**: Fitbod $95.99/yr for one category is MyLife's entire suite price ($99/yr for 30 modules).
- **Algorithm opacity**: Fitbod's fatigue model is closed. MyWorkouts' recovery heatmap and overload engine are open pure-TS functions, auditable.
- **No cross-module data**: Fitbod reads only workout history and muscle group load; it cannot read your MyMood entries, MyFast timing, MyNutrition protein. MyWorkouts' 6 detectors synthesize across mood, fasting, nutrition, time-of-day, volume-mood, sleep — a holistic substrate Fitbod cannot fetch.
- **No voice commands**: Fitbod is touch-only. MyWorkouts has 20-phrase voice parser (src/voice.ts).
- **No social/crew privacy model**: Fitbod has no social layer. MyWorkouts has opt-in privacy-filtered social that matches Fitbod's no-cloud-sharing default but adds upside.

## Logo
`../../assets/logos/fitbod.png` — Apple iTunes App Store artwork, 512x512 rendered.

## Logo Source
- URL: `https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/62/33/eb/6233ebf3-e076-a55a-112e-98cb8e26d9f0/AppIcon-0-0-1x_U007ephone-0-1-0-85-220-0.png/512x512bb.jpg`
- License: Apple App Store artwork, used for identification/commentary.

## Sources
- https://fitbod.me/
- https://www.crunchbase.com/organization/fitbod
- https://apps.apple.com/us/app/fitbod-workout-fitness-plans/id1038986299
- https://techcrunch.com/2019/... (early Fitbod profile)
