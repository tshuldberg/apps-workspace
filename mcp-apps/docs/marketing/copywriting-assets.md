# Copywriting Assets -- MCP Apps Portfolio

**Date:** 2026-03-05
**Voice:** Professional but direct. Technical without jargon. Confident without hype.
**Audience:** AI agent developers, autonomous agent operators, enterprise AI teams.
**Primary Action:** Connect a wallet and make the first tool call.

---

## 1. Homepage Hero Copy

### Option A (Recommended) -- Outcome-Focused, Privacy Lead

**Headline:**
> Tool infrastructure for AI agents. No accounts. No API keys. No tracking.

**Subheadline:**
> 15 MCP tool servers your agents can call right now -- web crawling, structured extraction, document parsing, knowledge graphs, and more. Pay per call with x402 micropayments. We never see your name, your email, or your data.

**CTA:**
> Make Your First Call

**Annotation:** Leads with the structural privacy advantage because it is the single clearest differentiator. Every competitor requires signup. We require nothing. The CTA uses "Make Your First Call" instead of "Get Started" because the action is literal -- agents call tools.

---

### Option B -- Problem-Focused

**Headline:**
> Your agents need tools, not another dashboard to log into.

**Subheadline:**
> MCP tool servers with zero signup friction. Your agent sends a wallet payment, gets structured data back, and we forget it happened. 15 tools. 95 endpoints. No accounts.

**CTA:**
> Connect a Wallet and Go

**Annotation:** Targets the frustration of managing API keys and dashboards across multiple services. "Forget it happened" reinforces the privacy-by-design positioning. Best for audiences arriving from competitor frustration.

---

### Option C -- Differentiation-Focused

**Headline:**
> The tool servers that don't know who you are.

**Subheadline:**
> 15 MCP-native tools for AI agents. Wallet-only identity. Pay-per-call pricing. Zero data collection. Your agent calls, pays, and moves on -- we never log the content.

**CTA:**
> See the Tools

**Annotation:** Uses mystery/intrigue to position privacy as a feature, not a limitation. "Don't know who you are" is technically accurate -- x402 provides wallet-only identity with no PII collection. Best for Hacker News and privacy-conscious audiences.

---

## 2. Feature Descriptions -- Top 4 Apps

### Web Crawler

**Tagline:** Crawl any page. Get clean markdown. Move on.

**Description:**
Your agent points at a URL. The crawler fetches the page, strips the noise, and returns clean markdown with extracted links. Batch 50 URLs at once. Crawl recursively up to 5 levels deep. Every crawl respects robots.txt by default.

No browser fingerprinting. No cookies. No request logging. We cache results for 1 hour to cut costs on repeated calls -- cached responses cost 50% less.

**Tools:**
- `crawl` -- Single URL to markdown ($0.002/call)
- `crawl_batch` -- Up to 50 URLs concurrently ($0.0015/URL)
- `crawl_recursive` -- Follow links up to 5 levels deep ($0.002/page)
- `fetch_links` -- Extract all links from a page ($0.001/call)

**Why this over Firecrawl:** No signup. No API key. No usage dashboard tracking your every call. Same output quality at comparable pricing, with wallet-only identity.

---

### Structured Extractor

**Tagline:** Send a schema. Get structured JSON. From any URL, HTML, or image.

**Description:**
Define the data you want with a JSON Schema. The extractor fetches the page, tries fast extraction first (JSON-LD, OpenGraph, microdata, CSS patterns), and only falls back to LLM if confidence drops below 0.8. You get structured data with a confidence score and the method used, so you always know how the result was produced.

**Transparency note:** Approximately 40% of extraction calls use Anthropic's Claude Haiku as an LLM fallback. When this happens, cleaned HTML (stripped of scripts, styles, and navigation) is sent to Anthropic's API. This is the only app in the portfolio that sends user content to a third party. The remaining 14 apps run entirely on local compute. Full details at the `/privacy` endpoint.

