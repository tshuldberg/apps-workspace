---
name: parse-doc
description: Parse PDF, DOCX, or XLSX documents into structured JSON using the live Document Parser API. Accepts file paths or URLs.
argument-hint: <file-path-or-url> [format: pdf|docx|xlsx]
allowed-tools: Bash(curl:*), Bash(base64:*), Read
---

# MCP Document Parser Skill

Parse documents (PDF, DOCX, XLSX) into structured JSON via the live Document Parser API.

**API Base:** `https://mcp-document-parser.fly.dev`

**Authentication:** Include `X-Wallet` header with an Ethereum wallet address for free trial (100 calls). Paid access uses x402 protocol.

## Arguments

- `$0` -- Path to a local file OR a URL to a document (required)
- `$1` -- Format override: `pdf`, `docx`, `xlsx` (optional -- auto-detected from extension)

## Execution

### If $0 is a URL

```bash
curl -s -X POST https://mcp-document-parser.fly.dev/parse/url \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d '{"url": "$0"}' | jq .
```

### If $0 is a local file

1. Detect format from file extension (or use `$1` override)
2. Base64-encode the file:
```bash
DATA_B64=$(base64 -i "$0")
```
3. Call the appropriate endpoint:

**PDF:**
```bash
curl -s -X POST https://mcp-document-parser.fly.dev/parse/pdf \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d "{\"data_b64\": \"$DATA_B64\", \"extract_tables\": true}" | jq .
```

**DOCX:**
```bash
curl -s -X POST https://mcp-document-parser.fly.dev/parse/docx \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d "{\"data_b64\": \"$DATA_B64\"}" | jq .
```

**XLSX:**
```bash
curl -s -X POST https://mcp-document-parser.fly.dev/parse/xlsx \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d "{\"data_b64\": \"$DATA_B64\"}" | jq .
```

### Table-Only Extraction

If the user specifically asks for tables:
```bash
curl -s -X POST https://mcp-document-parser.fly.dev/parse/tables \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d "{\"data_b64\": \"$DATA_B64\", \"format\": \"pdf\"}" | jq .
```

## Output Format

Present results to the user with:
1. Document metadata (title, author, page count, word count)
2. Sections with headings and content
3. Tables (formatted as Markdown tables)
4. Hyperlinks found
5. Whether the result was cached (50% discount on cached results)

For XLSX: show sheet names, headers, row count, and a preview of the data.

## Error Handling

- 402: "Payment required. Free trial may be exhausted."
- 413: "File too large. Maximum size is 50 MB."
- 400: "Parsing failed. The file may be corrupted or in an unsupported format."
- 429: "Rate limited. Try again in 60 seconds."

## Capabilities Check

```bash
curl -s https://mcp-document-parser.fly.dev/capabilities | jq .
```
