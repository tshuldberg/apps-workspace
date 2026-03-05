# MCP Apps Portfolio -- Financial Projections Model

**Date:** 2026-03-04
**Author:** Revenue Modeler
**Version:** 1.0

---

## 1. Portfolio Pricing Summary (from SPEC.md files)

| # | App | Key Price Points | Revenue Est. (SPEC, 10k agents) |
|---|-----|-----------------|--------------------------------|
| 1 | **Structured Extractor** | $0.003-$0.020/call | $40-60k/mo |
| 2 | **Web Crawler** | $0.001-$0.002/page | $18-30k/mo |
| 3 | **Knowledge Graph** | $0.002-$0.005/call | $20-40k/mo |
| 4 | **Message Bus** | $0.0001-$0.001/msg | $15-25k/mo |
| 5 | **Budget Tracker** | $0.0001-$0.001/call | $15-25k/mo |
| 6 | **Document Parser** | $0.005-$0.010/call | $15-25k/mo |
| 7 | **Embedding Service** | $0.0003-$0.002/call | $12-20k/mo |
| 8 | **Webhook Relay** | $0.0001-$0.01/op | $8-15k/mo |
| 9 | **Audit Logger** | $0.0001-$0.001/entry | $6-12k/mo |
| 10 | **Secrets Vault** | $0.001-$0.002/op | $6-10k/mo |
| 11 | **Job Scheduler** | $0.0001-$0.01/job | $5-12k/mo |
| 12 | **Identity Oracle** | $0.001-$0.01/call | $3-8k/mo (now), $30k+ at scale |
| 13 | **LLM Router** | $0.002 + pass-through | $3-8k/mo |
| 14 | **Deduplication** | $0.0002-$0.001/call | $3-8k/mo |
| 15 | **Translation** | $0.0002-$0.0005/100ch | $3-6k/mo |

**Portfolio total at 10k agents (SPEC estimates):** $172k-$304k/month

---

## 2. Scenario Definitions

### Active Agents Growth

| Milestone | Conservative | Moderate | Aggressive |
|-----------|-------------|----------|------------|
| Month 1 | 100 | 500 | 1,000 |
| Month 3 | 300 | 1,500 | 3,500 |
| Month 6 | 500 | 2,500 | 5,000 |
| Month 12 | 1,000 | 5,000 | 15,000 |

### Average Calls Per Agent Per Day

Not all agents use all services. Usage modeled as a weighted mix of heavy, medium, and light users per app category.

| Usage Tier | Conservative | Moderate | Aggressive |
|------------|-------------|----------|------------|
| Heavy apps (Extractor, Crawler, KG) | 10 calls/day | 25 calls/day | 50 calls/day |
| Medium apps (Doc Parser, Embedding, Bus, Budget) | 15 calls/day | 40 calls/day | 80 calls/day |
| Light apps (Audit, Secrets, Webhook, Scheduler) | 5 calls/day | 15 calls/day | 30 calls/day |
| Niche apps (LLM Router, Dedup, Translation, Identity) | 3 calls/day | 8 calls/day | 15 calls/day |

### Adoption Rate (% of agents using each app)

| App Category | Conservative | Moderate | Aggressive |
|--------------|-------------|----------|------------|
| **Tier A** -- Extractor, Crawler | 60% | 70% | 80% |
| **Tier B** -- KG, Embedding, Doc Parser | 30% | 45% | 55% |
| **Tier C** -- Bus, Budget, Audit, Webhook | 25% | 40% | 50% |
| **Tier D** -- Secrets, Scheduler, Identity, LLM Router, Dedup, Translation | 15% | 25% | 35% |

---

## 3. Per-App Revenue Model

### Weighted Average Revenue Per Call (WARPC)

Using weighted average across each app's tool mix (most calls go to the primary tool):

