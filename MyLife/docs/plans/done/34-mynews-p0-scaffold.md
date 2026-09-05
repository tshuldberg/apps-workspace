# Feature Spec: MyNews Phase 0 Scaffold (Hub Contract + Module Core + App Shells)

> MyNews launch plan 34, Phase 0 of 8. Registers `mynews` as the 41st MyLife module and builds the foundation everything else stands on: the hub contract (registry, billing, release state), the `@mylife/mynews` package with the three pure engines (structured diff, credibility, fee split), the local SQLite cache schema with sync policy, the canonical Supabase bootstrap SQL, both app shells (`apps/mynews` Expo, `apps/mynews-web` Next.js), and the `check:mynews-parity` gate. Founder mandate applies: phases are build order, not scope cuts; everything in the 2026-07-01 plan ships together at launch.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A registered, hidden, parity-gated MyNews foundation: hub contract green, module package with tested engines, canonical SQL authored, and both app shells typechecking with honest empty states.

**Architecture:** Standalone-first module (Manhattan pattern): `modules/mynews` holds all business logic as pure TypeScript with `nw_`-prefixed storage; `apps/mynews` (Expo) and `apps/mynews-web` (Next.js 15) are thin shells; Supabase is the canonical record per the BestChef public-launch exception; the local SQLite schema is a personal cache capped at `personal_replica` scope. The `cm_posts.post_type` widening is a GATED task (Task 14) because its files are mid-flight on `feature/meerkat-launch-finish`.

**Tech Stack:** TypeScript strict, Zod 3.24, Vitest 3, better-sqlite3 (tests), Expo ~54 + expo-router ~6, Next.js 15, Supabase (Postgres/RLS), pnpm 9 workspaces, Turborepo.

## Metadata

- **Surfaces:** `packages/module-registry`, `packages/billing-config`, `modules/mynews` (new), `supabase/migrations`, `apps/mynews` (new), `apps/mynews-web` (new), `scripts/`, root `package.json`
- **Priority Score:** 44 / 50 (A-Tier: unblocks all MyNews phases 1-7)
- **Estimated CC Time:** 4-5 wk of the 32-42 wk program
- **Depends On (hard):** none (worktree off main `4ae6d19e`)
- **Depends On (soft):** Task 14 gated on `feature/meerkat-launch-finish` merging (its 4 edit sites are dirty on that branch)
- **Blocks:** MyNews Phases 1-7 (publish/read, editing system, trust spine, support engine, safety floor, bias/power layer, launch readiness)
- **Companion docs:** `docs/reports/REPORT-mynews-open-journalism-plan-2026-07-01.html` (full build plan), `docs/reports/REPORT-mynews-product-review-2026-07-03.html` (approved screens), `docs/reports/mynews-news-platform-research-2026-06-29.html` (research, untracked)
- **INTERPRETATION FLAG (founder review requested, does not block build):** entitlement price is $4.99 matching Manhattan; supporter fee engine hardcodes DEFAULT_FEE_CONFIG at 2% platform / 2.9%+30c processing / $10 payout minimum, all overridable via `nw_fee_config` rows at runtime in later phases.

---

## Business Context

### Why

Open journalism platform: journalists publish under portable signed bylines, volunteer editors improve articles through author-controlled typed suggestions and earn auditable credibility, readers support journalists directly with a 2% all-in platform fee and zero ads. Phase 0 makes the module exist everywhere the suite requires a module to exist, and builds the three engines whose contracts every later phase consumes.

### Honesty boundary (standing rule)

No fabricated counts, no fake presence, no simulated support totals. Shell screens in this phase render honest empty states ("No articles yet. Publishing arrives with the reader in Phase 1."), never demo content presented as live.

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `packages/module-registry/src/types.ts` | Add `'mynews'` to `ModuleId` union + `ModuleIdSchema` |
| `packages/module-registry/src/constants.ts` | Add to `MODULE_IDS` + full `MODULE_METADATA.mynews` entry |
| `packages/module-registry/src/release-states.ts` | Add to `HIDDEN_MODULE_IDS` |
| `packages/module-registry/src/__tests__/mynews-registration.test.ts` | Focused registration assertions (new) |
| `packages/billing-config/src/index.ts` | `mynews: { id: 'mylife_mynews_unlock', price: 4.99 }` |
| `packages/billing-config/src/__tests__/mynews-product.test.ts` | Product assertions (new) |
| `modules/mynews/package.json`, `tsconfig.json`, `vitest.config.ts`, `CLAUDE.md` | Package scaffold |
| `modules/mynews/src/db/schema.ts` | `nw_` local cache DDL + indexes + migration V1 |
| `modules/mynews/src/definition.ts` | `MYNEWS_MODULE` ModuleDefinition incl. syncPolicy |
| `modules/mynews/src/models.ts` | Zod models (article, revision, suggestion, ledger, pledge) |
| `modules/mynews/src/engines/diff.ts` | Anchor-based structured diff: compute/apply/rebase |
| `modules/mynews/src/engines/credibility.ts` | Points, multipliers, decay, levels, caps |
| `modules/mynews/src/engines/fees.ts` | 2% split math, largest-remainder allocation, payout threshold |
| `modules/mynews/src/index.ts` | Barrel |
| `modules/mynews/src/**/__tests__/` or `*.test.ts` | Contract + property tests per engine |
| `supabase/migrations/20260703000001_mynews_bootstrap.sql` | Canonical `nw_` tables + RLS (static in P0) |
| `apps/mynews/*` | Expo shell: 5 tabs, honest empty states |
| `apps/mynews-web/*` | Next.js 15 shell: home, `/a/[slug]`, `/j/[handle]` |
| `scripts/check-mynews-parity.mjs` + root `package.json` | Dedicated parity gate wired into `check:parity` |

## Verification commands (used throughout)

```bash
pnpm --filter @mylife/module-registry test
pnpm --filter @mylife/billing-config test
pnpm --filter @mylife/mynews test
pnpm --filter @mylife/mynews typecheck
pnpm --filter @mylife/mynews-app typecheck
pnpm --filter mynews-web typecheck
pnpm check:mynews-parity
pnpm gate:function:changed
```

---

### Task 1: Register `mynews` in the module registry (41st ModuleId)

**Files:**
- Create: `packages/module-registry/src/__tests__/mynews-registration.test.ts`
- Modify: `packages/module-registry/src/types.ts` (ModuleId union ~line 24, ModuleIdSchema ~line 67)
- Modify: `packages/module-registry/src/constants.ts` (MODULE_IDS ~line 24, MODULE_METADATA after the `mood` entry)
- Modify: `packages/module-registry/src/release-states.ts` (HIDDEN_MODULE_IDS, between `'manhattan'` and `'notes'`)

- [ ] **Step 1: Write the failing test**

```ts
// packages/module-registry/src/__tests__/mynews-registration.test.ts
import { describe, expect, it } from 'vitest';
import { MODULE_IDS, MODULE_METADATA } from '../constants';
import { HIDDEN_MODULE_IDS } from '../release-states';
import { ModuleIdSchema } from '../types';

describe('mynews registration', () => {
  it('is a known module id', () => {
    expect(MODULE_IDS).toContain('mynews');
    expect(ModuleIdSchema.safeParse('mynews').success).toBe(true);
  });

  it('has standalone-first metadata with the nw_ prefix', () => {
    const def = MODULE_METADATA.mynews;
    expect(def.id).toBe('mynews');
    expect(def.name).toBe('MyNews');
    expect(def.tablePrefix).toBe('nw_');
    expect(def.tier).toBe('premium');
    expect(def.storageType).toBe('supabase');
    expect(def.accentColor).toBe('#8BCFF0');
    expect(def.requiresAuth).toBe(false);
    expect(def.requiresNetwork).toBe(true);
    expect(def.navigation.tabs.map((t) => t.key)).toEqual([
      'today', 'discover', 'desk', 'support', 'me',
    ]);
  });

  it('launches hidden', () => {
    expect(HIDDEN_MODULE_IDS).toContain('mynews');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mylife/module-registry test -- mynews-registration`
Expected: FAIL (TypeScript: `'mynews'` not assignable / property `mynews` missing)

- [ ] **Step 3: Add the id to `types.ts`**

In the `ModuleId` union insert after `| 'mood'`:

```ts
  | 'mynews'
```

In `ModuleIdSchema = z.enum([...])` insert after `'mood',`:

```ts
  'mynews',
```

- [ ] **Step 4: Add MODULE_IDS entry + MODULE_METADATA entry in `constants.ts`**

In `MODULE_IDS` insert after `'mood',`:

```ts
  'mynews',
```

In `MODULE_METADATA` insert after the full `mood` entry (metadata entries carry NO syncPolicy; that lives in the module definition):

