export { isTestMode, setTestMode } from './test-mode';

export type {
  HubUnlockProduct,
  StandaloneProduct,
  AnnualUpdateProduct,
  StorageTierProduct,
  ProductId,
  StorageTier,
  Purchase,
  EntitlementState,
} from './types';

export {
  HubUnlockProductSchema,
  StandaloneProductSchema,
  AnnualUpdateProductSchema,
  StorageTierProductSchema,
  ProductIdSchema,
  StorageTierSchema,
  PurchaseSchema,
  PlanModeSchema,
  UnsignedEntitlementsSchema,
  EntitlementsSchema,
} from './schema';

export type { EntitlementExpirableShape } from './gates';

export {
  isModuleUnlocked,
  getUnlockedModules,
  isHubUnlocked,
  getStorageTier,
  isUpdateEntitled,
  isEntitlementExpired,
  resolveEntitlements,
} from './gates';

export type { PlanMode, UnsignedEntitlements, Entitlements } from './hosted-types';

export {
  createEntitlementSignature,
  verifyEntitlementSignature,
} from './verify';

export {
  MEERKAT_APP_ID,
  MEERKAT_HOSTED_RELAY_FEATURE,
  MEERKAT_COMMUNITY_NODE_FEATURE,
  MEERKAT_HOSTED_STORAGE_FEATURE,
  MEERKAT_HOSTED_FEATURES,
  serializeEntitlementToken,
  parseEntitlementToken,
  issueMeerkatHostedEntitlement,
  verifyHostedFeatureEntitlement,
} from './meerkat-hosted';
export type {
  MeerkatHostedFeature,
  HostedEntitlementFailureReason,
  HostedEntitlementCheck,
  VerifyHostedFeatureEntitlementOptions,
  IssueMeerkatHostedEntitlementInput,
} from './meerkat-hosted';

export {
  MEERKAT_APP_UNLOCK_PRODUCT_ID,
  deriveMeerkatAppUnlock,
} from './meerkat-app';
export type { MeerkatAppUnlockState } from './meerkat-app';

export {
  MEERKAT_APP_UNLOCK_FEATURE,
  APP_UNLOCK_BINDING_WINDOW_MS,
  APP_UNLOCK_TOKEN_TTL_MS,
  appUnlockBindingMessage,
  issueMeerkatAppUnlockToken,
  parseMeerkatAppUnlockToken,
  verifyMeerkatAppUnlockToken,
} from './meerkat-app-token';
export type {
  AppUnlockTokenCheck,
  AppUnlockTokenFailureReason,
  IssueMeerkatAppUnlockTokenInput,
  MeerkatAppUnlockToken,
  UnsignedMeerkatAppUnlockToken,
} from './meerkat-app-token';
