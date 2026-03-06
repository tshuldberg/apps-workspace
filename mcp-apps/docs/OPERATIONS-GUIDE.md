# MCP Apps Portfolio: Complete Operations Guide

**What this covers:** Everything you need to know to manage, monitor, and launch the MCP Apps portfolio -- from checking if your apps are alive, to understanding how money flows in, to getting listed on marketplaces and running campaigns.

---

## Part 1: What You Have (The Deployment)

### Your 4 Live Apps

You have 4 MCP tool servers deployed on **Fly.io** (a cloud hosting platform). Each app is a standalone API that AI agents call to do work -- crawl websites, extract structured data, parse documents, or build knowledge graphs.

| App | What It Does | URL | Region |
|-----|-------------|-----|--------|
| **Web Crawler** | Converts URLs to clean Markdown | https://mcp-web-crawler.fly.dev | iad (Virginia) |
| **Structured Extractor** | Pulls structured JSON from any URL using a schema | https://mcp-bank-extractor.fly.dev | sjc (San Jose) |
| **Document Parser** | Parses PDF, DOCX, XLSX into structured JSON | https://mcp-document-parser.fly.dev | sjc (San Jose) |
| **Knowledge Graph** | Extracts entities, stores facts, traverses relationships | https://mcp-knowledge-graph.fly.dev | sjc (San Jose) |

### How They Stay Running (Scale-to-Zero)

Your apps use Fly.io's **scale-to-zero** architecture:

- When no one is using an app, it **shuts down** (costs $0/hour while idle)
- When a request comes in, it **wakes up in ~2 seconds** and handles the request
- After ~5 minutes of no activity, it goes back to sleep
- You only pay for the time machines are actually running

**What this means for your wallet:** If zero agents use your tools, your infrastructure cost is approximately **$0/month**. At moderate usage (5,000 agents), infrastructure is ~$130/month.

### How to Check If Your Apps Are Alive

Open a terminal and run:

```bash
# Check each app's health
curl https://mcp-web-crawler.fly.dev/health
curl https://mcp-bank-extractor.fly.dev/health
curl https://mcp-document-parser.fly.dev/health
curl https://mcp-knowledge-graph.fly.dev/health
```

A healthy response looks like:
```json
{"status": "healthy", "cache_available": true}
```

If `cache_available` is `false`, Redis is down -- the app still works, just without caching (agents pay full price instead of 50% discount on repeated calls).

### How to Check App Status on Fly.io

```bash
# See all your apps
flyctl apps list

# Check a specific app's status
flyctl status --app mcp-web-crawler

# Watch live logs
flyctl logs --app mcp-web-crawler

# See running machines
flyctl machine list --app mcp-web-crawler
```

### How to Deploy Updates

Each app has a `deploy.sh` script that handles everything:

```bash
cd /Users/trey/Desktop/Apps/mcp-apps/mcp-web-crawler
./deploy.sh
```

The script will:
1. Copy the shared `mcp_shared/` library into the app directory
2. Build and deploy to Fly.io
3. Run health checks until the app is confirmed alive
4. Clean up the temporary shared library copy

**To deploy all 4 apps:**
```bash
cd /Users/trey/Desktop/Apps/mcp-apps
for app in mcp-web-crawler mcp-structured-extractor mcp-document-parser mcp-knowledge-graph; do
  echo "Deploying $app..."
  cd "$app" && ./deploy.sh && cd ..
done
```

---

## Part 2: How Money Flows In (Billing & Payments)

### The Payment Model: x402 Micropayments

Your apps use **x402**, a payment protocol created by Coinbase. Here's how it works:

1. An AI agent wants to use your tool (e.g., crawl a website)
2. The agent sends a request to your app
3. Your app responds with HTTP 402 (Payment Required) and says: "This costs $0.002 in USDC. Send payment to this wallet on the Base network."
4. The agent's wallet sends $0.002 in USDC to your wallet
5. The agent sends the request again with a cryptographic payment proof
6. Your app verifies the payment and processes the request
7. The money is now in your wallet

