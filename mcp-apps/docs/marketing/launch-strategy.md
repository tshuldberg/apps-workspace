# MCP Apps Portfolio -- Launch Strategy

**Date:** 2026-03-05
**Framework:** ORB (Owned, Rented, Borrowed) + Five-Phase Launch
**Positioning:** Privacy-First MCP Tools for AI Agents
**Launch Target:** Week of 2026-03-10

---

## Key Messaging Framework

### Core Position

Every competitor in the MCP tool space requires email signup, API key provisioning, and usage dashboards. We require nothing. An agent sends a wallet payment, gets the result, and we forget it happened. Privacy is not a feature we bolted on -- it is a structural property of the x402 payment model. Competitors would have to rebuild their entire authentication and billing stack to match it.

### One-Liner (Use Everywhere)

> MCP tools for AI agents. No accounts. No API keys. No tracking. Pay per call.

### Three-Sentence Pitch

Every competitor requires email signup, API keys, and usage dashboards. We require nothing. Your agent sends a wallet payment, gets the result, and we forget it happened.

### Privacy Claims Matrix

Always use the correct claim for each context. Do not overstate.

| Claim | Scope | Use When |
|-------|-------|----------|
| "No accounts, no API keys, no tracking" | Full portfolio | Headlines, titles, one-liners |
| "14 of 15 apps use local compute only" | Portfolio minus Structured Extractor | When discussing data processing |
| "We never log request or response content" | Full portfolio | Privacy-focused conversations |
| "Wallet-only identity -- zero PII collection" | Full portfolio | Enterprise and compliance contexts |
| "Structured Extractor sends cleaned HTML to Anthropic Haiku for ~40% of calls" | Structured Extractor only | Transparency disclosures, always |

### Competitive Framing

| Them | Us |
|------|----|
| Sign up with email | No signup |
| Generate API key from dashboard | No API keys |
| Usage tracked in dashboards they control | No dashboards, no tracking |
| Content logged for debugging/analytics | Content never logged |
| $36M-$229M in VC funding, scaling to justify it | $0 funding, profitable from agent #18 |
| 1-3 tools per vendor | 15 tools, one protocol |

### Transparency Rules (Non-Negotiable)

1. **Always disclose the Structured Extractor's Anthropic API usage.** Never claim "zero third-party processing" for the full portfolio. Say "14 of 15 apps" or name the exception explicitly.
2. **Never say "we don't collect any data."** We collect operational metering: tool name, wallet address, call price, response duration, cache status. Be specific about what we collect and what we do not.
3. **Link to `/privacy` endpoints** in every listing, post, and README. Machine-readable privacy policies build trust with both developers and autonomous agents.

---

## Channel Strategy (ORB Framework)

### Owned Channels

| Channel | Status | Role |
|---------|--------|------|
| GitHub repos (open-source demo agents) | Build pre-launch | Primary trust signal. Agents and developers discover tools through working code. |
| `/privacy` endpoints on every app | Live | Machine-readable trust anchor. Link from all external posts. |
| App READMEs with privacy sections | Live | First thing developers read. Privacy section in every one. |

### Rented Channels (Primary Launch Vehicles)

| Channel | Audience | Privacy Angle | Priority |
|---------|----------|---------------|----------|
| Smithery (2,880+ servers) | MCP-native agents | "Privacy-first -- no accounts required" badge | Day 1 |
| Glama (9,000+ servers) | MCP-native agents | Same badge, gateway model = zero-setup | Day 1 |
| mcp.so (17,186+ servers) | Broad MCP discovery | Table stakes listing, privacy in description | Day 1 |
| PulseMCP | Curated newsletter subscribers | Submit for featured listing with privacy angle | Day 1 |
| Hacker News | Privacy-conscious developers | Lead with "no accounts, no tracking" | Week 1 |
| Reddit r/AI_Agents (180K+) | Agent builders | "Your agent's data stays your agent's data" | Week 1 |
| Reddit r/LocalLLaMA (500K+) | Local-first ML community | "14/15 tools run local compute only" | Week 2 |
| Apify (130K signups/mo) | Data pipeline builders | Port top 4 as Actors | Week 3 |
| MCPize (85% rev share) | MCP tool consumers | Parallel distribution channel | Week 2 |