| App | WARPC | Notes |
|-----|-------|-------|
| Structured Extractor | $0.007 | 60% HTML extract ($0.005), 20% JS ($0.015), 10% batch ($0.004), 5% image ($0.020), 5% raw HTML ($0.003) |
| Web Crawler | $0.0019 | 80% single ($0.002), 15% batch ($0.0015), 5% links ($0.001) |
| Knowledge Graph | $0.0038 | 30% extract ($0.005), 20% link ($0.003), 20% query ($0.005), 15% add_fact ($0.002), 15% search ($0.003) |
| Message Bus | $0.0004 | 60% publish ($0.0005), 30% poll ($0.0002), 10% subscribe/admin ($0.001) |
| Budget Tracker | $0.00015 | 70% record/check ($0.0001), 20% history ($0.0002), 10% admin ($0.001) |
| Document Parser | $0.0072 | 50% PDF ($0.008), 20% from_url ($0.010), 20% DOCX ($0.005), 10% tables ($0.006) |
| Embedding Service | $0.00055 | 50% batch embed ($0.0003), 25% single ($0.0005), 15% nearest ($0.002), 10% similarity ($0.001) |
| Webhook Relay | $0.0003 | 90% list/get events ($0.0002/$0.0001), 5% create ($0.01), 5% admin ($0.001) |
| Audit Logger | $0.00015 | 80% log ($0.0001), 15% query ($0.0002), 5% summary ($0.001) |
| Secrets Vault | $0.0013 | 40% retrieve ($0.001), 30% store ($0.002), 20% list ($0.001), 10% rotate ($0.002) |
| Job Scheduler | $0.0025 | 40% schedule_once ($0.005), 20% cron ($0.010), 30% get/list ($0.0001/$0.001), 10% admin ($0.001) |
| Identity Oracle | $0.003 | 30% get_profile ($0.001), 25% get_reputation ($0.002), 20% search ($0.005), 15% record ($0.002), 10% register ($0.01) |
| LLM Router | $0.0021 | 100% chat/complete: $0.002 flat fee. Pass-through revenue not counted as our revenue (10% margin only). Effective: ~$0.002 + ~$0.0001 pass-through margin |
| Deduplication | $0.0006 | 40% deduplicate ($0.001), 25% find_similar ($0.001), 20% fingerprint ($0.0002), 15% similarity ($0.0005) |
| Translation | $0.0004 | 60% translate ~200 chars avg ($0.001), 25% batch ($0.0008), 15% detect ($0.0002). Weighted to per-call: ~$0.0004 |

---

## 4. Monthly Revenue Projections by App

### Formula
`Monthly Revenue = Active Agents x Adoption Rate x Calls/Day x 30 x WARPC`

### Month 1

| App | WARPC | Tier | Con (100 agents) | Mod (500 agents) | Agg (1,000 agents) |
|-----|-------|------|-------------------|-------------------|---------------------|
| Structured Extractor | $0.007 | A (60/70/80%, 10/25/50 calls) | $126 | $1,838 | $8,400 |
| Web Crawler | $0.0019 | A | $34 | $499 | $2,280 |
| Knowledge Graph | $0.0038 | B (30/45/55%, 10/25/50) | $34 | $641 | $3,135 |
| Message Bus | $0.0004 | C (25/40/50%, 15/40/80) | $5 | $96 | $480 |
| Budget Tracker | $0.00015 | C | $2 | $36 | $180 |
| Document Parser | $0.0072 | B | $65 | $1,215 | $5,940 |
| Embedding Service | $0.00055 | B | $5 | $93 | $454 |
| Webhook Relay | $0.0003 | C | $3 | $72 | $360 |
| Audit Logger | $0.00015 | C | $2 | $36 | $180 |
| Secrets Vault | $0.0013 | D (15/25/35%, 3/8/15) | $2 | $39 | $205 |
| Job Scheduler | $0.0025 | D | $3 | $75 | $394 |
| Identity Oracle | $0.003 | D | $4 | $90 | $473 |
| LLM Router | $0.0021 | D | $3 | $63 | $331 |
| Deduplication | $0.0006 | D | $1 | $18 | $95 |
| Translation | $0.0004 | D | $1 | $12 | $63 |
| **TOTAL Month 1** | | | **$290** | **$4,833** | **$22,970** |

### Month 3