**Key point:** There are no invoices, no billing cycles, no accounts. Every call is paid instantly in USDC cryptocurrency on the Base L2 network. The money arrives in your wallet the moment the agent uses the tool.

### Your Wallet Address

Your wallet address is set as an environment variable on each Fly.io app:

```bash
# See your current wallet address
flyctl secrets list --app mcp-web-crawler
```

To change it (e.g., if you set up a new wallet):
```bash
flyctl secrets set WALLET_ADDRESS=0xYourNewAddress --app mcp-web-crawler
flyctl secrets set WALLET_ADDRESS=0xYourNewAddress --app mcp-bank-extractor
flyctl secrets set WALLET_ADDRESS=0xYourNewAddress --app mcp-document-parser
flyctl secrets set WALLET_ADDRESS=0xYourNewAddress --app mcp-knowledge-graph
```

### Where to See Your Balance

Your revenue accumulates as USDC on the **Base L2 network** (a Coinbase-built blockchain). To check your balance:

1. Go to https://basescan.org
2. Enter your wallet address in the search bar
3. Look at the "Token Holdings" section for USDC balance

Or if you use a wallet app (Coinbase Wallet, MetaMask, Rainbow):
- Add the Base network if not already added
- Your USDC balance shows your total revenue collected

### Pricing Per Tool

Every tool has a fixed price per call. Cached responses (when the same request was made within the last hour) cost 50% less.

**Web Crawler:**
| Tool | Price | Cached |
|------|-------|--------|
| Single page crawl | $0.002 | $0.001 |
| Batch crawl (per URL) | $0.0015 | $0.00075 |
| Recursive crawl (per page) | $0.002 | $0.001 |
| Link extraction | $0.001 | $0.0005 |

**Structured Extractor:**
| Tool | Price | Cached |
|------|-------|--------|
| Extract from URL | $0.005 | $0.0025 |
| Extract from HTML | $0.003 | $0.0015 |
| Extract from image | $0.020 | $0.010 |
| Batch extract (per URL) | $0.004 | $0.002 |

**Document Parser:**
| Tool | Price | Cached |
|------|-------|--------|
| Parse PDF | $0.008 | $0.004 |
| Parse DOCX | $0.005 | $0.0025 |
| Parse XLSX | $0.005 | $0.0025 |
| Parse from URL | $0.010 | $0.005 |
| Extract tables | $0.006 | $0.003 |

**Knowledge Graph:**
| Tool | Price | Cached |
|------|-------|--------|
| Extract entities | $0.005 | $0.0025 |
| Link entities | $0.003 | $0.0015 |
| Add fact | $0.002 | $0.001 |
| Query entity | $0.005 | $0.0025 |
| Search entities | $0.003 | $0.0015 |
| Get facts | $0.002 | $0.001 |

### The Free Trial System

Before agents start paying, they get **100 free calls per app per wallet**. This is automatic -- no configuration needed.

**How it works:**
- Agent sends a request with an `X-Wallet: 0x...` header
- The middleware checks Redis to see how many free calls that wallet has used on this app
- If under 100, the request is processed for free
- After 100 calls, the app requires x402 payment

**Anti-abuse protections (automatic):**
- Max 100 calls per IP per day (prevents one person using many wallets)
- Rate spike detection (flags >5 calls/minute from one IP)
- Wallet cycling detection (flags >3 different wallets from one IP per day)
- Minimum $1 USDC balance requirement (ensures the wallet is real)

### How to Track Usage and Revenue

Usage is logged to JSONL files (one JSON record per line) on each app's filesystem.

**Metering logs** (every paid call):
```
logs/metering.jsonl
```
Each line looks like:
```json
{"timestamp":"2026-03-05T18:00:00Z","tool_name":"crawl","wallet_address":"0x1234...","price":0.002,"cached":false,"duration_ms":234,"service":"mcp-web-crawler"}
```

**Abuse logs** (free trial violations):
```
logs/abuse.jsonl
```