### Borrowed Channels (Post-Launch)

| Channel | Action | Timeline |
|---------|--------|----------|
| LangChain integration docs | Submit tool registry entry with privacy badge | Week 3-4 |
| CrewAI community | Integration guide + Discord presence | Week 3-4 |
| Coinbase x402 team | Co-marketing as production x402 case study | Week 2-3 |
| Dev.to / Hashnode | Tutorial series on building privacy-respecting agent workflows | Week 4+ |

---

## Post Drafts

### Show HN Post

**Title:** Show HN: 15 MCP tools for AI agents -- no accounts, no API keys, no tracking

**Body:**

I built 15 MCP tool servers for AI agents. Web crawling, structured data extraction, document parsing, knowledge graphs, message bus, audit logging, and more.

The difference from existing options: there are no accounts, no API keys, no dashboards, and no content logging.

Every competitor (Firecrawl, Exa, Tavily) requires you to sign up with an email, generate an API key, and manage usage through their dashboard. My tools use x402 micropayments (Coinbase protocol) instead. An agent sends a wallet payment in the request header, gets the result, and the transaction is done. No signup. No identity. No data retained beyond operational metering (tool name, wallet, price, response time, cache status).

14 of 15 apps run entirely on local compute -- spaCy for NER, PyMuPDF for document parsing, sentence-transformers for embeddings, Argos Translate for translation. Zero external API calls. The one exception: Structured Extractor falls back to Anthropic Claude Haiku for ~40% of extraction requests when CSS/heuristic methods are insufficient. This is fully disclosed in the app's /privacy endpoint and README.

Every app exposes a machine-readable /privacy endpoint (JSON). No cookies. No browser fingerprinting. IP addresses used only for ephemeral rate limiting and never stored.

The top 4 deployed apps:

- **Web Crawler** -- URL to clean Markdown, recursive crawling, batch processing. $0.002/page.
- **Structured Extractor** -- URL + JSON Schema -> structured data. CSS-first extraction, LLM fallback. $0.005/call.
- **Document Parser** -- PDF, DOCX, XLSX to structured JSON. Local PyMuPDF. $0.008/doc.
- **Knowledge Graph** -- NER with spaCy, entity resolution, fact triples, graph traversal. $0.002-$0.005/call.

All 15 apps follow the same pattern: FastAPI, MCP protocol (tools/list, tools/call), x402 middleware, Redis caching. Cached responses billed at 50% price.

Tech stack: Python 3.12, FastAPI, Fly.io (scale-to-zero). 97% net margin at scale because 14/15 apps have zero variable costs.

Would love feedback on the privacy model and pricing. Every app has a live /privacy endpoint you can hit right now.

Marketplace listings: [Smithery] [Glama] [mcp.so]

---

### Reddit r/AI_Agents Post

**Title:** I built 15 paid MCP tools for AI agents. Zero accounts. Zero tracking. Here's how privacy-by-architecture works.

**Body:**

I've been building MCP tool servers for autonomous AI agents. 15 tools total: web crawling, structured extraction, document parsing, knowledge graphs, embeddings, message bus, audit logging, budget tracking, secrets vault, and more.

The thing I want to talk about is the privacy model, because I think it matters for agents in a way it hasn't mattered for traditional APIs.

**The problem with existing tools:**

Firecrawl ($36M raised), Exa ($22M), Tavily ($4M) -- they all require email signup, API key generation, and usage dashboards. That model made sense for human developers. It does not make sense for autonomous agents. An AI agent running a research workflow at 3am should not need a human to have pre-registered an account and pasted an API key into its config.

**What I built instead:**

x402 micropayments (Coinbase protocol). The agent includes a wallet payment in the HTTP header. The server verifies the payment, processes the request, returns the result. Done. No account. No key. No dashboard. No content logged.

