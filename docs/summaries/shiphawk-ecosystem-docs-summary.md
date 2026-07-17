# ShipHawk Ecosystem Documentation Summary

> Summary of all docs in SH/automation-hub/docs/ and shiphawk-templates/docs/
> Generated: 2026-02-08

## Overview

The ShipHawk ecosystem within the /Apps workspace consists of two independent projects that both serve the ShipHawk shipping platform (shiphawk-dev, which is out of scope by default). **Automation Hub** (`SH/automation-hub/`) is a standalone automation workspace that consolidates communication channels (email, calendar, reminders, texts, voice memos) into a unified task stream with AI-powered triage, due-date planning, and response draft generation. It is provider-agnostic, supporting both GPT and Claude agent runtimes, and enforces approval gates on all write/send actions. **ShipHawk Templates** (`shiphawk-templates/`) is a document-as-code system providing Liquid-templated HTML packing slips, pick tickets, and JSON-based carton/pallet label configurations for 20+ shipping customers.

These two projects are architecturally independent but conceptually linked: automation-hub aims to streamline operational workflows around the ShipHawk platform (email triage, schedule planning, drift detection), while shiphawk-templates provides the customer-facing document generation infrastructure that ShipHawk's PDF renderer and label printer systems consume. Both projects share a design philosophy of canonical data models, adapter-based architecture, and separation from the main shiphawk-dev codebase.

The documentation across both projects is substantial. Automation-hub has a full requirements document with phased implementation backlog, a channel integration matrix, and a deep analysis of ShipHawk's filtering architecture. Shiphawk-templates has a comprehensive variable reference (84 canonical fields), a visual pattern matching guide, a step-by-step template creation workflow, a customer requirements document format (CRD), and five detailed repository reorganization and feature plans.

## Automation Hub (SH/automation-hub/docs/)

### Channel Matrix

**File:** `SH/automation-hub/docs/channel_matrix.md`

The Channel Matrix defines how to consolidate six communication channels into one automation stream. It covers Email (Gmail/Outlook), Calendar (Google/Outlook), Apple Reminders, text messages (to self and from others), and Superwhisper voice memos/transcripts. Each channel has a defined integration path:

- **Email and Calendar** are ready now via native connector tools or MCP server wrappers.
- **Apple Reminders** uses a local bridge MCP via EventKit/Shortcuts.
- **Text messages** use a Zapier bridge app or local Messages bridge MCP, with approval gating required for outbound messages.
- **Superwhisper** uses a file-drop watcher and transcript ingestion MCP.
- **ShipHawk context** is read-only workspace context for task grounding.

The document defines five recommended adapters (`adapter_email`, `adapter_calendar`, `adapter_reminders_apple`, `adapter_messages_bridge`, `adapter_superwhisper_ingest`) and specifies a canonical event data contract with fields: `event_id`, `channel`, `source_reference`, `timestamp`, `actor`, `raw_text`, `entities`, `proposed_actions`, and `confidence`. All events normalize into `schemas/canonical_task.schema.json`.

Key operational rules: every write action requires human approval, every outbound message draft is stored before send, deduplication uses `source_reference` plus semantic fingerprint, and sync cursors are maintained per channel in `state/`.

### Requirements

**File:** `SH/automation-hub/docs/requirements_automation_hub.md`

This is the most comprehensive document in the automation-hub, serving as a full functional and non-functional requirements specification (620 lines) intended for engineering, product, operations, and security review.

**Background and Goals:** The system addresses pain points of disconnected communication channels, manual task creation, due dates set without calendar context, and ad-hoc response drafting. Success metrics include triage coverage (% classified above confidence threshold), task proposal rate, due-date accuracy, draft reuse rate, approval SLA, and duplicate suppression rate.

**Functional Requirements (10 groups, 40+ requirements):**

1. **Channel Ingestion (FR-001 to FR-006):** Ingest email, calendar, reminders, messages, and Superwhisper transcripts; normalize all into a common event schema with stable event IDs, source references, timestamps, actors, and confidence scores.

