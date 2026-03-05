# Go-to-Market Strategy: 15 MCP Apps Portfolio

**Date:** 2026-03-04 | **Author:** GTM Strategist | **Launch Target:** ~2 weeks

---

## Executive Summary

The fastest path to $10K MRR is a **three-pronged launch**: (1) list on MCP marketplaces for organic discovery, (2) launch the top 4 revenue apps first on Hacker News + Reddit for developer adoption, and (3) pursue 2-3 enterprise design partners simultaneously. The x402 micropayment model eliminates traditional SaaS sales friction -- agents pay per call with no accounts, no contracts, no procurement. This means our GTM motion is fundamentally different from traditional SaaS: we're selling to machines first, developers second, enterprises third.

**Key finding: We need ~500 active agents calling 3-4 apps at moderate frequency to hit $10K MRR.** Based on the revenue model (Moderate scenario Month 3 = $14.5K), this is achievable within 8-12 weeks with strong marketplace presence and 2-3 viral demos.

---

## 1. Portfolio Packaging Strategy

### Recommendation: Individual Apps with Bundle Incentives (NOT a platform)

**Why not a platform subscription:** x402 is inherently per-call. Forcing agents into subscriptions contradicts the protocol's value proposition and creates unnecessary friction. Agents should discover and pay for tools individually -- that's how the protocol works.

**Packaging tiers:**

| Tier | Model | Target |
|------|-------|--------|
| **Individual apps (primary)** | x402 per-call, prices as in SPEC | Autonomous agents, indie devs |
| **Data Bundle** | Extractor + Crawler + Doc Parser + KG: 15% volume discount at >10K calls/day | Power users, data pipeline teams |
| **Infrastructure Bundle** | Message Bus + Audit Logger + Budget Tracker + Secrets Vault + Job Scheduler: 20% volume discount | Enterprise agent platforms |
| **Full Portfolio Pass** | All 15 apps, 25% discount, minimum $500/mo commitment | Large-scale agent operators |

**Why individual-first:**
- 14/15 apps have ~100% gross margin, so discounts are pure acquisition strategy
- Agents naturally discover apps one at a time through workflow needs
- Bundling too early limits pricing power on the top 4 revenue drivers
- x402 makes individual discovery frictionless (no signup, no API keys)

### Launch Sequencing

| Phase | Week | Apps | Rationale |
|-------|------|------|-----------|
| **Phase 1** | Week 1-2 | Structured Extractor, Web Crawler, Document Parser, Knowledge Graph | Top 4 = 86% of revenue. Ship what matters. |
| **Phase 2** | Week 3-4 | Message Bus, Embedding Service, Audit Logger, Budget Tracker | Infrastructure layer enables multi-agent workflows |
| **Phase 3** | Week 5-6 | Secrets Vault, Job Scheduler, Webhook Relay, Identity Oracle | Trust and scheduling layer |
| **Phase 4** | Week 7-8 | LLM Router, Deduplication, Translation | Niche utilities, low revenue priority |

**Critical:** Do NOT launch all 15 simultaneously. The attention window is narrow. Lead with the strongest 4.

---

## 2. Pricing Strategy

### Current Per-Call Pricing: Validated and Competitive

| Benchmark | Our Range | Market Comparable |
|-----------|-----------|-------------------|
| Structured Extractor ($0.003-$0.020) | Competitive | Exa/Tavily search: $0.009/call; Firecrawl: $0.004-$0.01/page |
| Web Crawler ($0.001-$0.002) | Underpriced slightly | Firecrawl: $0.004/page. Room to raise. |
| Doc Parser ($0.005-$0.010) | Fair | Most document APIs: $0.01-$0.05/page |
| Knowledge Graph ($0.002-$0.005) | Good value | No direct MCP competitor. Neo4j cloud: $0.65/hr minimum |
| Message Bus ($0.0001-$0.001) | Aggressive | Redis pub/sub alternatives are free but need self-hosting |
| Budget Tracker ($0.0001-$0.001) | No competition | First mover -- no comparable x402 budget tool |