**What gets recorded:**
- Tool name
- Wallet address
- Call price
- Response duration
- Cache hit or miss

**What never gets recorded:**
- Request body content
- Response body content
- IP addresses (beyond ephemeral rate limiting)
- Any personal information

This is not a policy choice. It is a structural property of the payment model. There is no account system to store data in. There are no API keys to correlate across sessions. The wallet address is the only identity, and it carries no personal information.

**One honest disclosure:** The Structured Extractor sends cleaned HTML to Anthropic Claude Haiku for about 40% of calls when CSS-based extraction is not confident enough. This is clearly documented in the /privacy endpoint and README. Every other app (14 of 15) runs entirely on local compute with zero external API calls.

**The top 4 tools (deployed now):**

| Tool | What it does | Price |
|------|-------------|-------|
| Web Crawler | URL to Markdown, recursive, batch | $0.002/page |
| Structured Extractor | URL + JSON Schema -> JSON | $0.005/call |
| Document Parser | PDF/DOCX/XLSX -> JSON | $0.008/doc |
| Knowledge Graph | NER, entity resolution, fact triples | $0.002-$0.005/call |

Each tool has MCP endpoints (tools/list, tools/call) so agents discover and use them natively. Redis caching with 50% price on cache hits.

Has anyone else been thinking about the privacy implications of tool-calling for autonomous agents? I think "your agent's data stays your agent's data" is going to be a real differentiator as agents start making thousands of tool calls per day on behalf of users.

Happy to answer questions on the architecture, pricing, or privacy model.

---

### Reddit r/LocalLLaMA Post

**Title:** 14 of 15 MCP tools run local models only -- spaCy, sentence-transformers, PyMuPDF, Argos Translate. No content leaves the server.

**Body:**

I built 15 MCP tool servers for AI agents, and the local-first community might find the architecture interesting.

**14 of 15 apps use zero external APIs.** All inference and processing runs locally on the server:

| App | Local Stack | External API Calls |
|-----|------------|--------------------|
| Knowledge Graph | spaCy NER (en_core_web_sm) | None |
| Document Parser | PyMuPDF, python-docx, openpyxl | None |
| Embedding Service | sentence-transformers (all-MiniLM-L6-v2) | None |
| Translation | Argos Translate | None |
| Deduplication | sentence-transformers + locality-sensitive hashing | None |
| Web Crawler | httpx + readability | None |
| Message Bus | Redis pub/sub | None |
| Budget Tracker | PostgreSQL | None |
| Audit Logger | PostgreSQL | None |
| Secrets Vault | PostgreSQL + Fernet encryption | None |
| Job Scheduler | PostgreSQL + APScheduler | None |
| Webhook Relay | Redis + httpx | None |
| Identity Oracle | PostgreSQL + Base RPC (free tier) | None (on-chain reads are free) |
| LLM Router | Routing only | Pass-through to user's chosen LLM (by design) |

**The one exception:** Structured Extractor falls back to Anthropic Claude Haiku for ~40% of calls when CSS/heuristic extraction does not reach 80% confidence. Cleaned HTML snippets are sent to Anthropic's API. This is documented in the /privacy endpoint.

**Why this matters for privacy:**

These are paid tools (x402 micropayments via Coinbase). But unlike Firecrawl, Exa, or Tavily, there are no accounts, no API keys, no signup, and no content logging. The agent sends a wallet payment, gets the result, and nothing about the request or response content is stored anywhere.

Because 14 of the 15 apps run everything locally, there is no third-party data processing. The content your agent sends never leaves the server that processed it. The only metadata we record is operational: tool name, wallet, price, duration, cache status.

**Pricing (all per-call, no tiers, no plans):**

- Web crawl: $0.002/page
- Structured extraction: $0.005/call
- Document parsing: $0.005-$0.010/doc
- Knowledge graph operations: $0.002-$0.005
- Embeddings: $0.0003-$0.002
- Translation: $0.0002-$0.0005/100 chars

