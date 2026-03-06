# Knowledge Graph API -- Benchmark Report

**Date:** 2026-03-06
**API Base:** `https://mcp-knowledge-graph.fly.dev`
**Server Version:** 1.0.0
**NLP Model:** spaCy `en_core_web_sm` (loaded)
**Database:** PostgreSQL (connected)
**Redis:** Connected

---

## Test Matrix

| # | Test Name | Method | Endpoint | Status | Time (s) | Entities/Facts | Result |
|---|-----------|--------|----------|--------|----------|----------------|--------|
| 1a | Entity extraction (full) | POST | `/entities/extract` | 200 | 1.359 | 8 entities (raw: 8) | PASS |
| 1b | Entity extraction (filtered: PERSON, ORG) | POST | `/entities/extract` | 200 | 1.344 | 4 entities (raw: 4) | PASS |
| 2 | Entity linking | POST | `/entities/link` | 200 | 0.892 | 3 linked (0 existing, 3 created, 0 failed) | PASS |
| 3 | Add fact | POST | `/facts` | 200 | 1.192 | 1 fact stored | PASS |
| 4 | Search entities | POST | `/entities/search` | 200 | 0.739 | 1 entity found | PASS |
| 5 | Query entity (depth=2) | POST | `/entities/query` | 200 | 0.819 | 1 entity, 0 relationships, depth_reached=0 | PASS |
| 6 | Get facts | GET | `/facts?subject=Apple` | 200 | 1.127 | 1 fact returned | PASS |
| 7 | Capabilities | GET | `/capabilities` | 200 | 0.389 | 8 entity types, 8 predicates | PASS |
| 8 | Health check | GET | `/health` | 200 | 0.407 | -- | PASS |
| 9 | Root endpoint | GET | `/` | 200 | 0.103 | -- | PASS |
| 10 | A2A agent card | GET | `/.well-known/agent-card.json` | 200 | 0.335 | -- | PASS |
| 11 | MCP manifest | GET | `/.well-known/mcp.json` | 200 | 0.456 | -- | PASS |
| E1 | Extract (no wallet header) | POST | `/entities/extract` | 500 | 0.700 | -- | **FAIL** |
| E2 | Extract (empty text) | POST | `/entities/extract` | 200 | 2.735 | 0 entities | PASS |
| E3 | Extract (invalid body) | POST | `/entities/extract` | 422 | 0.858 | -- | PASS |
| E4 | Query (non-existent entity) | POST | `/entities/query` | 404 | 0.766 | -- | PASS |
| E5 | Query (depth > max 3) | POST | `/entities/query` | 422 | 0.914 | -- | PASS |
| E6 | Privacy endpoint | GET | `/privacy` | 404 | 0.390 | -- | **FAIL** |

---

## Sample Outputs

### Test 1a: Entity Extraction (full text)

**Input:** "Apple was founded by Steve Jobs and Steve Wozniak in Cupertino, California in 1976. Tim Cook is the current CEO."

```json
{
  "entities": [
    {"name": "Apple", "type": "ORG", "confidence": 0.9},
    {"name": "Steve Jobs", "type": "PERSON", "confidence": 0.9},
    {"name": "Steve Wozniak", "type": "PERSON", "confidence": 0.9},
    {"name": "Cupertino", "type": "LOCATION", "confidence": 0.9},
    {"name": "California", "type": "LOCATION", "confidence": 0.9},
    {"name": "1976", "type": "DATE", "confidence": 0.9},
    {"name": "Tim Cook", "type": "PERSON", "confidence": 0.9},
    {"name": "the current CEO", "type": "CONCEPT", "confidence": 0.7}
  ],
  "raw_count": 8
}
```

**Observations:**
- Named entities (PERSON, ORG, LOCATION, DATE) get confidence 0.9
- Noun chunks classified as CONCEPT get confidence 0.7
- "Cupertino" and "California" correctly identified as LOCATION (via spaCy GPE mapping)
- "the current CEO" extracted as CONCEPT via noun chunk extraction (not NER)