2. **Email Triage (FR-010 to FR-014):** Classify emails into categories (task, question, FYI, noise), extract entities (account, project, dates, owners, urgency), generate task candidates with confidence scoring, route low-confidence items to review queue, and deduplicate across repeated threads.

3. **Calendar-Aware Due-Date Planning (FR-020 to FR-023):** Propose due dates based on urgency, dependencies, and calendar free/busy data; annotate rationale; flag conflicts and overloaded dates; allow human override with audit log.

4. **PM/Gantt Reconciliation (FR-030 to FR-033):** Read PM schedule via MCP interface, detect schedule drift (late predecessors, blocked successors), generate remediation suggestions, and draft stakeholder update responses.

5. **Unified Communication Consolidation (FR-040 to FR-043):** Merge channel events into one timeline per work context, support grouping by project/account/topic, expose consolidated "action inbox" per run.

6. **Response Draft Generation (FR-050 to FR-053):** Draft responses with tone/policy templates, block outbound send without approval, track draft revisions with before/after versions.

7. **Voice-First Workflow (FR-060 to FR-062):** Ingest Superwhisper transcripts, classify into task candidate / response draft idea / archive note, preserve transcript source references.

8. **Filter and Retrieval (FR-070 to FR-074):** Support canonical filter JSON with operators (exact, set, range, contains, starts/ends), adapter interface for OpenSearch and SQL backends, saved-view payload versioning.

9. **Scheduling (FR-080 to FR-083):** Recurring jobs, dry-run and write-enabled modes, persisted run artifacts, actionable error context on failure.

10. **Security and Audit (FR-090 to FR-093):** Policy-gated approval for all writes, no cleartext secret logging, configurable sensitive payload handling, audit records with who/what/when.

**Non-Functional Requirements:** Reliability (safe recovery after interruption), idempotency (no duplicate outputs), performance (95% of ingest+triage under 5 minutes, sub-second retrieval on indexed fields), observability, maintainability, and portability across model providers.

**Phased Implementation (12 weeks total):**
- Phase 0: Foundation and Controls (1 week)
- Phase 1: Production-Grade Email Triage (2 weeks)
- Phase 2: Calendar-Aware Due-Date Planner (2 weeks)
- Phase 3: PM/Gantt Drift Automation (2 weeks)
- Phase 4: Unified Channels + Voice Workflow (3 weeks)
- Phase 5: Fast Filter Framework (2 weeks)
- Phase 6: Hardening, QA, and Rollout (2 weeks)

**Milestone Gates:** Gate A (end Phase 1) = reliable email-to-task pipeline; Gate B (end Phase 3) = schedule-aware planning + PM drift; Gate C (end Phase 4) = channel consolidation with voice; Gate D (end Phase 6) = production-ready candidate.

**Appendix A (Canonical Filter Spec):** Provides the full JSON schema for filters, including the canonical filter object structure (`version`, `entity`, `match`, `filters[]`, `sort[]`, `limit`, `offset`), 12 allowed operators (`eq`, `not_eq`, `one_of`, `not_one_of`, `contains`, `not_contains`, `starts_with`, `ends_with`, `range`, `gt`, `gte`, `lt`, `lte`), four field policy classes (`exact_only`, `range_capable`, `text_flexible`, `high_cost_text`), validation rules, backend translation contracts for OpenSearch and SQL adapters, and saved view payload rules.

### Filter Findings

**File:** `SH/automation-hub/docs/shiphawk_filters_findings.md`

A deep technical analysis of how filtering works across the ShipHawk platform today, covering five distinct filtering surfaces:

1. **API v4 + Web (Orders/Shipments):** Primary route through Elasticsearch/OpenSearch with SQL fallback when search health is red. Two filter engines: legacy `FilterQueryBuilder` and modular filter engine (`match` + `filters[]`). Warehouse scoping is auto-injected. Search text spans orders, addresses, line items, refs, and shipments.