```ts
  mynews: {
    id: 'mynews',
    name: 'MyNews',
    tagline: 'Open journalism, improved by everyone',
    icon: '\u{1F4F0}',
    accentColor: '#8BCFF0',
    tier: 'premium',
    storageType: 'supabase',
    tablePrefix: 'nw_',
    navigation: {
      tabs: [
        { key: 'today', label: 'Today', icon: 'home' },
        { key: 'discover', label: 'Discover', icon: 'compass' },
        { key: 'desk', label: 'Desk', icon: 'edit-3' },
        { key: 'support', label: 'Support', icon: 'heart' },
        { key: 'me', label: 'Me', icon: 'user' },
      ],
      screens: [
        { name: 'article-detail', title: 'Article' },
        { name: 'journalist-detail', title: 'Journalist' },
        { name: 'suggestion-detail', title: 'Suggestion' },
      ],
    },
    requiresAuth: false,
    requiresNetwork: true,
    version: '0.1.0',
  },
```

- [ ] **Step 5: Add to `HIDDEN_MODULE_IDS` in `release-states.ts`**

Insert between `'manhattan',` and `'notes',`:

```ts
  'mynews',
```

- [ ] **Step 6: Run the full registry suite (property test enforces exactly-once tier membership)**

Run: `pnpm --filter @mylife/module-registry test`
Expected: PASS including `release-states.property.test.ts` partition test and the new file

- [ ] **Step 7: Commit**

```bash
git add packages/module-registry
git commit -m "feat(mynews): register mynews as the 41st module (hidden, nw_ prefix)"
```

### Task 2: Billing catalog entry (`mylife_mynews_unlock`, $4.99)

**Files:**
- Create: `packages/billing-config/src/__tests__/mynews-product.test.ts`
- Modify: `packages/billing-config/src/index.ts` (standaloneModules, after the `manhattan` line ~62)

Note: `packages/entitlements` needs NO change; `StandaloneProduct` is the template literal `` `mylife_${ModuleId}_unlock` `` so the product id becomes valid the moment Task 1 lands.

- [ ] **Step 1: Write the failing test**

```ts
// packages/billing-config/src/__tests__/mynews-product.test.ts
import { describe, expect, it } from 'vitest';
import { ALL_PRODUCT_IDS, PRODUCTS } from '../index';

describe('mynews billing product', () => {
  it('sells the standalone unlock at 4.99', () => {
    expect(PRODUCTS.standaloneModules.mynews).toEqual({
      id: 'mylife_mynews_unlock',
      price: 4.99,
    });
  });

  it('derives into ALL_PRODUCT_IDS', () => {
    expect(ALL_PRODUCT_IDS).toContain('mylife_mynews_unlock');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mylife/billing-config test -- mynews-product`
Expected: FAIL (`standaloneModules.mynews` undefined; the `satisfies Record<Exclude<...>>` also now errors at typecheck because `mynews` is not excluded and not present)

- [ ] **Step 3: Add the product line**

After `manhattan: { id: 'mylife_manhattan_unlock', price: 4.99 },` insert:

```ts
    mynews: { id: 'mylife_mynews_unlock', price: 4.99 },
```

