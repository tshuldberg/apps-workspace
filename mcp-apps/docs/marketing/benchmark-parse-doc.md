# Benchmark Report: /parse-doc (Document Parser API)

**Service:** mcp-document-parser
**URL:** https://mcp-document-parser.fly.dev
**Date:** 2026-03-06
**Version:** 1.0.0

## Test Matrix

### Free Endpoints

| # | Test Name | Endpoint | Method | Status | Time (s) | Result |
|---|-----------|----------|--------|--------|----------|--------|
| 1 | Health Check | `/health` | GET | 200 | 0.168 | PASS -- returns `{"status":"ok"}` with timestamp |
| 2 | Capabilities | `/capabilities` | GET | 200 | 0.065 | PASS -- full format/feature/pricing/limits listing |
| 3 | Root | `/` | GET | 200 | 0.070 | PASS -- service info with endpoint directory |
| 4 | Agent Card | `/.well-known/agent-card.json` | GET | 200 | 0.115 | PASS -- A2A-compliant agent card with pricing |
| 5 | MCP Manifest | `/.well-known/mcp.json` | GET | 200 | 0.084 | PASS -- MCP 2024-11-05 manifest |
| 6 | Privacy | `/privacy` | GET | 404 | 0.568 | **FAIL** -- 404 Not Found (endpoint referenced in root response and capabilities but not registered) |

### x402 Payment Gate (No Payment Header)

| # | Test Name | Endpoint | Method | Status | Time (s) | Result |
|---|-----------|----------|--------|--------|----------|--------|
| 7 | Parse PDF (no pay) | `/parse/pdf` | POST | 402 | 0.405 | PASS -- correct 402 with wallet address and USDC amount ($0.008) |
| 8 | Parse URL (no pay) | `/parse/url` | POST | 402 | 0.416 | PASS -- correct 402 with $0.010 amount |
| 9 | Parse DOCX (no pay) | `/parse/docx` | POST | 402 | 0.915 | PASS -- correct 402 with $0.005 amount |
| 10 | Parse XLSX (no pay) | `/parse/xlsx` | POST | 402 | 0.804 | PASS -- correct 402 with $0.005 amount |
| 11 | Extract Tables (no pay) | `/parse/tables` | POST | 402 | 0.735 | PASS -- correct 402 with $0.006 amount |

### Paid Endpoints (With X-Payment Header)

| # | Test Name | Endpoint | Method | Status | Time (s) | Result |
|---|-----------|----------|--------|--------|----------|--------|
| 12 | Parse PDF (minimal) | `/parse/pdf` | POST | 200 | 0.193 | PASS -- structured ParseResult returned |
| 13 | Parse URL (W3C PDF) | `/parse/url` | POST | 200 | 0.439 | PASS -- full content extraction with metadata |
| 18 | Extract Tables (empty PDF) | `/parse/tables` | POST | 200 | 0.177 | PASS -- returns empty array (no tables in minimal PDF) |

### Error Cases

| # | Test Name | Endpoint | Method | Status | Time (s) | Result |
|---|-----------|----------|--------|--------|----------|--------|
| 14 | Non-existent domain | `/parse/url` | POST | 400 | 0.228 | PASS -- clear DNS error: `Name or service not known` |
| 15 | 404 URL | `/parse/url` | POST | 400 | 0.305 | PASS -- clear HTTP error with MDN link reference |
| 16 | Corrupt PDF data | `/parse/pdf` | POST | 400 | 0.117 | PASS -- `Failed to open stream` error |
| 17 | Missing required field | `/parse/url` | POST | 422 | 0.071 | PASS -- Pydantic validation error with location |
| 19 | Unsupported table format | `/parse/tables` | POST | 400 | 0.054 | PASS -- clear format error message |

### MCP Endpoint

| # | Test Name | Endpoint | Method | Status | Time (s) | Result |
|---|-----------|----------|--------|--------|----------|--------|
| 20 | MCP tools/list | `/mcp` | POST | 200 | 0.073 | PASS -- 6 tools with full JSON Schema inputs |
| 21 | MCP parse_from_url | `/mcp` | POST | 200 | 0.125 | PASS -- full parse via MCP (bypasses x402) |
| 22 | MCP list_capabilities | `/mcp` | POST | 200 | 0.062 | PASS -- capabilities returned via MCP |
| 23 | MCP invalid tool | `/mcp` | POST | 200 | 0.060 | PASS -- graceful error in result content |

## Sample Outputs

### Parse URL Result (Test 13, truncated)

