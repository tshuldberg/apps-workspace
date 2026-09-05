# Fastmail — Deep Dive (vs MyMail)

**Module:** mail
**Tier:** direct (independent pro email host)
**Founded:** 1999
**HQ:** Melbourne, Australia
**Status:** private (independent since 2013 staff buyout from Opera)

## One-line
Oldest independent privacy-oriented email provider, and the driving force behind JMAP — the open protocol MyMail should eventually support to leapfrog IMAP.

## Product
- Full webmail + iOS + Android + IMAP/JMAP access
- Custom domains, 600+ aliases, masked email (via 1Password + Bitwarden integrations)
- Calendar + Contacts + Notes + Files
- JMAP protocol co-developer (with IETF)
- Pricing: Individual $6/mo; Duo $8/mo; Family $14/mo; Business $10/user/mo
- Platforms: Web (primary), iOS, Android, macOS (1st party)

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | N/D (est. $15-20M) | N/D | N/D | inference from user base × ARPPU |
| 2024 | N/D (est. $20-25M) | N/D | N/D | compworth + Cybernews |
| 2025 | ~$3.8M (one source) or $165.9M (Compworth scaled) | N/D | N/D | conflicting sources |

**Revenue mix:** subscriptions ~98% (individual + family + business), JMAP consulting / professional services ~2%.
**Profit / burn:** profitable since at least 2015 per founder statements.
**Runway:** N/A (private, self-funded since 2013).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Founder-funded | 1999 | N/A | Jeremy Howard + team | N/A | original founders |
| Acquired by Opera Software | 2010 | undisclosed | Opera Software ASA | N/A | Norwegian browser co. |
| Staff buyout | 2013 | undisclosed (management-led) | Fastmail leadership | N/A | independence restored |

Notes: Current owners: Fastmail staff + management (post-2013 buyout). No VC, no public markets. ESOP-like broad ownership among key employees. CEO: Ricardo Signes (since 2023). Led by Helen Horstmann-Allen (COO) and Rob Mueller technically.
Sources: Wikipedia, Fastmail company history, Cybernews, LeadIQ.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 1999 | Self-funded | $0 external | Jeremy Howard + team | — | — | company history |
| 2010 | Acquired by Opera Software | undisclosed | Opera Software ASA | — | N/A | press |
| 2013 | Management buyout | undisclosed (est. low 8-figures) | Fastmail leadership | — | N/A | Fastmail blog |

Total raised: $0 external venture capital across 27 years of operation
Current stage: Employee-owned (staff buyout since 2013)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 1999 | Founded by Jeremy Howard + team in Melbourne, Australia | privacy-first email thesis |
| 2004 | JMAP/IMAP protocol leadership | technical credibility |
| 2010 | Acquired by Opera Software | short parent era |
| 2013 | Management-led staff buyout from Opera | independence restored |
| 2017 | JMAP standardized by IETF (RFC 8620) | protocol leadership |
| 2020 | Gmail privacy backlash → Fastmail inbound growth | category tailwind |
| 2023 | Ricardo Signes becomes CEO | leadership transition |
| 2026 | ~500K+ paying subs, profitable, employee-owned | rare 27-year bootstrapped-email survivor |

## Acquisition / Exit
Independent as of 2026-04 (since 2013 buyout). Previously acquired by Opera Software 2010, re-independent 2013. No disclosed current acquisition talks. At current scale and employee ownership, unlikely to sell without strategic premium; potential acquirers include privacy-focused platforms (Proton, DuckDuckGo) or enterprise-collaboration players.

## Users
- N/D total (est. 500k-1M paying)
- Long-standing base of technical users, small businesses
- Geography: AU + US + EU
- Low churn; high ARPPU ($72-168/yr)

## How they make money (precise)
1. **Individual subscription** ($6/mo): primary.
2. **Family plan** ($14/mo for 6 users): strong household channel.
3. **Business plans** ($10/user/mo): small businesses, startups.
4. **Professional services / JMAP consulting**: tiny.

## Wedge MyLife can exploit
- **Server-bound.** Fastmail runs the mail; user's only leverage is exporting IMAP backup. MyMail is IMAP client — user's server independence is the product.
- **No on-device intelligence.** Fastmail has server-side rules but no on-device Pearson correlations with mood/habits. MyMail is designed to feed the same SQLite used by journal/mood modules.
- **JMAP is Fastmail's moat and their lock-in risk.** If MyMail adds JMAP support (currently IMAP-only per code audit — explicit roadmap gap), it can partner with Fastmail servers while still letting IMAP users keep their existing hosts.
- **Single-app subscription vs suite.** $72-168/yr Fastmail individual/family vs $99/yr MyLife suite.
- **No ecosystem pull.** Fastmail mail does nothing for the user's journal, mood, or habits. MyMail's scope includes automations that cross module boundaries.

## Logo
`../../assets/logos/fastmail.png` — JPEG (file has .png extension), 512x512, from iTunes CDN.

## Logo Source
URL: https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/1b/5f/fd/1b5ffdbd-b3ab-ff53-5dc8-a16927ba759e/AppIcon-0-0-1x_U007epad-0-0-0-1-0-0-sRGB-85-220.png/512x512bb.jpg
License: Apple App Store CDN; trademark Fastmail Pty Ltd.

## Sources
- [Fastmail Wikipedia](https://en.wikipedia.org/wiki/Fastmail)
- [Fastmail homepage](https://www.fastmail.com/)
- [Cybernews — Fastmail review](https://cybernews.com/secure-email-providers/fastmail-review/)
- [GitHub — JMAP demo with Fastmail](https://github.com/joelparkerhenderson/demo-fastmail-api-jmap)
- [LeadIQ — Fastmail company overview](https://leadiq.com/c/fastmail/5a1d8e365400005400748b13)