**To view these logs from your terminal:**
```bash
# Watch metering logs in real-time
flyctl ssh console --app mcp-web-crawler -C "tail -f /app/logs/metering.jsonl"

# Count total calls today
flyctl ssh console --app mcp-web-crawler -C "grep '2026-03-05' /app/logs/metering.jsonl | wc -l"

# Sum revenue today (requires jq)
flyctl ssh console --app mcp-web-crawler -C "grep '2026-03-05' /app/logs/metering.jsonl | jq -s '[.[].price] | add'"

# See top wallets by call count
flyctl ssh console --app mcp-web-crawler -C "cat /app/logs/metering.jsonl | jq -r '.wallet_address' | sort | uniq -c | sort -rn | head -20"

# Check abuse log
flyctl ssh console --app mcp-web-crawler -C "cat /app/logs/abuse.jsonl | jq '.reason' | sort | uniq -c"
```

### Revenue Projections (What to Expect)

| Milestone | Agents | Monthly Revenue | Your Costs | Net Profit |
|-----------|--------|----------------|------------|------------|
| Break-even | 18-31 | ~$175 | ~$175 | $0 |
| Month 1 (moderate) | 500 | $4,833 | ~$300 | ~$4,500 |
| Month 3 | 1,500 | $14,467 | ~$500 | ~$14,000 |
| Month 6 | 2,500 | $24,112 | ~$700 | ~$23,400 |
| Month 12 | 5,000 | $48,224 | ~$870 | ~$47,350 |

Margins are 93-97% because 14 of 15 apps use only local compute. The Structured Extractor is the exception -- it calls Anthropic's Claude Haiku API for ~40% of requests, which costs ~$735/month at Month 12 scale.

---

## Part 3: What's Complete vs. What Needs to Be Done

### Completed (Ready to Go)

| Item | Status | Notes |
|------|--------|-------|
| 4 apps deployed on Fly.io | Done | Scale-to-zero, health checks passing |
| x402 payment middleware | Done | USDC on Base L2 |
| Free trial (100 calls/wallet) | Done | Anti-abuse protections active |
| Metering and billing logs | Done | JSONL append-only |
| Privacy endpoints (`/privacy`) | Done | Free, no payment required |
| Privacy sections in READMEs | Done | LLM disclosure for Extractor |
| MCP protocol endpoints | Done | `POST /mcp` on all 4 apps |
| A2A agent cards | Done | `/.well-known/agent-card.json` |
| Deploy scripts | Done | `deploy.sh` per app |
| Marketing strategy docs | Done | 4 docs in `docs/marketing/` |
| GTM strategy | Done | Channels ranked, timeline set |
| Executive strategy brief | Done | Revenue projections, risk assessment |
| CLAUDE.md privacy rules | Done | 7 enforceable rules |

### Not Yet Done (Action Items)

| Item | Priority | Effort | Details |
|------|----------|--------|---------|
| List on MCP marketplaces | P0 | 2-4 hours | Smithery, Glama, mcp.so, PulseMCP |
| Hacker News "Show HN" post | P0 | 1 hour | Draft ready in `docs/marketing/launch-strategy.md` |
| Reddit posts | P0 | 1 hour | Drafts ready in `docs/marketing/launch-strategy.md` |
| Python client SDK | P1 | 1-2 days | `pip install mcp-bank-client` |
| Uptime monitoring / alerting | P1 | 2 hours | e.g., UptimeRobot or Fly.io Metrics |
| Revenue dashboard | P2 | 1 day | Parse metering.jsonl into a dashboard |
| Apify Actor ports | P2 | 1-2 days | Port top 4 apps as Apify Actors |
| LangChain/CrewAI integrations | P2 | 1-2 days | Tool registry submissions |
| SOC 2 certification | P3 | 3-6 months | Required for enterprise sales |
| Stripe fallback billing | P3 | 1-2 weeks | Backup for non-crypto agents |

---

## Part 4: Marketplace Listings (Step by Step)

### 4.1 Smithery (Do First -- Highest Quality MCP Directory)

**What it is:** Smithery (smithery.ai) is the most curated MCP server directory. 2,880+ verified servers. Agents discover tools here.