Deployed on Fly.io with scale-to-zero. MCP protocol (JSON-RPC) so any MCP-compatible agent can discover and call them.

Curious what the local-first community thinks about this approach. The tools themselves are not open source (they are paid services), but the local compute architecture means your data never touches a third-party API (with the one Anthropic exception disclosed above).

---

### Marketplace Listing Copy (Smithery / Glama / mcp.so)

**Short Description (120 chars):**

MCP tools for AI agents. No accounts, no API keys, no tracking. Pay per call with x402 micropayments.

**Full Description:**

**Privacy-first MCP tool servers.** No accounts required. No API keys. No content logging. No tracking. Wallet-only identity via x402 micropayments.

**Web Crawler** -- URL to clean Markdown. Single page, batch (up to 50 URLs), recursive (up to 5 levels), and link extraction. $0.002/page. Respects robots.txt.

**Structured Extractor** -- URL + JSON Schema -> structured JSON. CSS-first extraction with LLM fallback. Confidence scoring. $0.005/call. *Note: ~40% of calls use Anthropic Claude Haiku for LLM extraction. Disclosed in /privacy endpoint.*

**Document Parser** -- PDF, DOCX, XLSX to structured JSON. Local processing via PyMuPDF. Table extraction. $0.005-$0.010/doc.

**Knowledge Graph** -- Named entity recognition (spaCy), entity resolution, fact triples (subject-predicate-object), graph traversal, entity search. $0.002-$0.005/call.

**Privacy model:** Operational metering records tool name, wallet address, price, duration, and cache status. Request and response body content is never logged. No cookies, no browser fingerprinting, no IP storage. Every app exposes a machine-readable `/privacy` endpoint.

**How payment works:** x402 micropayments (Coinbase protocol). Include a wallet payment in the HTTP request header. No signup, no dashboard, no API key management. Cached responses billed at 50%.

**Integration:**
```json
{
  "mcpServers": {
    "web-crawler": { "url": "https://mcp-web-crawler.fly.dev/mcp" },
    "extractor": { "url": "https://extractor.mcp-bank.fly.dev/mcp" },
    "doc-parser": { "url": "https://mcp-document-parser.fly.dev/mcp" },
    "knowledge-graph": { "url": "https://knowledge-graph.mcp-bank.fly.dev/mcp" }
  }
}
```

**Tags:** privacy, no-signup, x402, micropayments, web-crawling, data-extraction, document-parsing, knowledge-graph, MCP, AI-agents

---

## Launch Timeline

### Pre-Launch (Now through March 9)

| Day | Action | Owner | Done? |
|-----|--------|-------|-------|
| Mar 5-6 | Finalize privacy sections in all 4 app READMEs | Dev | [ ] |
| Mar 5-6 | Verify /privacy endpoints return correct JSON on all 4 apps | Dev | [ ] |
| Mar 6-7 | Build Research Agent demo (crawl -> extract -> knowledge graph pipeline) | Dev | [ ] |
| Mar 7-8 | Write demo agent README with cost breakdown per run | Dev | [ ] |
| Mar 8-9 | Draft all marketplace listings (Smithery, Glama, mcp.so, PulseMCP) | Marketing | [ ] |
| Mar 9 | Final review of HN post, Reddit posts, marketplace copy | Marketing | [ ] |

### Week 1: Launch (March 10-16)

| Day | Action | Channel | Expected Impact |
|-----|--------|---------|-----------------|
| Mon Mar 10 | Submit listings to Smithery, Glama, mcp.so, PulseMCP | Marketplaces | High -- primary discovery for MCP agents |
| Mon Mar 10 | Publish Research Agent demo on GitHub | GitHub | Medium -- proof the stack works end-to-end |
| Tue Mar 11 | Submit "Show HN" post at 9:00am ET | Hacker News | High -- HN loves privacy + novel payment models. Target 200+ upvotes. |
| Tue Mar 11 | Respond to every HN comment in real time (all day) | Hacker News | Critical -- engagement drives ranking |
| Wed Mar 12 | Post to r/AI_Agents (if HN has cooled, or in parallel) | Reddit | Medium-High -- build log format with privacy lead |
| Thu Mar 13 | Follow up on HN comments, engage with anyone who tested the tools | Hacker News | Medium -- convert interest to repeat usage |
| Fri Mar 14 | Submit to MCPize (top 4 apps) | MCPize | Medium -- parallel distribution channel |
| Sun Mar 16 | Week 1 retrospective: tally wallets, calls, revenue, post engagement | Internal | Required -- informs Week 2 strategy |