2. **Workstation (WS):** Separate, intentionally narrow search path optimized for operational lookup by order number, LPN, or tote. Filters to active in-process statuses, then applies post-filters for unprocessed shipments and remaining pickable quantity.

3. **Admin (ActiveAdmin + Ransack):** Independent of API elastic queries. Uses Ransack scopes with custom searchable scopes. Notable hotspot: credentials filter evaluates in Ruby over scope records then re-queries matched IDs (non-index-accelerated for JSON criteria).

4. **Saved Views:** Store request payload per user/entity, capturing filter body and additional parameters. Aligns with ShipHawk's public UX around saved filters/views.

5. **WMS Filtering UX:** Public WMS docs show filter-driven operational control in wave release and dashboards.

**Performance Findings:**
- Strong patterns: exact filters (`term`, `terms`), ranges, fixed scoping (account_id, warehouse). Early constraint injection. Dedicated WS path for constrained lookups.
- Risk patterns: wildcards with leading `*` for contains/ends-with, broad nested queries over line items/reference numbers, SQL fallback feature mismatch for heavy aggregations, in-memory admin credentials filtering.
- Boundary conditions: result window hard cap (10k default), healthcheck fallback shifts from elastic to simpler SQL semantics.

**Recommendations (5 search engine options evaluated):**
- **Option A: OpenSearch (recommended primary)** -- closest fit to current filter model, strong for mixed faceted + free-text + nested search.
- **Option B: PostgreSQL + GIN + pg_trgm (recommended selective/secondary)** -- fewer moving parts, good for transactional/reporting with moderate text search.
- **Option C: Solr** -- mature Lucene-based, strong filter-query caching, but lower team alignment.
- **Option D: Typesense** -- developer-friendly, fast filtering + typo-tolerant search, but not a drop-in for deep nested workloads.
- **Option E: Redis Query Engine** -- ultra-low-latency for exact/range patterns, but memory cost and data-model constraints.

The recommended path: keep OpenSearch core, enforce filter policy (prefer exact/range, restrict leading-wildcard), add field strategy (dedicated keyword fields, controlled wildcard/ngram), normalize filter AST once (portable across GPT/Claude tool runners), replace in-memory admin JSON filtering with indexed structure, and keep saved views as canonical payload snapshots.

## ShipHawk Templates (shiphawk-templates/docs/)

### Customer Requirements

**File:** `shiphawk-templates/docs/customer-requirements/sample-co-crd.md`

This is a sample Customer Requirements Document (CRD) that serves as the template format for onboarding new customers. The CRD for "Sample Co" demonstrates the structured format:

- **Document Overview:** Document type (Packing Slip), date, sample source image.
- **Layout Analysis:** Header style (three-column: Logo left, Company Info center, Document Details right), address layout (side-by-side Bill To / Ship To), items table style (detailed with pricing, 7 columns), footer (page count + terms link), pagination (15 items/page), closest existing template (Fastenal).
- **Detected Fields:** Organized into four sections (Title, Header, Body/Items, Footer), each with field name, Liquid variable mapping, required flag, and notes. Includes `<!-- TODO: verify variable -->` markers for uncertain mappings.
- **Pattern Match:** Identifies closest existing template and base template recommendation (standard-paginated).
- **Special Requirements:** Checklist of non-standard features (logo support, pricing/totals, Side Mark column, per-item Ship Date, Terms & Conditions footer, three-column title section).
- **Testing Notes:** Standard test scenarios (1 item, 15 items, 30+ items) plus customer-specific verification items.

### Plans

The templates project has five planning documents covering the repository reorganization and a new template generation skill.

#### Repository Reorganization Design (2026-02-04)

**File:** `shiphawk-templates/docs/plans/2026-02-04-repository-reorganization-design.md`

