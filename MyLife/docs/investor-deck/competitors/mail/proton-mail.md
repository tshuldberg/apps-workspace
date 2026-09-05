# Proton Mail — Deep Dive (vs MyMail)

**Module:** mail
**Tier:** direct (encrypted email category leader)
**Founded:** 2014
**HQ:** Geneva, Switzerland
**Status:** private (Proton AG, owned by non-profit Proton Foundation since 2024)

## One-line
The largest end-to-end encrypted email provider in the world, now a non-profit-owned suite (Mail, VPN, Drive, Calendar, Pass) with 100M+ users.

## Product
- E2E encrypted email (OpenPGP) with web, iOS, Android, desktop apps
- Proton suite cross-sell: VPN, Drive, Calendar, Pass, Wallet
- Custom domains, 500+ aliases (via Pass), anti-phishing, post-quantum encryption (2024)
- Pricing: free 500MB; Mail Plus €3.99/mo; Proton Unlimited €9.99/mo
- Platforms: Web, iOS, Android, macOS, Windows, Linux

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | ~$64M | N/D | N/D | GetLatka (585-person team data) |
| 2024 | ~$97.5M | N/D | N/D | GetLatka (468-person team data) |
| 2025 | N/D | N/D | N/D | — |

**Revenue mix:** subscriptions ~95% (Mail Plus, Unlimited, business plans), donations/lifetime fundraisers ~5% ($927k from 2024 fundraiser).
**Profit / burn:** profitable (self-sustaining per founder Andy Yen statements).
**Runway:** N/A (Proton Foundation non-profit now distributes 1% of revenue to charity).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Crowdfunding | 2014 | ~$500k | crowd | N/A | launch campaign |
| Seed | 2015 | $2M | Charles River Ventures | N/D | only major VC round |
| Grant | — | — | FONGIT + European Commission | — | subsidies, non-dilutive |
| Foundation conversion | 2024 | — | Proton Foundation (non-profit) | N/A | Foundation becomes principal shareholder of Proton AG |

Notes: Founders Andy Yen (CEO), Jason Stockman, Wei Sun. Post-2024: Proton Foundation (Swiss non-profit) holds controlling stake in Proton AG. 1% of revenue donated to privacy causes. Founders retain minority economic interest via AG, governance via Foundation.
Sources: Wikipedia, TechCrunch, Proton blog, Safety Detectives.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2014 | Crowdfunding | ~$550K | Indiegogo crowd | — | — | Indiegogo |
| 2015 | Seed | $2M | Charles River Ventures (CRV) | FONGIT, European Commission grants | N/D | TechCrunch |
| 2017-2023 | Grants | undisclosed | European Commission, FONGIT | — | — | Proton blog |
| 2024 | Foundation conversion | — | Proton Foundation (Swiss non-profit) | — | N/A | Proton Foundation |

Total raised: ~$2.5M equity + crowdfunding + grants
Current stage: Controlled by Proton Foundation (non-profit); Proton AG operates commercially

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2014 | Founded at CERN by Andy Yen, Jason Stockman, Wei Sun | post-Snowden privacy-email thesis |
| 2014 | Indiegogo crowdfunded ~$550K | community validation |
| 2015 | Public launch + $2M CRV seed | VC validation |
| 2016 | iOS + Android apps | mobile expansion |
| 2017 | ProtonVPN launched | platform expansion |
| 2020 | Proton Drive beta | Google-Drive alternative |
| 2022 | Proton Calendar, Pass, Wallet added | privacy-first bundle |
| 2024 | Proton Foundation assumes controlling stake | non-profit governance transition |
| 2026 | 100M+ accounts; estimated $150M+ ARR | privacy-category leader |

## Acquisition / Exit
Independent as of 2026-04, structurally protected by Proton Foundation controlling stake post-2024. Acquisition is highly unlikely given non-profit governance. Proton has publicly rejected IPO and acquisition paths, committing to independence and privacy-mission alignment.

## Users
- 100M+ users (2024)
- ~2-3M paying subscribers est. (from revenue ÷ blended ARPPU)
- Geography: Europe + privacy-conscious US/CA
- Conversion free→paid: ~2-3%

## How they make money (precise)
1. **Mail Plus** (€3.99/mo): individual premium Mail only.
2. **Proton Unlimited** (€9.99/mo): bundle of Mail + VPN + Drive + Pass + Calendar. Largest revenue share.
3. **Proton for Business** (starts $7/user/mo): B2B plans, custom domains, admin console.
4. **Lifetime fundraiser** (annual): raises ~$1M/yr of working capital.

## Wedge MyLife can exploit
- **Proton still hosts your mail server-side.** E2E encrypted but Proton infrastructure is the endpoint. MyMail is IMAP-only: user brings their own server, MyMail just stores metadata in local SQLite.
- **No life-suite integration.** Proton has Mail + VPN + Drive + Pass + Calendar — all productivity/identity. MyLife bundles mail alongside journal, mood, habits, meds, budget (life domain), not privacy tools.
- **Requires Proton account.** MyMail has no server dependency on our side — a user could run a personal Dovecot and connect MyMail without ever talking to MyLife servers.
- **Cross-module mail actions.** MyMail's automations engine can trigger MyHabits completions or MyMood entries; Proton's mail is inert outside its own ecosystem.
- **Price.** €120/yr Proton Unlimited vs $99/yr MyLife suite.

## Logo
`../../assets/logos/proton-mail.png` — JPEG (file has .png extension), 512x512, from iTunes CDN.

## Logo Source
URL: https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/37/e7/f1/37e7f143-628c-22fe-1c86-c97df05dfcf4/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/512x512bb.jpg
License: Apple App Store CDN; trademark Proton AG.

## Sources
- [Proton Mail Wikipedia](https://en.wikipedia.org/wiki/Proton_Mail)
- [Proton AG Wikipedia](https://en.wikipedia.org/wiki/Proton_AG)
- [TechCrunch — Proton to non-profit](https://techcrunch.com/2024/06/17/privacy-app-maker-proton-transitions-to-non-profit-foundation-structure/)
- [GetLatka — Proton $97.5M revenue](https://getlatka.com/companies/protonmail)
- [Proton 2024 lifetime fundraiser results](https://proton.me/blog/2024-lifetime-fundraiser-results)
