---
name: knowledge-graph
description: Build and query a knowledge graph using the live Knowledge Graph API. Extract entities from text, store facts as triples, search and traverse relationships.
argument-hint: <text-or-query> [action: extract|search|query|add-fact]
allowed-tools: Bash(curl:*)
---

# MCP Knowledge Graph Skill

Extract entities, store facts, and query relationships via the live Knowledge Graph API.

**API Base:** `https://mcp-knowledge-graph.fly.dev`

**Authentication:** Include `X-Wallet` header with an Ethereum wallet address for free trial (100 calls). Paid access uses x402 protocol.

## Arguments

- `$0` -- Text to analyze OR entity/query string (required)
- `$1` -- Action: `extract` (default), `search`, `query`, `add-fact`, `get-facts`, `link`

## Execution

### Extract Entities (default)

Send text and get back named entities (people, orgs, products, locations, etc.):

```bash
curl -s -X POST https://mcp-knowledge-graph.fly.dev/entities/extract \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d '{"text": "$0"}' | jq .
```

Optional: filter by entity types:
```bash
curl -s -X POST https://mcp-knowledge-graph.fly.dev/entities/extract \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d '{"text": "$0", "types": ["PERSON", "ORG"]}' | jq .
```

### Search Entities

Search the graph for entities matching a name:

```bash
curl -s -X POST https://mcp-knowledge-graph.fly.dev/entities/search \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d '{"query": "$0", "limit": 10}' | jq .
```

### Query Entity Relationships

Get an entity and its relationships (graph traversal):

```bash
curl -s -X POST https://mcp-knowledge-graph.fly.dev/entities/query \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d '{"entity": "$0", "depth": 2}' | jq .
```

### Add a Fact

Store a subject-predicate-object triple:

```bash
curl -s -X POST https://mcp-knowledge-graph.fly.dev/facts \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d '{"subject": "<subject>", "predicate": "<relationship>", "object": "<object>", "confidence": 0.9}' | jq .
```

Parse the user's input to extract subject, predicate, and object. For example:
- "Apple was founded by Steve Jobs" -> subject: "Apple", predicate: "founded_by", object: "Steve Jobs"
- "Elon Musk owns Tesla" -> subject: "Elon Musk", predicate: "owns", object: "Tesla"

### Link Entities

Resolve entity names to graph IDs (creates new entities if needed):

```bash
curl -s -X POST https://mcp-knowledge-graph.fly.dev/entities/link \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  -d '{"entities": ["Entity1", "Entity2"], "types": ["PERSON", "ORG"]}' | jq .
```

### Get Facts

Retrieve stored facts about an entity:

```bash
curl -s -H "X-Wallet: 0xYOUR_WALLET_ADDRESS" \
  "https://mcp-knowledge-graph.fly.dev/facts?subject=$0" | jq .
```

## Output Format

Present results to the user with:

**For entity extraction:**
1. Table of entities found: name, type, confidence
2. Raw count vs. deduplicated count
3. Any entity resolution that occurred (fuzzy matching to canonical forms)

**For search:**
1. List of matching entities with IDs, types, and match scores

**For query (graph traversal):**
1. The central entity and its properties
2. Related entities organized by relationship type
3. Traversal depth reached

**For facts:**
1. The stored triple (subject -> predicate -> object)
2. Confidence score
3. Whether entities were newly created or matched existing ones

## Supported Entity Types

PERSON, ORG, PRODUCT, LOCATION, EVENT, CONCEPT, URL, DATE

## Error Handling

- 400: "Text exceeds 100,000 character limit" or invalid request
- 402: "Payment required. Free trial may be exhausted." Include X-Wallet header for free trial.
- 404: "Entity not found in the graph."
- 429: "Rate limited. Try again in 60 seconds."

## Capabilities Check

```bash
curl -s https://mcp-knowledge-graph.fly.dev/capabilities | jq .
```