| App | WARPC | Con (300 agents) | Mod (1,500 agents) | Agg (3,500 agents) |
|-----|-------|-------------------|---------------------|---------------------|
| Structured Extractor | $0.007 | $378 | $5,513 | $29,400 |
| Web Crawler | $0.0019 | $103 | $1,496 | $7,980 |
| Knowledge Graph | $0.0038 | $103 | $1,924 | $10,973 |
| Message Bus | $0.0004 | $14 | $288 | $1,680 |
| Budget Tracker | $0.00015 | $5 | $108 | $630 |
| Document Parser | $0.0072 | $194 | $3,645 | $20,790 |
| Embedding Service | $0.00055 | $15 | $278 | $1,589 |
| Webhook Relay | $0.0003 | $10 | $216 | $1,260 |
| Audit Logger | $0.00015 | $5 | $108 | $630 |
| Secrets Vault | $0.0013 | $5 | $117 | $716 |
| Job Scheduler | $0.0025 | $10 | $225 | $1,378 |
| Identity Oracle | $0.003 | $12 | $270 | $1,654 |
| LLM Router | $0.0021 | $9 | $189 | $1,158 |
| Deduplication | $0.0006 | $2 | $54 | $331 |
| Translation | $0.0004 | $2 | $36 | $221 |
| **TOTAL Month 3** | | **$867** | **$14,467** | **$80,389** |

### Month 6

| App | WARPC | Con (500 agents) | Mod (2,500 agents) | Agg (5,000 agents) |
|-----|-------|-------------------|---------------------|---------------------|
| Structured Extractor | $0.007 | $630 | $9,188 | $42,000 |
| Web Crawler | $0.0019 | $171 | $2,494 | $11,400 |
| Knowledge Graph | $0.0038 | $171 | $3,206 | $15,675 |
| Message Bus | $0.0004 | $23 | $480 | $2,400 |
| Budget Tracker | $0.00015 | $8 | $180 | $900 |
| Document Parser | $0.0072 | $324 | $6,075 | $29,700 |
| Embedding Service | $0.00055 | $25 | $464 | $2,269 |
| Webhook Relay | $0.0003 | $17 | $360 | $1,800 |
| Audit Logger | $0.00015 | $8 | $180 | $900 |
| Secrets Vault | $0.0013 | $9 | $195 | $1,024 |
| Job Scheduler | $0.0025 | $17 | $375 | $1,969 |
| Identity Oracle | $0.003 | $20 | $450 | $2,363 |
| LLM Router | $0.0021 | $14 | $315 | $1,654 |
| Deduplication | $0.0006 | $4 | $90 | $473 |
| Translation | $0.0004 | $3 | $60 | $315 |
| **TOTAL Month 6** | | **$1,444** | **$24,112** | **$114,842** |

### Month 12

| App | WARPC | Con (1,000 agents) | Mod (5,000 agents) | Agg (15,000 agents) |
|-----|-------|---------------------|---------------------|----------------------|
| Structured Extractor | $0.007 | $1,260 | $18,375 | $126,000 |
| Web Crawler | $0.0019 | $342 | $4,988 | $34,200 |
| Knowledge Graph | $0.0038 | $342 | $6,413 | $47,025 |
| Message Bus | $0.0004 | $45 | $960 | $7,200 |
| Budget Tracker | $0.00015 | $17 | $360 | $2,700 |
| Document Parser | $0.0072 | $648 | $12,150 | $89,100 |
| Embedding Service | $0.00055 | $50 | $928 | $6,806 |
| Webhook Relay | $0.0003 | $34 | $720 | $5,400 |
| Audit Logger | $0.00015 | $17 | $360 | $2,700 |
| Secrets Vault | $0.0013 | $18 | $390 | $3,071 |
| Job Scheduler | $0.0025 | $34 | $750 | $5,906 |
| Identity Oracle | $0.003 | $41 | $900 | $7,088 |
| LLM Router | $0.0021 | $28 | $630 | $4,961 |
| Deduplication | $0.0006 | $8 | $180 | $1,418 |
| Translation | $0.0004 | $5 | $120 | $945 |
| **TOTAL Month 12** | | **$2,889** | **$48,224** | **$344,520** |

---

## 5. Revenue Summary Table

| Period | Conservative | Moderate | Aggressive |
|--------|-------------|----------|------------|
| **Month 1** | $290/mo | $4,833/mo | $22,970/mo |
| **Month 3** | $867/mo | $14,467/mo | $80,389/mo |
| **Month 6** | $1,444/mo | $24,112/mo | $114,842/mo |
| **Month 12** | $2,889/mo | $48,224/mo | $344,520/mo |