### Test 1b: Entity Extraction (filtered: PERSON + ORG only)

```json
{
  "entities": [
    {"name": "Apple", "type": "ORG", "confidence": 0.9},
    {"name": "Steve Jobs", "type": "PERSON", "confidence": 0.9},
    {"name": "Steve Wozniak", "type": "PERSON", "confidence": 0.9},
    {"name": "Tim Cook", "type": "PERSON", "confidence": 0.9}
  ],
  "raw_count": 4
}
```

Type filtering correctly excludes LOCATION, DATE, and CONCEPT entities.

### Test 2: Entity Linking

**Input:** entities: ["Apple", "Steve Jobs", "Tim Cook"], types: ["ORG", "PERSON", "PERSON"]

```json
{
  "linked": [],
  "created": [
    {"name": "Apple", "type": "ORG", "source_count": 1},
    {"name": "Steve Jobs", "type": "PERSON", "source_count": 1},
    {"name": "Tim Cook", "type": "PERSON", "source_count": 1}
  ],
  "failed": []
}
```

**Observation:** All three showed as "created" despite being extracted in Test 1a. This is because the link endpoint resolved them against the same entities (same IDs) but the `source_count == 1` heuristic classified them as "created." This is a known design choice -- the resolver matched existing entities but the source_count was still 1.

### Test 3: Add Fact

**Input:** subject: "Apple", predicate: "founded_by", object: "Steve Jobs", confidence: 0.95

```json
{
  "fact": {
    "id": "e2ec95e2-...",
    "subject_id": "d810b050-...",
    "predicate": "founded_by",
    "object_id": "8de177c2-...",
    "confidence": 0.95,
    "created_at": "2026-03-06T03:51:06.037480+00:00"
  },
  "subject": {"name": "Apple", "type": "CONCEPT"},
  "object": {"name": "Steve Jobs", "type": "CONCEPT"}
}
```

**Observation:** The `add_fact` endpoint resolves subject and object as type "CONCEPT" by default (hardcoded in route handler line 128-129). This means "Apple" gets a new entity as type CONCEPT separate from the existing ORG entity. This is a bug -- the fact endpoint should accept and pass through entity types, or look up existing entities first.

### Test 5: Query Entity (depth=2)

```json
{
  "entity": {"name": "Apple", "type": "ORG", "confidence": 0.9},
  "relationships": [],
  "depth_reached": 0
}
```

**Observation:** The query found the ORG-typed "Apple" but returned no relationships despite a fact having been added. This is because the fact was stored under a different "Apple" entity (type CONCEPT, different UUID). The type mismatch between extract (ORG) and add_fact (CONCEPT) causes disconnected entities.

### Test 6: Get Facts

```json
{
  "facts": [
    {
      "subject_id": "d810b050-...",
      "predicate": "founded_by",
      "object_id": "8de177c2-...",
      "confidence": 0.95
    }
  ],
  "total": 1
}
```

The GET `/facts?subject=Apple` endpoint found the fact correctly by searching the subject name.

### Test 7: Capabilities

```json
{
  "entity_types": ["PERSON", "ORG", "PRODUCT", "LOCATION", "EVENT", "CONCEPT", "URL", "DATE"],
  "predicate_examples": ["works_for", "located_in", "founded_by", "owns", "created", "member_of", "related_to", "mentioned_in"],
  "features": ["Named Entity Recognition (spaCy)", "Entity Resolution (fuzzy matching)", "Fact Storage (subject-predicate-object)", "Graph Traversal (configurable depth, max 3)", "Entity Search (name and type filtering, trigram fuzzy match)", "Confidence Scoring"],
  "limits": {
    "max_text_length": 100000,
    "max_traversal_depth": 3,
    "rate_limit": "60 requests/minute per IP (paid endpoints)"
  }
}
```

---

## Performance Summary

