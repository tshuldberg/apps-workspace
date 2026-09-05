# Mesh Sync Module Policy Matrix

**Related:** `docs/designs/mesh-sync-architecture.md`, `docs/plans/queue/08-mesh-sync-mission-control.md`
**Source of truth for module IDs:** `packages/module-registry/src/constants.ts:4`

Every module in the Meerkat suite gets a default sync scope and a primary-entity conflict strategy. The "Phase" column maps each module to its rollout phase in `docs/plans/queue/08-mesh-sync-mission-control.md`.

Scope legend: `local` = `device_local`, `personal` = `personal_replica`, `shared` = `shared_workspace`, `published` = `published_blob`.

Conflict legend: `lww`, `or_set`, `counter`, `document_crdt`, `manual_review`.

| Module | Default scope | Primary entity | Conflict strategy | Sensitive? | Phase |
|--------|---------------|----------------|-------------------|------------|-------|
| books | personal | `bk_books` (library rows) | lww | No | 5 |
| budget | personal | `bg_transactions` | manual_review | Yes (financial) | 6 |
| car | personal | `cr_vehicles`, maintenance records | lww | No | 5 |
| classes | personal | `cs_assignments`, `cs_grades` | lww | No | 5 |
| closet | personal | `cl_items`, `cl_outfits` | lww | No | 5 |
| create | personal | `ct_projects`, `ct_portfolio_pieces` | document_crdt for descriptions, lww for metadata | No | 5 |
| cycle | personal | `cy_days`, `cy_symptoms` | manual_review | Yes (health, reproductive) | 6 |
| dining | personal | `dn_visits`, `dn_restaurants` | lww; `dn_restaurant_tags` = or_set | No | 5 |
| fast | personal | `ft_fasts` (fasting sessions) | lww | Yes (health) | 6 |
| flash | personal | `fl_decks` rows + `fl_review_counts` counter | document_crdt for card bodies, counter for review stats | No | 5 |
| forums | local | cached thread bodies | lww cache only | No | 5 (cache policy; canonical data in supabase) |
| friends | shared | `fn_people`, `fn_hangouts` | document_crdt for memories, lww for people meta, or_set for tags | No | 5 |
| garden | personal | `gd_plants`, `gd_journal_entries` | document_crdt for journal, lww for plants | No | 5 |
| habits | personal | `hb_habits`, `hb_streak_counters` | counter for streaks, lww for habit meta | Yes (health-adjacent) | 6 |
| health | personal | `hl_vitals`, `hl_documents` | manual_review | Yes (HIPAA-adjacent) | 6 |
| homes | shared | `hm_saved_listings`, notes on listings | document_crdt for notes, or_set for saved set | No | 5 |
| journal | shared (opt-in) | `jn_entries` | document_crdt | No (opt-in per entry) | 5 |
| mail | local | cached headers | lww cache only (canonical on IMAP server) | No | 5 (cache policy; no direct mesh sync of messages) |
| market | local | cached listings | lww cache only (canonical in supabase) | No | 5 |
| meds | personal | `md_medications`, `md_schedules` | manual_review | Yes (health) | 6 |
| mood | personal | `mo_entries` | manual_review (timestamps collide for same day) | Yes (mental health) | 6 |
| notes | shared (per-note opt-in) | `nt_notes` | document_crdt body, or_set tags, lww meta | No | 5 |
| nutrition | personal | `nu_meals`, `nu_foods` | manual_review for meals, lww for food library | Yes (health) | 6 |
| payments | local (cache) | `pay_transactions` (canonical in BaaS), user annotations = personal | manual_review for annotations | Yes (financial, regulatory) | 6 |
| pets | shared | `pt_pets`, `pt_vet_visits` | lww for records, document_crdt for notes | No (but household-shared) | 5 |
| presence | personal | `pr_sessions` (maxScope: personal_replica), `pr_intentions` + `pr_summaries` (shareable) | lww for sessions, counter for totals | Yes (digital wellness) | 5 (intentions/summaries shareable); 6 (sessions stay personal) |
| recipes | personal for kitchen, shared for explicit social/cache records | `rc_recipes`; `rc_shopping_lists` can reach shared, while `rc_pantry_items`, `rc_pantry_batches`, `rc_receipt_imports`, `rc_food_products`, and `rc_nutrition_data` are capped at personal | document_crdt for recipes, or_set for tags, lww for pantry/product metadata | No, but pantry, receipts, and source images are private kitchen data | 5 |
| rsvp | shared | `rv_events`, `rv_guests` | or_set for guest list, document_crdt for event description, lww for meta | No | 5 |
| shop | personal | `sh_wishlist`, `sh_purchases` | lww; `sh_wishlist` = or_set (shared wishlist later) | No | 5 |
| sleep | personal | `sl_entries`, `sl_dreams` | manual_review for sleep log, document_crdt for dreams | Yes (health) | 6 |
| sports | personal | `sp_bets` (maxScope: personal_replica), `sp_participation_sessions`, `sp_attendance` | lww for records, or_set for followed teams, counter for streaks | No (but `sp_bets` = financial-ish, capped via maxScope) | 5 (bets capped at personal via maxScope; shared attendance Phase 6) |
| stars | personal | `st_profiles`, birth charts | lww | No | 5 |
| subs | personal | `sb_subscriptions` | lww | Yes (financial) | 6 |
| surf | personal | cached spots, `sf_sessions` | lww for sessions, cache for forecasts | No | 5 |
| trails | shared | `tr_trails`, `tr_recordings` | lww for meta, document_crdt for notes, published for GPX blobs | No | 5 |
| travel | shared | `tv_trips`, `tv_destinations` | document_crdt for journal, or_set for travelers, lww for meta | No | 5 |
| voice | personal | `vc_transcriptions` | lww | No | 5 |
| words | personal | `wd_saved_words` | lww + or_set for tags | No | 5 |
| workouts | personal | workout history, form recordings | lww for sessions, counter for totals, published for form-video blobs | Yes (health) | 6 |