### Week 2: Expand (March 17-23)

| Day | Action | Channel | Expected Impact |
|-----|--------|---------|-----------------|
| Mon Mar 17 | Post to r/LocalLLaMA with local-compute angle | Reddit | Medium -- 500K+ community, local-first resonance |
| Tue Mar 18 | Publish first tutorial on Dev.to: "Build a research agent with privacy-first MCP tools" | Dev.to | Medium -- SEO play, compounds over time |
| Wed Mar 19 | Begin Apify Actor porting for Web Crawler | Apify | High -- access to 130K monthly signups |
| Thu Mar 20 | Reach out to Coinbase x402 team for co-marketing | Coinbase | Medium -- we are one of few production x402 users |
| Fri Mar 21 | Complete Apify Actor for Web Crawler, submit for review | Apify | High -- $2K+/mo achievable per Actor |
| Sun Mar 23 | Week 2 retrospective | Internal | Required |

### Week 3: Deepen (March 24-30)

| Day | Action | Channel | Expected Impact |
|-----|--------|---------|-----------------|
| Mon Mar 24 | Port Structured Extractor to Apify | Apify | High |
| Tue Mar 25 | Submit LangChain tool registry entry with privacy badge | LangChain | Medium -- embedded discovery in developer workflows |
| Wed Mar 26 | Publish second tutorial: "Zero-tracking document processing pipeline" | Dev.to / Hashnode | Medium |
| Thu Mar 27 | Start CrewAI integration guide | CrewAI | Medium |
| Fri Mar 28 | Port Document Parser and Knowledge Graph to Apify | Apify | High |
| Sun Mar 30 | Week 3 retrospective | Internal | Required |

### Week 4: Compound (March 31 - April 6)

| Day | Action | Channel | Expected Impact |
|-----|--------|---------|-----------------|
| Mon Mar 31 | Publish CrewAI integration guide | CrewAI Discord | Medium |
| Tue Apr 1 | Record 10-min YouTube demo: "Build an autonomous research agent with 5 MCP tools" | YouTube | Medium-High -- visual proof drives trust |
| Wed Apr 2 | Reach out to 20 enterprise targets running AI agents at scale | Direct | Low-Medium in Week 4, compounds |
| Thu Apr 3 | Launch Phase 2 apps (Message Bus, Embedding Service, Audit Logger, Budget Tracker) | All channels | Medium -- expands portfolio story |
| Fri Apr 4 | Announce Phase 2 on HN (comment in original thread) and Reddit (update post) | HN, Reddit | Low-Medium |
| Sun Apr 6 | Month 1 retrospective: full KPI review | Internal | Required |

### Weeks 5-8: Sustain and Scale

| Week | Focus | Key Actions |
|------|-------|-------------|
| Week 5 | Phase 3 apps (Secrets Vault, Job Scheduler, Webhook Relay, Identity Oracle) | Deploy, list on marketplaces, announce |
| Week 6 | Enterprise outreach acceleration | Follow up with enterprise targets, prepare case study template |
| Week 7 | Phase 4 apps (LLM Router, Deduplication, Translation) | Deploy, list, complete the portfolio |
| Week 8 | Full portfolio retrospective | Revenue analysis, channel ROI, pricing adjustments, plan Month 3-6 strategy |

---

## Launch Checklist

### Pre-Launch