### Cumulative Revenue (Sum over period)

| Period | Conservative | Moderate | Aggressive |
|--------|-------------|----------|------------|
| **Months 1-3** | $1,737 | $29,200 | $143,527 |
| **Months 1-6** | $5,751 | $87,498 | $437,171 |
| **Months 1-12** | $14,331 | $218,016 | $1,219,340 |

---

## 6. Cost Model

### 6a. Infrastructure Costs (Fly.io)

All 15 apps deployed on Fly.io with scale-to-zero where possible.

| Component | Always-On Cost | Scale-to-Zero Cost | Notes |
|-----------|---------------|-------------------|-------|
| **App machines (shared-cpu-1x, 256MB)** | $3.19/mo each | $0 idle, ~$0.0000019/sec running | Most apps can scale-to-zero at low volume |
| **App machines (shared-cpu-2x, 512MB)** | $6.38/mo each | Same scale-to-zero | For Extractor, KG, Embedding (heavier compute) |
| **Fly Postgres (1GB, single node)** | $6.72/mo | N/A (always on) | Shared across apps needing PG |
| **Fly Redis (256MB)** | $6.38/mo | N/A (always on) | Shared cache layer |
| **Volume storage** | $0.15/GB/mo | Per-use | For model files (Embedding, Translation) |

#### Infrastructure Cost by Scenario

**Conservative (Month 1-3: Low traffic, most apps scale-to-zero)**
| Item | Monthly Cost |
|------|-------------|
| 3 always-on apps (Extractor, KG, Embedding) | $19.14 |
| 12 scale-to-zero apps | ~$5 (minimal runtime) |
| Shared Postgres | $6.72 |
| Shared Redis | $6.38 |
| Volume storage (2GB models) | $0.30 |
| **Total Infrastructure** | **~$38/mo** |

**Moderate (Month 6: Steady traffic, most apps always-on)**
| Item | Monthly Cost |
|------|-------------|
| 5 always-on 2x apps | $31.90 |
| 10 always-on 1x apps | $31.90 |
| 2 Postgres nodes (HA) | $13.44 |
| 2 Redis instances | $12.76 |
| Volume storage (5GB) | $0.75 |
| **Total Infrastructure** | **~$91/mo** |

**Aggressive (Month 12: High traffic, scaled up)**
| Item | Monthly Cost |
|------|-------------|
| 5 performance-2x (2GB) apps | $61.84/ea = $309.20 |
| 10 shared-cpu-4x (1GB) apps | $12.76/ea = $127.60 |
| Postgres HA (4GB, 2 nodes) | $96.00 |
| Redis (1GB, 2 instances) | $51.04 |
| Volume storage (20GB) | $3.00 |
| **Total Infrastructure** | **~$587/mo** |

### 6b. API Pass-Through Costs

| Service | Cost Driver | Estimate |
|---------|------------|----------|
| **Anthropic API (Haiku)** | Structured Extractor LLM fallback (~40% of calls) | ~$0.001/LLM call |
| **Anthropic API (Haiku)** | LLM Router pass-through | Pass-through + 10% margin |
| **Base RPC** | Identity Oracle on-chain verification | Negligible (free tier) |

**API cost as % of revenue:**
- Structured Extractor: LLM fallback on 40% of calls at $0.001 cost vs $0.005-$0.015 price = ~8-20% COGS
- LLM Router: 110% pass-through means we keep 10% margin, API cost is ~91% of revenue on that app
- All other apps: $0 API cost (local compute only)

**Monthly API Costs by Scenario:**

| Scenario/Month | Extractor API Cost | LLM Router API Cost | Total API Cost |
|----------------|-------------------|---------------------|----------------|
| Con M1 | $5 | $3 | $8 |
| Mod M1 | $74 | $57 | $131 |
| Agg M1 | $336 | $300 | $636 |
| Con M6 | $25 | $13 | $38 |
| Mod M6 | $368 | $286 | $654 |
| Agg M6 | $1,680 | $1,505 | $3,185 |
| Con M12 | $50 | $25 | $75 |
| Mod M12 | $735 | $572 | $1,307 |
| Agg M12 | $5,040 | $4,509 | $9,549 |