(Do NOT touch the `Exclude<...>` union; mynews is a paid standalone module, so it must have an entry, which the `satisfies` now enforces.)

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter @mylife/billing-config test && pnpm --filter @mylife/billing-config typecheck`
Expected: PASS / clean

- [ ] **Step 5: Commit**

```bash
git add packages/billing-config
git commit -m "feat(mynews): add mylife_mynews_unlock 4.99 standalone product"
```

### Task 3: `modules/mynews` package scaffold

**Files:**
- Create: `modules/mynews/package.json`, `modules/mynews/tsconfig.json`, `modules/mynews/vitest.config.ts`, `modules/mynews/CLAUDE.md`, `modules/mynews/src/index.ts`

- [ ] **Step 1: package.json (Manhattan template minus cross-module deps)**

```json
{
  "name": "@mylife/mynews",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc --build",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "uuid": "^11.1.0",
    "zod": "^3.24.0"
  },
  "peerDependencies": {
    "@mylife/db": "workspace:*",
    "@mylife/module-registry": "workspace:*",
    "react": "*",
    "react-native": "*"
  },
  "devDependencies": {
    "@mylife/db": "workspace:*",
    "@mylife/module-registry": "workspace:*",
    "@mylife/typescript-config": "workspace:*",
    "@types/better-sqlite3": "^7.6.0",
    "better-sqlite3": "^11.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.2.6"
  }
}
```

- [ ] **Step 2: tsconfig.json** (node types, not react-native: this package is pure logic in P0)

```json
{
  "extends": "@mylife/typescript-config/react.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: vitest.config.ts** (Manhattan's, verbatim)

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: src/index.ts placeholder barrel + smoke test, install, verify**

```ts
// modules/mynews/src/index.ts
export const MYNEWS_PACKAGE = '@mylife/mynews';
```

```ts
// modules/mynews/src/index.test.ts
import { describe, expect, it } from 'vitest';
import { MYNEWS_PACKAGE } from './index';

describe('package', () => {
  it('exports', () => {
    expect(MYNEWS_PACKAGE).toBe('@mylife/mynews');
  });
});
```

Run: `pnpm install && pnpm --filter @mylife/mynews test && pnpm --filter @mylife/mynews typecheck`
Expected: 1 test PASS, typecheck clean. Write `modules/mynews/CLAUDE.md` following `modules/manhattan/CLAUDE.md` structure (overview, exports, storage, engines, parity status).

- [ ] **Step 5: Commit**

```bash
git add modules/mynews pnpm-lock.yaml
git commit -m "feat(mynews): scaffold @mylife/mynews package"
```

### Task 4: Local cache schema (`src/db/schema.ts`) + migration V1

Local SQLite is a personal cache only (server is canonical). Seven tables, prefix `nw_`.

**Files:**
- Create: `modules/mynews/src/db/schema.ts`, `modules/mynews/src/db/schema.test.ts`

- [ ] **Step 1: Write the failing test** (executes real DDL on better-sqlite3)

```ts
// modules/mynews/src/db/schema.test.ts
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { ALL_TABLES, CREATE_INDEXES, MYNEWS_TABLE_NAMES } from './schema';

function freshDb() {
  const db = new Database(':memory:');
  for (const ddl of ALL_TABLES) db.exec(ddl);
  for (const idx of CREATE_INDEXES) db.exec(idx);
  return db;
}

describe('mynews local schema', () => {
  it('creates all nw_ tables', () => {
    const db = freshDb();
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'nw_%'")
      .all() as Array<{ name: string }>;
    expect(rows.map((r) => r.name).sort()).toEqual([...MYNEWS_TABLE_NAMES].sort());
  });

  it('enforces unique follow per journalist key', () => {
    const db = freshDb();
    const ins = db.prepare(
      "INSERT INTO nw_follows (id, journalist_key, handle, created_at) VALUES (?, ?, ?, ?)",
    );
    ins.run('f1', 'k1', 'rosa', '2026-07-03T00:00:00Z');
    expect(() => ins.run('f2', 'k1', 'rosa', '2026-07-03T00:00:01Z')).toThrow();
  });

  it('is idempotent (IF NOT EXISTS)', () => {
    const db = freshDb();
    for (const ddl of ALL_TABLES) db.exec(ddl);
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails** (`schema.ts` missing)

Run: `pnpm --filter @mylife/mynews test -- schema`
Expected: FAIL (cannot resolve `./schema`)

- [ ] **Step 3: Implement schema.ts**

```ts
// modules/mynews/src/db/schema.ts
export const MYNEWS_TABLE_NAMES = [
  'nw_follows',
  'nw_saved',
  'nw_read_cursor',
  'nw_feed_defs',
  'nw_feed_pins',
  'nw_drafts',
  'nw_settings',
] as const;

export const ALL_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS nw_follows (
    id TEXT PRIMARY KEY,
    journalist_key TEXT NOT NULL,
    handle TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS nw_saved (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    title TEXT NOT NULL,
    author_handle TEXT NOT NULL,
    saved_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS nw_read_cursor (
    article_id TEXT PRIMARY KEY,
    last_read_at TEXT NOT NULL,
    progress REAL NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS nw_feed_defs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    def_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS nw_feed_pins (
    id TEXT PRIMARY KEY,
    feed_id TEXT NOT NULL,
    position INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS nw_drafts (
    id TEXT PRIMARY KEY,
    headline TEXT,
    dek TEXT,
    body_md TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'news',
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS nw_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

export const CREATE_INDEXES: string[] = [
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_nw_follows_key ON nw_follows (journalist_key)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_nw_saved_article ON nw_saved (article_id)',
  'CREATE INDEX IF NOT EXISTS idx_nw_feed_pins_feed ON nw_feed_pins (feed_id, position)',
];
```

- [ ] **Step 4: Run to verify pass, commit**

Run: `pnpm --filter @mylife/mynews test -- schema`
Expected: 3 tests PASS

```bash
git add modules/mynews/src/db
git commit -m "feat(mynews): nw_ local cache schema with unique follow/save indexes"
```

### Task 5: `definition.ts` with syncPolicy

**Files:**
- Create: `modules/mynews/src/definition.ts`, `modules/mynews/src/definition.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// modules/mynews/src/definition.test.ts
import { describe, expect, it } from 'vitest';
import { MYNEWS_TABLE_NAMES } from './db/schema';
import { MYNEWS_MODULE } from './definition';

describe('MYNEWS_MODULE definition', () => {
  it('matches the registry contract', () => {
    expect(MYNEWS_MODULE.id).toBe('mynews');
    expect(MYNEWS_MODULE.tablePrefix).toBe('nw_');
    expect(MYNEWS_MODULE.schemaVersion).toBe(1);
    expect(MYNEWS_MODULE.migrations).toHaveLength(1);
  });

  it('declares a sync rule for every local table, all capped at personal_replica or below', () => {
    const rules = MYNEWS_MODULE.syncPolicy?.entityRules ?? [];
    const ruleNames = rules.map((r) => r.tableName).sort();
    const bare = MYNEWS_TABLE_NAMES.map((t) => t.replace(/^nw_/, '')).sort();
    expect(ruleNames).toEqual(bare);
    for (const rule of rules) {
      expect(['device_local', 'personal_replica']).toContain(rule.maxScope ?? rule.defaultScope);
    }
  });

  it('never shares at workspace scope in P0', () => {
    expect(MYNEWS_MODULE.syncPolicy?.shareable).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @mylife/mynews test -- definition`
Expected: FAIL (cannot resolve `./definition`)

- [ ] **Step 3: Implement definition.ts**

```ts
// modules/mynews/src/definition.ts
import type { Migration, ModuleDefinition } from '@mylife/module-registry';
import { ALL_TABLES, CREATE_INDEXES } from './db/schema';

const MYNEWS_MIGRATION_V1: Migration = {
  version: 1,
  description: 'MyNews local cache: follows, saved, read cursor, feeds, drafts, settings',
  up: [...ALL_TABLES, ...CREATE_INDEXES],
  down: [
    'DROP TABLE IF EXISTS nw_settings',
    'DROP TABLE IF EXISTS nw_drafts',
    'DROP TABLE IF EXISTS nw_feed_pins',
    'DROP TABLE IF EXISTS nw_feed_defs',
    'DROP TABLE IF EXISTS nw_read_cursor',
    'DROP TABLE IF EXISTS nw_saved',
    'DROP TABLE IF EXISTS nw_follows',
  ],
};

export const MYNEWS_MODULE: ModuleDefinition = {
  id: 'mynews',
  name: 'MyNews',
  tagline: 'Open journalism, improved by everyone',
  icon: '\u{1F4F0}',
  accentColor: '#8BCFF0',
  tier: 'premium',
  storageType: 'supabase',
  migrations: [MYNEWS_MIGRATION_V1],
  schemaVersion: 1,
  tablePrefix: 'nw_',
  syncPolicy: {
    defaultScope: 'device_local',
    shareable: false,
    entityRules: [
      { tableName: 'follows', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'or_set' },
      { tableName: 'saved', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'or_set' },
      { tableName: 'read_cursor', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'feed_defs', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'feed_pins', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'or_set' },
      { tableName: 'drafts', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'settings', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    ],
  },
  navigation: {
    tabs: [
      { key: 'today', label: 'Today', icon: 'home' },
      { key: 'discover', label: 'Discover', icon: 'compass' },
      { key: 'desk', label: 'Desk', icon: 'edit-3' },
      { key: 'support', label: 'Support', icon: 'heart' },
      { key: 'me', label: 'Me', icon: 'user' },
    ],
    screens: [
      { name: 'article-detail', title: 'Article' },
      { name: 'journalist-detail', title: 'Journalist' },
      { name: 'suggestion-detail', title: 'Suggestion' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: true,
  version: '0.1.0',
};
```

- [ ] **Step 4: Run, then commit**

Run: `pnpm --filter @mylife/mynews test -- definition`
Expected: 3 tests PASS

```bash
git add modules/mynews/src/definition.ts modules/mynews/src/definition.test.ts
git commit -m "feat(mynews): module definition with personal_replica-capped sync policy"
```

### Task 6: Zod models (`src/models.ts`)

**Files:**
- Create: `modules/mynews/src/models.ts`, `modules/mynews/src/models.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// modules/mynews/src/models.test.ts
import { describe, expect, it } from 'vitest';
import {
  ArticleRevisionSchema,
  ArticleSchema,
  CredibilityEntrySchema,
  EditSuggestionSchema,
  PledgeSchema,
  SUGGESTION_TYPES,
} from './models';

describe('mynews models', () => {
  it('parses a minimal article + revision', () => {
    const article = ArticleSchema.parse({
      id: 'a1', authorKey: 'k1', kind: 'news', status: 'published',
      currentRev: 1, publishedAt: '2026-07-03T00:00:00Z',
    });
    expect(article.kind).toBe('news');
    const rev = ArticleRevisionSchema.parse({
      articleId: 'a1', rev: 1, headline: 'H', bodyMd: 'Body.',
      signature: 'sig', signerPubkey: 'k1', createdAt: '2026-07-03T00:00:00Z',
      changelog: [],
    });
    expect(rev.rev).toBe(1);
  });

  it('requires citations on corrections but not copyedits', () => {
    const base = {
      id: 's1', articleId: 'a1', baseRev: 1, editorKey: 'e1',
      diff: { baseHash: 'h', ops: [] }, rationale: 'why', status: 'open',
      createdAt: '2026-07-03T00:00:00Z',
    };
    expect(
      EditSuggestionSchema.safeParse({ ...base, type: 'correction', citations: [] }).success,
    ).toBe(false);
    expect(
      EditSuggestionSchema.safeParse({
        ...base, type: 'correction', citations: ['https://inyowater.org/filings/2026-03'],
      }).success,
    ).toBe(true);
    expect(
      EditSuggestionSchema.safeParse({ ...base, type: 'copyedit', citations: [] }).success,
    ).toBe(true);
  });

  it('rejects non-https citations', () => {
    expect(
      EditSuggestionSchema.safeParse({
        id: 's2', articleId: 'a1', baseRev: 1, editorKey: 'e1', type: 'correction',
        diff: { baseHash: 'h', ops: [] }, citations: ['http://insecure.example'],
        rationale: 'why', status: 'open', createdAt: '2026-07-03T00:00:00Z',
      }).success,
    ).toBe(false);
  });

  it('pledges are positive integer cents', () => {
    expect(PledgeSchema.safeParse({ journalistId: 'j1', amountCents: 500 }).success).toBe(true);
    expect(PledgeSchema.safeParse({ journalistId: 'j1', amountCents: 0 }).success).toBe(false);
    expect(PledgeSchema.safeParse({ journalistId: 'j1', amountCents: 1.5 }).success).toBe(false);
  });

  it('exposes the six suggestion types', () => {
    expect(SUGGESTION_TYPES).toEqual([
      'correction', 'context', 'translation', 'clarity', 'headline', 'copyedit',
    ]);
    expect(CredibilityEntrySchema.safeParse({
      type: 'correction', acceptedAtMs: 1, authorKey: 'k1', authorStanding: 0.8,
    }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @mylife/mynews test -- models`
Expected: FAIL (cannot resolve `./models`)

- [ ] **Step 3: Implement models.ts**

```ts
// modules/mynews/src/models.ts
import { z } from 'zod';

export const SUGGESTION_TYPES = [
  'correction', 'context', 'translation', 'clarity', 'headline', 'copyedit',
] as const;
export const SuggestionTypeSchema = z.enum(SUGGESTION_TYPES);
export type SuggestionType = z.infer<typeof SuggestionTypeSchema>;

export const HttpsUrlSchema = z.string().url().startsWith('https://');

export const ArticleSchema = z.object({
  id: z.string().min(1),
  authorKey: z.string().min(1),
  newsroomId: z.string().min(1).optional(),
  kind: z.enum(['news', 'preprint']),
  status: z.enum(['draft', 'published', 'retracted']),
  currentRev: z.number().int().min(0),
  publishedAt: z.string().datetime().optional(),
});
export type Article = z.infer<typeof ArticleSchema>;

export const ChangelogEntrySchema = z.object({
  suggestionId: z.string().min(1),
  editorKey: z.string().min(1),
  type: SuggestionTypeSchema,
});

export const ArticleRevisionSchema = z.object({
  articleId: z.string().min(1),
  rev: z.number().int().min(1),
  headline: z.string().min(1),
  dek: z.string().optional(),
  bodyMd: z.string(),
  signature: z.string().min(1),
  signerPubkey: z.string().min(1),
  changelog: z.array(ChangelogEntrySchema),
  createdAt: z.string().datetime(),
});
export type ArticleRevision = z.infer<typeof ArticleRevisionSchema>;

export const DiffOpSchema = z.object({
  kind: z.enum(['replace', 'insert', 'delete']),
  anchorBefore: z.string().nullable(),
  anchorAfter: z.string().nullable(),
  baseBlocks: z.array(z.string()),
  newBlocks: z.array(z.string()),
});
export const StructuredDiffSchema = z.object({
  baseHash: z.string().min(1),
  ops: z.array(DiffOpSchema),
});

const CITATION_REQUIRED: ReadonlySet<SuggestionType> = new Set(['correction', 'context']);

export const EditSuggestionSchema = z
  .object({
    id: z.string().min(1),
    articleId: z.string().min(1),
    baseRev: z.number().int().min(1),
    editorKey: z.string().min(1),
    type: SuggestionTypeSchema,
    diff: StructuredDiffSchema,
    citations: z.array(HttpsUrlSchema).default([]),
    rationale: z.string().min(1),
    status: z.enum(['open', 'accepted', 'partial', 'rejected', 'stale']),
    createdAt: z.string().datetime(),
  })
  .refine((s) => !CITATION_REQUIRED.has(s.type) || s.citations.length > 0, {
    message: 'corrections and context suggestions require at least one citation',
    path: ['citations'],
  });
export type EditSuggestion = z.infer<typeof EditSuggestionSchema>;

export const CredibilityEntrySchema = z.object({
  type: SuggestionTypeSchema,
  acceptedAtMs: z.number().int().nonnegative(),
  authorKey: z.string().min(1),
  authorStanding: z.number().min(0).max(1),
  selfEdit: z.boolean().optional(),
});
export type CredibilityEntry = z.infer<typeof CredibilityEntrySchema>;

export const PledgeSchema = z.object({
  journalistId: z.string().min(1),
  amountCents: z.number().int().positive(),
});
export type Pledge = z.infer<typeof PledgeSchema>;
```

- [ ] **Step 4: Run, then commit**

Run: `pnpm --filter @mylife/mynews test -- models`
Expected: 5 tests PASS

```bash
git add modules/mynews/src/models.ts modules/mynews/src/models.test.ts
git commit -m "feat(mynews): zod models with citation-required corrections and https-only evidence"
```

### Task 7: Structured diff engine (`src/engines/diff.ts`)

Anchor-based block diff. Contract: `applyDiff(base, computeDiff(base, proposed)) === proposed` always; apply fails closed on hash mismatch or ambiguous anchors; rebase reports `clean | rebased | stale`.

**Files:**
- Create: `modules/mynews/src/engines/diff.ts`, `modules/mynews/src/engines/diff.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// modules/mynews/src/engines/diff.test.ts
import { describe, expect, it } from 'vitest';
import { applyDiff, computeDiff, hashText, rebaseDiff, splitBlocks } from './diff';

const BASE = [
  'The valley faces a hard season.',
  'County filings from March 2025 show a 40% drop in allocations.',
  'Growers south of Big Pine are hit hardest.',
].join('\n\n');

const PROPOSED = [
  'The valley faces a hard season.',
  'County filings from March 2026 show a 34% drop in allocations.',
  'Growers south of Big Pine are hit hardest.',
].join('\n\n');

describe('splitBlocks', () => {
  it('splits on blank lines and rejoins losslessly', () => {
    expect(splitBlocks(BASE)).toHaveLength(3);
    expect(splitBlocks(BASE).join('\n\n')).toBe(BASE);
  });
});

describe('computeDiff + applyDiff round trip', () => {
  it('round-trips a replacement', () => {
    const diff = computeDiff(BASE, PROPOSED);
    expect(diff.ops).toHaveLength(1);
    expect(diff.ops[0]?.kind).toBe('replace');
    const applied = applyDiff(BASE, diff);
    expect(applied).toEqual({ ok: true, text: PROPOSED });
  });

  it('round-trips insert at end and delete at start', () => {
    const insert = `${BASE}\n\nA new closing paragraph.`;
    expect(applyDiff(BASE, computeDiff(BASE, insert))).toEqual({ ok: true, text: insert });
    const blocks = splitBlocks(BASE);
    const del = blocks.slice(1).join('\n\n');
    expect(applyDiff(BASE, computeDiff(BASE, del))).toEqual({ ok: true, text: del });
  });

  it('round-trips randomized block edits (seeded)', () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let trial = 0; trial < 200; trial++) {
      const n = 1 + Math.floor(rnd() * 8);
      const base = Array.from({ length: n }, (_, i) => `block ${i} ${Math.floor(rnd() * 1000)}`);
      const proposed = base
        .filter(() => rnd() > 0.25)
        .flatMap((b) => (rnd() > 0.8 ? [b, `inserted ${Math.floor(rnd() * 1000)}`] : [b]))
        .map((b) => (rnd() > 0.85 ? `${b} edited` : b));
      const baseText = base.join('\n\n');
      const propText = proposed.join('\n\n');
      const applied = applyDiff(baseText, computeDiff(baseText, propText));
      expect(applied).toEqual({ ok: true, text: propText });
    }
  });
});

describe('fail-closed apply', () => {
  it('rejects a hash mismatch', () => {
    const diff = computeDiff(BASE, PROPOSED);
    const other = 'Entirely different document.';
    expect(applyDiff(other, diff)).toEqual({ ok: false, reason: 'base-mismatch' });
  });
});

describe('rebaseDiff', () => {
  it('is clean on identical base', () => {
    const diff = computeDiff(BASE, PROPOSED);
    expect(rebaseDiff(diff, BASE, BASE).status).toBe('clean');
  });

  it('rebases when untouched paragraphs change elsewhere', () => {
    const diff = computeDiff(BASE, PROPOSED);
    const newBase = BASE.replace('hit hardest.', 'hit hardest, officials say.');
    const res = rebaseDiff(diff, BASE, newBase);
    expect(res.status).toBe('rebased');
    if (res.status === 'rebased') {
      const applied = applyDiff(newBase, res.diff);
      expect(applied.ok).toBe(true);
      if (applied.ok) expect(applied.text).toContain('March 2026');
    }
  });

  it('is stale when the edited paragraph itself changed', () => {
    const newBase = BASE.replace('40% drop', '38% drop');
    const diff = computeDiff(BASE, PROPOSED);
    expect(rebaseDiff(diff, BASE, newBase).status).toBe('stale');
  });

  it('hashText is stable', () => {
    expect(hashText(BASE)).toBe(hashText(BASE));
    expect(hashText(BASE)).not.toBe(hashText(PROPOSED));
  });
});
```

- [ ] **Step 2: Run to verify FAIL** (`./diff` unresolved)

- [ ] **Step 3: Implement diff.ts** (LCS over blocks; ops carry context anchors; apply walks ops left-to-right against a work list; rebase re-locates each op's `baseBlocks` run in the new base and requires uniqueness)

```ts
// modules/mynews/src/engines/diff.ts
export interface DiffOp {
  kind: 'replace' | 'insert' | 'delete';
  anchorBefore: string | null;
  anchorAfter: string | null;
  baseBlocks: string[];
  newBlocks: string[];
}

export interface StructuredDiff {
  baseHash: string;
  ops: DiffOp[];
}

export type ApplyResult = { ok: true; text: string } | { ok: false; reason: 'base-mismatch' | 'anchor-missing' };
export type RebaseResult =
  | { status: 'clean' }
  | { status: 'rebased'; diff: StructuredDiff }
  | { status: 'stale' };

export function splitBlocks(text: string): string[] {
  return text.split('\n\n');
}

export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function lcsTable(a: string[], b: string[]): number[][] {
  const t: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      t[i]![j] = a[i] === b[j] ? t[i + 1]![j + 1]! + 1 : Math.max(t[i + 1]![j]!, t[i]![j + 1]!);
    }
  }
  return t;
}

export function computeDiff(base: string, proposed: string): StructuredDiff {
  const a = splitBlocks(base);
  const b = splitBlocks(proposed);
  const t = lcsTable(a, b);
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  let pendingBase: string[] = [];
  let pendingNew: string[] = [];

  const flush = (anchorAfterIdx: number) => {
    if (pendingBase.length === 0 && pendingNew.length === 0) return;
    const firstBaseIdx = anchorAfterIdx - pendingBase.length;
    ops.push({
      kind: pendingBase.length === 0 ? 'insert' : pendingNew.length === 0 ? 'delete' : 'replace',
      anchorBefore: firstBaseIdx > 0 ? a[firstBaseIdx - 1]! : null,
      anchorAfter: anchorAfterIdx < a.length ? a[anchorAfterIdx]! : null,
      baseBlocks: pendingBase,
      newBlocks: pendingNew,
    });
    pendingBase = [];
    pendingNew = [];
  };

  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush(i);
      i++;
      j++;
    } else if (j < b.length && (i === a.length || t[i]![j + 1]! >= t[i + 1]![j]!)) {
      pendingNew.push(b[j]!);
      j++;
    } else {
      pendingBase.push(a[i]!);
      i++;
    }
  }
  flush(a.length);
  return { baseHash: hashText(base), ops };
}

function findRun(haystack: string[], run: string[], from: number): number {
  if (run.length === 0) return -1;
  outer: for (let s = from; s <= haystack.length - run.length; s++) {
    for (let k = 0; k < run.length; k++) {
      if (haystack[s + k] !== run[k]) continue outer;
    }
    return s;
  }
  return -1;
}

export function applyDiff(base: string, diff: StructuredDiff): ApplyResult {
  if (hashText(base) !== diff.baseHash) return { ok: false, reason: 'base-mismatch' };
  const blocks = splitBlocks(base);
  const out: string[] = [];
  let cursor = 0;
  for (const op of diff.ops) {
    if (op.kind === 'insert') {
      const at = op.anchorAfter === null
        ? blocks.length
        : findRun(blocks, [op.anchorAfter], cursor);
      if (at < 0) return { ok: false, reason: 'anchor-missing' };
      out.push(...blocks.slice(cursor, at), ...op.newBlocks);
      cursor = at;
    } else {
      const at = findRun(blocks, op.baseBlocks, cursor);
      if (at < 0) return { ok: false, reason: 'anchor-missing' };
      out.push(...blocks.slice(cursor, at), ...op.newBlocks);
      cursor = at + op.baseBlocks.length;
    }
  }
  out.push(...blocks.slice(cursor));
  return { ok: true, text: out.join('\n\n') };
}

export function rebaseDiff(diff: StructuredDiff, oldBase: string, newBase: string): RebaseResult {
  if (hashText(newBase) === diff.baseHash) return { status: 'clean' };
  const newBlocks = splitBlocks(newBase);
  for (const op of diff.ops) {
    if (op.kind === 'insert') {
      if (op.anchorAfter !== null && findRun(newBlocks, [op.anchorAfter], 0) < 0) {
        return { status: 'stale' };
      }
      continue;
    }
    const first = findRun(newBlocks, op.baseBlocks, 0);
    if (first < 0) return { status: 'stale' };
    if (findRun(newBlocks, op.baseBlocks, first + 1) >= 0) return { status: 'stale' };
  }
  return { status: 'rebased', diff: { ...diff, baseHash: hashText(newBase) } };
}
```

- [ ] **Step 4: Run to verify PASS** (`pnpm --filter @mylife/mynews test -- diff`), then commit

```bash
git add modules/mynews/src/engines/diff.ts modules/mynews/src/engines/diff.test.ts
git commit -m "feat(mynews): anchor-based structured diff engine (compute/apply/rebase, fail-closed)"
```

### Task 8: Credibility engine (`src/engines/credibility.ts`)

**Files:**
- Create: `modules/mynews/src/engines/credibility.ts`, `modules/mynews/src/engines/credibility.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// modules/mynews/src/engines/credibility.test.ts
import { describe, expect, it } from 'vitest';
import type { CredibilityEntry } from '../models';
import {
  BASE_POINTS, computeScore, decayFactor, diversityMultiplier,
  levelFor, openSuggestionCap, standingMultiplier,
} from './credibility';

const DAY = 86_400_000;
const entry = (over: Partial<CredibilityEntry>): CredibilityEntry => ({
  type: 'correction', acceptedAtMs: 0, authorKey: 'a1', authorStanding: 1, ...over,
});

describe('multipliers', () => {
  it('diversity spans 0.3 to 1.5 and is monotonic', () => {
    expect(diversityMultiplier(0)).toBe(0.3);
    expect(diversityMultiplier(1)).toBeCloseTo(0.3, 5);
    expect(diversityMultiplier(11)).toBe(1.5);
    for (let d = 1; d < 15; d++) {
      expect(diversityMultiplier(d + 1)).toBeGreaterThanOrEqual(diversityMultiplier(d));
    }
  });
  it('standing maps 0..1 to 0.5..1.2', () => {
    expect(standingMultiplier(0)).toBe(0.5);
    expect(standingMultiplier(1)).toBeCloseTo(1.2, 5);
  });
  it('decay halves at 365 days and never goes negative', () => {
    expect(decayFactor(0)).toBe(1);
    expect(decayFactor(365 * DAY)).toBeCloseTo(0.5, 5);
    expect(decayFactor(3650 * DAY)).toBeGreaterThan(0);
  });
});

describe('computeScore', () => {
  it('weights corrections above copyedits', () => {
    const now = 0;
    const c = computeScore([entry({ type: 'correction' })], now);
    const e = computeScore([entry({ type: 'copyedit' })], now);
    expect(BASE_POINTS.correction).toBe(10);
    expect(BASE_POINTS.copyedit).toBe(1);
    expect(c).toBeGreaterThan(e * 5);
  });

  it('ten authors beat one author at equal volume', () => {
    const now = 0;
    const one = Array.from({ length: 10 }, () => entry({ authorKey: 'same' }));
    const ten = Array.from({ length: 10 }, (_, i) => entry({ authorKey: `a${i}` }));
    expect(computeScore(ten, now)).toBeGreaterThan(computeScore(one, now) * 2);
  });

  it('self edits earn zero', () => {
    expect(computeScore([entry({ selfEdit: true })], 0)).toBe(0);
  });
});

describe('levels', () => {
  const base = {
    weightedScore: 0, acceptedTotal: 0, acceptedCopyedits: 0, distinctAuthors: 0,
    acceptanceRate: 1, decidedSampleSize: 0, sanctionsInLast90d: 0,
    topicScore: 0, endorsements: 0, identityVerified: false,
  };
  it('walks the ladder', () => {
    expect(levelFor(base)).toBe('reader');
    expect(levelFor({ ...base, acceptedTotal: 1 })).toBe('contributor');
    expect(levelFor({ ...base, acceptedTotal: 25, acceptedCopyedits: 25, acceptanceRate: 0.6, distinctAuthors: 5 })).toBe('copyeditor');
    expect(levelFor({ ...base, acceptedTotal: 40, weightedScore: 150, distinctAuthors: 10 })).toBe('trusted_editor');
    expect(levelFor({
      ...base, acceptedTotal: 80, weightedScore: 600, distinctAuthors: 15,
      topicScore: 500, endorsements: 3, identityVerified: true,
    })).toBe('section_editor');
  });
  it('sanctions block trusted_editor', () => {
    expect(levelFor({ ...base, weightedScore: 200, distinctAuthors: 12, acceptedTotal: 30, sanctionsInLast90d: 1 })).toBe('contributor');
  });
  it('unverified identity blocks section_editor', () => {
    expect(levelFor({
      ...base, acceptedTotal: 80, weightedScore: 600, distinctAuthors: 15,
      topicScore: 500, endorsements: 3, identityVerified: false,
    })).toBe('trusted_editor');
  });
});

describe('openSuggestionCap', () => {
  const base = {
    weightedScore: 0, acceptedTotal: 0, acceptedCopyedits: 0, distinctAuthors: 0,
    acceptanceRate: 1, decidedSampleSize: 0, sanctionsInLast90d: 0,
    topicScore: 0, endorsements: 0, identityVerified: false,
  };
  it('throttles low acceptance at sample size 30+', () => {
    expect(openSuggestionCap({ ...base, acceptanceRate: 0.1, decidedSampleSize: 30 })).toBe(3);
    expect(openSuggestionCap({ ...base, acceptanceRate: 0.1, decidedSampleSize: 10 })).toBe(5);
  });
  it('scales with level', () => {
    expect(openSuggestionCap(base)).toBe(5);
    expect(openSuggestionCap({ ...base, acceptedTotal: 1 })).toBe(8);
    expect(openSuggestionCap({ ...base, acceptedTotal: 40, weightedScore: 150, distinctAuthors: 10 })).toBe(20);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

- [ ] **Step 3: Implement credibility.ts**

```ts
// modules/mynews/src/engines/credibility.ts
import type { CredibilityEntry, SuggestionType } from '../models';

export const BASE_POINTS: Record<SuggestionType, number> = {
  correction: 10, context: 7, translation: 7, clarity: 4, headline: 3, copyedit: 1,
};

const DAY_MS = 86_400_000;
const HALF_LIFE_DAYS = 365;

export function diversityMultiplier(distinctAuthors: number): number {
  if (distinctAuthors <= 1) return 0.3;
  return Math.min(1.5, 0.3 + 0.12 * (distinctAuthors - 1));
}

export function standingMultiplier(standing: number): number {
  const s = Math.min(1, Math.max(0, standing));
  return 0.5 + 0.7 * s;
}

export function decayFactor(ageMs: number): number {
  if (ageMs <= 0) return 1;
  return Math.pow(0.5, ageMs / (HALF_LIFE_DAYS * DAY_MS));
}

export function computeScore(entries: CredibilityEntry[], nowMs: number): number {
  const counted = entries.filter((e) => !e.selfEdit);
  const distinct = new Set(counted.map((e) => e.authorKey)).size;
  const diversity = diversityMultiplier(distinct);
  let score = 0;
  for (const e of counted) {
    score +=
      BASE_POINTS[e.type] *
      standingMultiplier(e.authorStanding) *
      decayFactor(nowMs - e.acceptedAtMs);
  }
  return score * diversity;
}

export type EditorLevel = 'reader' | 'contributor' | 'copyeditor' | 'trusted_editor' | 'section_editor';

export interface EditorStats {
  weightedScore: number;
  acceptedTotal: number;
  acceptedCopyedits: number;
  distinctAuthors: number;
  acceptanceRate: number;
  decidedSampleSize: number;
  sanctionsInLast90d: number;
  topicScore: number;
  endorsements: number;
  identityVerified: boolean;
}

export function levelFor(s: EditorStats): EditorLevel {
  const trusted =
    s.weightedScore >= 150 && s.distinctAuthors >= 10 && s.sanctionsInLast90d === 0;
  if (trusted && s.topicScore >= 500 && s.endorsements >= 3 && s.identityVerified) {
    return 'section_editor';
  }
  if (trusted) return 'trusted_editor';
  if (s.acceptedCopyedits >= 25 && s.acceptanceRate >= 0.6 && s.distinctAuthors >= 5) {
    return 'copyeditor';
  }
  if (s.acceptedTotal >= 1) return 'contributor';
  return 'reader';
}

const LEVEL_CAPS: Record<EditorLevel, number> = {
  reader: 5, contributor: 8, copyeditor: 12, trusted_editor: 20, section_editor: 30,
};

export function openSuggestionCap(s: EditorStats): number {
  if (s.decidedSampleSize >= 30 && s.acceptanceRate < 0.2) return 3;
  return LEVEL_CAPS[levelFor(s)];
}
```

- [ ] **Step 4: Run to verify PASS, commit**

```bash
git add modules/mynews/src/engines/credibility.ts modules/mynews/src/engines/credibility.test.ts
git commit -m "feat(mynews): credibility engine (diversity-weighted points, ladder, throttles)"
```

### Task 9: Fee engine (`src/engines/fees.ts`)

**Files:**
- Create: `modules/mynews/src/engines/fees.ts`, `modules/mynews/src/engines/fees.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// modules/mynews/src/engines/fees.test.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_FEE_CONFIG, payoutEligible, splitCharge } from './fees';

describe('splitCharge', () => {
  it('splits the documented $18 example', () => {
    const split = splitCharge([
      { journalistId: 'a', amountCents: 500 },
      { journalistId: 'b', amountCents: 300 },
      { journalistId: 'c', amountCents: 1000 },
    ]);
    expect(split.grossCents).toBe(1800);
    expect(split.processingFeeCents).toBe(82);
    expect(split.platformFeeCents).toBe(36);
    const net = split.journalistNetCents.reduce((s, j) => s + j.netCents, 0);
    expect(net).toBe(1800 - 82 - 36);
  });

  it('conserves every cent across 500 randomized charges (seeded)', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    for (let t = 0; t < 500; t++) {
      const n = 1 + Math.floor(rnd() * 6);
      const pledges = Array.from({ length: n }, (_, i) => ({
        journalistId: `j${i}`,
        amountCents: 100 + Math.floor(rnd() * 5000),
      }));
      const split = splitCharge(pledges);
      const net = split.journalistNetCents.reduce((s, j) => s + j.netCents, 0);
      expect(net + split.platformFeeCents + split.processingFeeCents).toBe(split.grossCents);
      for (const j of split.journalistNetCents) expect(j.netCents).toBeGreaterThanOrEqual(0);
    }
  });

  it('allocates proportionally (larger pledge, larger net)', () => {
    const split = splitCharge([
      { journalistId: 'small', amountCents: 200 },
      { journalistId: 'big', amountCents: 2000 },
    ]);
    const small = split.journalistNetCents.find((j) => j.journalistId === 'small')!;
    const big = split.journalistNetCents.find((j) => j.journalistId === 'big')!;
    expect(big.netCents).toBeGreaterThan(small.netCents * 8);
  });

  it('rejects empty and non-positive inputs', () => {
    expect(() => splitCharge([])).toThrow();
    expect(() => splitCharge([{ journalistId: 'a', amountCents: 0 }])).toThrow();
  });

  it('rejects charges too small to cover fees', () => {
    expect(() => splitCharge([{ journalistId: 'a', amountCents: 30 }])).toThrow();
  });
});

describe('payoutEligible', () => {
  it('applies the $10 threshold', () => {
    expect(payoutEligible(999)).toBe(false);
    expect(payoutEligible(1000)).toBe(true);
    expect(DEFAULT_FEE_CONFIG.payoutMinCents).toBe(1000);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

- [ ] **Step 3: Implement fees.ts** (largest-remainder allocation so cents always conserve)

```ts
// modules/mynews/src/engines/fees.ts
import type { Pledge } from '../models';

export interface FeeConfig {
  platformFeeBps: number;
  processingPctBps: number;
  processingFixedCents: number;
  payoutMinCents: number;
}

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  platformFeeBps: 200,
  processingPctBps: 290,
  processingFixedCents: 30,
  payoutMinCents: 1000,
};

export interface ChargeSplit {
  grossCents: number;
  processingFeeCents: number;
  platformFeeCents: number;
  journalistNetCents: Array<{ journalistId: string; netCents: number }>;
}

export function splitCharge(pledges: Pledge[], cfg: FeeConfig = DEFAULT_FEE_CONFIG): ChargeSplit {
  if (pledges.length === 0) throw new Error('splitCharge: no pledges');
  for (const p of pledges) {
    if (!Number.isInteger(p.amountCents) || p.amountCents <= 0) {
      throw new Error(`splitCharge: invalid pledge amount ${p.amountCents}`);
    }
  }
  const grossCents = pledges.reduce((s, p) => s + p.amountCents, 0);
  const processingFeeCents =
    Math.round((grossCents * cfg.processingPctBps) / 10_000) + cfg.processingFixedCents;
  const platformFeeCents = Math.round((grossCents * cfg.platformFeeBps) / 10_000);
  const pool = grossCents - processingFeeCents - platformFeeCents;
  if (pool <= 0) throw new Error('splitCharge: charge too small to cover fees');

  const exact = pledges.map((p) => (pool * p.amountCents) / grossCents);
  const floors = exact.map(Math.floor);
  let remainder = pool - floors.reduce((s, f) => s + f, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((x, y) => y.frac - x.frac || x.i - y.i);
  const nets = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    nets[i] = nets[i]! + 1;
    remainder -= 1;
  }
  return {
    grossCents,
    processingFeeCents,
    platformFeeCents,
    journalistNetCents: pledges.map((p, i) => ({ journalistId: p.journalistId, netCents: nets[i]! })),
  };
}

export function payoutEligible(balanceCents: number, cfg: FeeConfig = DEFAULT_FEE_CONFIG): boolean {
  return balanceCents >= cfg.payoutMinCents;
}
```

- [ ] **Step 4: Run to verify PASS, then update the barrel and commit**

Replace `modules/mynews/src/index.ts` with:

```ts
// modules/mynews/src/index.ts
export const MYNEWS_PACKAGE = '@mylife/mynews';
export { MYNEWS_MODULE } from './definition';
export * from './models';
export { ALL_TABLES, CREATE_INDEXES, MYNEWS_TABLE_NAMES } from './db/schema';
export * from './engines/diff';
export * from './engines/credibility';
export * from './engines/fees';
```

Run: `pnpm --filter @mylife/mynews test && pnpm --filter @mylife/mynews typecheck`
Expected: all suites PASS, typecheck clean

```bash
git add modules/mynews/src
git commit -m "feat(mynews): fee-split engine (2% platform, largest-remainder conservation) + barrel"
```

### Task 10: Canonical Supabase bootstrap SQL (static in P0)

**Files:**
- Create: `supabase/migrations/20260703000001_mynews_bootstrap.sql`

No live Supabase project exists yet (founder-ops). This migration is authored, convention-checked, and committed; `supabase db push` happens at founder-ops time. Conventions from BestChef: lowercase SQL, `create table if not exists public.nw_*`, RLS enabled on every table, public-read/owner-write, service-role tables with RLS on and NO policies, `https://` CHECKs on public URL columns.

- [ ] **Step 1: Author the migration** with these 15 tables (columns per the 2026-07-01 plan Section 11): `nw_profiles`, `nw_journalists`, `nw_journalist_verifications`, `nw_articles`, `nw_article_revisions`, `nw_article_meta`, `nw_edit_suggestions`, `nw_suggestion_events`, `nw_credibility_ledger`, `nw_follows`, `nw_supports`, `nw_support_charges`, `nw_transfer_ledger`, `nw_fee_config`, `nw_job_config`, plus `nw_reports` and `nw_terms_acceptance`. Policy sketch per class:
  - Public read: `nw_profiles`, `nw_journalists` (status cols only), `nw_articles` (status='published'), `nw_article_revisions` (parent published), `nw_edit_suggestions`, `nw_suggestion_events`, `nw_credibility_ledger`.
  - Owner write: profiles/articles/revisions/suggestions by `auth.uid() = user_id` linkage.
  - Money tables: `nw_supports` supporter-and-journalist readable only; `nw_support_charges`/`nw_transfer_ledger`/`nw_fee_config`/`nw_job_config` service-role only (RLS on, zero policies).
  - `nw_fee_config` seeded: `insert into public.nw_fee_config (key, value) values ('platform_fee_bps','200'), ('processing_pct_bps','290'), ('processing_fixed_cents','30'), ('payout_min_cents','1000') on conflict do nothing;`

- [ ] **Step 2: Static verification**

Run: `grep -c 'enable row level security' supabase/migrations/20260703000001_mynews_bootstrap.sql`
Expected: one per table (17). Also `grep -c "https://" ...` covers every public URL column CHECK.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260703000001_mynews_bootstrap.sql
git commit -m "feat(mynews): canonical nw_ bootstrap migration (RLS, service-role money tables)"
```

### Task 11: `apps/mynews` Expo shell

**Files:**
- Create: `apps/mynews/package.json`, `app.json`, `eas.json`, `metro.config.js`, `tsconfig.json`, `vitest.config.ts`, `scripts/check-build-env.mjs`, `app/_layout.tsx`, `app/index.tsx`, `app/(root)/_layout.tsx`, `app/(root)/(tabs)/_layout.tsx`, `app/(root)/(tabs)/{index,discover,desk,support,me}.tsx`, `app/(root)/theme/tokens.ts`, `app/__tests__/shell.test.ts`, `CLAUDE.md`

Copy `apps/manhattan` for `eas.json`, `metro.config.js`, `tsconfig.json`, `scripts/check-build-env.mjs` (adjust env prefix to `EXPO_PUBLIC_MYNEWS_`). Key files verbatim:

- [ ] **Step 1: package.json**

```json
{
  "name": "@mylife/mynews-app",
  "version": "1.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "eas-build-pre-install": "node scripts/check-build-env.mjs",
    "build": "expo export --platform android --platform ios",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests",
    "android": "expo run:android",
    "ios": "expo run:ios"
  },
  "dependencies": {
    "@mylife/auth": "workspace:*",
    "@mylife/billing-config": "workspace:*",
    "@mylife/db": "workspace:*",
    "@mylife/entitlements": "workspace:*",
    "@mylife/module-registry": "workspace:*",
    "@mylife/mynews": "workspace:*",
    "@mylife/subscription": "workspace:*",
    "@mylife/ui": "workspace:*",
    "expo": "~54.0.33",
    "expo-constants": "~18.0.9",
    "expo-linking": "~8.0.8",
    "expo-router": "~6.0.23",
    "expo-secure-store": "~15.0.7",
    "expo-sqlite": "~16.0.10",
    "expo-status-bar": "~3.0.8",
    "lucide-react-native": "^0.469.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "react-native": "~0.81.5",
    "react-native-safe-area-context": "~5.6.0",
    "react-native-screens": "~4.16.0",
    "react-native-svg": "16.0.8"
  },
  "devDependencies": {
    "@mylife/typescript-config": "workspace:*",
    "@types/react": "^19.1.11",
    "typescript": "^5.7.0",
    "vitest": "^3.2.6"
  }
}
```

(Version pins for expo-constants/linking/status-bar/safe-area/screens/svg: read the exact pins from `apps/manhattan/package.json` at build time and match them; the numbers above are from the current lockfile family. `react-native-purchases` joins in the Phase 4 payments task, not the shell.)

- [ ] **Step 2: app.json**: copy `apps/manhattan/app.json` then change: name `MyNews`, slug `mynews`, scheme `mynews`, bundleIdentifier + android package `com.mylife.mynews`, keep dark UI + `#131318` splash + privacy manifests + `allowBackup false` + INTERNET permission only (no exact-alarm, no calendar).

- [ ] **Step 3: theme tokens** (`app/(root)/theme/tokens.ts`)

```ts
export const tokens = {
  bg: '#131318',
  surface: '#1B1B20',
  card: '#1F1F25',
  elevated: '#2A292F',
  text: '#E4E1E9',
  textSecondary: '#B8B0BC',
  textTertiary: '#8E8794',
  accent: '#8BCFF0',
  accentDim: 'rgba(139, 207, 240, 0.14)',
  border: 'rgba(255,255,255,0.07)',
  success: '#30D158',
  danger: '#FFB4AB',
} as const;
```

- [ ] **Step 4: root layout + redirect + tabs**

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
```

```tsx
// app/index.tsx
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(root)/(tabs)" />;
}
```

```tsx
// app/(root)/_layout.tsx
import { Stack } from 'expo-router';
import { tokens } from './theme/tokens';

export default function RootGroupLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.bg },
      }}
    />
  );
}
```

```tsx
// app/(root)/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Compass, Heart, Home, PenLine, User } from 'lucide-react-native';
import { tokens } from '../theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#101015', borderTopColor: tokens.border },
        tabBarActiveTintColor: tokens.accent,
        tabBarInactiveTintColor: tokens.textTertiary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: ({ color, size }) => <Compass color={color} size={size} /> }} />
      <Tabs.Screen name="desk" options={{ title: 'Desk', tabBarIcon: ({ color, size }) => <PenLine color={color} size={size} /> }} />
      <Tabs.Screen name="support" options={{ title: 'Support', tabBarIcon: ({ color, size }) => <Heart color={color} size={size} /> }} />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
```

- [ ] **Step 5: the five tab screens**: one shared honest empty-state component, five thin screens. Verbatim template (repeat with the listed title/body per screen):

```tsx
// app/(root)/components/EmptyState.tsx
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.bg, padding: 32 },
  title: { color: tokens.text, fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  body: { color: tokens.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
```

```tsx
// app/(root)/(tabs)/index.tsx  (repeat this shape for discover/desk/support/me)
import { EmptyState } from '../components/EmptyState';

export default function TodayScreen() {
  return (
    <EmptyState
      title="No articles yet"
      body="Publishing and the reader arrive with Phase 1. Nothing here is simulated."
    />
  );
}
```

Copy per screen: `discover.tsx` ("Discover is coming with Phase 1" / "Topics, journalists, and labeled event clusters will appear here."), `desk.tsx` ("The editing desk arrives in Phase 2" / "Suggest edits, review queues, and credibility live here."), `support.tsx` ("Support arrives in Phase 4" / "Direct journalist support with the 2% fee printed on every sheet."), `me.tsx` ("Your profile" / "Keys, credibility, and settings arrive as the phases land.").

- [ ] **Step 6: verify + commit**

Run: `pnpm install && pnpm --filter @mylife/mynews-app typecheck && pnpm --filter @mylife/mynews-app test`
Expected: typecheck clean, vitest passes (with `--passWithNoTests` or the shell smoke test)

```bash
git add apps/mynews pnpm-lock.yaml
git commit -m "feat(mynews): Expo app shell (5 tabs, honest empty states, com.mylife.mynews)"
```

### Task 12: `apps/mynews-web` Next.js 15 shell

**Files:**
- Create: `apps/mynews-web/package.json`, `next.config.ts`, `tsconfig.json`, `app/layout.tsx`, `app/page.tsx`, `app/a/[slug]/page.tsx`, `app/j/[handle]/page.tsx`, `app/globals.css`, `CLAUDE.md`

Notes: route `/@handle` is not a literal Next segment; ship `/j/[handle]` now and add a `/@:handle -> /j/:handle` rewrite at launch. Do NOT import `@mylife/ui` (react-native-web barrel hazard documented in memory); this app is plain React + CSS.

- [ ] **Step 1: package.json**

```json
{
  "name": "mynews-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3010",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "@mylife/mynews": "workspace:*",
    "next": "^15.3.0",
    "react": "19.1.0",
    "react-dom": "19.1.0"
  },
  "devDependencies": {
    "@mylife/typescript-config": "workspace:*",
    "@types/node": "^22.0.0",
    "@types/react": "^19.1.11",
    "typescript": "^5.7.0",
    "vitest": "^3.2.6"
  }
}
```

(Match the `next` pin to `apps/web/package.json` at build time.)

- [ ] **Step 2: next.config.ts**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mylife/mynews'],
};

export default nextConfig;
```

- [ ] **Step 3: layout + routes** (server components, honest empty states, `notFound()` until the canonical record exists)

```tsx
// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MyNews: open journalism',
  description: 'Journalists publish. Volunteers make it better. Reading is free, with zero ads.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// app/page.tsx
export default function Home() {
  return (
    <main className="shell">
      <h1>MyNews</h1>
      <p>Open journalism: publish under a portable byline, improve articles together, support journalists directly. The platform keeps 2% and shows the math.</p>
      <p className="muted">The reader launches with Phase 1. No demo content is shown as live.</p>
    </main>
  );
}
```

```tsx
// app/a/[slug]/page.tsx
import { notFound } from 'next/navigation';

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  await params;
  notFound();
}
```

```tsx
// app/j/[handle]/page.tsx
import { notFound } from 'next/navigation';

export default async function JournalistPage({ params }: { params: Promise<{ handle: string }> }) {
  await params;
  notFound();
}
```

`app/globals.css`: Obsidian Noir base (`background #0E0E13`, text `#E4E1E9`, accent `#8BCFF0`, `.shell { max-width: 720px; margin: 0 auto; padding: 64px 24px; }`, `.muted { color: #8E8794; }`).

- [ ] **Step 4: verify + commit**

Run: `pnpm install && pnpm --filter mynews-web typecheck && pnpm --filter mynews-web build`
Expected: typecheck clean, build exits 0

```bash
git add apps/mynews-web pnpm-lock.yaml
git commit -m "feat(mynews): Next.js 15 web shell (article + journalist route skeletons)"
```

### Task 13: `check:mynews-parity` gate

**Files:**
- Create: `scripts/check-mynews-parity.mjs` (model: `scripts/check-meerkat-parity.mjs`, same `ensureFile`/`ensureContains` helpers verbatim)
- Modify: root `package.json` scripts

- [ ] **Step 1: Write the script**: after copying the helper block from check-meerkat-parity.mjs, the assertion body:

```js
out('Checking MyNews standalone app artifacts...\n');

const modulePkg = ensureFile('modules/mynews/package.json');
ensureContains('modules/mynews/package.json', modulePkg, '"@mylife/mynews"', 'is the module package');
const definition = ensureFile('modules/mynews/src/definition.ts');
ensureContains('modules/mynews/src/definition.ts', definition, "tablePrefix: 'nw_'", 'declares the nw_ prefix');
ensureContains('modules/mynews/src/definition.ts', definition, "shareable: false", 'keeps P0 sync private');
ensureFile('modules/mynews/src/engines/diff.ts');
ensureFile('modules/mynews/src/engines/credibility.ts');
ensureFile('modules/mynews/src/engines/fees.ts');

const registry = ensureFile('packages/module-registry/src/constants.ts');
ensureContains('packages/module-registry/src/constants.ts', registry, "mynews:", 'registers metadata');
const releases = ensureFile('packages/module-registry/src/release-states.ts');
ensureContains('packages/module-registry/src/release-states.ts', releases, "'mynews'", 'has a release state');
const billing = ensureFile('packages/billing-config/src/index.ts');
ensureContains('packages/billing-config/src/index.ts', billing, 'mylife_mynews_unlock', 'sells the unlock');

const appPkg = ensureFile('apps/mynews/package.json');
ensureContains('apps/mynews/package.json', appPkg, '"@mylife/mynews"', 'app consumes the module');
ensureFile('apps/mynews/app.json');
ensureFile('apps/mynews/app/(root)/(tabs)/_layout.tsx');
const webPkg = ensureFile('apps/mynews-web/package.json');
ensureContains('apps/mynews-web/package.json', webPkg, '"@mylife/mynews"', 'web consumes the module');
ensureFile('apps/mynews-web/app/a/[slug]/page.tsx');
ensureFile('supabase/migrations/20260703000001_mynews_bootstrap.sql');

if (failures > 0) {
  err(`\n${failures} MyNews parity failure(s).`);
  process.exit(1);
}
out('\nMyNews parity OK.');
```

- [ ] **Step 2: Wire into root package.json**

Add after the `check:meerkat-parity` line:

```json
    "check:mynews-parity": "bash scripts/perf-audit/run-js.sh scripts/check-mynews-parity.mjs",
```

And in `check:parity`, append `&& pnpm check:mynews-parity` before the `check:module-layouts` link (order after meerkat).

- [ ] **Step 3: Verify + commit**

Run: `pnpm check:mynews-parity && pnpm check:parity`
Expected: both exit 0

```bash
git add scripts/check-mynews-parity.mjs package.json
git commit -m "feat(mynews): dedicated parity gate wired into check:parity"
```

### Task 14 (GATED): widen `ChannelPostType` with `article` and `preprint`

**GATE: do not execute while `feature/meerkat-launch-finish` is unmerged.** All four edit sites are dirty on that branch. Execute this task as its own commit immediately after that branch lands on main, rebasing this branch first.

**Files:**
- Modify: `apps/meerkat-web/src/lib/meerkat-data.ts` (~line 461 type decl; ~lines 1080-1088 `postTypeForRoot` fallback)
- Modify: `apps/meerkat/app/(root)/data/community-core.ts` (~line 74 type decl; ~lines 1454-1462 `postTypeForRoot` fallback)
- Verify: `apps/meerkat-web/src/lib/__tests__/post-schema-v2-parity.test.ts` still passes (it guards the two decls staying in sync)

- [ ] **Step 1: Both type decls become**

```ts
export type ChannelPostType = 'discussion' | 'task' | 'announcement' | 'decision' | 'article' | 'preprint';
```

- [ ] **Step 2: Both `postTypeForRoot` fallbacks accept the new values** (add `|| value === 'article' || value === 'preprint'` to the recognized-value condition; unknown values still fall back to `'discussion'`)

- [ ] **Step 3: Verify**

Run: `pnpm --filter @mylife/meerkat-web test && pnpm --filter @mylife/meerkat-app test && pnpm --filter @mylife/sync test`
Expected: PASS (no sync-package or DDL change needed; `post_type` is `TEXT NOT NULL` with no CHECK, and `packages/sync/src/protocol/publication.ts`'s `'discussion'` is an unrelated `PublicCategory`)

- [ ] **Step 4: Commit**

```bash
git add apps/meerkat-web/src/lib/meerkat-data.ts "apps/meerkat/app/(root)/data/community-core.ts"
git commit -m "feat(mynews): widen ChannelPostType with article/preprint for the news substrate"
```

### Task 15: Gates + close-out

- [ ] Run `pnpm gate:function:changed` from the worktree root; fix findings.
- [ ] Run `pnpm --filter @mylife/module-registry test`, `--filter @mylife/billing-config test`, `--filter @mylife/mynews test`, plus `typecheck` on all touched packages and both new apps.
- [ ] Run `pnpm check:parity` (now includes `check:mynews-parity`) and `pnpm check:generated-artifacts`.
- [ ] Move this plan file `queue/ -> active/` when execution starts and `active/ -> done/` when Tasks 1-13 + 15 are green (Task 14 tracked as a follow-up row if still gated).
- [ ] Update `memory.md` (Project State bullet + Sessions row), write the session log, capture to Open Brain (`"personal, mylife"`).

## Status Delta (2026-07-03, execution session)

Tasks 1-13 and 15 EXECUTED and green on `feature/mynews-p0-scaffold` (worktree off main `4ae6d19e`). Task 14 remains GATED on the `feature/meerkat-launch-finish` merge as planned. **Task 14 UNGATED and EXECUTED 2026-07-04** (`f98a4b0d`, after the main merge landing `edd6b2e3` + main merged back into this branch in `515f8794`): both `ChannelPostType` decls widened with `'article' | 'preprint'` and both `postTypeForRoot` fallbacks accept them; verified via meerkat-web typecheck + 468 tests (incl. `post-schema-v2-parity`), meerkat-app typecheck + 699 tests, sync 1562 tests, plus the staged function gate on commit. Plan 34 is now fully executed. Deviations from the written plan, all verified:

1. **Diff engine apply is positional, not anchor-searched.** The planned anchor-search apply misplaces inserts beside duplicate blocks (base `A,X,B,X,C` + insert after the second X lands after the first). Since `baseHash` pins the exact base, `DiffOp` gained `baseIndex` and `applyDiff` applies positionally with a defense-in-depth op-content check; anchors are used by `rebaseDiff` only. A dedicated duplicate-block regression test covers this.
2. **billing-config had no test harness.** Added `"test": "vitest run"`, vitest devDep, and `vitest.config.ts` (repo-standard shape) so Task 2's test could run.
3. **Two consumer maps enumerate all ModuleIds and needed the 41st entry:** `packages/ui/src/tokens/colors.ts` (`mynews: '#8BCFF0'`) and `apps/web/lib/module-icons.ts` (`mynews: Newspaper`). Found by the pre-commit consumer typecheck.
4. **Two count-pinning tests updated:** `release-states.test.ts` HIDDEN length 22 -> 23; `apps/web/test/parity/standalone-passthrough-matrix.test.ts` `hubOnlyModules` gained `'mynews'` (manhattan precedent for in-repo standalone-first modules).
5. **Shell test suites are real, not `--passWithNoTests`:** the function gate invokes vitest directly, so `apps/mynews` tests the `check-build-env` guard (4 tests) and `apps/mynews-web` has shell invariants (3 tests incl. the no-`@mylife/ui` hazard rule).
6. **`uuid` dropped from module deps** (unused in P0, YAGNI).

Verification at close: module-registry 90, billing-config 2, @mylife/mynews 40, mynews-app 4, mynews-web 3 tests green; typechecks green incl. hub mobile + web consumers; `mynews-web` production build green; `check:mynews-parity` + full `check:parity` + `gate:function:changed` + `check:generated-artifacts` all exit 0. Founder-ops next: Supabase project + `db push`, EAS init, RevenueCat/Stripe products, domain.

## Self-Review (writing-plans checklist)

- **Spec coverage:** Registry/billing (plan Section 2.1) → Tasks 1-2; module core + engines (Sections 4, 5, 8, 10.1) → Tasks 3-9; canonical SQL (Section 11) → Task 10; shells (Section 10.1, 12) → Tasks 11-12; parity (Section 2.1) → Task 13; substrate widening (Section 2.2) → Task 14 gated. Newsrooms, verification, payments execution, moderation pipeline are Phases 1-5, not P0.
- **Placeholder scan:** the two "match pins at build time" notes (Tasks 11-12) are deliberate lockfile-accuracy instructions pointing at exact files, not TBDs. No other deferrals.
- **Type consistency:** `Pledge`/`CredibilityEntry`/`SuggestionType` defined once in `models.ts` and imported by both engines; `StructuredDiff` shape in `models.ts` (Zod) matches `engines/diff.ts` (TS) field-for-field.