**Pricing recommendations:**

1. **Raise Web Crawler to $0.002-$0.004/page.** Currently underpriced vs Firecrawl. The market supports 2x.
2. **Keep Structured Extractor at current range.** It's the anchor product. Competitive pricing drives adoption of the entire portfolio.
3. **Introduce a "first 100 calls free" per app per wallet.** Not a free tier -- a trial. Agents get 100 calls to integrate, then x402 kicks in. This reduces integration friction without creating freeloaders. Cost: negligible ($0.70 per wallet for all 15 apps).
4. **Volume discounts at scale thresholds:**
   - >1K calls/day on any app: 10% discount
   - >10K calls/day: 20% discount
   - >100K calls/day: Custom pricing (enterprise conversation trigger)

---

## 3. Launch Channels (Ranked by Expected ROI)

### Tier 1: High-Intent Discovery (Do First)

| Channel | Action | Expected Impact | Timeline |
|---------|--------|----------------|----------|
| **Smithery** (2,880+ verified servers) | List all 15 apps. Smithery has CLI install commands -- agents can discover and connect instantly. | High -- primary MCP discovery channel. | Day 1 |
| **Glama** (9,000+ servers) | List all apps. Glama hosts and runs MCP servers and offers API gateway access. | High -- second-largest directory. | Day 1 |
| **mcp.so** (17,186+ servers) | List all apps. Largest catalog but lower signal-to-noise. | Medium -- volume play. Being listed is table stakes. | Day 1 |
| **PulseMCP** | List all apps + submit to their curated newsletter. | Medium-High -- curated = higher quality leads. | Day 1 |
| **MCPize** (85% rev share) | List top 4 revenue apps as parallel distribution channel. | Medium -- test as supplementary channel. | Week 2 |
| **Apify** (80% rev share, 130K signups/mo) | Port top 4 apps as Apify Actors with pay-per-event. Access to 130K+ monthly signups. | High -- largest ready-made audience. $2K+/mo achievable per app. | Week 3 |

### Tier 2: Developer Community Launches

| Channel | Action | Expected Impact | Timeline |
|---------|--------|----------------|----------|
| **Hacker News** | "Show HN: 15 MCP tools for AI agents, paid via x402 micropayments" | High -- HN loves novel economic models. Target 200+ upvotes. | Week 1 (Tue/Wed, 9am ET) |
| **Reddit r/AI_Agents** (180K+) | "Build log" style post showing real agent workflow using 3-4 tools. | Medium-High | Week 1, day after HN |
| **Reddit r/LocalLLaMA** (500K+) | Angle: "local-first MCP tools that don't need OpenAI API keys" | Medium | Week 2 |
| **Twitter/X** | Thread: "I built 15 paid MCP tools. Here's what I learned about pricing for AI agents." | Medium | Ongoing from Day 1 |
| **ProductHunt** | Launch as "MCP Bank - Pay-per-call tools for AI agents." | Low-Medium | Week 2 (Tuesday) |

### Tier 3: Long-Term Growth Channels

| Channel | Action | Expected Impact | Timeline |
|---------|--------|----------------|----------|
| **Dev.to / Hashnode** | 3-4 tutorials on agent tool integration | Medium -- SEO play, compounds | Week 2-4 |
| **YouTube** | 10-min demo: "Build an autonomous research agent using 5 MCP tools" | Medium-High | Week 3 |
| **Discord communities** | Join LangChain, CrewAI, AutoGPT servers. Help, don't spam. | Low-Medium | Ongoing |
| **GitHub** | Open-source example agents that use the tools. | Medium -- compounds | Week 1 |

---

## 4. Developer Evangelism Plan

### Demo Agents to Build (Ship Before Launch)

1. **Research Agent** -- Takes a topic, crawls 10 pages, extracts structured data, builds knowledge graph, returns summary. Cost per run: ~$0.05-$0.10.

2. **Document Processing Pipeline** -- Takes PDF, extracts text, generates embeddings, deduplicates, translates to 3 languages. Cost per doc: ~$0.02-$0.05.

