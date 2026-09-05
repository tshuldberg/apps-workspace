export type {
  ModuleId,
  ModuleDefinition,
  ModuleTab,
  ModuleScreen,
  Migration,
  ModuleTier,
  StorageType,
} from './types';
export { ModuleIdSchema, ModuleDefinitionSchema } from './types';

export type {
  CrossModuleInterface,
  SearchableItem,
  ModuleSummary,
  ActivityItem,
  CorrelationDataPoint,
  CorrelationSeries,
  CorrelationDataset,
  TodayCard,
  TodayCardContext,
} from './cross-module-types';

export { ModuleRegistry } from './registry';

export {
  MODULE_IDS,
  FREE_MODULES,
  MODULE_METADATA,
  HEALTH_DATA_MODULE_IDS,
  HEALTH_DATA_TYPES,
  isHealthDataModule,
} from './constants';
export {
  GA_MODULE_IDS,
  PUBLIC_BETA_MODULE_IDS,
  HIDDEN_MODULE_IDS,
  MERGED_MODULE_IDS,
  USER_VISIBLE_MODULE_IDS,
  MODULE_RELEASE_STATES,
  getModuleReleaseState,
  isGeneralAvailabilityModule,
  isPublicBetaModule,
  isHiddenModule,
  isMergedModule,
  isUserVisibleModule,
  getModuleReleaseLabel,
  getModuleReleaseDescription,
} from './release-states';
export type { ModuleReleaseState } from './release-states';

export { MODULE_ICONS, DOCK_ITEMS } from './hub-icons';

export {
  aggregateDashboardData,
  aggregateActivityFeed,
  aggregateTodayCards,
  getDismissedCardIds,
  dismissCardToday,
} from './dashboard';
export type { AggregateTodayCardsOptions } from './dashboard';

export {
  CLUSTER_QUICK_ACTIONS,
  getQuickActionsForClusters,
} from './today-quick-actions';
export type { QuickAction } from './today-quick-actions';

export { useEnabledModules, useModuleRegistry, ModuleRegistryContext } from './hooks';
