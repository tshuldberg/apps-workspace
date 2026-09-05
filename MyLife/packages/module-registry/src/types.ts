import { z } from 'zod';
import type { CrossModuleInterface } from './cross-module-types';

/** All known module identifiers in the MyLife suite. */
export type ModuleId =
  | 'books'
  | 'budget'
  | 'car'
  | 'classes'
  | 'closet'
  | 'cycle'
  | 'create'
  | 'dining'
  | 'fast'
  | 'flash'
  | 'forums'
  | 'friends'
  | 'garden'
  | 'habits'
  | 'health'
  | 'homes'
  | 'journal'
  | 'mail'
  | 'manhattan'
  | 'market'
  | 'meds'
  | 'mood'
  | 'mynews'
  | 'notes'
  | 'nutrition'
  | 'payments'
  | 'pets'
  | 'presence'
  | 'recipes'
  | 'rsvp'
  | 'shop'
  | 'sleep'
  | 'sports'
  | 'stars'
  | 'subs'
  | 'surf'
  | 'trails'
  | 'travel'
  | 'voice'
  | 'words'
  | 'workouts';

/** Zod schema for runtime validation of ModuleId values. */
export const ModuleIdSchema = z.enum([
  'books',
  'budget',
  'car',
  'classes',
  'closet',
  'cycle',
  'create',
  'dining',
  'fast',
  'flash',
  'forums',
  'friends',
  'garden',
  'habits',
  'health',
  'homes',
  'journal',
  'mail',
  'manhattan',
  'market',
  'meds',
  'mood',
  'mynews',
  'notes',
  'nutrition',
  'payments',
  'pets',
  'presence',
  'recipes',
  'rsvp',
  'shop',
  'sleep',
  'sports',
  'stars',
  'subs',
  'surf',
  'trails',
  'travel',
  'voice',
  'words',
  'workouts',
]);

/** A tab displayed in the module's bottom navigation. */
export interface ModuleTab {
  /** Unique key for the tab within this module. */
  key: string;
  /** Display label shown in the tab bar. */
  label: string;
  /** Icon name (from the icon library used by the host app). */
  icon: string;
}

/** A navigable screen within the module (not a tab). */
export interface ModuleScreen {
  /** Route name used by the navigation system. */
  name: string;
  /** Display title for the header bar. */
  title: string;
}

/** A single database migration step for a module's local schema. */
export interface Migration {
  /** Sequential version number (1-indexed). */
  version: number;
  /** Human-readable description of what this migration does. */
  description: string;
  /** SQL statements to apply this migration. */
  up: string[];
  /** SQL statements to revert this migration. */
  down: string[];
}

/** Pricing tier — determines whether the module is available without purchase. */
export type ModuleTier = 'free' | 'premium';

/** Storage backend used by the module. */
export type StorageType = 'sqlite' | 'supabase' | 'drizzle';

// ---------------------------------------------------------------------------
// Sync Policy Types (Mesh Sync Architecture Section 9)
// ---------------------------------------------------------------------------

export type SyncScope = 'device_local' | 'personal_replica' | 'shared_workspace' | 'published_blob';
export type ConflictStrategy = 'lww' | 'or_set' | 'counter' | 'document_crdt' | 'manual_review';

export interface ModuleEntitySyncRule {
  tableName: string;
  defaultScope: SyncScope;
  maxScope?: SyncScope;
  conflictStrategy: ConflictStrategy;
  stripColumns?: string[];
  requiresManualResolver?: boolean;
  resolverComponent?: string;
}

export interface ModuleSyncPolicy {
  defaultScope: SyncScope;
  shareable: boolean;
  entityRules: ModuleEntitySyncRule[];
  isSensitive?: boolean;
  /**
   * Require an out-of-band SAS (emoji) verification of the peer before this
   * module replicates into a shared workspace, WITHOUT the per-entity content-key
   * encryption that `isSensitive` also implies (MK-024). Use this when the trust
   * boundary needs first-contact-MITM protection but the payload is already
   * sealed by another layer (e.g. the community-identity model). The inbound SAS
   * gate treats `isSensitive` and `requiresSasForShare` identically.
   */
  requiresSasForShare?: boolean;
}

