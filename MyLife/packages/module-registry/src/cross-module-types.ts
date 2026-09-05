/**
 * Cross-module interface types.
 *
 * These types define the contract for modules that want to participate in
 * hub-level features like unified search, AI intelligence, dashboard
 * summaries, activity feeds, and cross-module correlations.
 */

/** A single searchable item surfaced by a module for unified hub search. */
export interface SearchableItem {
  /** Module that owns this item. */
  moduleId: string;
  /** Type of content (e.g. 'book', 'transaction', 'recipe', 'workout'). */
  type: string;
  /** Primary display title. */
  title: string;
  /** Optional body text to search against. */
  body?: string;
  /** Optional tags/keywords for search relevance. */
  tags?: string[];
  /** Unique identifier within the module (row ID or composite key). */
  itemId: string;
  /** ISO timestamp of when this item was last modified. */
  updatedAt: string;
}

/** High-level summary of a module's data, used for dashboard cards and AI context. */
export interface ModuleSummary {
  /** Module that produced this summary. */
  moduleId: string;
  /** Total number of records the module manages. */
  totalItems: number;
  /** Key-value stats specific to the module (e.g. { booksRead: 42, avgRating: 4.2 }). */
  stats: Record<string, number | string>;
  /** ISO timestamp of the most recent user activity in this module. */
  lastActivity?: string;
}

/** A single activity event for the hub-wide activity feed. */
export interface ActivityItem {
  /** Module that generated this activity. */
  moduleId: string;
  /** Machine-readable event type (e.g. 'created', 'completed', 'logged'). */
  action: string;
  /** Human-readable description of the activity. */
  description: string;
  /** ISO timestamp of when this activity occurred. */
  timestamp: string;
  /** Optional reference to the item involved. */
  itemId?: string;
  /** Optional item type for routing (e.g. 'book', 'workout'). */
  itemType?: string;
}

/** A single numeric data point for cross-module correlation analysis. */
export interface CorrelationDataPoint {
  /** ISO date string (YYYY-MM-DD) for the observation. */
  date: string;
  /** Numeric value for this data point. */
  value: number;
}

/** A named metric series that can be correlated with series from other modules. */
export interface CorrelationSeries {
  /** Machine-readable metric name (e.g. 'sleep_hours', 'calories', 'pages_read'). */
  metric: string;
  /** Human-readable label for display. */
  label: string;
  /** Unit of measurement (e.g. 'hours', 'kcal', 'pages'). */
  unit: string;
  /** The data points for this series. */
  data: CorrelationDataPoint[];
}

/** A module's correlation dataset, containing one or more metric series. */
export interface CorrelationDataset {
  /** Module that produced this dataset. */
  moduleId: string;
  /** Available metric series from this module. */
  series: CorrelationSeries[];
}

/** A card surfaced by a module for the hub's unified Today view. */
export interface TodayCard {
  /** Stable identifier within the module (module namespaces its own ids). */
  id: string;
  /** Owner module. */
  moduleId: string;
  /** Semantic kind that drives visual treatment + ranking. */
  kind: 'action' | 'progress' | 'insight' | 'reminder' | 'event';
  /** 0-100. Higher = more visible. Module computes with time-relevance bonuses. */
  priority: number;
  /** Primary display text. */
  title: string;
  /** Optional single-line supporting text. */
  subtitle?: string;
  /** Optional CTA; if present, the card is tappable. */
  cta?: { label: string; route: string };
  /** Whether the user may dismiss this card for today. */
  dismissible: boolean;
  /** Optional ISO timestamp after which the card should not render. */
  expiresAt?: string;
}

/** Context passed to `getTodayCards`. Modules may read or ignore. */
export interface TodayCardContext {
  /** Current wall-clock time; lets callers pass a fixed clock in tests. */
  now: Date;
  /** User's onboarding clusters, if known. Drives cluster-weighted ranking. */
  primaryClusters?: string[];
}

/**
 * Cross-module interface that modules optionally implement to participate
 * in hub-level search, intelligence, dashboard, and engagement features.
 *
 * The `db` parameter is typed as `unknown` so that the registry package
 * stays decoupled from any specific database driver. Each module casts
 * it to its own database type internally.
 */
export interface CrossModuleInterface {
  /** Return searchable items for the hub's unified search index. */
  getSearchableContent?: (db: unknown) => SearchableItem[];
  /** Return a high-level data summary for dashboard cards and AI context. */
  getDataSummary?: (db: unknown) => ModuleSummary;
  /** Return recent activity since `since` for the hub-wide activity feed. */
  getActivityFeed?: (db: unknown, since: Date) => ActivityItem[];
  /** Return numeric time-series data for cross-module correlation analysis. */
  getCorrelationData?: (db: unknown) => CorrelationDataset;
  /** Return 0-3 cards for the hub's unified Today view. */
  getTodayCards?: (db: unknown, context: TodayCardContext) => TodayCard[];
}
