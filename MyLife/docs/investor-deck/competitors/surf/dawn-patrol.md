# Dawn Patrol — Deep Dive (vs MySurf)

**Module:** surf
**Tier:** direct
**Founded:** 2014
**HQ:** San Diego, California, USA
**Status:** private (indie)

## One-line
Apple Watch-native surf session tracker that auto-detects waves, speed, and paddle strokes — a cautionary tale of a great-product, single-device bet in a category where the big money sits in forecasts, not telemetry.

## Product
- Apple Watch paddle and wave detection (accelerometer + GPS)
- Session summary: waves caught, top speed, distance paddled, calories
- Surfline cam integration to attach a clip to a wave
- Heatmaps per spot (private, personal)
- Platforms: iOS + Apple Watch (required), watchOS-first
- Pricing: Free (limited) / Premium $1.99/mo or $14.99/yr
- Distinguishing UX choice: the watch is the sensor, the phone is the viewer

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | ~$150-400K est. | N/D | N/D | Indie surf app category range |
| 2024 | ~$200-500K est. | N/D | N/D | App Store traces, <$500K baseline |
| 2025 | ~$250-600K est. | N/D | N/D | competitor-financials baseline <$500K |

**Revenue mix:** subscriptions ~95%, ~5% from Apple Watch face packs or one-time IAP.
**Profit / burn:** lifestyle-business profitable; ~6-person team per company statements.
**Runway:** N/A (bootstrapped).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Self-funded | 2014 | founder savings | — | — | David Fishman + team founders |
| No disclosed VC | ongoing | N/A | N/A | N/A | Indie co, no institutional rounds |

Founders: David Fishman (founder/CEO). Core team <10. No major institutional holders.
Sources: Crunchbase (sparse), company site, App Store developer listings.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2014 | Self-funded | founder savings | — | — | — | Crunchbase |
| — | — | $0 VC | — | — | — | Bootstrap |

Total raised: $0 outside capital disclosed
Current stage: Bootstrapped indie (David Fishman-controlled)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2014 | David Fishman founded Dawn Patrol in San Diego | Apple Watch-first thesis |
| 2015 | Apple Watch launched; Dawn Patrol among launch surf apps | category first-mover on wearables |
| 2018 | Surfline cam integration shipped | differentiated clip-to-wave feature |
| 2022 | Apple Watch Ultra endorsement in surf reviews | niche category validation |
| 2024 | ~$200-500K revenue est.; lifestyle-profitable | sub-$500K indie |
| 2026 | Still indie; ~6-person team | stable lifestyle business |

## Acquisition / Exit
Independent as of 2026-04. Most recent round: never raised. No public acquisition talks. David Fishman operates as indie founder-CEO; team <10. Apple Watch-only TAM limits strategic acquirer interest.

## Users
- MAU: N/D (est. 20-50K based on Apple Watch-only constraint)
- DAU: N/D
- Geography: California, East Coast US, Australia
- Conversion rate: est. 8-12% of Apple Watch owners who install convert to paid

## How they make money (precise)
1. **Premium subscription** ($1.99/mo or $14.99/yr): unlocks unlimited sessions, cam integration, advanced stats.
2. Occasional one-time Watch face + theme packs.
3. No ads, no data sold.

Unit economics: tiny team, App Store distribution, >80% est. gross margin. Limited TAM because Apple Watch is required.

## Wedge MyLife can exploit
- **Apple Watch lock-in**: Dawn Patrol requires a Watch. MySurf runs on any iPhone/Android + web, with its own GPS wave detection (src/utils/waves.ts) that doesn't require a watch.
- **No forecast**: Dawn Patrol is post-session only. Users still need Surfline/Windy to decide when to surf. MySurf merges forecast + rating + session log.
- **Narrow TAM**: Watch-native limits growth. MyLife's suite economics let surf be a leading-indicator module that pulls users into 29 other modules.
- **Cross-module**: no link from Dawn Patrol to budget (gas to beach), calendar, workouts. MySurf is already cross-wired to MyTrails and hub_places.

## Logo
`../../assets/logos/dawn-patrol.png` — Apple iTunes App Store artwork, 512x512 rendered.

## Logo Source
- URL: `https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/d6/d1/28/d6d128d3-841c-fa24-14b0-73431cc39951/Dawn_Patrol_App_Icon-0-0-1x_U007ephone-0-1-0-sRGB-85-220.png/512x512bb.jpg`
- License: Apple App Store artwork, used for identification/commentary.

## Sources
- https://dawnpatrol.co/
- https://apps.apple.com/us/app/dawn-patrol-surf-wave-tracker/id1122095040
- https://www.crunchbase.com/organization/dawn-patrol
- https://www.theinertia.com/surf/dawn-patrol-apple-watch-surf-tracker/ (editorial context)