## Notes

- `forums`, `market`, `mail` have `storageType: 'supabase'` (constants.ts:641, :781, :821) or server-canonical equivalents. They keep `defaultScope: 'device_local'` for cached data; canonical rows never travel the mesh. The `SyncEngine` enforces this: any non-device-local change for a supabase/drizzle module is rejected at the `ChangeTracker` write path (architecture doc Section 15).
- `mail` is a special case: canonical data lives on the user's IMAP server, not in any MyLife storage backend. Treated identically to supabase modules (device-local cache only).
- `homes`, `surf` require network (constants.ts:408, :355) and network-owned data (listings, forecasts). Their mesh payload is user-authored metadata only (saved sets, notes, sessions).
- `payments` has `storageType: 'supabase'` (constants.ts:926). Main transaction table is `device_local` (canonical ledger stays with BaaS). User-authored annotations and receipts are `personal_replica` and sync via mesh.
- `fast` is in `HEALTH_DATA_MODULE_IDS` (constants.ts:64) and is assigned to Phase 6. It was previously listed as Phase 5 in error.
- `presence` entities are split: `pr_sessions` has `maxScope: 'personal_replica'` (screen time is personal); `pr_intentions` and `pr_summaries` are shareable in Phase 5 (family "how much screen time" use case).
- `sports.sp_bets` has `maxScope: 'personal_replica'` even though the sports module is shareable. This uses the per-entity `maxScope` field in `ModuleEntitySyncRule` rather than the coarse module-level `shareable` flag.
- BestChef splits private kitchen data from the public product cache. Local `rc_food_products`, `rc_food_product_aliases`, `rc_food_confirmations`, `rc_nutrition_data`, `rc_pantry_items`, `rc_pantry_batches`, `rc_receipt_imports`, and `rc_receipt_import_lines` are capped at `personal_replica`; receipt import sync strips raw OCR/photo URI and receipt line candidate JSON. Server `bc_product_records`, aliases, nutrition, contributions, and evidence publish only sanitized product metadata after explicit contribution opt-in, license/attribution capture, image consent, and moderation approval.
- Sensitive modules (`HEALTH_DATA_MODULE_IDS` in constants.ts:64) land in Phase 6. Sharing these requires the consent UX and legal review that ships with that phase.
- Modules without `tablePrefix` in constants.ts (`surf`, `workouts`, `homes`) use module-scoped table names defined inside `modules/<name>/src/`.
- Every module with `manual_review` conflict strategy must register a `resolverComponent` in its `ModuleEntitySyncRule`. This is validated by `check:module-parity`.