**How to list:**

1. Go to https://smithery.ai
2. Create an account (GitHub login)
3. Click "Add Server" or "Submit"
4. For each of your 4 apps, provide:

**Web Crawler listing:**
```
Name: MCP Web Crawler
Description: URL to Markdown conversion with recursive crawling, batch processing, and link extraction. No accounts, no API keys, no tracking.
MCP Endpoint: https://mcp-web-crawler.fly.dev/mcp
Transport: Streamable HTTP
Category: Data / Web Scraping
Tags: crawler, markdown, web-scraping, x402, privacy-first
```

**Structured Extractor listing:**
```
Name: Structured Extractor
Description: URL + JSON Schema -> structured data. CSS/heuristic first, LLM fallback. No accounts, no API keys. Pay per call.
MCP Endpoint: https://mcp-bank-extractor.fly.dev/mcp
Transport: Streamable HTTP
Category: Data / Extraction
Tags: extraction, structured-data, json-schema, x402, privacy-first
```

**Document Parser listing:**
```
Name: MCP Document Parser
Description: Parse PDF, DOCX, XLSX into structured JSON with table extraction. No accounts, no API keys, no tracking.
MCP Endpoint: https://mcp-document-parser.fly.dev/mcp
Transport: Streamable HTTP
Category: Data / Document Processing
Tags: pdf, docx, xlsx, document-parsing, x402, privacy-first
```

**Knowledge Graph listing:**
```
Name: MCP Knowledge Graph
Description: Named entity recognition (spaCy), entity resolution, fact storage, and graph traversal. No accounts, no tracking.
MCP Endpoint: https://mcp-knowledge-graph.fly.dev/mcp
Transport: Streamable HTTP
Category: AI / Knowledge Management
Tags: knowledge-graph, ner, entities, graph, x402, privacy-first
```

5. Submit for review. Smithery typically reviews within 1-3 days.

### 4.2 Glama (Second -- Largest MCP Gateway)

**What it is:** Glama (glama.ai) hosts 9,000+ MCP servers and offers a gateway that lets agents connect to any listed server.

**How to list:**

1. Go to https://glama.ai
2. Sign up / log in
3. Navigate to "Add MCP Server" or equivalent
4. Provide the same information as Smithery (name, description, MCP endpoint URL)
5. Glama may offer to proxy your server through their gateway -- this means agents can connect via Glama's URL instead of yours directly. **Accept this** -- it increases discoverability.

### 4.3 mcp.so (Third -- Largest Catalog)

**What it is:** mcp.so has 17,000+ servers. Less curated than Smithery but the largest catalog.

**How to list:**

1. Go to https://mcp.so
2. Click "Submit Server" or similar
3. Enter the same details (name, description, endpoint)
4. mcp.so typically auto-lists with minimal review

### 4.4 PulseMCP (Fourth -- Curated Newsletter)

**What it is:** PulseMCP curates MCP tools and sends a newsletter to developers.

1. Go to https://pulsemcp.com
2. Submit your apps for inclusion
3. Write a short pitch emphasizing: "first privacy-first MCP tool suite with x402 micropayments"
4. They may feature you in their weekly roundup

### 4.5 Marketplace Listing Tips

- **Lead with privacy** in every description: "No accounts, no API keys, no tracking"
- **Include MCP config snippets** so agents can copy-paste:
  ```json
  {
    "mcpServers": {
      "web-crawler": {
        "url": "https://mcp-web-crawler.fly.dev/mcp"
      }
    }
  }
  ```
- **List pricing** clearly -- agents (and their developers) want to know costs upfront
- **Link to `/capabilities`** endpoint for machine-readable pricing
- **Mention the free trial** -- "First 100 calls free per wallet"

---

## Part 5: Running Campaigns (Step by Step)

### 5.1 Hacker News Launch

**When:** Tuesday or Wednesday, 9:00 AM Eastern Time (this is when HN gets the most traffic)

**The post:** A full draft is ready at `docs/marketing/launch-strategy.md`. The key elements:

**Title:**
```
Show HN: 15 MCP tools for AI agents -- no accounts, no API keys, no tracking
```

**Body structure:**
1. What it is (one paragraph)
2. Why no accounts/API keys (the x402 model)
3. Top 4 tools with pricing
4. The one exception (Structured Extractor uses Anthropic API -- disclose this)
5. Links to GitHub, MCP endpoints, `/privacy` endpoints
6. Ask: "What tools would you want added?"

**After posting:**
- Stay online for the first 2-3 hours to answer comments
- Be honest about limitations (no search capability, no browser automation, etc.)
- If asked about privacy, point to the `/privacy` endpoints
- If asked "why would I use this vs Firecrawl?", answer: "If you want zero-signup access and don't want to manage API keys, this is simpler. If you need anti-bot bypass or JS rendering, Firecrawl is better today."

### 5.2 Reddit Launch

**Day after HN.** Post to two subreddits:

**r/AI_Agents (180K members):**
- Use the "build log" draft from `docs/marketing/launch-strategy.md`
- Reddit prefers story format: "I built X because Y, here's what I learned"
- Include a data collection table showing what you log vs. what you don't
- End with: "Try it free (100 calls per wallet) -- no signup needed"

**r/LocalLLaMA (500K members):**
- Lead with: "14 of 15 apps run local models only (spaCy, pymupdf, sentence-transformers)"
- This community cares deeply about local compute and privacy
- Be upfront about the Anthropic exception in the Extractor

**Reddit rules:**
- Don't post to both subreddits on the same day (looks spammy)
- Engage authentically with comments
- Don't delete and repost if it doesn't take off -- Reddit flags this

### 5.3 Twitter/X Launch Thread

Full thread drafts are in `docs/marketing/copywriting-assets.md`. Post a 5-6 tweet thread:

1. Hook: "Built 15 MCP tools for AI agents. No accounts. No API keys. No tracking."
2. How it works: x402 micropayments
3. Top 4 tools with one-line descriptions
4. Privacy angle: what we collect vs. competitors
5. Pricing: "$0.002-$0.020 per call. First 100 free."
6. CTA: Link to MCP endpoints + GitHub

### 5.4 Campaign Timeline

| Day | Action |
|-----|--------|
| **Day 1** | Submit to Smithery, Glama, mcp.so, PulseMCP |
| **Day 2-3** | Wait for marketplace approvals. Prepare HN post. |
| **Day 4** (Tue/Wed) | Post to Hacker News at 9am ET. Monitor comments all day. |
| **Day 5** | Post to r/AI_Agents |
| **Day 6** | Post Twitter/X thread |
| **Day 7** | Post to r/LocalLLaMA |
| **Week 2** | Submit to MCPize and Apify. Write first tutorial blog post. |
| **Week 3** | Follow up on marketplace listings. Post second tutorial. |
| **Week 4** | Evaluate: How many agents? How much revenue? Adjust. |

---

## Part 6: Day-to-Day Operations

### Daily Checklist (5 minutes)

```bash
# 1. Check all apps are healthy
for app in mcp-web-crawler mcp-bank-extractor mcp-document-parser mcp-knowledge-graph; do
  echo -n "$app: "; curl -s "https://$app.fly.dev/health" | jq -r '.status'
done

# 2. Check your USDC balance on Base
# Go to https://basescan.org and search your wallet address
# Or check in your wallet app (Coinbase Wallet, MetaMask, etc.)

# 3. Quick abuse check (any new abuse events?)
for app in mcp-web-crawler mcp-bank-extractor mcp-document-parser mcp-knowledge-graph; do
  echo "--- $app abuse events ---"
  flyctl ssh console --app $app -C "wc -l /app/logs/abuse.jsonl 2>/dev/null || echo '0 events'" 2>/dev/null
done
```

### Weekly Checklist (15 minutes)

