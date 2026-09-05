# TripIt — Deep Dive (vs MyTravel)

**Module:** travel
**Tier:** direct
**Founded:** 2006
**HQ:** San Francisco, California, USA
**Status:** acquired (Concur / SAP, 2011); acquired again indirectly when SAP carved out Concur 2025

## One-line
The email-forwarding travel itinerary aggregator — forward a booking confirmation and TripIt assembles the trip, monetized via TripIt Pro ($49/yr) and massive SAP Concur corporate-travel bundling.

## Product
- Email parsing: forward booking.com/United/Airbnb confirmation to plans@tripit.com, an itinerary appears
- Unified trip view (flights, hotels, cars, activities)
- Pro: real-time flight alerts, point tracker, alternate flights, refund monitor, seat tracker
- Calendar sync (Google, Apple, Outlook)
- Platforms: iOS, Android, Web
- Pricing: Free / Pro $49/yr
- Distinguishing UX choice: zero-entry itinerary building via email forwarding — the parser is the product

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | N/D (bundled in SAP Concur) | N/D | N/A | SAP 10-K bundles Concur |
| 2024 | N/D (bundled) | N/D | N/A | SAP reports |
| 2025 | N/D (bundled) | N/D | N/A | SAP Concur restructuring |

**Revenue mix:** TripIt Pro subscriptions direct-to-consumer; large share indirectly via SAP Concur enterprise travel licensing. No clean public split.
**Profit / burn:** N/D; Concur bundling obscures economics.
**Runway:** N/A (SAP subsidiary).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Series A-C | 2006-2010 | ~$13M | Sabre, SNFC, OVP Venture Partners | N/D | Scott Hintz + Gregg Brockway founders |
| Acquisition | Jan 2011 | $120M | Concur Technologies | — | Standalone product under Concur |
| Parent acquisition | Dec 2014 | $8.3B | SAP acquires Concur | — | TripIt becomes SAP property |
| Concur structural review | 2024-2025 | — | SAP | — | Concur restructuring ongoing |

Founders: Scott Hintz, Gregg Brockway, Andy Denmark (all exited). Owner: SAP Concur.
Sources: TechCrunch 2011 acquisition, Wall Street Journal 2014 SAP/Concur deal, Crunchbase.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2007 | Series A | $5.1M | Sabre Holdings | O'Reilly AlphaTech | N/D | Crunchbase |
| 2008 | Series B | $5.1M | SNCF (French rail) | Sabre | N/D | Crunchbase |
| 2010 | Series C | $3M | OVP Venture Partners | — | N/D | Crunchbase |
| 2011 | Acquisition | $120M | Concur Technologies | — | N/A | TechCrunch |
| 2014 | Parent acq | $8.3B | SAP acquires Concur | — | N/A | WSJ |

Total raised: ~$13M pre-acquisition
Current stage: Subsidiary of SAP Concur (since 2011, via SAP 2014)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2006 | Scott Hintz, Gregg Brockway, Andy Denmark founded TripIt in SF | email-parsing itinerary thesis |
| 2007 | Sabre Series A | travel-industry capital |
| 2010 | Crossed 2M users | consumer traction |
| 2011 | Concur acquires TripIt for $120M (Jan 2011) | first exit |
| 2014 | SAP acquires Concur for $8.3B (Dec 2014) | second exit (indirect) |
| 2020 | Pandemic travel collapse; Pro subs declined | category shock |
| 2024-2025 | SAP Concur restructuring; product dev pace slows | stagnation signal |

## Acquisition / Exit
**Acquired by:** Concur Technologies (Jan 2011 for $120M); Concur subsequently acquired by SAP (Dec 2014 for $8.3B).
**Date:** January 2011 (primary); December 2014 (parent acquisition).
**Price:** $120M direct; indirect value inside $8.3B SAP/Concur deal.
**Current status inside parent:** TripIt operates as standalone consumer product under SAP Concur; largely frozen product roadmap; enterprise/SAP travel bundles drive revenue.
**Strategic rationale:** Concur needed a consumer itinerary tool to extend its corporate-travel spend-management suite; SAP needed Concur for enterprise T&E.
**Founder outcome:** Scott Hintz, Gregg Brockway, Andy Denmark all departed within 2-3 years post-Concur acquisition.

## Users
- Registered: ~20M est. cumulative (company historical)
- MAU: N/D; est. 1-2M active
- DAU: N/D
- Geography: US-heavy, business traveler skew
- Conversion rate: N/D; TripIt Pro is small minority

## How they make money (precise)
1. **TripIt Pro** ($49/yr): flight alerts, point tracker, alternate flights.
2. **SAP Concur enterprise bundle**: TripIt seat is often bundled into corporate travel licenses.
3. Historical affiliate links to OTAs (Priceline, Expedia) have been scaled back post-SAP integration.

Unit economics: parser ingestion scales cheaply; margin on Pro est. >80% after SAP infrastructure allocation.

## Wedge MyLife can exploit
- **Stagnant product**: TripIt's UX hasn't meaningfully evolved since 2015. MyTravel has a 487-test engineering substrate and active Mission Control roadmap.
- **Enterprise tilt**: TripIt prioritizes SAP Concur enterprise use cases; consumer product gets fractional attention. MyTravel is consumer-first, privacy-first.
- **Email-parsing exposure**: TripIt reads your inbox (or forwards) — privacy trade is real. MyTravel is fully manual + local; no inbox access required.
- **No journal/memory layer**: TripIt is logistics-only. MyTravel unifies trips + destinations + journal + memories + bucket list.
- **Single-category pricing**: $49/yr for logistics vs MyLife $99/yr for 30 modules (travel + surf + trails + journal + 26 more).

## Logo
`../../assets/logos/tripit.png` — Apple iTunes App Store artwork, 512x512 rendered.

## Logo Source
- URL: `https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/42/bf/c7/42bfc7da-f0e5-edbf-9673-d57fe638b572/AppIcon-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/512x512bb.jpg`
- License: Apple App Store artwork, used for identification/commentary.

## Sources
- https://www.tripit.com/pro
- https://techcrunch.com/2011/01/12/concur-acquires-tripit-for-120-million
- https://www.wsj.com/articles/sap-to-buy-concur-for-about-7-3-billion-1409961618
- https://www.crunchbase.com/organization/tripit