/**
 * Complete definition of a MyLife module.
 *
 * Every module in the suite implements this contract. The hub app uses it
 * to register, enable/disable, and render modules dynamically.
 */
export interface ModuleDefinition {
  /** Unique identifier for this module. */
  id: ModuleId;
  /** Display name (e.g. 'MyBooks'). */
  name: string;
  /** Short tagline shown on the module card (e.g. 'Track your reading life'). */
  tagline: string;
  /** Emoji icon representing the module. */
  icon: string;
  /** Brand accent color as a hex string (e.g. '#C9894D'). */
  accentColor: string;
  /** Whether this module is free or requires a premium purchase. */
  tier: ModuleTier;
  /** Which storage backend this module uses. */
  storageType: StorageType;
  /** Database migrations for modules using local SQLite storage. */
  migrations?: Migration[];
  /** Current schema version (corresponds to the latest migration version). */
  schemaVersion?: number;
  /** Table name prefix to avoid collisions in a shared database (e.g. 'bk_'). */
  tablePrefix?: string;
  /** Navigation structure: tabs for the tab bar, screens for stack navigation. */
  navigation: {
    tabs: ModuleTab[];
    screens: ModuleScreen[];
  };
  /** Whether this module requires user authentication. */
  requiresAuth: boolean;
  /** Whether this module requires a network connection to function. */
  requiresNetwork: boolean;
  /** Semantic version string for this module release. */
  version: string;
  /**
   * Optional list of tab keys that remain accessible without a subscription,
   * even when the module's tier is 'premium'. Used by MyHealth to keep the
   * Fasting tab free while gating other tabs behind MyLife Pro.
   */
  freeSections?: string[];
  /**
   * Optional cross-module interface for hub-level features.
   * Modules implement this to participate in unified search, dashboard
   * summaries, activity feeds, and cross-module correlation analysis.
   */
  crossModule?: CrossModuleInterface;
  /**
   * Sync policy for mesh sync. Required after Phase 5.
   * Declares scope, conflict strategy, and resolver requirements per entity.
   */
  syncPolicy?: ModuleSyncPolicy;
}

export const SyncScopeSchema = z.enum(['device_local', 'personal_replica', 'shared_workspace', 'published_blob']);
export const ConflictStrategySchema = z.enum(['lww', 'or_set', 'counter', 'document_crdt', 'manual_review']);

export const ModuleEntitySyncRuleSchema = z.object({
  tableName: z.string().min(1),
  defaultScope: SyncScopeSchema,
  maxScope: SyncScopeSchema.optional(),
  conflictStrategy: ConflictStrategySchema,
  stripColumns: z.array(z.string()).optional(),
  requiresManualResolver: z.boolean().optional(),
  resolverComponent: z.string().optional(),
});

export const ModuleSyncPolicySchema = z.object({
  defaultScope: SyncScopeSchema,
  shareable: z.boolean(),
  entityRules: z.array(ModuleEntitySyncRuleSchema),
  isSensitive: z.boolean().optional(),
  requiresSasForShare: z.boolean().optional(),
});

/** Zod schema for validating ModuleDefinition objects at runtime. */
export const ModuleDefinitionSchema: z.ZodType<ModuleDefinition> = z.object({
  id: ModuleIdSchema,
  name: z.string().min(1),
  tagline: z.string().min(1),
  icon: z.string().min(1),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  tier: z.enum(['free', 'premium']),
  storageType: z.enum(['sqlite', 'supabase', 'drizzle']),
  migrations: z
    .array(
      z.object({
        version: z.number().int().positive(),
        description: z.string(),
        up: z.array(z.string()),
        down: z.array(z.string()),
      }),
    )
    .optional(),
  schemaVersion: z.number().int().nonnegative().optional(),
  tablePrefix: z.string().optional(),
  navigation: z.object({
    tabs: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        icon: z.string(),
      }),
    ),
    screens: z.array(
      z.object({
        name: z.string(),
        title: z.string(),
      }),
    ),
  }),
  requiresAuth: z.boolean(),
  requiresNetwork: z.boolean(),
  version: z.string(),
  freeSections: z.array(z.string()).optional(),
  crossModule: z.custom<CrossModuleInterface>().optional(),
  syncPolicy: ModuleSyncPolicySchema.optional(),
});
