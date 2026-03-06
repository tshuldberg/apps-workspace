# Deep Code Audit: Live MCP Apps

Date: 2026-03-05  
Workspace: `/Users/trey/Desktop/Apps/mcp-apps`  
Apps audited:
- `mcp-web-crawler` (`https://mcp-web-crawler.fly.dev`)
- `mcp-structured-extractor` (`https://mcp-bank-extractor.fly.dev`)
- `mcp-document-parser` (`https://mcp-document-parser.fly.dev`)
- `mcp-knowledge-graph` (`https://mcp-knowledge-graph.fly.dev`)

## Skill Used
- `audit-code` skill (`/Users/trey/.codex/skills/audit-code/SKILL.md`) for structured audit flow (scope, automated checks, severity categorization, report format).

## Scope and Assumptions
- Audited the current local working trees for each repo (not pinned to deployment artifact SHA).
- Focus was efficiency and accuracy, with security/privacy as blockers where they affect production correctness.
- Existing uncommitted changes were present in all four repos and were included in the audit surface.

## Methodology

### 1) Static Architecture and Hot-Path Review
Goal:
- Find efficiency bottlenecks and correctness risks in request-to-response paths.

How:
- Read main app bootstrap, route handlers, middleware, and core pipeline/store modules with line-level inspection.

Examples:
- Web crawler hot path:
  - `mcp-web-crawler/src/app/crawler/fetcher.py:47-60`
  - `mcp-web-crawler/src/app/crawler/pipeline.py:15-84`
- Structured extractor hot path:
  - `mcp-structured-extractor/src/app/extraction/pipeline.py:51-103`
  - `mcp-structured-extractor/src/app/extraction/llm_extract.py:55-113`
- Document parser hot path:
  - `mcp-document-parser/src/app/routes/parser.py:47-155`
  - `mcp-document-parser/src/app/parsers/url_parser.py:14-72`
- Knowledge graph hot path:
  - `mcp-knowledge-graph/src/app/routes/graph.py:42-214`
  - `mcp-knowledge-graph/src/app/graph/store.py:291-345`

### 2) Automated Quality Checks
Goal:
- Verify baseline health (tests, lint, import-time compile).

How:
- Per repo: `uv run ruff check src tests mcp_shared`, `uv run pytest -q`, `uv run python -m compileall -q src`.

Examples and results:
- `mcp-web-crawler`: `ruff` failed (14), `pytest` passed (24), compile passed.
- `mcp-structured-extractor`: `ruff` failed (23), `pytest` passed (38), compile passed.
- `mcp-document-parser`: `ruff` failed (60), `pytest` passed (15), compile passed.
- `mcp-knowledge-graph`: `ruff` failed (28), `pytest` passed (24), compile passed.

### 3) Security and Privacy Policy Conformance
Goal:
- Validate against workspace privacy rules and security expectations for public endpoints.

How:
- Searched middleware, logging, free path config, and privacy endpoint implementation.
- Cross-checked against workspace critical policy in `CLAUDE.md`.

Examples:
- Policy requirements:
  - `/Users/trey/Desktop/Apps/mcp-apps/CLAUDE.md:53`
  - `/Users/trey/Desktop/Apps/mcp-apps/CLAUDE.md:57`
- Shared free trial implementation:
  - `mcp-web-crawler/mcp_shared/free_trial.py:33-36`
  - `mcp-web-crawler/mcp_shared/free_trial.py:138-143`
  - Same pattern in each app’s `mcp_shared/free_trial.py`.

### 4) Accuracy and Contract Integrity Checks
Goal:
- Ensure declared API contract and schema behavior match runtime behavior.

How:
- Compared request/response schemas to route and pipeline behavior.
- Checked how validation errors are surfaced vs suppressed.

Examples:
- Structured schema validation is swallowed:
  - `mcp-structured-extractor/src/app/extraction/pipeline.py:44-48`
- Document parser error translation:
  - `mcp-document-parser/src/app/routes/parser.py:62-63`, `80-81`, `99-100`, `120-121`

### 5) Test Adequacy Review
Goal:
- Identify gaps where tests do not cover high-risk behavior.

How:
- Enumerated test suites and mapped to critical risk categories.

Examples:
- Free-trial tests exist but do not assert `/privacy` free-path requirement.
- No SSRF coverage for URL-fetching tools in crawler/extractor/document-parser.

## Findings (Ordered by Severity)