1. **Revenue check:** Sum up metering logs across all 4 apps to see weekly revenue
2. **Top wallets:** Identify your most active paying agents (potential enterprise leads)
3. **Abuse review:** Check if any IPs or wallets are being flagged repeatedly
4. **Fly.io dashboard:** Log into https://fly.io/dashboard and check machine uptime, cold starts, errors
5. **Marketplace check:** Visit your Smithery/Glama listings -- any reviews or questions?

### Monthly Checklist (30 minutes)

1. **Revenue reconciliation:** Compare metering log totals to actual USDC received in wallet
2. **Cost check:** Review Fly.io invoice (should be $38-130 depending on usage)
3. **Anthropic bill:** Check your Anthropic API usage (only Structured Extractor uses it)
4. **Update pricing if needed:** If volume is high, consider adding volume discounts
5. **Marketplace rankings:** Check if your apps are moving up in Smithery/Glama rankings
6. **Content:** Publish at least one tutorial or blog post (see content calendar in `docs/marketing/content-strategy.md`)

### Handling Common Situations

**"An app is returning 500 errors"**
```bash
# Check logs for the error
flyctl logs --app mcp-web-crawler

# If it's a one-off, the auto-restart should fix it
# If persistent, redeploy:
cd mcp-web-crawler && ./deploy.sh
```

**"I want to change pricing"**
Pricing is hardcoded in two places per app:
1. The x402 middleware config in `src/app/main.py` (the actual payment requirement)
2. The `/capabilities` endpoint in `src/app/routes/` (the advertised price)

Change both, then redeploy: `./deploy.sh`

**"Someone is abusing the free trial"**
Check `logs/abuse.jsonl` for the IP or wallet. The system automatically:
- Blocks IPs over 100 calls/day
- Flags rate spikes (>5 calls/min)
- Detects wallet cycling (>3 wallets/IP/day)

If you need to block a specific wallet, you'd add it to a blocklist (not yet implemented -- would require a code change).

**"I want to withdraw my USDC"**
Your USDC is on the Base L2 network. To convert to USD:
1. Open your wallet (Coinbase Wallet, MetaMask)
2. Bridge USDC from Base to Ethereum mainnet (or use Coinbase directly if using Coinbase Wallet)
3. Send to Coinbase exchange
4. Sell USDC for USD
5. Withdraw to bank

Or if using Coinbase Wallet: USDC on Base can be used directly within the Coinbase ecosystem.

---

## Part 7: Environment Variables Reference

These are the secrets configured on each Fly.io app. Never share these publicly.

### Required (All Apps)

| Variable | What It Does | Example |
|----------|-------------|---------|
| `WALLET_ADDRESS` | Your wallet that receives payments | `0x1234abcd...` |
| `REDIS_URL` | Redis connection for caching + free trial tracking | `redis://default:pass@host:6379` |

### App-Specific

| Variable | App | What It Does |
|----------|-----|-------------|
| `DATABASE_URL` | Knowledge Graph | PostgreSQL for entity/fact storage |
| `ANTHROPIC_API_KEY` | Structured Extractor | Claude Haiku API key for LLM fallback |
| `BASE_URL` | Extractor, KG | Public URL for discovery endpoints |

### Optional (Defaults Are Fine)

| Variable | Default | What It Does |
|----------|---------|-------------|
| `ENVIRONMENT` | `development` | Set to `production` for payment enforcement |
| `PORT` | `8080` | Internal port (Fly.io handles external routing) |
| `X402_FACILITATOR_URL` | `https://x402.org/facilitator` | Coinbase's payment verification |
| `METERING_LOG_DIR` | `logs` | Where metering JSONL is written |
| `BASE_RPC_URL` | `https://mainnet.base.org` | For checking wallet USDC balances |

### How to View/Set Secrets

```bash
# View all secrets for an app
flyctl secrets list --app mcp-web-crawler

# Set a secret
flyctl secrets set WALLET_ADDRESS=0xYourAddress --app mcp-web-crawler

# Set across all 4 apps at once
for app in mcp-web-crawler mcp-bank-extractor mcp-document-parser mcp-knowledge-graph; do
  flyctl secrets set WALLET_ADDRESS=0xYourAddress --app $app
done
```

---

## Part 8: Marketing Assets Inventory

