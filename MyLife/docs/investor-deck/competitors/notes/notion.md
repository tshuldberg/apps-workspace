# Notion — Deep Dive (vs MyNotes)

**Module:** notes
**Tier:** direct (all-in-one workspace, notes-adjacent)
**Founded:** 2013 (relaunch 2016)
**HQ:** San Francisco, USA
**Status:** private (late-stage, IPO rumored 2026)

## One-line
The all-in-one workspace that replaced docs + wiki + database for millions of knowledge workers; increasingly an AI agent platform chasing Microsoft Copilot.

## Product
- Block-based docs with nested pages, databases, wikis, kanban, timeline, calendar views
- Notion AI (rewrite, summarize, translate, Q&A across workspace)
- Notion Agent (autonomous multi-step workflows, launched 2025)
- Templates gallery, API, integrations (Slack, Jira, Figma), web clipper
- Platforms: Web (primary), macOS, Windows, iOS, Android
- Pricing: Free / Plus $10/mo / Business $15/user/mo / Enterprise custom; Notion AI $10/user/mo add-on
- Distinguishing UX choice: the universal block primitive — any element is a page, every page is a database row

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | ~$250M ARR est. | ~$250M | $10B (2021 round) | Sacra, CB Insights |
| 2024 | ~$400M ARR | ~$400M | $10B (carried) | Sacra, SaaStr |
| 2025 | ~$500M-$600M ARR | $500M+ (Sep 2025 CNBC) | $11B (Dec 2025 employee tender) | CNBC, SaaStr |

**Revenue mix:** subscriptions ~90%, AI add-on ~10% (growing). No ads, no licensing.
**Profit / burn:** unprofitable; actively investing in AI infrastructure.
**Runway:** deep — raised $418M cumulative, minimal burn relative to ARR.

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Seed | 2015 | ~$2M | First Round | ~$10M | Ivan Zhao + Simon Last |
| Series A | 2019 | $10M | First Round | ~$800M | Accidental unicorn pricing |
| Series B | 2020 | $50M | Index Ventures, Sequoia | $2B | |
| Series C | 2021 | $275M | Coatue, Sequoia, Index | $10B | |
| Employee tender | Dec 2025 | secondary | — | $11B | Valuation reset post-AI growth |

Founders Ivan Zhao (CEO) + Simon Last retain significant stakes; Coatue, Index, Sequoia largest institutional holders.
Sources: Crunchbase, Sacra, PitchBook, CNBC.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2015 | Seed | ~$2M | First Round | Elad Gil, angels | ~$10M | Crunchbase |
| 2019 | Series A | $10M | First Round | Index Ventures | ~$800M | TechCrunch |
| 2020 | Series B | $50M | Index Ventures, Sequoia | — | $2B | Bloomberg |
| 2021 | Series C | $275M | Coatue, Sequoia, Index | — | $10B | Forbes |
| 2025 | Employee tender (secondary) | undisclosed | — | — | $11B | CNBC |

Total raised: ~$343M primary (plus secondary rounds)
Current stage: Late-stage private; IPO rumored for 2026/2027

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2013 | Founded by Ivan Zhao and Simon Last in San Francisco | original vision: programming for non-programmers |
| 2015 | Near-death rewrite; founders relocated to Kyoto to save money | survival moment |
| 2018 | Relaunch with database blocks; viral adoption in productivity community | product-market fit |
| 2019 | Accidental unicorn: $800M Series A | viral PLG validated |
| 2020 | Series B at $2B; crossed 4M users | remote-work tailwind |
| 2021 | Series C at $10B; 20M+ users | category leader |
| 2023 | Notion AI launched | AI pivot begins |
| 2025 | Crossed $500M ARR (Sep 2025); Notion Agent launched | AI monetization inflects |
| 2026 | ~$600M+ ARR, 100M users, $11B tender valuation | IPO candidate |

## Acquisition / Exit
Independent as of 2026-04. Most recent round: Dec 2025 employee tender at $11B. IPO widely rumored for 2026-2027 per CNBC / Bloomberg. No acquisition talks disclosed; Ivan Zhao has publicly framed the company as a long-term independent bet against Microsoft / Google.

## Users
- Registered: 100M+ (2025)
- Paying customers: 4M+ (GetLatka, 2025)
- MAU: N/D (product-led growth, strong enterprise adoption)
- Geography: US ~40%, Europe ~30%, APAC ~20%, rest ~10%
- Conversion rate: ~4% registered-to-paid est.

## How they make money (precise)
1. **Plus/Business/Enterprise seats** ($10-25+/user/mo): ACV scales with team size; net-revenue-retention >120% est.
2. **Notion AI** ($10/user/mo): seat-level add-on driving ~10-15% of new ARR per 2025 earnings color.
3. **API + integration marketplace**: no direct monetization; drives stickiness.

Unit economics: gross margin ~80% (standard SaaS), CAC paid back <12 mo from team expansion.

## Wedge MyLife can exploit
- **Cloud-only, no offline-first:** every Notion doc requires their servers. MyNotes is local-first SQLite with FTS5 and works offline indefinitely.
- **Seat-based pricing:** Notion bills per collaborator. MyLife is a flat suite subscription with no per-seat taxation.
- **Privacy concern:** Notion trains AI on workspace content (opt-out). MyNotes runs AI on-device (extractive summarization, grammar) with zero network.
- **Consumer wedge:** Notion's consumer tier is a feeder for teams. MyNotes is a consumer app first — no signup, no workspace creation, just open and write.
- **No ePub/OCR/canvas parity:** MyNotes has a true infinite canvas (Obsidian-class), OCR-searchable attachments, and a full knowledge-graph engine.

## Logo
`../../assets/logos/notion.png` — reused from B1 (Create module). Wikimedia Commons SVG rendered PNG.

## Logo Source
- URL: Wikimedia Commons — Notion_app_logo.png (reused from create/notion.md by B1)
- License: PD-textlogo / trademark owner retains rights; used for identification.

## Sources
- https://www.cnbc.com/2025/09/18/notion-launches-ai-agent-as-it-crosses-500-million-in-annual-revenue.html
- https://sacra.com/c/notion/
- https://www.saastr.com/notion-and-growing-into-your-10b-valuation-a-masterclass-in-patience/
- https://www.crunchbase.com/organization/notion-labs
