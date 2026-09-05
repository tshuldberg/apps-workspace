---
status: PROPOSAL
phase: 4
parent: docs/plans/consolidation/README.md
---

# AI Agent Layer

Wire the existing `packages/intelligence` into the app with local-first inference, per-module permissions, tool-gated SQLite access, and BYOK cloud fallback. AI is additive. Every feature ships a non-AI path. AI off by default.

## Decision: local-first, smart routing

| Platform | Local model | Library | Tool calling |
|----------|-------------|---------|--------------|
| iOS 26+ | Apple Foundation Models (~3B, OS-managed) | `@react-native-ai/apple` | Native `@Generable` / `Tool` |
| iOS 17-25, Android | Llama 3.2 1B Q4 | `react-native-executorch` | JSON-mode + parser |
| Web | Llama 3.2 1B or Gemma 3 1B | WebLLM (WebGPU) | OpenAI-compatible |
| Tool router (optional) | FunctionGemma 270M | ExecuTorch | Native function-calling head |
| Cloud fallback (BYOK) | Claude / GPT / Gemini | Vercel AI SDK v6 | Native |

Router policy in `packages/intelligence/src/llm/router.ts`:

```
if (requiresTools && iOS26 && appleFMAvailable)          -> Apple FM
else if (onDeviceAllowed && modelInstalled)              -> ExecuTorch / WebLLM
else if (cloudAllowed && userHasKey(preferredProvider))  -> Vercel AI SDK provider
else                                                      -> throw AI_UNAVAILABLE (caller falls back to non-AI UI)
```

## Package structure

Expand `packages/intelligence/src/` from the existing layout (keep `engine/`, `permissions/`, `analytics/`):

```
packages/intelligence/src/
  index.ts                         # public API barrel
  llm/
    types.ts                       # ProviderId, ModelId, InferenceRequest/Response
    router.ts                      # NEW: local/cloud routing policy
    inference.ts                   # NEW: public ask() / act() / stream() / generateObject()
    config.ts                      # existing
    prompt.ts                      # existing
    query.ts                       # existing
    providers/                     # NEW
      apple.ts                     # @react-native-ai/apple
      executorch.ts                # react-native-executorch
      mediapipe.ts                 # Android fallback (optional)
      webllm.ts                    # web
      anthropic.ts                 # Vercel AI SDK
      openai.ts                    # Vercel AI SDK
      gemini.ts                    # Vercel AI SDK
  tools/
    index.ts                       # NEW: registerTool, listTools, callTool
    sql.ts                         # NEW: sqlReadTool, sqlWriteTool (prefix-gated)
    modules/                       # NEW: one file per module with typed actions
      books.ts                     # addBook, updateProgress, ...
      budget.ts                    # addTransaction, setEnvelope, ...
      meds.ts                      # logDose, setReminder, ...
      mood.ts                      # logMood, ...
      rsvp.ts                      # createEvent, inviteContact, ...
      # ... one per enabled module
  permissions/                     # existing
  embeddings/                      # NEW
    index.ts                       # embed(text) -> number[]
    providers/
      apple.ts                     # NLContextualEmbedding
      executorch.ts                # all-MiniLM-L6-v2
      transformersjs.ts            # web
    store.ts                       # sqlite-vec adapter
    rag.ts                         # retrieveContext(query, moduleIds, k)
  prompts/                         # NEW
    system.ts                      # base system prompt with privacy guardrails
    templates/
      summarize.ts
      correlate.ts
      weekly-review.ts
      tool-calling.ts
  keys/                            # NEW
    index.ts                       # BYOK store (expo-secure-store + WebCrypto)
  engine/                          # existing: correlation, trends, insights
  analytics/                       # existing
```

## Public API (what modules consume)

```ts
import { inference, embeddings, tools, permissions, keys } from '@mylife/intelligence';

// 1. Natural-language Q&A with permission-scoped module access
const answer = await inference.ask({
  prompt: 'How did my mood correlate with sleep last week?',
  moduleScope: ['mood', 'workouts'],    // permissions enforced before any tool call
  allowCloud: user.settings.ai.cloudEnabled,
});

// 2. Agentic action (tool calls)
await inference.act({
  instruction: 'Log a Book Club reminder for Thursday 7pm',
  tools: tools.forModules(['rsvp', 'books']),
  requireBiometric: true,              // for writes that schedule/spend/message
});

// 3. RAG retrieval (journal/notes/transcripts semantic search)
const context = await embeddings.retrieve('migraines', {
  modules: ['mood', 'meds', 'journal'],
  k: 8,
});

// 4. Structured generation (JSON out)
const plan = await inference.generateObject({
  prompt: 'Plan next week meals from pantry',
  schema: MealPlanSchema,              // Zod
  moduleScope: ['recipes', 'nutrition'],
});
```

## Tool surface

### SQL tools (gated by prefix whitelist + permissions table)