The design plan for reorganizing the shiphawk-templates repository from a flat root directory with 67+ files into a structured hierarchy. Three phases:

- **Phase 1: Cleanup** -- Build a review manifest cataloging ~27 questionable root files (trash candidates like `nul` and `Untitled*`, possible duplicates like `granger.html` vs `grainger.html`, reference materials, and large unknowns like `Contents/` at 43 MB). Move NetSuite files (4 files) to `netsuite/`, move tools (Gopher.py, ShipHawkTool) to `tools/`.

- **Phase 2: Template Migration** -- Map root-level HTML/JSON files to customers, migrate into `templates/[type]/customers/[customer-name]/` hierarchy with standardized naming. 26+ packing slips, 3 carton label JSONs, 1 pick ticket. Strip duplicated inline CSS and add shared stylesheet `<link>` references. Proof of concept with Grainger first.

- **Phase 3: Customer Mappings** -- Create `config/reference-fields/customer-mappings/[customer-name].json` for each customer. Priority order: SawStop (3+ variants, 27 unique variables), GuardAir (4 variants), Grainger (verify existing), MSC, then remaining single-template customers alphabetically.

#### Repository Reorganization Implementation (2026-02-04)

**File:** `shiphawk-templates/docs/plans/2026-02-04-repository-reorganization-implementation.md`

Detailed step-by-step implementation plan with 10 tasks across 3 phases. Each task specifies exact files to create/move, shell commands, verification steps, and expected results. Key details:

- **Task 1 (Review Manifest):** 6-step process comparing duplicate pairs (Hold.html vs current.html, proclipslip.html vs ProClipFinal.html, wiseslip.html vs wise_eye_ps.html, granger.html vs grainger.html), cataloging trash/reference/JSON files, and flagging large unknowns.
- **Tasks 2-3 (Cleanup):** Move 4 NetSuite files and tools to proper directories.
- **Tasks 4-6 (Migration):** Proof of concept with Grainger (zero customer-specific CSS, cleanest migration), migrate remaining 23 packing slips + 1 pick ticket, move JSON label/config files.
- **Tasks 7-10 (Mappings):** Create SawStop mapping (27 unique variables documented with canonical name mappings), create GuardAir mapping (4 variants), verify Grainger mapping, create remaining 14 customer mappings.

#### Repository Reorganization Execution (2026-02-05)

**File:** `shiphawk-templates/docs/plans/2026-02-05-repository-reorganization-execution.md`

Full execution plan with 12 phases, building on the prior design and implementation documents. Covers the complete end-to-end flow from git init through final documentation update:

- Phases 1-2: Git init and archive trash/duplicates (15 files).
- Phases 3-5: Archive reference materials (14 files), organize test data and clean root directories, migrate 11 label configs.
- Phases 6-8: Investigate SawStop/test.html, migrate 24 production templates, cleanup Toolkit and Contents.
- Phases 9-12: Fix Grainger Liquid syntax bug (`order.references.["` to `order.references["`), refactor templates to extract inline CSS, create 16 customer mapping JSONs, update documentation and tag v1.0-reorganized.

The final verification target: root should contain only `.claude/`, `.git/`, `archive/`, `config/`, `docs/`, `netsuite/`, `templates/`, `tools/`, `CLAUDE.md`, `README.md`, `timeline.md`, `.gitignore`.

#### Archive and Migrate (2026-02-05)

**File:** `shiphawk-templates/docs/plans/2026-02-05-archive-and-migrate.md`

A successor plan that picks up after partial execution of the reorganization. Documents what was already completed (review manifest, NetSuite moves, tool relocations, 5 duplicates archived) and provides 13 remaining tasks:

- **Phase 1 (Git Init):** Create .gitignore, initialize git, baseline commit.
- **Phase 2 (Archive Root, 4 tasks):** Archive 6 untitled/trash files, 4 broken/empty files, 11 reference images/PDFs, 5 reference docs and test data.
- **Phase 3 (Consolidate, 5 tasks):** Move GopherScript files, GW carrier CSVs, remaining root JSONs, label configs (12 files including from `Gerrit/` and `Middleby/` directories), and handle SawStop/test.html.
- **Phase 4 (Migrate, 3 tasks):** Create 18 customer directories, migrate 22 packing slips + 1 pick ticket, verify clean root.

Total: ~79 files moved across all tasks. Future work noted: CSS refactor, customer mappings, Grainger syntax fix, Contents/ investigation, documentation updates.

#### Packing Slip From Screenshot Design (2026-02-05)

**File:** `shiphawk-templates/docs/plans/2026-02-05-packing-slip-from-screenshot-design.md`

Design for a Claude Code skill that takes a screenshot of a packing slip and generates three artifacts:

1. A Customer Requirements Document (CRD) in markdown.
2. A first-draft HTML packing slip template.
3. A customer field mapping JSON config.

The skill follows a 10-step process: read the image, ask for customer name (only required input), analyze image via vision (sections, fields, table columns, layout), load reference data (standard-fields.json, reference-fields.md), load visual reference for pattern matching, generate CRD, find closest existing template, generate first-draft HTML adapted from closest template, generate customer mapping JSON following grainger.json structure, and present summary with TODO items.

TODO markers are used for uncertain mappings: `<!-- TODO: verify variable -->` in HTML, `"TODO": true` in JSON. Out of scope: logo embedding, visual reference updates, base template creation, git commits. Future skills planned: pick-ticket-from-screenshot, carton-label-from-screenshot, pallet-label-from-screenshot.

### Template Development Guide

**File:** `shiphawk-templates/docs/template-development/creating-new-template.md`

A comprehensive 9-step guide (492 lines) for creating new packing slip, pick ticket, or label templates. Steps:

1. **Gather Requirements:** Obtain customer sample, get samples with varying item counts, document required fields and special requirements.
2. **Match to Existing Patterns:** Use the Visual Reference README to find closest existing template match. Example matching workflow provided.
3. **Map Fields to Variables:** Cross-reference customer fields with Liquid variables using reference-fields.md. Create field mapping table.
4. **Select and Copy Base Template:** Choose from standard-paginated, standard-single-page, landscape, pick-ticket, carton-label, or pallet-label bases. Create customer directory with standardized naming.
5. **Customize Template:** Update HTML structure using table-based layout with inline styles (critical PDF renderer requirement). Full code examples provided for header, address blocks, and items table. Map custom fields with canonical names and fallbacks.
6. **Create Configuration File:** Write customer mapping JSON (`config/reference-fields/customer-mappings/[customer-name].json`) with field mappings, layout config, and testing notes.
7. **Document Customer Requirements:** Create customer README in template directory with field mapping table, layout details, and testing notes.
8. **Register Template:** Add to `config/template-configs/template-registry.json`.
9. **Add to Visual Reference:** Generate sample PDF, update Quick Reference Table.

Includes a template checklist (code quality, testing, documentation, print styles), common customization examples (barcodes, logos, date formatting, conditional sections), and a troubleshooting section (blank fields, pagination issues, styling in PDF, logo display).

### Variable Reference

**File:** `shiphawk-templates/docs/variable-reference/reference-fields.md`

The most critical reference document for template development (499 lines). Organized into four sections:

**Section 1: Native Fields (12 subsections):**
- **Account:** company_name, logo_src.
- **Shipment (19 fields):** ship_date, est_delivery_date, current_date, carrier_name, shipping_service, formatted_service_name, shipping_price, items_price, total_price, currency, total_weight, weight_uom, tracking_number, shipment_number, pro_number, warehouse_code, notes, barcode_img_src, po_barcode_img_src, co_barcode_img_src.
- **Order (5 direct fields + references hash + refs hash + reference_numbers array + billing address):** order_number, order_date, shipping_price, tax_price, currency. References accessed via `order.references["Field Name"]`. Refs accessed via `order.refs.invoice_id` etc. Reference numbers iterable with code/x12_code/value/name.
- **Origin (Ship From, 10 fields):** name, company, street1, street2, city, state, zip, country, phone_number, email, one_line.
- **Destination (Ship To, 10 fields):** Same structure as origin. Also available: ultimate_destination, return_address, billing_address.
- **Items (15 fields):** sku, upc, name, description, quantity, quantity_ordered, quantity_shipped, value, sum_value, currency, weight, weight_uom, volume_cubic_ft, line_number, sequence_number, inventory_identification, inventory_identifiers. Plus item references hash and reference_numbers array with loop pattern.
- **Packages (10 fields + nested line_items):** tracking_number, material, package_material_name, dimensions, dimension_uom, weight, net_weight, total_weight, weight_uom, number_of_units, total_item_quantity.
- **Handling Units:** Nested structure with packages and line_items inside.
- **Items with Kits:** Kit SKUs with nested component items.
- **Items Info (Summary):** total_count, total_weight, total_volume, weight_uom.
- **Top-Level:** logo_src.
- **Liquid Utilities:** Current date, loop index/index0/last.

**Section 2: Order-Level References (A-Series, 65 canonical fields):**
A numbered catalog (A1-A65) of all order-level reference fields with canonical name, Liquid syntax, description, and known aliases. Key fields include: 3rd Party Carrier (A1), Account# (A2), Bill To (A3), BOL# (A8), Customer Order #(EDI) (A15), FOB (A19), Invoice # (A26), Location (A29), Order Number (A32), PO# (A38), Ship To (A46), Terms (A57). Each entry lists known aliases (e.g., PO# has aliases "PO Number", "Customer PO", "Purchase Order", "PO").

**Section 3: Item-Level References (B-Series, 20 canonical fields):**
B1-B20 covering: Backorder Qty, Bay Location, BK/ORD, Boxes, Buyer Part # (EDI), Color, Cust#, Customer Part No, Grainger SKU, Lead Time, Legacy Number, Model #, Ordered Quantity, Prev.Ship, Serial Number, Side Mark, Size, Total Sq.Ft, UOM, Vendor Part # (EDI). Includes loop pattern for fields accessed via reference_numbers array.

**Section 4: Common Patterns:**
Code examples for pagination (15 items/page with offset calculation), safe defaults, newline handling (`newline_to_br`), barcode generation (`inline_barcode`), conditional display, and fallback chains.

**Quick Lookup Table:** "I need to show..." lookup mapping 22 common data needs to their native field or reference number.

### Visual Reference

**File:** `shiphawk-templates/docs/visual-reference/README.md`

A pattern matching guide (249 lines) that helps match new customer requirements to existing template patterns. Contains:

**Quick Reference Table:** 10 customers with columns for Header Layout, Address Layout, Items Table style, Pagination, and Special Features. Examples: Amazon (Logo Right, Side-by-Side, Standard with pricing, 15/page, EDI + barcode), Grainger (Logo Right, Ship To Only, No Pricing, 15/page, Location code + EDI), GuardAir Global (Logo Left, Side-by-Side Sold To/Ship To, Detailed with options, 15/page, International + multiple POs).

**Layout Pattern Categories:**
- **Header Styles (4 patterns):** Logo Left/Title Right (guardglobal, proclip), Logo Right/Info Left (grainger, amazon, fastenal -- 60% of customers), Centered Logo (homedepot, millennium), Two-Column Split (msc, safariland).
- **Address Block Layouts (3 patterns):** Side-by-Side Ship To/Bill To (Amazon, Fastenal, GuardAir), Ship To Only with order details (Grainger, MSC, SafariLand -- 55%), Floating Ship To top-right (ProClip).
- **Items Table Styles (4 patterns):** Standard Grid with pricing (Amazon, Fastenal, Home Depot), No Pricing (Grainger, MSC -- 45%), Detailed with BPN/VPN/UOM (Argco, SafariLand), Compact (ProClip).
- **Footer Elements:** Terms & Conditions (MSC, GuardAir), Barcode bottom center (Argco, Grainger), Page Count (all paginated), Contact Information (most).