- [ ] All 4 Phase 1 apps deployed and passing health checks on Fly.io
- [ ] /privacy endpoint live and returning correct JSON on all 4 apps
- [ ] Privacy section in all 4 READMEs matches the transparency rules above
- [ ] Research Agent demo repo published on GitHub with cost breakdown
- [ ] Marketplace listings drafted for Smithery, Glama, mcp.so, PulseMCP
- [ ] HN post drafted and reviewed (privacy lead, honest disclosures)
- [ ] Reddit posts drafted and reviewed (r/AI_Agents, r/LocalLLaMA)
- [ ] MCP config snippet tested (agents can discover and call tools)
- [ ] x402 payment flow tested end-to-end with a real wallet
- [ ] Rate limiting verified (60/min per IP, 10/sec per target domain for crawler)

### Launch Day (HN)

- [ ] "Show HN" submitted Tuesday 9:00am ET
- [ ] Monitoring HN new page for the post
- [ ] Responding to every comment in real time
- [ ] Tracking upvotes, comments, and click-through to /privacy endpoints
- [ ] All services healthy (no 500s, no timeouts)

### Post-Launch (Week 1-2)

- [ ] Reddit r/AI_Agents post published
- [ ] MCPize listings submitted
- [ ] Week 1 KPIs recorded (wallets, calls, revenue, post engagement)
- [ ] Reddit r/LocalLLaMA post published
- [ ] First Dev.to tutorial published
- [ ] Apify Actor porting started
- [ ] Coinbase x402 team contacted

### Ongoing (Monthly)

- [ ] Revenue vs. projections comparison
- [ ] Channel ROI ranking updated
- [ ] Pricing adjustments if needed (Web Crawler may need a raise to $0.003-$0.004)
- [ ] New tool launches treated as mini-launches (blog post, social, marketplace update)
- [ ] /privacy endpoints updated if any data handling changes

---

## Success KPIs

| Metric | Week 1 | Month 1 | Month 3 |
|--------|--------|---------|---------|
| Active paying wallets | 20+ | 100+ | 500+ |
| Total tool calls | 5,000+ | 50,000+ | 500,000+ |
| MRR | $100+ | $1,000+ | $5,000+ |
| HN upvotes | 100+ | -- | -- |
| Marketplace listings live | 4 (all directories) | 8+ | 15 (full portfolio) |
| Demo agent GitHub stars | 25+ | 100+ | 250+ |
| /privacy endpoint hits | Track (signal of developer diligence) | Track | Track |

### Abandon Thresholds

| Signal | Timeline | Action |
|--------|----------|--------|
| < 20 wallets after Month 1 | Week 4 | Pause marketing, investigate distribution. Add Stripe/API key fallback urgently. |
| < 5 wallets after Month 2 | Week 8 | Pivot to traditional SaaS pricing (abandon x402-only). |
| HN post gets < 10 upvotes | Day 1 | Resubmit with different title angle. Try "Show HN: I built X. Here's what happened." |
| Zero Apify traction after listing | Week 5 | Deprioritize Apify, double down on direct marketplace listings. |

---

## Privacy Messaging Quick Reference

For every external-facing piece of content, use this checklist:

1. Does the headline or first sentence mention "no accounts" or "no tracking"?
2. Does it specify what we DO collect (operational metering)?
3. Does it disclose the Structured Extractor's Anthropic API usage?
4. Does it link to a /privacy endpoint?
5. Does it avoid the phrase "we don't collect any data" (because we collect metering data)?
6. Does it distinguish between "14 of 15 apps" (local compute) and the full portfolio?

If all six are covered, the content is ready to publish.

---

*Supporting documents:*
- *[REVENUE-MODEL.md](../../REVENUE-MODEL.md) -- detailed per-app financial projections*
- *[GTM-STRATEGY.md](../../GTM-STRATEGY.md) -- full go-to-market plan with channel rankings*
- *[EXECUTIVE-STRATEGY-BRIEF.md](../../EXECUTIVE-STRATEGY-BRIEF.md) -- investment-grade portfolio analysis*