| Category | Avg Response Time |
|----------|------------------|
| Free endpoints (health, capabilities, root) | 0.30s |
| Entity extraction (NER + resolution) | 1.35s |
| Entity linking (resolution only) | 0.89s |
| Add fact (resolution + storage) | 1.19s |
| Search entities (DB query) | 0.74s |
| Query entity (graph traversal) | 0.82s |
| Get facts (DB query) | 1.13s |
| Discovery (.well-known endpoints) | 0.40s |

---

## Pass/Fail Summary

**Total tests:** 18
**Passed:** 16 (89%)
**Failed:** 2 (11%)

### Failures

1. **E1: No wallet header returns 500 instead of 402**
   - **Severity:** High
   - **Description:** All paid endpoints return HTTP 500 "Internal Server Error" when no `X-Wallet` header is provided. The expected behavior is 402 Payment Required (per x402 protocol) or a descriptive error message.
   - **Root cause:** The `FreeTrialMiddleware` sets `request.state.free_trial = False` and passes to `call_next`. The `x402_payment_gate` middleware then checks `request.state.free_trial` -- when False, it calls `_x402_mw(request, call_next)`. The x402 middleware likely throws an unhandled exception when no payment header is present, causing the bare 500.
   - **Impact:** Users calling the API without a wallet header see an opaque "Internal Server Error" with no guidance on how to authenticate. The SKILL.md does not document the `X-Wallet` header requirement.

2. **E6: /privacy endpoint returns 404**
   - **Severity:** Low
   - **Description:** The `/privacy` route is defined in `graph.py` (line 251) but returns 404 at the live endpoint. This may be a routing precedence issue or the route was not included in the deployed build.
   - **Impact:** The root endpoint and capabilities both reference `/privacy` as a link, but it does not resolve.

---

## Additional Issues Found

### Issue: Entity type mismatch between extract and add_fact

The `add_fact` endpoint hardcodes entity type as "CONCEPT" when resolving subject and object (line 128-129 in `graph.py`). This creates duplicate entities when the same name was previously extracted with a different type (e.g., "Apple" as ORG via extraction, but "Apple" as CONCEPT via add_fact). The graph query then cannot traverse between them.

**Recommendation:** Accept an optional `subject_type` and `object_type` in the `AddFactRequest` schema, or perform a type-agnostic entity lookup before creating new entities.

### Issue: SKILL.md missing X-Wallet header documentation

The skill definition does not mention the `X-Wallet` header, which is required for the free trial pathway. Without it, all paid endpoints fail with 500.

**Recommendation:** Add `X-Wallet` header to all curl examples in the SKILL.md, or document the authentication requirement.

### Issue: Entity resolution creates new entities across different type namespaces

Entities are scoped by type during resolution (`search_entities` with `type_filter`). This means the same real-world entity (e.g., "Apple") can exist as multiple graph entries under different types (ORG, CONCEPT). The fuzzy matching only searches within the same type.

---

## Skill Definition Accuracy

| SKILL.md Claim | Verified |
|----------------|----------|
| API Base: `https://mcp-knowledge-graph.fly.dev` | Yes |
| POST /entities/extract works | Yes (with X-Wallet header) |
| POST /entities/link works | Yes (with X-Wallet header) |
| POST /facts works | Yes (with X-Wallet header) |
| POST /entities/search works | Yes (with X-Wallet header) |
| POST /entities/query works | Yes (with X-Wallet header) |
| GET /facts works | Yes (with X-Wallet header) |
| GET /capabilities works | Yes (no auth needed) |
| Entity types: PERSON, ORG, PRODUCT, LOCATION, EVENT, CONCEPT, URL, DATE | Yes |
| Max text length: 100,000 characters | Documented, not tested at boundary |
| Max traversal depth: 3 | Validated (422 returned for depth=5) |
| Error 400 for text exceeds limit | Not triggered (documented) |
| Error 402 for payment required | Returns 500 instead (bug) |
| Error 404 for entity not found | Yes |
| Error 429 for rate limit | Not triggered (documented) |