Everything you need for launch is already written and ready to use.

### In `docs/marketing/`

| File | What's Inside | Use When |
|------|--------------|----------|
| `launch-strategy.md` | HN post draft, Reddit post drafts, marketplace listing copy, week-by-week timeline, messaging framework | Listing on marketplaces, posting to HN/Reddit |
| `copywriting-assets.md` | Homepage hero copy (3 options), privacy taglines (10 options), comparison tables, 3-email onboarding sequence, Twitter threads | Building a landing page, writing emails, posting on social |
| `content-strategy.md` | 5 content pillars, 90-day content calendar, 15 blog topics, 12 tutorials, SEO keywords | Planning ongoing content after launch |
| `competitor-comparison.md` | Feature/privacy/pricing tables vs Firecrawl/Exa/Tavily/Browserbase/E2B, "why switch" narratives, SEO alternative pages | Answering "why should I use this?" questions, building comparison pages |

### In the Root Directory

| File | What's Inside |
|------|--------------|
| `EXECUTIVE-STRATEGY-BRIEF.md` | Full business case: market opportunity, revenue projections, unit economics, risk assessment, go/no-go recommendation |
| `GTM-STRATEGY.md` | Go-to-market plan: channels ranked by ROI, pricing strategy, enterprise motion, partnership priorities, privacy messaging playbook |
| `REVENUE-MODEL.md` | Detailed per-app financial model with sensitivity analysis |

### Key Copy to Grab Right Now

**Your one-liner (use everywhere):**
> MCP tools for AI agents. No accounts. No API keys. No tracking. Pay per call.

**Your three-sentence pitch:**
> Every competitor requires email signup, API keys, and usage dashboards. We require nothing. Your agent sends a wallet payment, gets the result, and we forget it happened.

**MCP config snippet (for marketplace listings):**
```json
{
  "mcpServers": {
    "web-crawler": { "url": "https://mcp-web-crawler.fly.dev/mcp" },
    "extractor": { "url": "https://mcp-bank-extractor.fly.dev/mcp" },
    "doc-parser": { "url": "https://mcp-document-parser.fly.dev/mcp" },
    "knowledge-graph": { "url": "https://mcp-knowledge-graph.fly.dev/mcp" }
  }
}
```

---

## Part 9: Decision Points (When to Act)

### Month 1 Signals

| Signal | What It Means | Action |
|--------|--------------|--------|
| >100 active agents | Strong start | Full speed. Launch remaining 11 apps. |
| 20-100 agents | Moderate start | Continue, but add Stripe fallback urgently (some agents may not have crypto wallets) |
| <20 agents | Slow start | Pause marketing spend. Investigate: are agents finding you? Is x402 the blocker? |
| 0 agents after 30 days | Not working | Pivot to traditional API key + Stripe billing. Abandon x402-only model. |
| Enterprise inbound interest | Opportunity | Accelerate SOC 2 process ($5-15K). Build invoicing. |

### Pricing Adjustments to Consider

| Trigger | Adjustment |
|---------|-----------|
| Web Crawler usage is highest | Raise to $0.004/page (Firecrawl charges this) |
| Volume users appear (>1K calls/day) | Introduce 10% volume discount |
| Enterprise inquiry | Offer 2x rate with SLA guarantee + monthly invoicing |
| Free trial abuse is rampant | Lower free calls from 100 to 25 per wallet |

---

## Quick Reference Card

```
HEALTH CHECK:    curl https://{app}.fly.dev/health
CAPABILITIES:    curl https://{app}.fly.dev/capabilities
PRIVACY POLICY:  curl https://{app}.fly.dev/privacy
APP LOGS:        flyctl logs --app {app-name}
SET SECRET:      flyctl secrets set KEY=VALUE --app {app-name}
DEPLOY:          cd {app-dir} && ./deploy.sh
WALLET BALANCE:  https://basescan.org (search your wallet address)

App Names on Fly.io:
  mcp-web-crawler
  mcp-bank-extractor
  mcp-document-parser
  mcp-knowledge-graph
```