### 6c. Domain, SSL, Misc

| Item | Cost |
|------|------|
| Domain (mcp-bank.fly.dev) | Free (Fly subdomain) |
| Custom domain (if used) | $12/year |
| SSL | Free (Fly managed) |
| GitHub Pro | $4/mo |
| Monitoring (Fly Metrics) | Free |
| **Total Misc** | **~$5/mo** |

### 6d. Total Cost Summary

| Scenario/Period | Infrastructure | API Costs | Misc | **Total Cost** |
|-----------------|---------------|-----------|------|---------------|
| Con M1 | $38 | $8 | $5 | **$51** |
| Con M6 | $38 | $38 | $5 | **$81** |
| Con M12 | $55 | $75 | $5 | **$135** |
| Mod M1 | $50 | $131 | $5 | **$186** |
| Mod M6 | $91 | $654 | $5 | **$750** |
| Mod M12 | $130 | $1,307 | $5 | **$1,442** |
| Agg M1 | $65 | $636 | $5 | **$706** |
| Agg M6 | $200 | $3,185 | $5 | **$3,390** |
| Agg M12 | $587 | $9,549 | $5 | **$10,141** |

---

## 7. Unit Economics

### Gross Margin by App Category

| App | Revenue/Call | Cost/Call | Gross Margin | Margin % |
|-----|-------------|----------|-------------|----------|
| Structured Extractor | $0.007 avg | $0.0004 (40% LLM @ $0.001) | $0.0066 | 94% |
| Web Crawler | $0.0019 | ~$0 (compute only) | $0.0019 | ~100% |
| Knowledge Graph | $0.0038 | ~$0 (local spaCy) | $0.0038 | ~100% |
| Message Bus | $0.0004 | ~$0 (Redis) | $0.0004 | ~100% |
| Budget Tracker | $0.00015 | ~$0 (PG insert) | $0.00015 | ~100% |
| Document Parser | $0.0072 | ~$0 (local libs) | $0.0072 | ~100% |
| Embedding Service | $0.00055 | ~$0 (local model) | $0.00055 | ~100% |
| Webhook Relay | $0.0003 | ~$0 (Redis + HTTP) | $0.0003 | ~100% |
| Audit Logger | $0.00015 | ~$0 (PG insert) | $0.00015 | ~100% |
| Secrets Vault | $0.0013 | ~$0 (PG + crypto) | $0.0013 | ~100% |
| Job Scheduler | $0.0025 | ~$0 (PG + cron) | $0.0025 | ~100% |
| Identity Oracle | $0.003 | ~$0 (PG + RPC) | $0.003 | ~100% |
| LLM Router | $0.0021 | $0.0019 (91% pass-through) | $0.0002 | 9.5% |
| Deduplication | $0.0006 | ~$0 (local model) | $0.0006 | ~100% |
| Translation | $0.0004 | ~$0 (local argos) | $0.0004 | ~100% |

**Portfolio-weighted gross margin:** ~93-95% (LLM Router drags it down slightly)

**Key insight:** 14 of 15 apps have near-100% gross margin because they use local compute (spaCy, sentence-transformers, argos-translate, pymupdf, etc.) or simple database operations. Only Structured Extractor (partial LLM fallback) and LLM Router (pass-through model) have meaningful variable costs.

### Net Margin by Scenario (Month 12)

| Scenario | Revenue | Total Costs | Net Income | Net Margin |
|----------|---------|-------------|------------|------------|
| Conservative | $2,889 | $135 | $2,754 | 95.3% |
| Moderate | $48,224 | $1,442 | $46,782 | 97.0% |
| Aggressive | $344,520 | $10,141 | $334,379 | 97.1% |

---

## 8. Break-Even Analysis

### Fixed Costs Floor
Minimum infrastructure to keep the portfolio alive: **~$38/month** (scale-to-zero apps + shared PG + Redis)

### Break-Even by Scenario

