/**
 * @mylife/auth -- Shared auth package.
 *
 * Dual-auth model: local (SQLite) is the default,
 * cloud (Supabase) is opt-in for sync users.
 */

// Types -- shared
export type {
  AuthMode,
  CloudProvider,
  PerModuleAuthConfig,
  AuthRequiredMode,
  PlanMode,
  PasswordStrength,
  PasswordValidationResult,
} from './types';
export { EmailSchema, DisplayNameSchema } from './types';

// Types -- local auth (SQLite-backed)
export type {
  LocalAuthUser,
  LocalAuthSession,
  LocalAuthState,
  LocalAuthResult,
} from './types';

// Types -- cloud auth (Supabase-backed)
export type {
  AuthState,
  AuthResult,
  TokenStorage,
} from './types';

// Types -- module lock
export type {
  ModuleLockMethod,
  ModuleLockRow,
} from './types';

// Module lock service (hub-level PIN/biometric lock)
export {
  LOCKABLE_MODULE_IDS,
  LOCKOUT_MAX_ATTEMPTS,
  LOCKOUT_DURATION_SECONDS,
  isLockableModule,
  hashPin,
  verifyPin,
  verifyPinWithRehash,
  attemptUnlock,
  generateSalt,
  checkLockout,
  computeLockedUntil,
  isTimeoutElapsed,
  getModuleLock,
  getAllModuleLocks,
  enableModuleLock,
  disableModuleLock,
  incrementLockFailedAttempts,
  resetLockFailedAttempts,
  setLockLockedUntil,
  updateModuleLockMethod,
  changeModuleLockPin,
} from './module-lock';
export type { LockableModuleId, LockoutState, AttemptUnlockResult } from './module-lock';

// Password validation
export {
  validatePassword,
  getPasswordStrength,
  generatePassphraseSuggestion,
} from './password-validation';

// Local auth service (SQLite)
export {
  CREATE_HUB_AUTH_USERS,
  CREATE_HUB_AUTH_SESSIONS,
  AUTH_TABLES,
  createAuthTables,
  registerUser,
  loginUser,
  logoutSession,
  logoutAllSessions,
  getSessionUser,
  updatePassword,
  deleteAccount,
} from './local-auth';

// Secure storage adapters
export {
  createExpoSecureStorage,
  createWebStorage,
  createMemoryStorage,
} from './secure-storage';

// Cloud auth client (Supabase)
export { getSupabaseClient, resetSupabaseClient } from './client';
export type { SupabaseClientOptions } from './client';

// Cloud auth service
export { AuthService, requiresAuth, INITIAL_AUTH_STATE, UNAUTHENTICATED_STATE } from './service';

// React integration -- cloud auth
export { AuthProvider, useAuth } from './provider';
export type { AuthProviderProps, UseAuthReturn } from './provider';

// React integration -- local auth (SQLite-backed session restoration)
export { LocalAuthProvider, useLocalAuth } from './local-auth-context';
export type { LocalAuthProviderProps, UseLocalAuthReturn } from './local-auth-context';
