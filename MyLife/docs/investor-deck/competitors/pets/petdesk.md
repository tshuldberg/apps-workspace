# PetDesk — Deep Dive (vs MyPets)

**Module:** pets
**Tier:** adjacent (B2B vet-clinic SaaS with a consumer-app front end)
**Founded:** 2013
**HQ:** San Diego, CA, USA (parent: Petvisor)
**Status:** PE-backed (Apax Digital + Frontier Growth + PeakSpan + management)

## One-line
A consumer pet-reminder app that is actually a distribution layer for B2B vet-clinic SaaS; every "appointment reminder" is a paid message your vet bought through PetDesk's platform.

## Product (consumer-side, the app users see)
- Appointment reminders from your vet (clinic pushes via PetDesk backend)
- Book appointments, prescription refill requests, in-app messaging with your clinic
- Vaccination records delivered by the vet
- Loyalty rewards at participating clinics
- Platforms: iOS, Android
- Pricing: free for pet owners (clinics pay PetDesk monthly SaaS + per-message)
- Distinguishing UX choice: data is authored by the vet, not the pet owner — your records are "correct" because your vet entered them

## Product (B2B-side, what Petvisor actually sells)
- Client retention + appointment reminders (PetDesk core)
- Online booking (Vetstoria, acquired)
- Payments, loyalty, websites, grooming-specific tools (WhiskerCloud, Groomer.io)
- AI front-desk (Kontak)
- Serves 10,000+ veterinary clinics + 400+ grooming facilities serving 20M+ pet parents

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | 3x growth since 2021 (per Apax) | N/D | N/D | Apax press release Nov 2023 |
| 2024 | ~$13.4M (PetDesk standalone) / ~$100M+ est. (Petvisor consolidated) | N/D | N/D | Competitor-financials-2024-2026 baseline + Apax commentary |
| 2025 | N/D (private) | N/D | N/D | — |

**Revenue mix:** B2B SaaS subscriptions (clinic software) ~70% est., per-message/transactional fees ~20%, payments take-rate ~10% est.
**Profit / burn:** N/D; Apax thesis is growth + consolidation.
**Runway:** N/A (PE-backed with $100M+ fresh capital).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Seed / growth | 2013-2020 | small, undisclosed | — | — | Founder Taylor Cavanah |
| Frontier Growth investment | 2021 | undisclosed | Frontier Growth | — | Pet-tech platform thesis |
| PeakSpan + follow-on | 2022 | undisclosed | PeakSpan | — | Tuck-in acquisitions (Vetstoria, Kontak, WhiskerCloud, Groomer.io) |
| Apax Digital lead | Nov 2023 | $100M+ | Apax Digital Funds | N/D | Petvisor umbrella formalized |

Institutional holders: Apax Digital, Frontier Growth, PeakSpan, management rollover. Petvisor is the roll-up vehicle.
Sources: Apax press release (Nov 2023), Petvisor news, Pe Hub.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2013 | Seed | undisclosed | angels | — | — | Crunchbase |
| 2017 | Series A | ~$5M est. | Providence Strategic Growth | — | N/D | PitchBook |
| 2021 | Growth | undisclosed | Frontier Growth | — | N/D | PE Hub |
| 2022 | Growth / tuck-ins | undisclosed | PeakSpan | — | N/D | Petvisor news |
| 2023 | PE recap | $100M+ | Apax Digital | Frontier, PeakSpan, management | N/D | Apax press release |

Total raised: ~$150M+ est. across stages (exact amounts undisclosed)
Current stage: PE-backed (Apax Digital lead); Petvisor umbrella holds 5+ acquired brands

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2013 | Founded in San Diego by Taylor Cavanah and Chris Morris | vet-clinic SaaS bet |
| 2017 | Crossed 1000 clinic customers | B2B traction |
| 2021 | Frontier Growth investment; began M&A strategy | roll-up phase begins |
| 2022 | Acquired Vetstoria (online booking), Groomer.io | product expansion |
| 2023 | Acquired WhiskerCloud + Kontak (AI); Apax recap ($100M+); Petvisor brand formed | category consolidator |
| 2024 | 10,000+ clinics + 400+ grooming facilities; 20M+ pet parents reached | scale milestone |
| 2026 | Continued consolidation under Apax thesis | category leader |

## Acquisition / Exit
- Not acquired as a standalone exit: PetDesk remains operating brand inside Petvisor umbrella (Apax Digital-backed).
- Parent: Petvisor (PE-owned by Apax Digital Funds)
- Status: PE-backed platform executing buy-and-build strategy
- Strategic rationale (Apax): fragmented vet-software market with inflation-resistant demand; opportunity to consolidate 5-10 point solutions into one vet-clinic platform
- Founder outcome: Taylor Cavanah transitioned from CEO of PetDesk to broader Petvisor role

## Users
- Consumer app users: 2M+ (pet parents with at least one PetDesk-connected clinic)
- Geography: mostly US + Canada
- B2B footprint: 10,000+ vet clinics + 400+ grooming facilities
- Conversion rate: N/A (free consumer app, clinics are the paying customer)

## How they make money (precise)
1. **Clinic SaaS subscription** (PetDesk core product): monthly per-practice fee (est. ~$200-600/mo).
2. **Per-message fees** for reminders, confirmations, follow-ups.
3. **Payments take-rate** (PetDesk Payments add-on): card-present + card-not-present transactions with the clinic.
4. **Online booking commissions** (Vetstoria).
5. **AI front-desk subscription** (Kontak).

Unit economics: clinic ACV est. $3-10K/yr across the Petvisor stack; net revenue retention >100% via cross-sell.

## Wedge MyLife can exploit
- **The product is not for the pet owner:** PetDesk exists to sell clinic software. The consumer app is table-stakes. MyPets is owner-first.
- **No vet means no PetDesk value:** if your vet is not a PetDesk customer, you get nothing. MyPets works for every pet on earth without vet participation.
- **No expense/insurance/budget layer:** PetDesk has no ledger for what the pet is costing you. MyPets ships full cost-of-ownership.
- **Not a health diary:** PetDesk shows what your vet uploaded; MyPets is an owner-authored longitudinal health record (medications, weight trends, BCS, feeding logs).
- **Data is vet-owned, not pet-owned:** move vets, lose your PetDesk history. MyPets data is local-first SQLite; you own it forever.

## Logo
`../../assets/logos/petdesk.png` — Apple App Store icon, 512x512, converted PNG.

## Logo Source
- URL: iTunes Search API lookup (id=631377773) artworkUrl512
- License: trademark owner's app-store icon; used for identification in competitor analysis.

## Sources
- https://www.apax.com/news-views/investing-in-petvisor/
- https://petdesk.com/blog/petvisor-investment-apax-digital-funds
- https://petvisor.com/news/petvisor-investment-apax-digital-funds
- https://globalpetindustry.com/news/petvisor-raises-100-million-strategic-investment/