| Scenario | Fixed Cost | Avg Rev/Agent/Mo | Agents to Break Even |
|----------|-----------|-----------------|---------------------|
| Conservative | $51 | $2.90 | **18 agents** |
| Moderate | $186 | $9.67 | **20 agents** |
| Aggressive | $706 | $22.97 | **31 agents** |

**The portfolio breaks even at roughly 18-31 active agents**, depending on infrastructure provisioning. This is extremely capital-efficient.

### Time to Break Even (from launch)
- **Conservative:** Month 1 (revenue $290 > costs $51)
- **Moderate:** Month 1 (revenue $4,833 > costs $186)
- **Aggressive:** Month 1 (revenue $22,970 > costs $706)

**All scenarios are profitable from Month 1.** The scale-to-zero architecture and near-zero COGS mean there is no cash burn period.

---

## 9. Revenue Mix Analysis (Which apps drive 80% of revenue?)

### Month 12 Revenue Share

| Rank | App | Con Rev | Con % | Mod Rev | Mod % | Agg Rev | Agg % |
|------|-----|---------|-------|---------|-------|---------|-------|
| 1 | Structured Extractor | $1,260 | 43.6% | $18,375 | 38.1% | $126,000 | 36.6% |
| 2 | Document Parser | $648 | 22.4% | $12,150 | 25.2% | $89,100 | 25.9% |
| 3 | Web Crawler | $342 | 11.8% | $4,988 | 10.3% | $34,200 | 9.9% |
| 4 | Knowledge Graph | $342 | 11.8% | $6,413 | 13.3% | $47,025 | 13.6% |
| | **Top 4 subtotal** | **$2,592** | **89.7%** | **$41,926** | **86.9%** | **$296,325** | **86.0%** |
| 5 | Embedding Service | $50 | 1.7% | $928 | 1.9% | $6,806 | 2.0% |
| 6 | Message Bus | $45 | 1.6% | $960 | 2.0% | $7,200 | 2.1% |
| 7 | Job Scheduler | $34 | 1.2% | $750 | 1.6% | $5,906 | 1.7% |
| 8 | Identity Oracle | $41 | 1.4% | $900 | 1.9% | $7,088 | 2.1% |
| | **Top 8 subtotal** | **$2,762** | **95.6%** | **$45,464** | **94.3%** | **$323,325** | **93.8%** |

**Key finding:** The top 4 apps (Structured Extractor, Document Parser, Knowledge Graph, Web Crawler) drive **86-90% of all revenue** across all scenarios. These are the "data extraction and enrichment" cluster. The remaining 11 apps provide ecosystem value but are not primary revenue drivers.

**Revenue concentration risk:** Structured Extractor alone accounts for 37-44% of revenue. This is the single most important app to get right.

---

## 10. Sensitivity Analysis

### 10a. x402 Adoption Rate Sensitivity

| Factor | Conservative M12 | Moderate M12 | Aggressive M12 |
|--------|-----------------|-------------|---------------|
| **Base case** | $2,889 | $48,224 | $344,520 |
| **0.5x adoption (halved agents)** | $1,444 | $24,112 | $172,260 |
| **2x adoption (doubled agents)** | $5,778 | $96,448 | $689,040 |

Linear scaling -- revenue is directly proportional to agent count since costs are near-zero marginal.

### 10b. Pricing Pressure (50% price reduction)

If competitive pressure forces a 50% price cut across all apps:

| Scenario | Original M12 Rev | 50% Price Cut Rev | Costs | Still Profitable? |
|----------|-----------------|-------------------|-------|-------------------|
| Conservative | $2,889 | $1,444 | $135 | Yes ($1,309 net) |
| Moderate | $48,224 | $24,112 | $1,442 | Yes ($22,670 net) |
| Aggressive | $344,520 | $172,260 | $10,141 | Yes ($162,119 net) |

**Even at 50% price cuts, the portfolio remains highly profitable** due to near-zero marginal costs. The floor is essentially the infrastructure cost ($38-$587/mo).

### 10c. Competitor Entry Scenario

A well-funded competitor launches 5 equivalent services, capturing 40% market share on those apps:

- Assume competitor takes 40% of Extractor, Crawler, Doc Parser, Embedding, and LLM Router revenue
- Remaining 10 apps unaffected (niche/ecosystem lock-in)

