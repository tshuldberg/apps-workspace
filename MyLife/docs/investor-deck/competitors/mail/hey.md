# HEY — Deep Dive (vs MyMail)

**Module:** mail
**Tier:** direct (opinionated modern email client + hosting)
**Founded:** 2020 (service launch)
**HQ:** Chicago, IL
**Status:** private (division of 37signals LLC; bootstrapped, founder-owned)

## One-line
DHH and Jason Fried's opinionated rewrite of email — Screener, Imbox, Reply Later, paid-only with a distinctive brand that commands a $99/yr premium.

## Product
- Screener (approve senders before they reach you), Imbox + Feed + Paper Trail
- Reply Later stack, Set Aside, threads, focus timers
- Custom domain via HEY for Domains ($99/yr business)
- Recently added calendar + contacts features
- Pricing: $99/yr personal; HEY for Work $12/user/mo; HEY for Domains $99/yr
- Platforms: Web, iOS, Android, macOS, Windows, Linux

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | N/D (part of 37signals $280M cumulative) | N/D | N/D | 37signals public statements |
| 2024 | N/D | N/D | N/D | not broken out |
| 2025 | N/D | N/D | N/D | — |

**Revenue mix:** subscriptions 100% (personal, business, domains tiers). No free tier, no ads, no VC cross-subsidy.
**Profit / burn:** 37signals is highly profitable; HEY division contributes meaningfully but not disclosed separately.
**Runway:** N/A (parent bootstrapped, 25+ years cash-flow positive).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Bootstrap | 1999-present | N/A | Jason Fried + DHH | N/A | 100% founders |
| Jeff Bezos minority investment | 2006 | undisclosed (est. few $M) | Bezos Expeditions | N/D | minority stake, still held |
| External | 2006-2025 | $0 | — | — | no other outside equity |

Notes: Jason Fried (CEO), David Heinemeier Hansson (CTO). Jeff Bezos minority investor since 2006. Founders retain controlling equity. No ESOP disclosed. 37signals also owns Basecamp, ONCE.
Sources: Wikipedia 37signals, Signal vs Noise blog, DHH public writing.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 1999 | Founded | $0 external | Jason Fried + partners | — | — | Signal vs Noise |
| 2006 | Minority investment | undisclosed (est. few $M) | Jeff Bezos (Bezos Expeditions) | — | N/D | DHH writing |
| — | — | $0 other equity | — | — | — | no other outside capital 2006-2026 |

Total raised: $0 venture capital; one minority Bezos check circa 2006
Current stage: 37signals bootstrapped (Jeff Bezos minority stake held since 2006)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 1999 | 37signals founded by Jason Fried + partners in Chicago | web-design consultancy |
| 2004 | Basecamp launched as first SaaS product | product-company pivot |
| 2006 | Jeff Bezos minority investment; DHH creates Ruby on Rails | category-defining OSS + Bezos validation |
| 2014 | Renamed 37signals → Basecamp (company) | product-first branding |
| 2020 Jun | HEY email launched at $99/yr | category re-entry |
| 2022 | Re-renamed company to 37signals (original) | brand restoration |
| 2024 | HEY for Domains + ONCE product line | platform expansion |
| 2026 | HEY estimated ~$30M ARR; 37signals profitable for 25+ years | rare long-run bootstrapped-unicorn case |

## Acquisition / Exit
Independent as of 2026-04. Jeff Bezos minority investment remains unchanged since 2006. DHH and Jason Fried have publicly stated they will never sell 37signals. Most likely acquirer profile if stance changed: Apple, Google Workspace competitor, or a privacy-focused platform (Proton).

## Users
- "Tens of thousands" of HEY customers (37signals public statement, 2023)
- Est. 250k-500k paying (our baseline doc estimate)
- Geography: US + developer/designer community heavy
- Conversion: N/A (paid-only)

## How they make money (precise)
1. **HEY Personal** ($99/yr): primary. High-priced to signal quality, filter out bad actors.
2. **HEY for Work** ($12/user/mo): business teams.
3. **HEY for Domains** ($99/yr): bring your own domain, keep HEY UX.
4. **Basecamp cross-sell**: same billing infrastructure, same customer base.

## Wedge MyLife can exploit
- **HEY still hosts your mail.** HEY runs its own SMTP/IMAP behind its UI; user delegates email to 37signals servers. MyMail is pure IMAP client — user's server stays the user's.
- **Opinionated rigidity.** HEY's Screener + Imbox workflow is polarizing; users who want classic mailboxes bounce. MyMail respects folder structure + threads.
- **No life-suite context.** HEY is solo product; MyMail bundles with journal, mood, habits, meds inside the same SQLite.
- **Pricing.** $99/yr HEY personal = entire MyLife suite price for one app.
- **No V2 features like filters, encryption keys, attachments, calendar events as schema primitives**: HEY hides these behind server-side logic; MyMail exposes them as on-device tables any other module can query.

## Logo
`../../assets/logos/hey.png` — JPEG (file has .png extension), 512x512, from iTunes CDN.

## Logo Source
URL: https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/cc/fd/f9/ccfdf9c2-b58f-b510-0a78-53c9a5435496/AppIcon-0-1x_U007epad-0-11-0-85-220-0.png/512x512bb.jpg
License: Apple App Store CDN; trademark 37signals LLC.

## Sources
- [HEY homepage](https://www.hey.com/)
- [37signals Wikipedia](https://en.wikipedia.org/wiki/37signals)
- [Signal vs Noise — How we acquired HEY.com](https://signalvnoise.com/svn3/how-we-acquired-hey-com/)
- [Data Center Dynamics — 37signals $3M cloud](https://www.datacenterdynamics.com/en/news/37signals-spent-more-than-3-million-on-the-cloud-in-2022-for-basecamp-and-hey/)
- [37signals homepage](https://37signals.com/)