**Pattern Statistics (from 32 templates):** Most common header: Logo Right (60%). Most common address: Ship To Only (55%). Most common items table: No Pricing (45%). Pagination standard: 15 items/page (78%). Most common special feature: EDI field integration (40%).

Includes a pattern matching workflow example and instructions for adding new patterns.

## Ecosystem Connections

**How automation-hub and shiphawk-templates relate to each other:**

Both projects are standalone and have no code dependency on each other. However, they serve the same ecosystem:

- **Automation-hub** automates the operational side of ShipHawk -- triaging inbound emails about orders, planning due dates against calendar load, detecting schedule drift, and drafting responses. Its filter architecture (canonical filter JSON with `match` + `filters[]` operators) is explicitly designed to be compatible with how ShipHawk's existing modular filter engine works in production (the same `match: all|some` + `filters[{field, values[], operator}]` contract documented in the filter findings).

- **Shiphawk-templates** handles the outbound document side -- generating the packing slips, pick tickets, and labels that accompany shipments. It standardizes the mapping of ShipHawk's data model (orders, items, addresses, references) into renderable documents.

- The **filter findings** doc in automation-hub directly references ShipHawk's internal code paths (in shiphawk-dev) and recommends a canonical filter AST that would be portable across the automation hub and the main ShipHawk platform. This creates a conceptual bridge: if implemented, the same filter payload could query tasks in the automation hub and orders/shipments in ShipHawk.

**How both relate to shiphawk-dev (the main Rails app):**

- **shiphawk-dev** is the source of truth for shipment data. The templates project consumes its data model (the variables documented in reference-fields.md come from the ShipHawk API), and the automation hub reads from it for context and task grounding (read-only, no code dependency).
- The filter findings document maps automation-hub's canonical filter spec directly to shiphawk-dev's existing filter architecture, identifying five filter surfaces in the codebase (API v4, Workstation, Admin, Saved Views, WMS) and recommending how to evolve them.
- Template variable references must align with shiphawk-dev's data schema -- any schema changes in the main app could affect template rendering.

## Comprehensive Detail

### Requirements Document -- Key Specifications

The automation-hub requirements document defines the most complete specification in the ecosystem:

**Canonical Event Schema (required fields):**
- `event_id` (stable), `channel`, `source_reference`, `timestamp`, `actor`, `raw_text`, `entities` (people, account, project, dates), `proposed_actions`, `confidence`

**Email Classification Categories:** task, question, FYI, noise

**Entity Extraction Targets:** account, project, dates, owners, urgency

**Due-Date Planning Inputs:** event urgency, dependencies, calendar capacity/free-busy

**Adapter Requirements (per adapter):** health check, pagination/sync cursor, deterministic error mapping, retry policy with backoff, source reference normalization

**Open Decisions Needed:**
1. Which message bridge is primary in production (Zapier vs local)?
2. What confidence thresholds trigger auto-proposal vs manual review?
3. What maximum allowed outbound automation scope is acceptable?
4. Which backend is selected first for high-performance filtering?
5. Data retention policy per channel and evidence type.

### Variable Reference -- Complete Field Inventory

The reference-fields.md document catalogs **99 total canonical fields:**
- 12 native field groups with ~80 individual fields across account, shipment, order, origin, destination, items, packages, handling units, kits, items info, top-level, and utilities
- 65 order-level references (A-series: A1-A65) covering addresses, identifiers, contacts, shipping terms, EDI fields, and custom references
- 20 item-level references (B-series: B1-B20) covering quantities, part numbers, inventory details, and custom attributes

