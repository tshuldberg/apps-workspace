# Session: 2026-03-22 -- Business Plan & MCP Fixes

## What Was Done

### 1. MCP Doctor Fixes
- Fixed 10 MCP servers missing `cmd /c` wrapper for Windows (npx requires it)
- Removed duplicate `playwright` user-level MCP server (conflicts with plugin)
- Removed duplicate `context7` MCP server (redundant with claude.ai Context7 built-in)
- Removed duplicate `Framelink MCP for Figma` (redundant with claude.ai Figma built-in)
- Disabled `firecrawl` plugin (not found in marketplace, MCP server still works)
- Fixes applied to `.mcp.json` and `~/.claude.json` (global + 3 per-project entries)

### 2. Business Plan Creation
- Conducted comprehensive market research across all 29 module categories
- Researched competitors for all 23 competitive spaces (pricing, features, user counts)
- Read and consolidated existing competitor docs (12 feature files, 8 research files, pricing analysis, CPO strategy)
- Deep code review of all 29 modules to catalog current features and completeness

### 3. Three Deliverables Created (docs/business-plan/)

**BUSINESS-PLAN-MyLife-2026.md**
- 13 sections + 2 appendices
- All 29 modules detailed (features, competitors, gaps, TAM, completeness)
- Market capture revenue model (1/500 of 2.17B users = $1.79M ARR)
- $750K seed ask with 18-month milestone timeline
- Viral launch bomb marketing strategy (video + 50-city social deployment)
- Exit strategy with comparable exits (Truebill $1.275B, Notion $10B, etc.)
- Founder salary at $150K/yr included in cost structure

**COMPETITIVE-MATRIX.md**
- 267 features built (checkmarked), 217 features needed (from competitors)
- Priority distribution: 22 P0, 112 P1, 72 P2, 11 P3
- Competitor pricing tables for every module
- Estimated 12-18 months for full competitor parity

**DECK-MyLife-2026.md**
- 18 slides, data-driven, investor-ready
- Market capture model on slide 9
- Viral launch bomb on slide 12
- $750K ask with allocation breakdown on slide 11

### 4. Key Decisions Made
- Pricing: $5/yr firm
- Investment ask: $750K (up from initial $500K to include founder salary)
- Founder salary: $150K/yr (below market rate of $160-220K)
- Revenue model: market capture framing, not download guesses
- Marketing: viral video + 50-city simultaneous social deployment
- Subs module: being absorbed into Budget (not standalone)
- No AI messaging in investor materials until messaging is approved

## Files Changed
- `.mcp.json` -- cmd/c wrappers, removed context7 and Framelink
- `~/.claude.json` -- cmd/c wrappers, removed playwright MCP, removed context7/Framelink from per-project entries
- `.claude/settings.json` -- firecrawl plugin disabled
- `docs/business-plan/BUSINESS-PLAN-MyLife-2026.md` -- new
- `docs/business-plan/COMPETITIVE-MATRIX.md` -- new
- `docs/business-plan/DECK-MyLife-2026.md` -- new
- `memory.md` -- updated with session entry

## Verification
- All JSON files validated (node -e JSON.parse)
- All AI/solo-dev references scrubbed from business materials
- Investment amount ($750K) consistent across all documents
- Market capture numbers consistent across plan and deck

## Remaining Items
- PDF version of business plan
- Review competitive matrix section by section
- Finalize video concept/script direction
- Determine equity structure / SAFE terms
- Organize existing docs/Marketing and Competition/ directory