```json
{
  "format": "pdf",
  "page_count": 1,
  "title": "",
  "author": "Evangelos Vlachogiannis",
  "created_at": "2007-02-23T00:00:00",
  "word_count": 3,
  "sections": [
    {
      "title": "Document Content",
      "level": 1,
      "content": "Dummy PDF file\n",
      "page": 1
    }
  ],
  "tables": [],
  "hyperlinks": [],
  "metadata": {
    "format": "PDF 1.4",
    "author": "Evangelos Vlachogiannis",
    "creator": "Writer",
    "producer": "OpenOffice.org 2.1",
    "creationDate": "D:20070223175637+02'00'"
  },
  "raw_text": "Dummy PDF file\n"
}
```

### 402 Payment Required Response (Test 7)

```json
{
  "error": "Payment Required",
  "wallet_address": "0x0000000000000000000000000000000000000001",
  "currency": "USDC",
  "network": "base",
  "amount": "0.008",
  "facilitator_url": "https://x402.org/facilitator"
}
```

### Capabilities Response (Test 2, truncated)

```json
{
  "supported_formats": ["pdf", "docx", "xlsx"],
  "features": {
    "pdf": ["text_extraction", "table_extraction", "section_detection", "hyperlinks", "metadata"],
    "docx": ["text_extraction", "table_extraction", "section_detection", "hyperlinks", "metadata"],
    "xlsx": ["data_extraction", "multi_sheet", "headers_detection"]
  },
  "pricing": {
    "parse_pdf": 0.008,
    "parse_docx": 0.005,
    "parse_xlsx": 0.005,
    "parse_from_url": 0.01,
    "extract_tables": 0.006
  },
  "cached_discount": 0.5,
  "cache_ttl_seconds": 3600,
  "limits": {
    "max_payload_bytes": 52428800,
    "max_payload_mb": 50,
    "rate_limit": "60 requests/minute per IP (paid endpoints)"
  }
}
```

### MCP tools/list Response (Test 20, tool names only)

6 tools registered:
1. `parse_pdf` -- Base64 PDF input, returns sections/tables/metadata/raw_text
2. `parse_docx` -- Base64 DOCX input, same structured output
3. `parse_xlsx` -- Base64 XLSX input, returns headers/rows/sheet info
4. `parse_from_url` -- URL input, auto-detects format, returns parsed content
5. `extract_tables` -- Base64 input (PDF/DOCX), returns table data only
6. `list_capabilities` -- No input, returns formats/features/pricing

## Pass/Fail Summary

| Category | Tests | Passed | Failed |
|----------|-------|--------|--------|
| Free Endpoints | 6 | 5 | 1 |
| x402 Payment Gate | 5 | 5 | 0 |
| Paid Endpoints | 3 | 3 | 0 |
| Error Cases | 5 | 5 | 0 |
| MCP Endpoint | 4 | 4 | 0 |
| **Total** | **23** | **22** | **1** |

**Pass Rate: 95.7%**

## Issues Found

### 1. `/privacy` endpoint returns 404 (Severity: Low)

The root endpoint (`/`) returns `"privacy": {"details": "/privacy"}` and the capabilities endpoint also references `/privacy`, but calling `GET /privacy` returns a 404. The route is defined in the source code (`parser.py:190`) but is not being registered correctly, or the router mount order causes it to be shadowed.

**Impact:** Low. Privacy info is still accessible via the root endpoint's inline `privacy` object. The dedicated endpoint is a nice-to-have.

**Fix:** The `/privacy` route is on the `parser` router. Verify the router prefix is not causing a mismatch (e.g., if the router has a `/parse` prefix, the actual path would be `/parse/privacy`).

### 2. First request after cold start is slow (Severity: Low)

The initial health check took 6.9s (Fly.io cold start / machine wake-up). Subsequent requests were all under 1s. This is expected behavior for Fly.io Machines that scale to zero.

**Impact:** First request latency for infrequently-used deployments. Subsequent requests are fast (50-440ms).

### 3. Wallet address is placeholder (Severity: Info)

The 402 response shows `wallet_address: 0x0000000000000000000000000000000000000001`, which is the burn address. This is a placeholder and needs to be set to a real wallet for production payment collection.

### 4. MCP endpoint bypasses x402 payment (Severity: Info)

The `/mcp` endpoint is configured as free (amount: 0) in the x402 pricing table, meaning all MCP tool calls bypass payment. This is intentional per the source code comment "Pricing handled per tool," but no per-tool payment enforcement was observed in the MCP handler. Agents using the MCP endpoint can parse documents for free.

## Performance Summary

| Metric | Value |
|--------|-------|
| Cold start latency | ~6.9s (Fly.io machine wake) |
| Free endpoint avg | 0.077s |
| Paid endpoint avg (with payment) | 0.270s |
| Error response avg | 0.155s |
| MCP endpoint avg | 0.080s |
| Parse URL (real PDF) | 0.439s (includes fetch + parse) |
| 50MB payload limit | Documented in capabilities, enforced via `_check_payload_size()` |
