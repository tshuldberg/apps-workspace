# API & Data Standards Review

**Date:** 2026-02-08
**Scope:** Full /Apps workspace — ShipHawk (primary reference), Receipts, EasyStreet Monorepo, macOS Hub, EasyStreet Native
**Purpose:** Establish universal API input/output standards for JSON and CSV consumption across all apps and systems

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Review Process & Methodology](#review-process--methodology)
3. [Project-by-Project Findings](#project-by-project-findings)
   - [ShipHawk (Grape API)](#shiphawk-grape-api)
   - [Receipts (Django REST Framework)](#receipts-django-rest-framework)
   - [EasyStreet Monorepo (Convex)](#easystreet-monorepo-convex)
   - [macOS Hub (MCP Server)](#macos-hub-mcp-server)
   - [EasyStreet Native (iOS/Android)](#easystreet-native-iosandroid)
4. [Cross-Project Comparison Matrix](#cross-project-comparison-matrix)
5. [Universal API Standards](#universal-api-standards)
   - [JSON Response Envelope](#1-json-response-envelope)
   - [Key Naming Convention](#2-key-naming-convention)
   - [Error Response Format](#3-error-response-format)
   - [Pagination](#4-pagination)
   - [DateTime Format](#5-datetime-format)
   - [Input Validation](#6-input-validation)
   - [CSV Import/Export](#7-csv-importexport)
   - [Authentication Headers](#8-authentication-headers)
   - [Versioning](#9-versioning)
   - [Content Negotiation](#10-content-negotiation)
6. [Per-Project Compliance Checklist](#per-project-compliance-checklist)
7. [Implementation Recommendations](#implementation-recommendations)
8. [Appendix: Requirements Gathering Process](#appendix-requirements-gathering-process)

---

## Executive Summary

This review analyzed the API layers across all active projects in `/Apps/` to establish universal standards for JSON/CSV data interchange. The goal: ensure any app in the workspace can produce and consume structured data (JSON, CSV) in a consistent, predictable format — enabling cross-system interop, easier tooling, and reduced onboarding friction.

**Key Findings:**
- ShipHawk has the most mature API (120+ Grape endpoints, 25+ validators, 10+ coercers, CSV import/export pipelines)
- Receipts has the cleanest REST conventions (data envelopes, structured errors, read/write serializer separation)
- Key naming is split: ShipHawk and Receipts use `snake_case`, EasyStreet Monorepo uses `camelCase`
- Error formats vary significantly across projects
- CSV support only exists in ShipHawk; other projects are JSON-only
- No project has formal OpenAPI/Swagger specs

**Recommendation:** Adopt a hybrid standard drawing the best patterns from each project, with `snake_case` as the canonical wire format and clear envelope/error contracts.

---

## Review Process & Methodology

### Agent Team Structure

| Agent Role | Scope | Focus Areas |
|-----------|-------|-------------|
| **ShipHawk API Reviewer** | `/Apps/SH/shiphawk-dev/app/api/` | Grape structure, entities, validators, coercers, CSV, auth, errors |
| **Cross-Project Reviewer** | `/Apps/receipts/`, `/Apps/Parks/`, `/Apps/macos-hub/` | DRF serializers, Convex schema, MCP tools, native data models |
| **Standards Compiler** | All findings | Synthesis, gap analysis, universal standards definition |

### Files Examined

**ShipHawk (deepest review):**
- `app/api/root_engine.rb` — Root Grape mount, error rescue chain
- `app/api/v4/root_engine.rb` — V4 auth, rate limiting, session scoping
- `app/api/v4/entities/` — 120+ Grape entity classes (serialization)
- `app/api/v4/helpers/` — 25+ parameter helper modules (validation)
- `app/api/validators/` — Custom validators (FileType, MaxLength, InRange, etc.)
- `lib/coercers/` — Input coercers (RoundUp, WeightUom, CountryCode, Truncate, etc.)
- `app/api/v4/orders*.rb`, `shipments*.rb` — Core resource endpoints
- `app/api/v4/address_imports.rb`, `address_exports.rb` — CSV pipelines
- `Gemfile` — API gem stack (grape 3.0.1, grape-entity 1.0.1, oj 3.13.23)

**Receipts:**
- `api/pagination.py` — Custom PageNumberPagination
- `api/exceptions.py` — Custom exception handler
- `api/utils.py` — DefaultFilterBackend
- `*/serializers/list/`, `*/serializers/detail/` — Directory-based serializer convention
- `receipts/settings.py` — REST_FRAMEWORK config

**EasyStreet Monorepo:**
- `packages/backend/convex/schema.ts` — Convex table definitions with validators
- `packages/backend/convex/streetSegments.ts` — Query/mutation functions
- `packages/backend/convex/parkedCars.ts` — CRUD mutation patterns

**macOS Hub:**
- `src/tools/` — 29 MCP tool definitions with JSON Schema inputs
- `src/types.ts` — TypeScript interfaces for all domain objects
- `src/bridges/` — AppleScript bridge layer

**EasyStreet Native:**
- iOS `StreetRepository.swift` — SQLite queries, data models
- Android data layer — Kotlin data classes

### Requirements Gathered

The review was guided by these requirements:
1. All APIs must produce and consume JSON as primary format
2. CSV import/export must be standardized for bulk data operations
3. Field naming must be consistent and predictable
4. Error responses must be machine-parseable
5. Standards must work across web APIs (REST), serverless (Convex), CLI tools (MCP), and mobile apps
6. Standards must be adoptable incrementally (not break existing APIs)

---

## Project-by-Project Findings

### ShipHawk (Grape API)

**Stack:** Ruby on Rails 8.0 + Grape 3.0.1 + grape-entity 1.0.1

#### API Structure
- **Path-based versioning:** `/api/v3/` (deprecated, returns 410) and `/api/v4/` (active)
- **Sub-engines:** Root → Public, Auth, Web, Workstation, TMS, Brokers
- **120+ endpoints** organized by resource (orders, shipments, rates, addresses, carriers, products, warehouses, etc.)
- **Format:** JSON-only (`format :json, default_format :json`)

#### Serialization (Grape Entities)
```ruby
# Pattern: expose fields with optional aliases and documentation
module V4::Entities::Orders
  class Order < Grape::Entity
    expose :public_id, as: :id, documentation: { type: 'String' }
    expose :order_number
    expose :status
    expose :created_at, format_with: :iso8601
    expose :order_line_items, using: V4::Entities::Orders::OrderLineItems
  end
end
```

- **Key naming:** `snake_case` throughout
- **ID aliasing:** Internal `public_id` exposed as `id`
- **DateTime:** ISO8601 via `format_with: :iso8601`
- **Nesting:** Grape entities compose via `using:` parameter
- **Conditional fields:** `expose :field, if: ->(obj, opts) { condition }`

#### Response Format
- **No envelope:** Direct object or array return (no `{"data": ...}` wrapper)
- **Pagination:** Header-based — `X-Total`, `X-Total-Pages`, `X-Per-Page`, `X-Page`
- **Parameters:** `page` (default 1), `per_page` (default 20, max 500), `all_items: true` disables pagination

#### Error Handling
```ruby
# Rescue chain in root_engine.rb
rescue_from ActiveRecord::RecordNotFound    # → 404
rescue_from JSON::ParserError               # → 400
rescue_from Grape::Exceptions::Validation   # → 422
rescue_from StandardError                   # → 500

# Response format:
{ "error": "Error message string" }
# Or with field-level details:
{ "error": "Validation failed", "field_name": ["Error 1", "Error 2"] }
```

#### Input Validation
- **25+ param helper modules** in `app/api/v4/helpers/`
- **Type validation:** `requires :email, type: String` / `optional :page, type: Integer, default: 1`
- **Custom validators** in `app/api/validators/`: FileType, MaxLength, InRange, ValidPartialAddress, TimeWithoutDate, etc.
- **Custom coercers** in `lib/coercers/`: RoundUp, WeightUom, CountryCode, Truncate[N], ArrayOfObjects
- **Enum validation:** `values: Enums::API_WEIGHT_UOM`
- **Declared params:** `declared(params, include_missing: false)` strips undeclared input

#### CSV Import/Export
- **Address import:** `POST /csv_histories/addresses/imports` (file param, async processing)
- **Address export:** `POST /csv_histories/addresses/exports`
- **Order import:** `POST /orders/imports` (requires `allow_order_import_csv` feature flag)
- **Material containers:** `POST /materials/containers/import` and `/export` (admin-only)
- **Shipment line items:** `POST /shipments/:id/shipment_line_items.csv`
- **SKUs:** `POST /web/skus_histories`
- **Pattern:** Upload via `file` param → validate extension → async Sidekiq worker → track in `csv_histories` table
- **Export pattern:** Generate on demand → return with `content_type 'text/csv'` + `Content-Disposition: attachment`

#### Authentication
- **Header tokens:** `X-User-Email`, `X-User-Token`, `X-Api-Key`
- **Service-to-service:** `X-Service-Token` (matches `ENV['app_auth_token']`)
- **Session scoping:** Web portal, Workstation, API Client (enum-based)
- **Rate limiting:** `429 Too Many Requests` with per-user tracking

---

### Receipts (Django REST Framework)

**Stack:** Django 4.x + DRF + Celery + PostgreSQL

#### Response Envelope
```json
{
  "data": [
    { "id": 1, "field": "value" }
  ],
  "paging": {
    "count": 123,
    "next": "https://api.receeps.com/v1/items/?page=2",
    "previous": null
  }
}
```

- **Always wrapped:** `"data"` key for payload, `"paging"` for pagination metadata
- **Key naming:** `snake_case`

#### Error Format
```json
{
  "error": {
    "key": "validation_error",
    "status_code": 400,
    "message": "Invalid data.",
    "errors": [
      {
        "field": "choice",
        "details": [{ "message": "Invalid choice", "key": "invalid_choice" }]
      }
    ]
  }
}
```

- Machine-readable `key` for programmatic handling
- Human-readable `message` for display
- Field-level `errors` array with structured details
- Custom exception handler intercepts all unhandled exceptions

#### Serializer Convention
```
<app>/serializers/
  list/list_serializers.py      # Lightweight, for list views
  detail/detail_serializers.py  # Full data, for retrieve/create/update
  create/create_serializers.py  # Optional, create-specific validation
```

- `ReadWriteSerializerMixin` switches serializer by action
- Separate QuerySet optimization per action (`select_related` vs `prefetch_related`)
- Shared `UserBriefSerializer` from `accounts/` (never duplicate)

#### Pagination
```python
class ApiPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "limit"
    max_page_size = 50  # Enforced ceiling
```

#### Authentication
- Bearer tokens: `Authorization: Bearer <token>`
- JWT: 30-min access, 2-day refresh, rotation with blacklist
- Default permission: `IsAuthenticatedOrReadOnly`

#### Throttling
- Burst: 60/min
- Sustained: 15,000/day

#### CSV Support
- Not yet implemented (JSON-only)

---

### EasyStreet Monorepo (Convex)

**Stack:** TypeScript + Convex serverless backend

#### Schema Definition
```typescript
export default defineSchema({
  streetSegments: defineTable({
    segmentId: v.string(),
    streetName: v.string(),
    coordinates: v.array(v.object({ latitude: v.number(), longitude: v.number() })),
    bounds: v.object({ latMin: v.number(), latMax: v.number(), lngMin: v.number(), lngMax: v.number() }),
    rules: v.array(v.object({
      dayOfWeek: v.number(),
      startTime: v.string(),
      endTime: v.string(),
      weeksOfMonth: v.array(v.number()),
      applyOnHolidays: v.boolean(),
    })),
  }).index("by_segmentId", ["segmentId"]).index("by_streetName", ["streetName"]),
});
```

- **Key naming:** `camelCase` (TypeScript/JavaScript convention)
- **Validation:** Built into Convex validators (`v.string()`, `v.number()`, `v.optional()`)
- **Auto fields:** `_id`, `_creationTime`
- **No HTTP API:** Functions called directly via Convex SDK (not REST)
- **No envelope:** Direct object/array returns
- **No error contract:** Convex handles errors at framework level

#### CSV Support
- None (no bulk data import/export)

---

### macOS Hub (MCP Server)

**Stack:** Node.js + TypeScript + MCP SDK

#### Tool Input Schema (JSON Schema)
```typescript
inputSchema: {
  type: "object",
  properties: {
    name: { type: "string", description: "Reminder title" },
    priority: { type: "number", enum: [0, 1, 5, 9] },
    flagged: { type: "boolean" },
  },
  required: ["name"],
}
```

#### Response Format (MCP Protocol)
```typescript
// Success
{ content: [{ type: "text", text: '{"id":"abc","message":"Created"}' }] }
// Error
{ content: [{ type: "text", text: "Error message" }], isError: true }
```

- **Key naming:** `snake_case` for tool args, `camelCase` for TypeScript interfaces
- **Validation:** JSON Schema at MCP protocol layer
- **29 tools** organized by app domain
- **No CSV support**

---

### EasyStreet Native (iOS/Android)

- **No external API** — all data bundled locally in SQLite
- **iOS (Swift):** Struct-based models, SQLite queries, camelCase properties
- **Android (Kotlin):** Data class models, camelCase properties
- **Offline-first:** No network calls, no API credentials
- **Data format:** SQLite with `snake_case` column names, mapped to camelCase in code

---

## Cross-Project Comparison Matrix

| Standard | ShipHawk | Receipts | EasyStreet Mono | macOS Hub | EasyStreet Native |
|----------|----------|----------|-----------------|-----------|-------------------|
| **Transport** | REST (Grape) | REST (DRF) | Convex SDK | MCP (stdio) | Local (SQLite) |
| **Format** | JSON | JSON | JSON | JSON-in-MCP | SQLite/JSON |
| **Key Naming** | snake_case | snake_case | camelCase | Mixed | camelCase |
| **Response Envelope** | None (bare) | `{data, paging}` | None (bare) | `{content}` | N/A |
| **Error Format** | `{error: string}` | `{error: {key, status_code, message, errors}}` | Framework | `{isError, content}` | Exceptions |
| **Pagination** | Headers (X-Total) | Body (paging obj) | N/A | N/A | N/A |
| **DateTime** | ISO8601 | ISO8601 | Unix ms | ISO8601 strings | Date objects |
| **Validation** | Grape params + custom validators + coercers | DRF serializers + ChoiceField | Convex validators | JSON Schema | SQLite schema |
| **Auth** | X-Api-Key / X-User-Token | Bearer JWT | Convex auth | N/A | N/A |
| **CSV Import** | Yes (5+ endpoints) | No | No | No | No |
| **CSV Export** | Yes (4+ endpoints) | No | No | No | No |
| **API Docs** | Inline Grape + external docs.shiphawk.com | None formal | None | JSON Schema descriptions | None |
| **Versioning** | Path (/v3, /v4) | None | N/A | N/A | N/A |

---

## Universal API Standards

These standards apply across all projects in `/Apps/`. Project-specific CLAUDE.md files may add stricter rules but **must not weaken** these baseline requirements.

### 1. JSON Response Envelope

**Standard:** All API responses returning data MUST use a consistent envelope.

#### Single Resource
```json
{
  "data": {
    "id": "abc-123",
    "name": "Example",
    "created_at": "2026-02-08T10:30:00Z"
  }
}
```

#### Collection
```json
{
  "data": [
    { "id": "abc-123", "name": "Example 1" },
    { "id": "def-456", "name": "Example 2" }
  ],
  "paging": {
    "total": 100,
    "page": 1,
    "per_page": 20,
    "total_pages": 5
  }
}
```

#### Rationale
- Consistent `"data"` key enables generic client parsing
- Pagination metadata separated from payload
- Extensible — can add `"meta"`, `"included"`, etc. without breaking clients
- Receipts already follows this pattern; ShipHawk can adopt incrementally

#### Migration Path for Existing APIs
- **ShipHawk:** New endpoints use envelope; existing endpoints add envelope on next major version
- **Receipts:** Already compliant
- **EasyStreet Monorepo:** Apply when exposing Convex functions as HTTP endpoints
- **macOS Hub:** MCP protocol has its own envelope; internal JSON payloads should follow this format

---

### 2. Key Naming Convention

**Standard:** `snake_case` for all JSON wire format keys.

```json
{
  "data": {
    "order_number": "ORD-001",
    "line_items": [
      { "item_name": "Widget", "unit_price": 9.99 }
    ],
    "created_at": "2026-02-08T10:30:00Z"
  }
}
```

#### Rules
- All JSON keys in API requests and responses: `snake_case`
- Internal code may use language-native conventions (camelCase in JS/TS/Swift/Kotlin), but **wire format is always snake_case**
- Client SDKs should transform between wire format and native conventions
- Database column names should use `snake_case` (already standard in SQL)

#### Rationale
- ShipHawk (largest API) already uses `snake_case`
- Receipts (Django) already uses `snake_case`
- Most API ecosystems (GitHub, Stripe, Twilio) use `snake_case`
- Eliminates ambiguity in CSV headers (which are inherently flat)

#### Migration Path
- **EasyStreet Monorepo:** Add serialization layer when creating HTTP endpoints; internal Convex functions can keep camelCase
- **macOS Hub:** Tool argument names already use `snake_case`; TypeScript interfaces can keep camelCase internally

---

### 3. Error Response Format

**Standard:** All errors MUST return a structured JSON object.

```json
{
  "error": {
    "key": "validation_error",
    "status_code": 422,
    "message": "One or more fields failed validation.",
    "errors": [
      {
        "field": "email",
        "details": [
          { "message": "is not a valid email address", "key": "invalid_format" }
        ]
      },
      {
        "field": "quantity",
        "details": [
          { "message": "must be greater than 0", "key": "min_value" }
        ]
      }
    ]
  }
}
```

#### Error Keys (Standard Set)

| Key | HTTP Status | When to Use |
|-----|-------------|-------------|
| `bad_request` | 400 | Malformed JSON, missing required headers |
| `not_authenticated` | 401 | Missing or expired credentials |
| `forbidden` | 403 | Valid credentials, insufficient permissions |
| `not_found` | 404 | Resource does not exist |
| `method_not_allowed` | 405 | Wrong HTTP method |
| `conflict` | 409 | Resource state conflict (duplicate, locked) |
| `validation_error` | 422 | Input validation failures |
| `rate_limited` | 429 | Rate limit exceeded |
| `internal_error` | 500 | Unhandled server error |

#### Rules
- `error.key` is machine-readable, lowercase_with_underscores
- `error.message` is human-readable, suitable for display
- `error.errors[]` is present only for validation errors (422)
- Each field error includes `field` name and `details[]` array
- Non-field errors use `field: null` or `field: "_form"`
- Never expose stack traces, SQL, or internal paths in production

#### Migration Path
- **ShipHawk:** Wrap existing `{ "error": "string" }` in the structured format in the error rescue chain
- **Receipts:** Already compliant
- **macOS Hub:** Map `isError: true` responses to this format in any HTTP bridge layer

---

### 4. Pagination

**Standard:** Body-based pagination with consistent fields.

```json
{
  "data": [...],
  "paging": {
    "total": 500,
    "page": 1,
    "per_page": 20,
    "total_pages": 25
  }
}
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `per_page` | integer | 20 | Items per page |
| `sort` | string | varies | Sort field name |
| `direction` | string | `asc` | Sort direction: `asc` or `desc` |

#### Rules
- Maximum `per_page` capped per project (recommend 100 for general APIs, 500 for internal/admin)
- Use `total: 0, data: []` for empty results (not 404)
- Provide `total_pages` to support client progress indicators
- For very large datasets, consider cursor-based pagination as an optimization (documented separately)

#### Migration Path
- **ShipHawk:** Currently uses headers (`X-Total`, etc.); new endpoints use body-based; existing endpoints add body fields alongside headers
- **Receipts:** Currently uses `count`/`next`/`previous`; align field names to `total`/`page`/`per_page`/`total_pages`

---

### 5. DateTime Format

**Standard:** ISO 8601 with UTC timezone for all datetime fields.

```
"2026-02-08T10:30:00Z"
```

#### Rules
- All datetime fields in UTC (Z suffix)
- Full ISO 8601: `YYYY-MM-DDTHH:MM:SSZ`
- Date-only fields: `YYYY-MM-DD`
- Time-only fields: `HH:MM:SS` (24-hour)
- Never use Unix timestamps in API responses (internal storage is fine)
- Never use locale-dependent formats ("February 8, 2026")

#### Rationale
- ShipHawk, Receipts, and macOS Hub already use ISO8601
- EasyStreet Monorepo uses Unix milliseconds internally (Convex convention) — convert at API boundary
- Eliminates timezone ambiguity
- Parseable by every language's standard library

---

### 6. Input Validation

**Standard:** Validate early, fail fast, return all errors at once.

#### Rules
1. **Type checking:** Validate types before processing (`string`, `integer`, `boolean`, `array`, `object`)
2. **Required fields:** Clearly distinguish required vs optional in schema
3. **Enum values:** Use allowlists, not denylists — `values: ["pending", "shipped", "delivered"]`
4. **Coercion:** Apply consistently — trim whitespace, normalize country codes, round quantities
5. **Nested validation:** Validate nested objects/arrays recursively
6. **Batch errors:** Return ALL validation errors in a single response (not just the first one)
7. **Strip unknown fields:** Ignore undeclared parameters (don't pass through to business logic)

#### Framework-Specific Implementation

| Framework | Validation Layer | Location |
|-----------|-----------------|----------|
| Grape (Ruby) | `params do ... end` blocks + custom validators | `app/api/v4/helpers/`, `app/api/validators/` |
| DRF (Python) | Serializer fields + custom validators | `*/serializers/`, `api/validators.py` |
| Convex (TypeScript) | `v.*` validators in function args | `packages/backend/convex/*.ts` |
| MCP (TypeScript) | JSON Schema in tool inputSchema | `src/tools/*.ts` |

---

### 7. CSV Import/Export

**Standard:** Consistent CSV format for bulk data interchange across all apps.

#### CSV Format Rules
```
Header Row:  field_name_1,field_name_2,field_name_3
Data Rows:   value1,value2,value3
```

1. **Headers:** `snake_case`, matching JSON field names exactly
2. **Encoding:** UTF-8 with BOM for Excel compatibility
3. **Delimiter:** Comma (`,`); use double-quotes for fields containing commas
4. **Newlines:** CRLF (`\r\n`) for maximum compatibility
5. **Null values:** Empty string (not "null", "NULL", or "N/A")
6. **Boolean values:** `true`/`false` (lowercase)
7. **DateTime values:** ISO 8601 (`2026-02-08T10:30:00Z`)
8. **Nested objects:** Flatten with dot notation — `address.street1`, `address.city`
9. **Arrays:** JSON-encode in cell — `"[1,2,3]"` or `"[""item1"",""item2""]"`

#### Import Endpoint Pattern
```
POST /api/v4/{resource}/import
Content-Type: multipart/form-data

Parameters:
  file: <csv_file>          (required, .csv extension enforced)
  mode: "create" | "upsert" (optional, default: "create")
  dry_run: true | false     (optional, default: false)
```

#### Import Response
```json
{
  "data": {
    "import_id": "imp-abc123",
    "status": "processing",
    "total_rows": 500,
    "processed": 0,
    "errors": []
  }
}
```

#### Export Endpoint Pattern
```
POST /api/v4/{resource}/export
Accept: text/csv

Parameters:
  format: "csv"                 (required)
  fields: ["field1", "field2"]  (optional, default: all fields)
  filters: { ... }             (optional, same as list endpoint filters)
```

#### Export Response
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="orders-2026-02-08.csv"

order_number,status,created_at,address.street1,address.city
ORD-001,shipped,2026-02-08T10:30:00Z,123 Main St,New York
```

#### CSV-JSON Field Mapping
Every exportable resource MUST document the mapping between CSV headers and JSON fields:

```json
{
  "csv_header": "order_number",
  "json_path": "order_number",
  "type": "string",
  "required_on_import": true,
  "example": "ORD-001"
}
```

#### Migration Path
- **ShipHawk:** Already has CSV import/export; standardize headers to match JSON field names
- **Receipts:** Add CSV export to list endpoints; add CSV import for bulk operations
- **EasyStreet Monorepo:** Add CSV export for street segment data (useful for data updates)
- **macOS Hub:** Not applicable (MCP protocol, not HTTP)

---

### 8. Authentication Headers

**Standard:** Bearer token in Authorization header.

```
Authorization: Bearer <token>
```

#### Rules
- Primary auth: `Authorization: Bearer <token>` header
- API key auth (where needed): `X-Api-Key: <key>` header
- Service-to-service: `X-Service-Token: <token>` header
- Never pass credentials as query parameters
- Never pass credentials in request body (except login endpoint)
- Rate limit by API key or user token
- Return `401` for missing/invalid auth, `403` for insufficient permissions

#### Per-Project Implementation

| Project | Current Auth | Standard Compliant? |
|---------|-------------|-------------------|
| ShipHawk | X-User-Email + X-User-Token + X-Api-Key | Partial (add Bearer support) |
| Receipts | Bearer JWT | Yes |
| EasyStreet Mono | Convex SDK auth | N/A (not HTTP) |
| macOS Hub | MCP protocol | N/A (not HTTP) |

---

### 9. Versioning

**Standard:** Path-based versioning for HTTP APIs.

```
/api/v1/orders
/api/v2/orders
```

#### Rules
- Version in URL path, not headers
- Start at `v1` for new APIs
- Deprecation period: minimum 6 months with `Sunset` header and `410 Gone` after removal
- Never break backwards compatibility within a version
- New versions only when request/response shape changes (not for new endpoints)

---

### 10. Content Negotiation

**Standard:** JSON as default, CSV as opt-in.

| Accept Header | Response Format |
|--------------|-----------------|
| `application/json` (default) | JSON with standard envelope |
| `text/csv` | CSV with standard headers |
| `*/*` or missing | JSON |

#### Rules
- JSON is always the default format
- CSV available on endpoints that explicitly support it
- Use `Accept` header, not query parameter, for format selection
- Return `406 Not Acceptable` if requested format is unsupported

---

## Per-Project Compliance Checklist

Teams should review this checklist against their project and file issues for non-compliant items.

### ShipHawk

| Standard | Status | Notes |
|----------|--------|-------|
| JSON envelope | Non-compliant | Uses bare objects/arrays; adopt for new endpoints |
| snake_case keys | Compliant | Already uses snake_case throughout |
| Error format | Partial | Has `{error: string}` — needs structured format |
| Pagination (body) | Non-compliant | Uses headers; add body pagination alongside |
| ISO8601 datetime | Compliant | Already uses format_with: :iso8601 |
| Input validation | Compliant | Excellent — 25+ validators, coercers |
| CSV import/export | Compliant | 5+ import/export endpoints |
| Auth headers | Partial | Custom headers; add Bearer token support |
| Versioning | Compliant | Path-based v3/v4 |
| Content negotiation | Partial | JSON default, CSV on specific endpoints |

### Receipts

| Standard | Status | Notes |
|----------|--------|-------|
| JSON envelope | Compliant | Uses {data, paging} already |
| snake_case keys | Compliant | Already uses snake_case |
| Error format | Compliant | Structured {error: {key, status_code, message, errors}} |
| Pagination (body) | Compliant | Body-based with count/next/previous |
| ISO8601 datetime | Compliant | Django default |
| Input validation | Compliant | DRF serializers + custom validators |
| CSV import/export | Non-compliant | Not yet implemented |
| Auth headers | Compliant | Bearer JWT |
| Versioning | Non-compliant | No versioning; add /api/v1/ prefix |
| Content negotiation | Partial | JSON only |

### EasyStreet Monorepo

| Standard | Status | Notes |
|----------|--------|-------|
| JSON envelope | N/A | Convex SDK (not HTTP); apply when adding HTTP layer |
| snake_case keys | Non-compliant | Uses camelCase; add transform layer for HTTP endpoints |
| Error format | N/A | Convex handles errors at framework level |
| Pagination (body) | N/A | Not applicable for current SDK usage |
| ISO8601 datetime | Non-compliant | Uses Unix ms; convert at API boundary |
| Input validation | Compliant | Convex validators built-in |
| CSV import/export | Non-compliant | No CSV support; add for data updates |
| Auth headers | N/A | Convex SDK auth |
| Versioning | N/A | Not HTTP |
| Content negotiation | N/A | Not HTTP |

### macOS Hub

| Standard | Status | Notes |
|----------|--------|-------|
| JSON envelope | N/A | MCP protocol has own envelope |
| snake_case keys | Partial | Tool args are snake_case; TS interfaces are camelCase |
| Error format | Partial | Uses isError flag; internal JSON should follow standard |
| Pagination | N/A | Not applicable |
| ISO8601 datetime | Compliant | String dates in ISO format |
| Input validation | Compliant | JSON Schema in tool definitions |
| CSV import/export | N/A | Not applicable |
| Auth headers | N/A | MCP protocol |
| Versioning | N/A | Tool versioning via MCP protocol |
| Content negotiation | N/A | MCP protocol |

---

## Implementation Recommendations

### Priority 1: Adopt Across New Endpoints Immediately
1. **JSON envelope** — All new endpoints use `{data, paging}` format
2. **Structured errors** — All new error responses use the standard error object
3. **snake_case keys** — Enforce in code review for all new API work

### Priority 2: Standardize CSV (Next Sprint)
1. Document CSV field mappings for ShipHawk's existing CSV endpoints
2. Add CSV export to Receipts list endpoints
3. Create shared CSV parsing utilities (headers ↔ JSON field mapping)

### Priority 3: Align Existing APIs (Incremental)
1. ShipHawk: Add body-based pagination alongside existing header pagination
2. ShipHawk: Wrap error strings in structured error objects
3. Receipts: Add `/api/v1/` path prefix
4. EasyStreet Monorepo: Add HTTP API layer with snake_case transform when needed

### Priority 4: Documentation
1. Generate OpenAPI/Swagger specs from code (grape-swagger gem for ShipHawk, drf-spectacular for Receipts)
2. Maintain CSV field mapping docs alongside API docs
3. Add examples to each endpoint's documentation

---

## Appendix: Requirements Gathering Process

### How This Review Was Conducted

**Phase 1 — Codebase Exploration (Parallel)**
Three specialized agents reviewed the codebase simultaneously:
- **ShipHawk API Agent:** Deep dive into `app/api/`, `app/serializers/`, `lib/coercers/`, `app/api/validators/`
- **Cross-Project Agent:** Reviewed Receipts (DRF), EasyStreet Monorepo (Convex), macOS Hub (MCP), EasyStreet Native (iOS/Android)
- **Standards Compiler:** Synthesized findings into this document

**Phase 2 — Pattern Extraction**
Each agent documented:
- JSON structure conventions (envelopes, nesting, key naming)
- Input validation approach (framework, custom validators, coercers)
- Output serialization patterns (entities, serializers, type definitions)
- Error response formats (structure, status codes, field-level errors)
- CSV/data import-export capabilities
- Authentication patterns

**Phase 3 — Gap Analysis**
Compared all projects against each standard to identify:
- What's already compliant
- What needs migration
- What's not applicable (different transport/protocol)

**Phase 4 — Standards Definition**
Drafted universal standards drawing best practices from:
- ShipHawk's mature validation/coercion pipeline
- Receipts' clean envelope and error patterns
- Industry standards (Stripe, GitHub, Twilio API conventions)
- CSV RFC 4180 with practical additions

### How to Use This Document

1. **Project teams:** Review the [Per-Project Compliance Checklist](#per-project-compliance-checklist) for your project
2. **New projects:** Follow the [Universal API Standards](#universal-api-standards) from day one
3. **Code reviewers:** Reference these standards when reviewing API changes
4. **Next steps:** This document feeds into the upcoming commit/PR policy review, which will establish how API changes are documented, reviewed, and deployed across the workspace

### Reproducing This Review for Other Contexts

To run a similar review for a new project or workspace:

1. **Identify all API surfaces** — REST endpoints, SDK functions, CLI tools, data files
2. **Deploy parallel review agents** — One per project/stack, focused on the 10 categories in this document
3. **Extract patterns** — Document what each project does for each category
4. **Build comparison matrix** — Side-by-side view reveals gaps and inconsistencies
5. **Draft standards** — Draw from the strongest patterns; default to industry conventions for gaps
6. **Create compliance checklists** — Per-project, actionable, with migration paths
7. **Prioritize** — New code first, then incremental migration of existing code

---

*Generated by API Standards Review Team — 2026-02-08*
*Next review: Commit/PR Policy Standards (queued)*
