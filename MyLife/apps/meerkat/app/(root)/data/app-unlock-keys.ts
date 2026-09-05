// RN-free app-unlock storage keys. Kept apart from app-unlock.ts (which imports
// react-native-purchases + react-native) so the pure submit-client / data layer
// can reference the unlock cache without pulling the native SDK into its graph.

/** mk_settings key the screens cache the derived unlock into (device-local, never synced). */
export const APP_UNLOCK_RECEIPT_KEY = 'app_unlock_receipt_id';
export const APP_UNLOCK_PURCHASED_AT_KEY = 'app_unlock_purchased_at';
/** Opaque HMAC grant for a cross-rail purchase, revalidated server-side on boot. */
export const APP_UNLOCK_GRANT_KEY = 'app_unlock_cross_rail_grant';
