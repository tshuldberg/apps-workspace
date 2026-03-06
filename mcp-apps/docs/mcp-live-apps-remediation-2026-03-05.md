# MCP Live Apps Remediation

Date: 2026-03-05  
Workspace: `/Users/trey/Desktop/Apps/mcp-apps`

## Scope
Resolved the high-priority findings from `docs/mcp-live-apps-deep-code-audit-2026-03-05.md` across:
- `mcp-web-crawler`
- `mcp-structured-extractor`
- `mcp-document-parser`
- `mcp-knowledge-graph`
- workspace shared module: `mcp_shared/`

## What Was Fixed

### 1) Privacy compliance in free-trial abuse logging
Updated all `mcp_shared/free_trial.py` copies (workspace + all four app copies):
- Added `"/privacy"` to `FREE_PATHS`.
- Removed persisted raw `ip` and `wallet` fields from abuse logs.
- Kept only privacy-safe operational metadata (`wallet_present`, reason, service, timestamp, detail counters).
- Sanitized `details` payload to drop identifier keys (`ip`, `wallet`, `wallet_address`).

### 2) SSRF protections and URL hardening
Implemented host safety checks to block private/local network targets:
- `mcp-web-crawler/src/app/crawler/fetcher.py`
- `mcp-structured-extractor/src/app/extraction/security.py` (new shared helper)
- `mcp-structured-extractor/src/app/extraction/fetcher.py`
- `mcp-structured-extractor/src/app/extraction/image_extract.py`
- `mcp-document-parser/src/app/parsers/url_parser.py`

Blocked cases include:
- `localhost` and `.local` hostnames
- private/loopback/link-local/reserved/multicast IP ranges
- unresolved/invalid hosts

### 3) Oversized response protections
- Web crawler fetch path now uses `bytearray` streaming assembly and explicit max-size enforcement.
- Structured extractor HTML/image fetch paths enforce response size while streaming.
- Document parser URL parse path enforces a hard 50 MB remote file cap while streaming.

### 4) MCP test/dev payment gate alignment
To match existing REST behavior in non-wallet environments:
- `mcp-web-crawler/src/app/discovery/mcp.py`
- `mcp-structured-extractor/src/app/discovery/mcp.py`

Change:
- MCP payment enforcement now activates only when `WALLET_ADDRESS` is configured.

## Test Coverage Added/Updated
- Updated free-trial tests to verify:
  - `/privacy` is bypassed as a free path
  - abuse logs no longer assert raw IP persistence
- Added SSRF block tests:
  - crawler: localhost/private IP blocked
  - extractor: URL guard/fetch/image block private targets
  - document parser: private host block + oversized remote file rejection

## Verification Results
- `mcp-web-crawler`: `26 passed`
- `mcp-structured-extractor`: `41 passed`
- `mcp-document-parser`: `17 passed`
- `mcp-knowledge-graph`: `24 passed`
- workspace shared tests: `mcp_shared/test_free_trial.py` -> `19 passed`

All test suites above were executed on 2026-03-05 in this workspace.