```ts
// packages/intelligence/src/tools/sql.ts
import { tool } from 'ai';
import { z } from 'zod';
import { can } from '../permissions';

const MODULE_PREFIXES: Record<string, string> = {
  books: 'bk_', budget: 'bg_', mood: 'mo_', /* ... all 30 */
};

export const sqlReadTool = (ctx: { userId: string }) => tool({
  description: 'Read rows from an allowed module table (SELECT only).',
  parameters: z.object({
    module: z.enum(Object.keys(MODULE_PREFIXES) as [string, ...string[]]),
    sql: z.string(),
    params: z.array(z.any()).optional(),
  }),
  execute: async ({ module, sql, params }) => {
    if (!can(ctx.userId, module, 'read')) throw new Error('permission_denied');
    if (!/^\s*SELECT\s/i.test(sql)) throw new Error('read_only_violation');
    assertPrefixMatches(sql, MODULE_PREFIXES[module]);
    return db.prepare(sql).all(...(params ?? []));
  },
});

export const sqlWriteTool = (ctx: { userId: string }) => tool({
  description: 'Insert/update/delete in an allowed module table.',
  parameters: z.object({
    module: z.enum(Object.keys(MODULE_PREFIXES) as [string, ...string[]]),
    sql: z.string(),
    params: z.array(z.any()).optional(),
    confirmation: z.string().describe('Human-readable summary shown to the user before execution'),
  }),
  execute: async ({ module, sql, params, confirmation }) => {
    if (!can(ctx.userId, module, 'write')) throw new Error('permission_denied');
    if (/^\s*SELECT\s/i.test(sql)) throw new Error('use_sqlReadTool');
    assertPrefixMatches(sql, MODULE_PREFIXES[module]);
    await confirmWithUser(confirmation);     // UI dialog, biometric if sensitive
    return db.prepare(sql).run(...(params ?? []));
  },
});
```

### Module action tools

One file per module. Exports typed actions that internally call `sqlReadTool` / `sqlWriteTool` (or module-specific business logic) so policy enforcement is centralized.

```ts
// packages/intelligence/src/tools/modules/meds.ts
export const logDose = (ctx) => tool({
  description: 'Record that a medication dose was taken.',
  parameters: z.object({
    medicationId: z.string(),
    takenAt: z.string().datetime(),
  }),
  execute: async ({ medicationId, takenAt }) => {
    // calls meds package directly; permissions checked upstream
  },
});

export const scheduleReminder = (ctx) => tool({
  description: 'Schedule a medication reminder.',
  parameters: z.object({
    medicationId: z.string(),
    rrule: z.string(),
  }),
  execute: async ({ medicationId, rrule }) => {
    // writes hub_reminders
  },
});
```

`tools.forModules(moduleIds)` returns the union of SQL tools + action tools for the given modules, intersected with the user's permissions.

## Embeddings + RAG

- **Mobile mandatory migration:** swap `expo-sqlite` → `op-sqlite` with `sqliteVec` install flag. Already a known transition in the strategic review. Alternative if delayed: in-memory cosine over a `hub_embeddings(id, module_id, row_ref, text, vec BLOB, created_at)` table.
- **Web:** `better-sqlite3` + sqlite-vec loadable extension works out of the box.
- **Embed on write:** each module that wants semantic search calls `embeddings.embed(text, moduleId)` on row create/update and stores the vector.
- **Query:** `embeddings.retrieve(query, { modules, k })` returns top-k rows across the allowed module set.

Embedding models by platform:

| Platform | Model | Dim | Size |
|----------|-------|-----|------|
| iOS 17+ | Apple `NLContextualEmbedding` | 512 | ~100MB (bundled) |
| Android | all-MiniLM-L6-v2 via ExecuTorch | 384 | ~90MB Q8 |
| Higher quality (both) | Nomic Embed Text v1.5 (Matryoshka) | 64/128/256/512/768 | ~270MB |
| Web | Transformers.js + `all-MiniLM-L6-v2` | 384 | ~80MB |

## Key storage (BYOK cloud)

- **Mobile:** `expo-secure-store` with `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` + `requireAuthentication: true` (biometric gate). Handle `AUTH_REQUIRED` invalidation on biometric-enrollment change by re-prompting.
- **Web:** `WebCrypto` AES-GCM with user-passphrase-derived key; encrypted blob in IndexedDB; unlock per-session. Never plaintext in `localStorage`.

## User-facing surfaces

### 1. Insights page (no LLM required)

Three sub-tabs:

- **Correlations** — picker for metric A × metric B. Uses `engine.queryCorrelation()`. Pure on-device statistical analysis. Zero network.
- **Trends** — single-metric chart with smoothing and period selector. Uses `engine.queryTrends()`.
- **Discoveries** — ranked card deck from `engine.discoverInsights()` (anomaly + before/after detection). Tap to drill down.

Routes:

- Mobile: `apps/mobile/app/(hub)/insights/index.tsx`, `.../correlations.tsx`, `.../trends.tsx`, `.../discoveries.tsx`
- Web: `apps/web/app/insights/page.tsx` + sub-routes

### 2. Chat surface (LLM required)

Natural-language interface. Tool calling enabled. Permission gate on every call.