**Most-used fields across templates (from visual reference analysis):**
- `order.order_number`, `shipment.ship_date`, `destination.*` fields, `item.sku`, `item.description`, `item.quantity` (used in nearly all templates)
- `order.references["PO#"]` (A38), `order.references["Account#"]` (A2), `order.references["Order Number"]` (A32) (most common reference fields)
- `item.references["UOM"]` (B19) with default "EA" (most common item reference)

### Template Development Workflow -- Key Steps

The creating-new-template.md guide defines a 9-step process with critical constraints:

1. **Layout Constraint (non-negotiable):** Templates MUST use table-based layout with inline styles. ShipHawk's PDF renderer is table-aware; div-based CSS fails or renders inconsistently in PDF conversion.

2. **Base Template Selection:** 6 base templates available (standard-paginated, standard-single-page, landscape, pick-ticket, carton-4x6, pallet-4x6).

3. **Field Mapping Rule:** Use canonical field names from `standard-fields.json`. Access order references via `order.references["Canonical Name"]`, item references via `item.references["Canonical Name"]`. Always provide defaults for optional fields.

4. **Testing Standard:** Every template must be tested with 1 item, 15 items (pagination boundary), and 30+ items (multi-page). Barcodes must generate and scan. PDF output must match customer sample.

5. **Label Font Size Constraint:** Only these sizes are allowed: 12, 17, 22, 28, 33, 44, 67, 100, 111, 133, 150, 170, 190, 220.

## Cross-References to /Apps/docs

### shiphawk-templates-research-2026-02-08.md
**Location:** `/Apps/docs/reports/shiphawk-templates-research-2026-02-08.md`

This workspace-level research report provides the deepest analysis of shiphawk-templates, covering:
- Full architecture overview with directory structure diagram and data flow
- Complete customer coverage table (20 customers, 28+ templates, with carton/pallet/pick-ticket coverage per customer)
- Layout pattern distribution statistics
- Configuration system details (standard-fields.json schema, customer mapping JSON structure)
- PDF renderer constraints and label font size constraints
- Template creation workflow summary
- Feature requirements by template type (packing slips, pick tickets, carton labels, pallet labels)
- Future feature roadmap (template linting, PDF regression testing, template preview UI, internationalization)

**Connection to project docs:** The research report synthesizes information from reference-fields.md (variable inventory), visual-reference/README.md (pattern statistics), creating-new-template.md (workflow), and the reorganization plans into a single comprehensive document. It adds analysis not present in project docs, including completeness assessment (100% variable reference coverage, 50% customer mapping coverage) and prioritized feature roadmap.

### 2026-02-08-across-app-72-hour-summary.md
**Location:** `/Apps/docs/reports/2026-02-08-across-app-72-hour-summary.md`

The workspace-level 72-hour summary covers shiphawk-templates activity:
- **21 commits** during the review window
- Repo reorganization and scope tightening completed: archive/migration execution from flat root into organized template hierarchy, cleanup/removal of non-template directories, docs updates, added sample template + variable docs + layout guidance
- Follow-up work noted: shared CSS refactor, remaining customer mappings, specific syntax fixes
- shiphawk-templates is listed among the most active projects in the workspace during this period

**Connection to project docs:** The 72-hour summary provides execution status for the reorganization plans documented in `shiphawk-templates/docs/plans/`. The plans describe the design and task-level steps; the summary confirms that archive/migration execution was completed but CSS refactor and customer mappings remain pending.

### Other Related /Apps/docs Files

- **`/Apps/docs/README.md`** -- The central documentation index references shiphawk-templates as one of the workspace projects and links to the research report.
- **`/Apps/CLAUDE.md`** -- The workspace-level CLAUDE.md contains the shiphawk-templates project summary (stack, key commands, architecture, key constraint about table-based layout) and the shiphawk-dev summary (which provides context for understanding the data model that templates consume).
- **`/Apps/docs/next-steps-workspace-cleanup-2026-02-08.md`** -- May reference shiphawk-templates cleanup tasks as part of workspace-wide documentation standards.