| Scenario | Original M12 | Competitor Impact | Revised M12 | Change |
|----------|-------------|-------------------|-------------|--------|
| Conservative | $2,889 | -$891 | $1,998 | -31% |
| Moderate | $48,224 | -$14,618 | $33,606 | -30% |
| Aggressive | $344,520 | -$105,452 | $239,068 | -31% |

Still profitable in all scenarios. Knowledge Graph (network effects moat) and infrastructure apps (Bus, Budget, Audit, Secrets) are defensible.

### 10d. Call Volume Sensitivity

What if average calls per agent per day are 2x or 0.5x baseline?

| Volume Factor | Conservative M12 | Moderate M12 | Aggressive M12 |
|---------------|-----------------|-------------|---------------|
| 0.5x calls/day | $1,444 | $24,112 | $172,260 |
| 1x (base) | $2,889 | $48,224 | $344,520 |
| 2x calls/day | $5,778 | $96,448 | $689,040 |
| 5x calls/day | $14,445 | $241,120 | $1,722,600 |

At 5x call volume (heavy automation agents running 24/7), moderate scenario hits $241k/mo at month 12 -- approaching the SPEC's original 10k-agent estimates.

---

## 11. Key Metrics Summary

### The Bottom Line: Realistic Monthly Revenue

| Period | Most Likely (Moderate) | Pessimistic (Conservative) | Optimistic (Aggressive) |
|--------|----------------------|--------------------------|------------------------|
| Month 1 | **$4,833** | $290 | $22,970 |
| Month 3 | **$14,467** | $867 | $80,389 |
| Month 6 | **$24,112** | $1,444 | $114,842 |
| Month 12 | **$48,224** | $2,889 | $344,520 |

### Key Ratios (Month 12, Moderate)

| Metric | Value |
|--------|-------|
| Monthly Revenue | $48,224 |
| Monthly Costs | $1,442 |
| Net Margin | 97.0% |
| Revenue/Agent/Month | $9.65 |
| Break-Even Agents | 20 |
| Top 4 Apps Revenue Share | 86.9% |
| LTV/Agent (12-month) | $115.80 |
| Portfolio ARR | $578,688 |

### Build Priorities by Revenue Impact

1. **Structured Extractor** -- 38% of revenue, build first
2. **Document Parser** -- 25% of revenue, build second
3. **Knowledge Graph** -- 13% of revenue, network effects moat, build third
4. **Web Crawler** -- 10% of revenue, complements Extractor, build fourth
5. All others contribute < 3% each individually but provide ecosystem completeness

---

## 12. Risk Factors

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| x402 adoption slower than expected | Revenue scales linearly down | Medium | Low fixed costs mean profitable even at tiny scale |
| Competitor launches cheaper alternatives | 30% revenue loss on affected apps | Medium | Network effects (KG), ecosystem lock-in (Bus/Budget/Audit) |
| Anthropic API price increase | Higher COGS on Extractor + Router | Low | CSS-first extraction minimizes LLM dependency |
| Fly.io pricing changes | Infrastructure cost increase | Low | ~3% of revenue at scale, easily absorbed |
| Agent call volume lower than modeled | Linear revenue decrease | Medium | Budget Tracker and Audit Logger have floor usage (agents need them) |
| Single app concentration (Extractor = 38%) | Revenue fragility | Medium | Document Parser at 25% provides secondary anchor |

---

## 13. Appendix: Assumptions

1. **30 days/month** for all calculations
2. **No churn modeled** -- agents that start using a service continue. Conservative scenario implicitly has low adoption to compensate
3. **No free tier** -- all calls paid via x402 (no usage before first payment)
4. **Cache hit rate of 20%** reduces effective revenue by ~10% (cached calls at 50% price). Not modeled separately -- absorbed into WARPC estimates
5. **LLM Router pass-through** -- only the $0.002 service fee counted as revenue, not the API cost pass-through
6. **No human employees** -- solo operator, $0 labor cost
7. **Scale-to-zero** on Fly.io works as documented (machines sleep after 5min idle, cold start < 2s)
8. **x402 payment fees** -- assumed absorbed by the paying agent (standard in the protocol)
9. **Translation pricing** -- modeled as per-call average rather than per-100-chars to simplify
