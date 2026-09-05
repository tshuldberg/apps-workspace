# MyHomes — Module Audit

**ID:** homes | **Prefix:** hm_ | **Tier:** premium | **Storage:** drizzle (local SQLite)
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.3.0
**One-line promise:** Real estate, reimagined

## User Value
- Full property management: maintenance schedules, cost ledger, contractor directory
- Insurance policy tracker with expiry alerts and coverage gap analysis
- Home inventory (rooms + items + appliances) with warranty and condition tracking
- Renovation project tracker with phases, photos, budget vs actual
- Document vault for deeds, warranties, inspections with search and expiration

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Property CRUD + ownership types | src/db/properties.ts | shipped |
| Maintenance schedules + default presets + due logic | src/engines/reminder-engine | shipped |
| Cost tracking (summary, monthly trend, by-schedule) | src/engines/cost-engine | shipped |
| Contractor directory + recommendations by task | src/engines/contractor-engine | shipped |
| Insurance policies (active, expiring, gaps) | src/engines/insurance-engine | shipped |
| Document vault (expiry, search, stats) | src/engines/document-engine | shipped |
| Room + inventory with property value calc | src/engines/inventory-engine | shipped |
| Appliance registry (warranty status, attention) | src/engines/appliance-engine | shipped |
| Project tracker (budget vs actual, phase progress) | src/engines/project-engine | shipped |
| CSV export (inventory) | src/engines/inventory-engine | shipped |
| Home listings + tours (buyer side) | src/db/crud.ts (V1) | shipped |
| Cross-module hook | src/cross-module.ts | shipped |

## Data Model
Prefix `hm_`, schema v3. 16 tables: hm_listings, hm_tours, hm_properties, hm_maintenance_schedules, hm_settings, hm_cost_entries, hm_documents, hm_contractors, hm_contractor_services, hm_insurance_policies, hm_rooms, hm_inventory_items, hm_appliances, hm_projects, hm_project_phases, hm_project_photos. Local SQLite via drizzle.

## Screens / User Flows
Mobile tabs: Home, Properties, Maintenance, Costs, Settings. Stack screens: property-detail/add-property, schedule-detail/add-schedule, cost-list/cost-detail/add-cost, contractor-directory/contractor-detail/add-contractor, insurance-policies/insurance-detail/add-insurance, document-vault/document-detail/add-document, inventory-manager/room-detail/inventory-item-detail/add-inventory-item, appliance-registry/appliance-detail/add-appliance, project-tracker/project-detail/add-project, onboarding (3-step wizard with default schedules). 20 mobile route files, 10 web route files.

## Distinctive / Moat-worthy
- 7 domain engines (reminder, cost, document, contractor, insurance, inventory, appliance, project) — pure functions, 191 passing tests
- Combines HomeZada + Centriq + HomeBinder + Thumbtack-lite into one local-first module
- Auto-seeded maintenance presets personalized by ownership + property type on onboarding

## Gaps vs competitors
- No listing-aggregator data feed (Zillow/Redfin) — scope is owned-home management, not browsing
- No native Matterport/3D scan capture
- Contractor directory is local-only (no booking/marketplace)

## Investor-facing hook
A private, offline-capable HomeZada replacement that turns every homeowner's phone into a deed + warranty + maintenance + renovation command center.
