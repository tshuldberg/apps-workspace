---
name: crawl
description: Crawl URLs using the live MCP Web Crawler API and return clean Markdown. Supports single, batch, recursive crawling, and link extraction.
argument-hint: <url> [mode: single|batch|recursive|links]
allowed-tools: Bash(curl:*)
---

# MCP Web Crawler Skill

Crawl one or more URLs via the live Web Crawler API and return results.

**API Base:** `https://mcp-web-crawler.fly.dev`

**Authentication:** Include `X-Wallet` header with an Ethereum wallet address for free trial (100 calls). Paid access uses x402 protocol.

## Arguments

- `$0` -- URL to crawl (required)
- `$1` -- Mode: `single` (default), `batch`, `recursive`, or `links`

If `$1` is `batch`, `$0` should be a comma-separated list of URLs.
If `$1` is `recursive`, optional depth and max_pages can follow as `$2` and `$3`.

## Execution

### Single Crawl (default)

```bash
curl -s -X POST https://mcp-web-crawler.fly.dev/crawl \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d '{"url": "$0"}' | jq .
```

### Batch Crawl

Split `$0` on commas into a JSON array of URLs:

```bash
curl -s -X POST https://mcp-web-crawler.fly.dev/crawl/batch \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d '{"urls": [<comma-separated URLs from $0>]}' | jq .
```

### Recursive Crawl

```bash
curl -s -X POST https://mcp-web-crawler.fly.dev/crawl/recursive \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d '{"url": "$0", "depth": 2, "max_pages": 10}' | jq .
```

### Link Extraction

```bash
curl -s -X POST https://mcp-web-crawler.fly.dev/links \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d '{"url": "$0"}' | jq .
```

## Output Format

Present results to the user with:
1. The URL(s) crawled
2. HTTP status (success/failure)
3. Word count and title for each page
4. Whether the result was cached (`X-Cache-Hit` header or `cached` field)
5. The Markdown content (truncated to first 500 lines if very long)
6. For batch/recursive: summary table of all URLs with status

## Error Handling

- If the API returns 402, inform the user: "Payment required. Free trial may be exhausted for this wallet."
- If the API returns 429, inform the user: "Rate limited. Try again in 60 seconds."
- If the API returns 5xx, inform the user: "Server error. Check https://mcp-web-crawler.fly.dev/health"

## Capabilities Check

To verify the service is available and see current pricing:
```bash
curl -s https://mcp-web-crawler.fly.dev/capabilities | jq .
```
