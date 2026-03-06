---
name: extract
description: Extract structured JSON data from any URL, HTML, or image using the live Structured Extractor API. Provide a URL and JSON schema to get back structured data.
argument-hint: <url> [schema-description]
allowed-tools: Bash(curl:*)
---

# MCP Structured Extractor Skill

Extract structured data from URLs, HTML, or images using the live Structured Extractor API.

**API Base:** `https://mcp-bank-extractor.fly.dev`

**Authentication:** Include `X-Wallet` header with an Ethereum wallet address for free trial (100 calls). Paid access uses x402 protocol.

**Privacy note:** ~40% of requests use Anthropic Claude Haiku for LLM fallback. Cleaned HTML/images are sent to Anthropic's API.

## Arguments

- `$0` -- URL to extract from (required)
- `$1` -- Description of what to extract, or a JSON schema (optional -- if omitted, extract common fields)

## Execution

### Step 1: Build the JSON Schema

If the user provided `$1`, convert their description into a valid JSON Schema. For example:
- "product name and price" becomes `{"type":"object","properties":{"name":{"type":"string"},"price":{"type":"number"}}}`
- "article title, author, date" becomes `{"type":"object","properties":{"title":{"type":"string"},"author":{"type":"string"},"date":{"type":"string"}}}`

If no schema description provided, use a generic schema:
```json
{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"},"content":{"type":"string"}}}
```

### Step 2: Call the API

**Extract from URL:**
```bash
curl -s -X POST https://mcp-bank-extractor.fly.dev/extract \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d '{"url": "$0", "schema": <json-schema>}' | jq .
```

**Extract from image URL** (if $0 ends in .png, .jpg, .jpeg, .gif, .webp):
```bash
curl -s -X POST https://mcp-bank-extractor.fly.dev/extract/image \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d '{"image_url": "$0", "schema": <json-schema>}' | jq .
```

## Output Format

Present results to the user with:
1. The extracted data (formatted JSON)
2. Confidence score (0.0-1.0) with interpretation:
   - 0.9-1.0: High confidence (JSON-LD or structured data source)
   - 0.7-0.9: Good confidence (CSS heuristics)
   - 0.5-0.7: Moderate confidence (LLM extraction)
   - Below 0.5: Low confidence
3. Extraction method used (json_ld, opengraph, microdata, css_heuristic, llm_haiku, vision_llm)
4. Duration in milliseconds
5. Whether it was cached

## Error Handling

- 402: "Payment required. Free trial may be exhausted."
- 422: "Could not fetch the URL. Check that it's accessible."
- 429: "Rate limited. Try again in 60 seconds."
- 501: "Feature not implemented (e.g., JS rendering)."

## Capabilities Check

```bash
curl -s https://mcp-bank-extractor.fly.dev/capabilities | jq .
```