**Tools:**
- `extract` -- URL + schema to structured JSON ($0.005/call)
- `extract_from_html` -- Raw HTML + schema ($0.003/call)
- `extract_from_image` -- Image + schema via vision LLM ($0.020/call)
- `extract_batch` -- Up to 50 URLs with one schema ($0.004/URL)

**Why this over Exa or Tavily:** They return search results. We return exactly the structured data your schema defines. No accounts, no API keys, no content logging. You define the shape, you get the shape.

---

### Document Parser

**Tagline:** PDFs, Word docs, and spreadsheets -- parsed and structured in one call.

**Description:**
Send a document (base64 or URL) and get back sections, tables, metadata, hyperlinks, and full text. The parser handles PDFs with table extraction, DOCX with heading structure, and XLSX with multi-sheet support. All parsing runs locally using pymupdf and python-docx -- no content leaves the server.

**Tools:**
- `parse_pdf` -- Extract text, tables, sections, and metadata ($0.008/call)
- `parse_docx` -- DOCX to structured sections and tables ($0.005/call)
- `parse_xlsx` -- Spreadsheet to headers and row data ($0.005/call)
- `parse_from_url` -- Fetch and parse from URL with auto-format detection ($0.010/call)
- `extract_tables` -- Pull only table data from PDF or DOCX ($0.006/call)

**Why this over building your own:** Zero ops. No server to maintain, no libraries to update, no format edge cases to debug. Send the document, get structured output.

---

### Knowledge Graph

**Tagline:** Extract entities. Store relationships. Query the graph. All via MCP.

**Description:**
Feed text into the graph and it extracts named entities using spaCy NER (PERSON, ORG, LOCATION, PRODUCT, and more). Entities get resolved and deduplicated automatically -- "Apple Inc." and "Apple" map to the same node. Add facts as subject-predicate-object triples. Query relationships up to 3 levels deep.

Every entity has a confidence score, source count, and alias tracking. The graph grows with every call your agent makes. Over time, this creates a private knowledge base that compounds in value -- and that is the real product.

All NER and resolution runs locally. No external API calls.

**Tools:**
- `extract_entities` -- Text to named entities with resolution ($0.005/call)
- `link_entities` -- Resolve names to graph IDs ($0.003/call)
- `add_fact` -- Store a subject-predicate-object relationship ($0.002/call)
- `query_entity` -- Traverse relationships up to 3 levels ($0.005/call)
- `search_entities` -- Find entities by name or type ($0.003/call)
- `get_facts` -- Retrieve facts for a subject ($0.003/call)

**Why this over Neo4j or a custom graph:** No database to provision. No schema to define. No cluster to manage. Your agent starts adding facts and querying relationships in its first call. Pay per operation, not per hour.

---

## 3. Privacy-Focused Taglines

1. **No accounts. No API keys. No tracking. Just tools.**
   *Rationale: Direct and exhaustive. Lists what we lack, which is actually our strength.*

2. **Your agent's data stays your agent's data.**
   *Rationale: Speaks to agents as first-class users. Short and quotable.*

3. **We never see your name, your email, or your content.**
   *Rationale: Specificity builds trust more than vague promises.*

4. **Wallet in, data out. Nothing else stored.**
   *Rationale: Describes the entire flow in six words.*

5. **Privacy by architecture, not by policy.**
   *Rationale: Positions privacy as structural (x402 model) rather than a checkbox compliance exercise.*

6. **The tools that don't know who you are.**
   *Rationale: Slightly provocative. Makes the reader stop and think about how that is even possible.*

7. **14 of 15 apps never make a single external API call. We disclose the one that does.**
   *Rationale: Transparency as a competitive weapon. No competitor volunteers this level of honesty.*

8. **Zero PII by design. Not by promise.**
   *Rationale: "By design" signals that the architecture itself prevents data collection, not just a policy decision.*

9. **No signup form. No billing portal. No data retention. Just MCP tools and x402 payments.**
   *Rationale: Lists all the infrastructure that does not exist, letting the reader realize how different this model is.*

10. **Built for agents. Invisible to humans.**
    *Rationale: Captures the philosophical shift -- these tools serve machines first, and machines do not need dashboards.*