## CRITICAL

### C1. Persistent IP and wallet logging violates portfolio privacy rules
Affected:
- All four apps (`mcp_shared/free_trial.py` in each repo)

Evidence:
- Policy forbids persistent IP correlation/logging beyond ephemeral rate limiting:
  - `/Users/trey/Desktop/Apps/mcp-apps/CLAUDE.md:57`
- Free-trial abuse logs persist IP and wallet fields:
  - `mcp-web-crawler/mcp_shared/free_trial.py:138-143`
  - `mcp-structured-extractor/mcp_shared/free_trial.py:138-143`
  - `mcp-document-parser/mcp_shared/free_trial.py:138-143`
  - `mcp-knowledge-graph/mcp_shared/free_trial.py:138-143`

Impact:
- Direct policy non-compliance on production services.
- Potential legal/privacy exposure if abuse logs are retained/backed up.

Fix direction:
- Remove raw IP and wallet from persisted abuse logs.
- Replace with short-lived hashed/tokenized identifiers and aggregate counters.
- Enforce TTL and deletion policy for abuse telemetry.

## HIGH

### H1. `/privacy` is not in `FREE_PATHS` (explicit policy violation)
Affected:
- All four apps (`mcp_shared/free_trial.py`)

Evidence:
- Policy requirement:
  - `/Users/trey/Desktop/Apps/mcp-apps/CLAUDE.md:53`
- Current FREE_PATHS omits `/privacy`:
  - `mcp-web-crawler/mcp_shared/free_trial.py:33-36`
  - `mcp-structured-extractor/mcp_shared/free_trial.py:33-36`
  - `mcp-document-parser/mcp_shared/free_trial.py:33-36`
  - `mcp-knowledge-graph/mcp_shared/free_trial.py:33-36`

Impact:
- Policy endpoint is not guaranteed free from middleware checks/tracking path.

Fix direction:
- Add `"/privacy"` to `FREE_PATHS` in shared middleware and add regression tests.

### H2. URL fetch paths have SSRF exposure (no private-network egress guard)
Affected:
- `mcp-web-crawler`, `mcp-structured-extractor`, `mcp-document-parser`

Evidence:
- Direct user-supplied URL fetch without host/IP allow/deny filtering:
  - `mcp-web-crawler/src/app/crawler/fetcher.py:25-27`, `47-49`
  - `mcp-structured-extractor/src/app/extraction/fetcher.py:46-53`
  - `mcp-document-parser/src/app/parsers/url_parser.py:29-31`

Impact:
- Attackers can target internal addresses/metadata endpoints if network permits.

Fix direction:
- Enforce scheme restrictions (`http/https` only).
- Resolve and deny RFC1918, localhost, link-local, multicast ranges.
- Consider outbound proxy/allowlist at infra layer.

### H3. Document parser URL parsing can memory-amplify large downloads
Affected:
- `mcp-document-parser`

Evidence:
- Downloads full response into memory, then base64-encodes entire content:
  - `mcp-document-parser/src/app/parsers/url_parser.py:34`, `62`
- No content-length/stream hard-stop for URL ingestion path.

Impact:
- Memory pressure and latency spikes under large files; DoS risk.

Fix direction:
- Stream with hard byte cap before buffering.
- Reject oversized responses with clear 413/422.

## MEDIUM

### M1. Web crawler response assembly is O(n^2) byte concatenation
Affected:
- `mcp-web-crawler`

Evidence:
- `content += chunk` inside async stream loop:
  - `mcp-web-crawler/src/app/crawler/fetcher.py:56-59`

Impact:
- Avoidable CPU/memory overhead for larger pages.

Fix direction:
- Use `bytearray` append or chunk list + `b"".join`.

### M2. Structured extractor suppresses schema validation failures
Affected:
- `mcp-structured-extractor`

Evidence:
- Validation exceptions are swallowed; potentially invalid payload still returned:
  - `mcp-structured-extractor/src/app/extraction/pipeline.py:44-48`

Impact:
- Contract accuracy drift; downstream consumers may treat invalid data as valid.

Fix direction:
- Surface validation status in response (`valid`, `validation_errors`) or fail with 422 on strict mode.

### M3. Structured extractor lacks response-size limits for fetch/image
Affected:
- `mcp-structured-extractor`

Evidence:
- HTML fetch has timeout but no body-size guard:
  - `mcp-structured-extractor/src/app/extraction/fetcher.py:46-65`
