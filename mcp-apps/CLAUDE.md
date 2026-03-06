# CLAUDE.md -- MCP Apps Portfolio

## Overview

Portfolio of 15 MCP (Model Context Protocol) tool servers providing AI agents with pay-per-call infrastructure via x402 micropayments. The top 4 deployed apps are: Structured Extractor, Document Parser, Knowledge Graph, and Web Crawler.

## Stack

- Python 3.12, FastAPI, uvicorn
- x402 micropayments (Coinbase protocol) for billing
- Redis for caching and rate limiting
- Fly.io for deployment (scale-to-zero)
- Shared library: `mcp_shared/` (free trial middleware, metering)

## Key Commands

```bash
# Per-app (from app directory)
uv sync --all-extras
uv run uvicorn src.app.main:app --host 0.0.0.0 --port 8080
uv run pytest -q
uv run ruff check src/
```

## Architecture

Each app follows the same structure:
- `src/app/main.py` -- FastAPI app with middleware stack (CORS, rate limit, x402, free trial)
- `src/app/routes/` -- API route handlers
- `src/app/models/schemas.py` -- Pydantic request/response models
- `src/app/middleware/` -- Cache, rate limiting, x402 payment
- `src/app/discovery/` -- MCP and A2A (agent card) endpoints
- `mcp_shared/` -- Shared free trial middleware (symlinked or copied per app)

## Git Workflow

Conventional Commits, branch from `main`.

---

## Privacy Rules (Critical)

These rules apply to all MCP apps in this portfolio. Violations must be caught and reverted immediately.

1. **Never add analytics, telemetry, or tracking** to any MCP app. No Google Analytics, no Mixpanel, no Segment, no PostHog, no custom event tracking. The only acceptable logging is operational metering (tool name, wallet, price, duration, cache status).

2. **Never log request or response body content** in metering, abuse logs, or any other log sink. The metering system (`shared/metering.py`) must only record operational metadata.

3. **Always disclose third-party API calls** in both the app's `README.md` (Privacy section) and the `/privacy` endpoint response. If an app sends user-provided content to an external API (e.g., Anthropic Claude for LLM extraction), this must be documented with: provider name, when it happens, what data is sent, and a link to the provider's privacy policy.

4. **Every new app must include a `/privacy` endpoint** before deployment. The endpoint must return a JSON privacy policy covering data collection, data retention, authentication model, and third-party sharing.

5. **`/privacy` must always be in `FREE_PATHS`** in `mcp_shared/free_trial.py`. The privacy policy must be accessible without payment or wallet.

6. **No cookies, no session storage, no browser fingerprinting.** These apps serve autonomous AI agents, not browsers. There is no reason to track client identity beyond the wallet address provided in x402 payment headers.

7. **IP addresses may only be used for ephemeral rate limiting.** IP addresses must not be stored in metering logs, must not be correlated across requests beyond the rate limit window, and must not be shared with any third party.