---

## 4. Comparison Table Copy

### Header Copy

**Headline:** How we compare to the alternatives.

**Subheadline:** Every competitor requires you to create an account, manage API keys, and accept usage tracking. We require a wallet address.

### Comparison Table

| | **MCP Apps** | **Firecrawl** | **Exa** | **Tavily** |
|---|---|---|---|---|
| **Account required** | No | Yes (email + password) | Yes (email + password) | Yes (email + password) |
| **API key required** | No (x402 wallet) | Yes | Yes | Yes |
| **Usage tracking/dashboard** | None | Full dashboard | Full dashboard | Full dashboard |
| **Content logging** | Never | Varies by plan | Yes | Yes |
| **Identity model** | Wallet address only | Email + org profile | Email + org profile | Email + org profile |
| **Cookie/browser tracking** | None | Marketing analytics | Marketing analytics | Marketing analytics |
| **PII collected** | Zero | Name, email, company | Name, email, company | Name, email, company |
| **Payment model** | Pay per call (x402 USDC) | Monthly subscription | Monthly subscription | Monthly subscription |
| **Free tier lock-in** | 100 free calls per wallet, then pay-as-you-go | Free tier with limits, upgrade to unlock | Free tier with limits | Free tier with limits |
| **MCP native** | Yes (all 15 apps) | Yes | Yes | Yes |
| **Third-party data sharing** | 1 of 15 apps (disclosed) | See their privacy policy | See their privacy policy | See their privacy policy |
| **Tools available** | 95 across 15 apps | Web crawling focused | Search focused | Search focused |
| **Open pricing** | Yes (on-chain, per call) | Published tiers | Published tiers | Published tiers |

### Below-Table Copy

We are not claiming competitors mishandle data. We are pointing out that their business model requires collecting it. Ours does not.

The x402 micropayment protocol means authentication and billing happen in the same step -- a cryptographic payment from your agent's wallet. There is no account to create, no key to rotate, and no billing information to store. This is not a feature we added. It is a structural property of how the system works.

**One exception we always disclose:** The Structured Extractor sends cleaned HTML to Anthropic's Claude Haiku API on approximately 40% of extraction calls, when fast CSS/heuristic methods return low confidence. All other apps process everything locally. Full details are available at each app's `/privacy` endpoint, accessible without payment.

---

## 5. Email Sequence -- Developer Onboarding (3 Emails)

### Email 1: Welcome -- First 100 Calls Are Free

**Subject:** Your agent's first 100 tool calls are on us

**Preview text:** No signup required. Seriously.

**Body:**

You connected a wallet. That is the entire onboarding process.

Your agent now has 100 free calls per app across 15 MCP tool servers. Here are the four most useful ones to start with:

**Web Crawler** -- Point at a URL, get clean markdown. ($0.002/call after free tier)
Docs: [link]

**Structured Extractor** -- Define a JSON Schema, get structured data from any webpage. ($0.005/call after free tier)
Docs: [link]

**Document Parser** -- Send a PDF, DOCX, or XLSX, get sections, tables, and metadata. ($0.008/call after free tier)
Docs: [link]

**Knowledge Graph** -- Extract entities, store relationships, query the graph. ($0.005/call after free tier)
Docs: [link]

Every app exposes a `/privacy` endpoint so your agent can verify our data handling before its first call. We never log request or response content. We never see your name or email. Your wallet address is the only identifier we have -- and you are reading this email because you opted in separately.

Try one tool. If you need help, reply to this email.

**CTA:** Read the Quickstart Guide

---

### Email 2: Build Something (Day 3)

**Subject:** Build a research agent in 15 minutes with 3 MCP calls

**Preview text:** Crawl, extract, graph. That is the entire pipeline.

**Body:**

Here is a workflow your agent can run today:

**Step 1: Crawl** -- Gather 10 web pages on a topic using `crawl_batch`. Cost: $0.015

**Step 2: Extract** -- Pull structured data from each page using `extract` with a JSON Schema matching what you need. Cost: $0.050

