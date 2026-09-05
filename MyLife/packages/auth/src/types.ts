/**
 * @mylife/auth -- Shared auth types.
 *
 * Dual-auth model: local (SQLite) is the default for offline/privacy users,
 * cloud (Supabase) is opt-in for sync users.
 */

import { z } from 'zod';
import type { User, Session } from '@supabase/supabase-js';
import type { ErrorCategory } from '@mylife/errors';

// ── Auth Modes ──────────────────────────────────────────────────────

/** Local = SQLite on-device, Cloud = Supabase hosted */
export type AuthMode = 'local' | 'cloud';

/** Cloud auth provider for modules that opt in */
export type CloudProvider = 'supabase' | 'clerk';

/** Plan modes that require authentication. */
export type AuthRequiredMode = 'hosted';

/** All plan modes from the entitlements package. */
export type PlanMode = 'hosted' | 'self_host' | 'local_only';

// ── Per-Module Auth Config ──────────────────────────────────────────

export interface PerModuleAuthConfig {
  /** Which auth mode this module uses */
  mode: AuthMode;
  /** Cloud provider (only when mode is 'cloud') */
  cloudProvider?: CloudProvider;
  /** Whether this module requires auth at all (some may be fully anonymous) */
  requiresAuth: boolean;
}

// ── Local Auth State (SQLite-backed) ────────────────────────────────

export interface LocalAuthUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface LocalAuthSession {
  userId: string;
  createdAt: string;
  expiresAt: string | null;
}

export type LocalAuthState =
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: LocalAuthUser; session: LocalAuthSession };

export type LocalAuthResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      /**
       * Classified error category so callers can discriminate retryable
       * (network/timeout) vs intervention-required (auth/validation) failures
       * without string-matching. Optional for backward compatibility; new
       * producers should always populate it via `@mylife/errors.classifyError`.
       */
      category?: ErrorCategory;
    };

// ── Cloud Auth State (Supabase-backed) ──────────────────────────────

/** Auth state exposed to consumers (cloud auth). */
export interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/** Result of a sign-up or sign-in operation (cloud auth). */
export interface AuthResult {
  success: boolean;
  user: User | null;
  session: Session | null;
  error: string | null;
  /** Classified error category; see LocalAuthResult for rationale. */
  category?: ErrorCategory;
}

/** Token storage adapter for platform-specific persistence. */
export interface TokenStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// ── Password Validation ─────────────────────────────────────────────

export type PasswordStrength = 'weak' | 'fair' | 'strong' | 'very_strong';

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: PasswordStrength;
}

// ── Module Lock Types ────────────────────────────────────────────────

export type ModuleLockMethod = 'pin' | 'biometric' | 'biometricWithPin';

export interface ModuleLockRow {
  moduleId: string;
  pinHash: string;
  salt: string;
  method: ModuleLockMethod;
  lockTimeoutSeconds: number;
  failedAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Zod Schemas ─────────────────────────────────────────────────────

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required.')
  .email('Enter a valid email address.');

export const DisplayNameSchema = z
  .string()
  .trim()
  .min(1, 'Display name is required.')
  .max(64, 'Display name must be 64 characters or fewer.');