- Image size checked only after full download:
  - `mcp-structured-extractor/src/app/extraction/image_extract.py:35-46`

Impact:
- Elevated memory usage, expensive upstream calls, tail latency issues.

Fix direction:
- Stream download with early cutoff and hard max bytes for HTML and image inputs.

### M4. Knowledge graph entity resolution is sequential and chatty
Affected:
- `mcp-knowledge-graph`

Evidence:
- Batch resolution iterates serially, each resolve performs DB-backed search:
  - `mcp-knowledge-graph/src/app/graph/resolver.py:101-107`
  - `mcp-knowledge-graph/src/app/graph/resolver.py:54-58`
- Route resolves all extracted entities without pre-dedupe:
  - `mcp-knowledge-graph/src/app/routes/graph.py:61-66`

Impact:
- Throughput degrades with long texts/high entity counts.

Fix direction:
- Deduplicate `(normalized_text, type)` before resolve.
- Resolve in bounded concurrency with local memoization per request.

### M5. In-memory rate-limit maps can grow without bound
Affected:
- `mcp-web-crawler`, `mcp-document-parser`, `mcp-knowledge-graph`

Evidence:
- Per-IP/domain buckets use in-memory dict/list with no key eviction strategy:
  - `mcp-web-crawler/src/app/middleware/rate_limit.py:27`, `42-43`
  - `mcp-document-parser/src/app/middleware/rate_limit.py:34`
  - `mcp-knowledge-graph/src/app/middleware/rate_limit.py:27`

Impact:
- Long-lived processes may accumulate large keysets under broad IP churn.

Fix direction:
- Add stale-key eviction or move counters to Redis with TTL.

## LOW

### L1. Lint debt is high across all apps (mostly import hygiene and style)
Evidence:
- Ruff failures: 14 / 23 / 60 / 28 by repo.

Impact:
- Low immediate production risk; higher maintenance friction.

Fix direction:
- Run `ruff --fix` in controlled PR, then address remaining violations manually.

### L2. Runtime warnings indicate dependency/API drift
Evidence:
- Structured extractor test warning: Requests dependency mismatch.
- FastAPI deprecation warnings for `ORJSONResponse`.

Impact:
- Not immediately breaking; can become breaking in future upgrades.

Fix direction:
- Align dependency versions; migrate from deprecated response patterns.

## Test Coverage Gaps
- No regression test that asserts `/privacy` is in `FREE_PATHS` across all shared middleware copies.
- No SSRF tests for URL/image fetch endpoints.
- No stress tests for large streaming responses and memory ceilings.
- No performance budget tests (P95 latency, CPU per request, cold/warm cache path).

## Repo-Level Efficiency/Accuracy Assessment

| Repo | Efficiency | Accuracy | Notes |
|---|---|---|---|
| `mcp-web-crawler` | B- | B | Good baseline, but fetch path and shared middleware issues need fixes. |
| `mcp-structured-extractor` | C+ | C+ | Flexible extraction pipeline; current validation semantics and size controls reduce reliability. |
| `mcp-document-parser` | C | B- | Core parsers work; URL ingestion path can over-consume memory. |
| `mcp-knowledge-graph` | C+ | B | Functional graph logic; sequential resolution limits throughput under load. |

## Recommended Remediation Sequence
1. Shared compliance fixes first:
   - Patch all `mcp_shared/free_trial.py` copies for `/privacy` free path and no persisted IP/wallet.
2. Network and payload hardening:
   - Add SSRF guards and streaming byte caps to all URL/image fetchers.
3. Performance fixes:
   - Web crawler byte assembly optimization.
   - Knowledge graph dedupe + bounded-concurrency resolver path.
4. Accuracy contract improvements:
   - Structured extractor schema validation reporting/strict mode.
5. Test and lint quality:
   - Add targeted regression/perf/security tests.
   - Clean lint debt after functional fixes.

## Verification Log (What Was Executed)
- `uv run ruff check src tests mcp_shared` (per repo)
- `uv run pytest -q` (per repo)
- `uv run python -m compileall -q src` (per repo)
- Targeted code scans with `rg` for:
  - `FREE_PATHS`, `/privacy`, logging patterns, request body handling, secret-like literals.
- Manual source review with line-numbered inspection on:
  - app entrypoints, route handlers, fetchers/parsers, shared middleware, store/resolver code.