**Step 3: Graph** -- Feed extracted entities into `extract_entities` and store relationships with `add_fact`. Cost: $0.070

Total cost for a 10-page research pipeline: **~$0.14**

Your agent now has a structured knowledge graph it can query by entity, relationship type, or graph traversal up to 3 levels deep.

We published a working example of this exact pipeline on GitHub: [link]

The pipeline uses 3 of our 15 tools. The other 12 handle document parsing, embeddings, deduplication, translation, job scheduling, audit logging, and more. Each one works the same way -- MCP call, x402 payment, structured result.

**CTA:** See All 15 Tools

---

### Email 3: Scale Up (Day 7)

**Subject:** What happens when your agent makes 10,000 calls a day

**Preview text:** Volume discounts. Same zero-tracking promise.

**Body:**

Some agents start with a few calls a day. Others ramp to thousands within the first week.

If your agent is approaching volume:

**Volume discounts kick in automatically:**
- 1,000+ calls/day on any app: 10% off
- 10,000+ calls/day: 20% off
- 100,000+ calls/day: custom pricing (reply to this email)

**Our privacy promise does not change at scale.** Whether your agent makes 10 calls or 100,000, we log the same operational metadata: tool name, wallet address, call price, response duration, cache status. That is it. No content. No request bodies. No response bodies.

**For enterprise teams running agent fleets:**
A 200-agent fleet using the Data Bundle (Crawler + Extractor + Doc Parser + Knowledge Graph) at the 15% bundle discount costs approximately $8,100/month -- compared to $4,000-$8,500/month for self-hosting equivalent infrastructure with your own DevOps time included.

The difference: you maintain nothing. No servers, no databases, no model updates, no on-call rotation.

If you are evaluating us for a team or organization, I would like to understand your use case. Reply to this email or book a 15-minute call: [link]

**CTA:** See Enterprise Pricing

---

## 6. Social Media Post Templates (Twitter/X Threads)

### Thread 1: Launch Announcement

**Post 1/6:**
I built 15 paid MCP tool servers for AI agents.

No accounts. No API keys. No tracking. No content logging.

Your agent pays per call with x402 micropayments. We never learn your name.

Here is what I built and why:

**Post 2/6:**
The top 4 tools (86% of projected revenue):

- Web Crawler: URL to clean markdown ($0.002/call)
- Structured Extractor: JSON Schema in, structured data out ($0.005/call)
- Document Parser: PDF/DOCX/XLSX to sections and tables ($0.008/call)
- Knowledge Graph: NER + entity resolution + graph queries ($0.005/call)

**Post 3/6:**
The privacy model is structural, not a policy checkbox.

x402 means wallet = identity = payment. There is no account to create. There is no API key to manage. There is no dashboard logging your calls.

14 of 15 apps run on local compute only. Zero external API calls.

**Post 4/6:**
The 1 exception: Structured Extractor sends cleaned HTML to Anthropic Claude Haiku on ~40% of calls when CSS extraction confidence is low.

I disclose this in the README, the /privacy endpoint, and every marketing page. Transparency is the whole point.

**Post 5/6:**
Unit economics:

- 14/15 apps have ~100% gross margin (local compute only)
- Infrastructure: Fly.io, scale-to-zero, ~$38/month floor
- Break-even: 18-31 active agents
- Profitable from month 1 in every scenario modeled

**Post 6/6:**
The first 100 calls per app per wallet are free.

After that, x402 per-call pricing. USDC on Base.

Every app has an MCP endpoint at /mcp and a privacy policy at /privacy (no payment required to read it).

Docs: [link]
GitHub: [link]

---

### Thread 2: Privacy Deep-Dive

**Post 1/5:**
Here is what we collect vs. what every competing API service collects.

A thread on why "no accounts" is not a marketing gimmick -- it is an architectural decision with real consequences:

**Post 2/5:**
What competitors collect:
- Email address (signup)
- Password (account security)
- API key (identity + rate limiting)
- Company name (billing)
- Usage dashboards (every call tracked by identity)
- Cookies + analytics (marketing attribution)