- Mobile: `apps/mobile/app/(hub)/ask/index.tsx`
- Web: `apps/web/app/ask/page.tsx`

Empty-state prompts users see:

- "Plan my meals for the week from my pantry."
- "What did I highlight in the last book I read?"
- "Show me mood on days I exercised."
- "Remind me about the car service on Monday."

Preview-then-execute pattern for every write. Biometric gate applies per the sensitivity tier matrix below.

### Biometric gate policy (default Option B + configurable drawer)

AI tool calls are classified into four sensitivity tiers. Each tier has a default biometric requirement that users can override in `Settings > AI > Require Face ID for:`.

| Tier | Examples | Default requires biometric |
|------|----------|---------------------------|
| Read | Summarize, query, correlate | No |
| Local write | Log mood, add note, tag book, local reminder, create goal | No (simple tap-confirm preview) |
| Money / scheduled | Budget transaction, confirm subscription, split expense, system-calendar reminder | **Yes** |
| Outbound | Forum post, market message, mail reply, share data to friend | **Yes** |

Settings drawer exposes four independent toggles so privacy-paranoid users can opt into biometric on every write, and low-friction users can require it only for outbound messages:

```
Settings > AI > Require Face ID for
  [ ] Local writes
  [x] Money and scheduled actions   (default on)
  [x] Outbound messages              (default on)
  [ ] Reads (never asked)
```

Stored in `hub_preferences['ai.biometric_tiers']` as a JSON object of `{ tier: boolean }`. The `inference.act` router consults this preference plus the tool's declared tier (every tool in `tools/modules/*.ts` declares a `tier` constant) before executing.

### 3. AI settings (`Settings > AI`)

- Master toggle (default OFF)
- Per-module toggle (default OFF for all modules)
- Granular mode: per-table read/write toggles (power user)
- Cloud provider picker + BYOK key entry (behind biometric unlock)
- Local model status (downloaded size, last used, "delete" button)
- Privacy audit log (which tool calls ran, when, what modules)

## Non-AI fallbacks (hard requirement)

Every AI flow has a manual equivalent shipped alongside:

| AI surface | Non-AI equivalent |
|------------|-------------------|
| Chat plan-my-meals | Meal planner page in recipes module (already exists) |
| Chat find-highlight | Full-text search via `packages/search` |
| Chat correlation | Manual picker in Insights > Correlations |
| Chat reminder creation | Reminder creation form in any module |

If `inference.ask` or `inference.act` throws `AI_UNAVAILABLE`, the calling screen redirects to the non-AI equivalent. No dead ends.

## Privacy audit trail

Every tool call writes one row to `hub_ai_audit_log`:

```sql
CREATE TABLE IF NOT EXISTS hub_ai_audit_log (
  id TEXT PRIMARY KEY NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  provider TEXT NOT NULL,          -- 'apple_fm' | 'executorch' | 'webllm' | 'claude' | 'openai' | 'gemini'
  tool_name TEXT NOT NULL,
  module_id TEXT,
  action TEXT NOT NULL,            -- 'read' | 'write' | 'schedule' | 'message'
  outcome TEXT NOT NULL,           -- 'allowed' | 'denied' | 'user_cancelled'
  payload_sha256 TEXT              -- hash of payload, not payload itself
);
```

Users can view the full log in Settings > AI > Audit. Retention: 90 days default, user-configurable.

## Dependencies to add

- `@react-native-ai/apple` (stable 0.12.x)
- `react-native-executorch` (v0.3+)
- `@mlc-ai/web-llm`
- `@huggingface/transformers` (Transformers.js v4)
- `ai` + `@ai-sdk/anthropic` + `@ai-sdk/openai` + `@ai-sdk/google` (Vercel AI SDK v6)
- `op-sqlite` (replaces `expo-sqlite` on mobile; `sqliteVec` install flag)

## Acceptance

- `packages/intelligence` exports the public API listed above
- Local inference works on iOS 17+, Android 10+, Chrome/Edge/Safari with WebGPU
- Tool calls respect `hub_ai_permissions` (denied by default)
- BYOK key store is biometric-gated on mobile and WebCrypto-encrypted on web
- `hub_ai_audit_log` records every tool call
- Every AI screen ships a non-AI fallback reachable from the same route
- `pnpm gate:function:changed` green
- `pnpm test` green including new `packages/intelligence` tests
- No crash if a user opens an AI screen with all permissions off (shows educational empty state)

## References

- Apple Foundation Models: https://developer.apple.com/documentation/FoundationModels
- React Native ExecuTorch: https://docs.swmansion.com/react-native-executorch/
- WebLLM: https://github.com/mlc-ai/web-llm
- Vercel AI SDK v6 BYOK: https://vercel.com/docs/ai-gateway/authentication-and-byok/byok
- sqlite-vec: https://github.com/asg017/sqlite-vec
- op-sqlite: https://github.com/OP-Engineering/op-sqlite
- FunctionGemma: https://ai.google.dev/gemma/docs/functiongemma
- Apple NLContextualEmbedding: https://developer.apple.com/documentation/naturallanguage/nlcontextualembedding