3. **Multi-Agent Coordination Demo** -- 3 agents via Message Bus, one tracks budget, one logs audit trail. Enterprise pitch demo.

### Developer Experience Priorities

1. **SDK/client library** -- `pip install mcp-bank-client` wrapping x402 + MCP for all 15 tools
2. **Playground/sandbox** -- Web page for trying tools without a wallet
3. **Integration guides** -- LangChain, CrewAI, AutoGen, Claude Agent SDK
4. **Status page** -- Uptime monitoring for all 15 services

---

## 5. Enterprise Sales Motion

### Target Segments

| Segment | Entry Point | Deal Size |
|---------|-------------|-----------|
| AI consulting firms | Structured Extractor + Doc Parser | $2-5K/mo |
| FinTech companies | Doc Parser + Audit Logger + Budget Tracker | $5-15K/mo |
| Enterprise AI platforms | Infrastructure Bundle | $10-50K/mo |
| Legal/compliance teams | Data Bundle | $3-10K/mo |

### Enterprise Pricing (Layered on x402)

1. **Invoice billing** -- Monthly invoice based on x402 usage
2. **SLA guarantee** -- 99.9% uptime, <200ms p95 latency. 2x per-call rate.
3. **Dedicated instances** -- $500-2K/mo per app for data isolation
4. **Audit/compliance package** -- SOC2, EU AI Act, data retention

---

## 6. Partnership Opportunities

### Priority 1: Protocol & Payment

| Partner | Action |
|---------|--------|
| **Coinbase / x402** | Case study, co-marketing, Foundation membership |
| **Cloudflare** | Explore Workers deployment for distribution |
| **Stripe** | Early x402 USDC integration partner |

### Priority 2: Agent Frameworks

| Partner | Action |
|---------|--------|
| **LangChain** | Integration package + tool registry submission |
| **CrewAI** | Integration + Discord/newsletter sponsorship |
| **AutoGen (Microsoft)** | Integration + case study |
| **Claude Agent SDK** | MCP ecosystem showcase |

### Priority 3: Distribution

| Partner | Action |
|---------|--------|
| **Apify** (130K signups/mo, 80% rev share) | Port top 4 apps as Actors |
| **MCPize** (85% rev share) | List all 15 apps |
| **Composio** | List on enterprise gateway |

---

## 7. Three Paths to $10K MRR

### Path A: Marketplace + Organic (8-12 weeks)
List on all directories, ship demo agents, HN/Reddit launch. ~50 agents/week growth.
- **Timeline:** 10 weeks to 500 agents
- **Risk:** May stall at 200-300 without acceleration

### Path B: Platform Distribution (6-8 weeks)
Port top 4 to Apify. 130K monthly signups. $2K+/mo per Actor achievable.
- **Timeline:** 6-8 weeks
- **Risk:** Platform dependency, lower margins (80%)

### Path C: Enterprise Design Partners (4-8 weeks)
Cold outreach to 20 companies, close 2-3 at $3-5K/mo each.
- **Timeline:** 6-8 weeks for first close
- **Risk:** Enterprise sales cycles unpredictable

### Recommended: Execute All Three in Parallel

**Projected timeline to $10K MRR: 6-10 weeks** with parallel execution.

---

## 8. Total Launch Budget: ~$175

| Category | Budget |
|----------|--------|
| Infrastructure (Fly.io) | $150/mo |
| Domain + SSL | $12 one-time |
| Demo agents, content, Apify porting | $0 (self-built) |
| **Total** | **~$175** |

---

## 9. Week 1 Actions

1. **Ship Phase 1 apps** (Extractor, Crawler, Doc Parser, KG) to production
2. **List on Smithery + Glama + mcp.so + PulseMCP**
3. **Publish Research Agent demo** on GitHub
4. **Submit "Show HN"** -- Tuesday/Wednesday, 9am ET
5. **Start enterprise target list** -- 20 companies running AI agents at scale