**Post 3/5:**
What we collect:
- Wallet address (from x402 payment header)
- Tool name (which tool was called)
- Call price (what was charged)
- Response duration (latency tracking)
- Cache status (hit or miss)

That is the complete list. No request bodies. No response bodies. No IP addresses stored.

**Post 4/5:**
This is not self-discipline. It is architecture.

x402 means payment IS authentication. The wallet address in the payment header is the only identity signal. We do not need emails because we do not have accounts. We do not need API keys because the payment itself authorizes the call.

**Post 5/5:**
We built a /privacy endpoint on every app that returns a machine-readable JSON privacy policy.

Your agent can read our privacy policy, evaluate it programmatically, and decide whether to proceed -- all before making a single paid call.

That is what "built for agents" actually means.

---

### Thread 3: Technical Walkthrough

**Post 1/5:**
Want to build a research agent that crawls the web, extracts structured data, and builds a knowledge graph?

Here is the 3-tool pipeline. Total cost per run: ~$0.14

**Post 2/5:**
Step 1: `crawl_batch`

Send 10 URLs. Get clean markdown back for each.

The crawler strips navigation, ads, and boilerplate. Respects robots.txt by default. Concurrent requests up to 50 at once.

Cost: $0.015 (10 URLs x $0.0015 batch price)

**Post 3/5:**
Step 2: `extract`

Define a JSON Schema:
```json
{
  "properties": {
    "company": {"type": "string"},
    "revenue": {"type": "number"},
    "ceo": {"type": "string"}
  }
}
```

The extractor tries JSON-LD, OpenGraph, microdata, and CSS patterns first. Falls back to LLM only if needed.

Cost: $0.050 (10 pages x $0.005)

**Post 4/5:**
Step 3: `extract_entities` + `add_fact`

Feed extracted text into the Knowledge Graph. SpaCy NER identifies people, companies, locations.

"Satya Nadella" and "Nadella" resolve to the same entity. Relationships stored as subject-predicate-object triples.

Cost: $0.070 (entity extraction + fact storage)

**Post 5/5:**
Your agent now has a queryable knowledge graph.

`query_entity("Microsoft", depth=2)` returns:
- CEO: Satya Nadella
- HQ: Redmond, WA
- Products: Azure, Windows, Office 365
- All relationships 2 levels deep

Total pipeline cost: $0.14
Total time to integrate: however long it takes to read the MCP tool docs.

No accounts created. No API keys managed. No dashboards opened.

---

### Thread 4: Cost Comparison (Short)

**Post 1/3:**
Running a 200-agent fleet with self-hosted infrastructure:

- 3-5 servers: $500-$1,500/mo
- PostgreSQL HA: $200-$500/mo
- Redis cluster: $100-$300/mo
- DevOps time (0.25 FTE): $3,000-$6,000/mo
- Total: $4,000-$8,500/mo

Plus maintenance. Plus on-call. Plus library updates.

**Post 2/3:**
Same 200-agent fleet with MCP Apps:

$8,100/mo with bundle discount.

Zero servers. Zero databases. Zero on-call rotation. Zero DevOps time.

Scale-to-zero when agents are idle. Scale up when they are busy.

**Post 3/3:**
At 50 agents, self-hosting is competitive.

At 200 agents, we save you the DevOps hire.

At 500+ agents, the gap widens because our infrastructure scales with usage, not with headcount.

First 100 calls free per app per wallet. Test before you commit: [link]

---

## Meta Content

### Homepage SEO

**Page title:** MCP Tools for AI Agents -- No Accounts, No API Keys, No Tracking

**Meta description:** 15 MCP tool servers for autonomous AI agents. Web crawling, structured extraction, document parsing, knowledge graphs, and more. Pay per call with x402 micropayments. Zero accounts, zero tracking, zero content logging.

### Key SEO Phrases (for content strategy)

- MCP tool servers
- MCP tools for AI agents
- x402 micropayments AI
- privacy-first AI tools
- structured data extraction MCP
- web crawler for agents
- knowledge graph API
- document parser API
- pay-per-call AI tools
- no-signup API
