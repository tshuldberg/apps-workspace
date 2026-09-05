// Crash reporting for BestChef, the suite's first public consumer launch
// (audit H14: the app previously shipped with zero crash reporting).
//
// PRIVACY POSTURE (hard constraint, not a preference). MyLife is privacy-first
// with zero product analytics; this module is operational crash reporting only,
// kept distinct from behavioral telemetry:
//   - Fully inert unless EXPO_PUBLIC_BESTCHEF_SENTRY_DSN is set. No DSN means
//     initSentry() returns immediately and NO network client is created, so a
//     build with no DSN behaves exactly as before this file existed.
//   - tracesSampleRate 0: no performance/transaction tracing, so no timing or
//     navigation telemetry is emitted. Only crashes and explicitly captured
//     errors are sent.
//   - No user identity: sendDefaultPii is false and scrubEvent() strips
//     event.user entirely, so no user id, email, IP, or username leaves the
//     device. The only scope is the anonymous per-install session Sentry
//     assigns; we never attach an account id to it.
//   - beforeSend runs scrubEvent() (see ./scrub.ts) to redact emails,
//     bearer/JWT tokens, and user home-directory file paths from messages,
//     exception values, and breadcrumbs before anything is queued for sending.
//   - beforeBreadcrumb drops console breadcrumbs (they can echo arbitrary
//     logged strings) and scrubs the rest.
//
// Residency: the DSN chooses the ingest region. Point it at Sentry's EU ingest
// (or a self-hosted Sentry) to keep crash data in-region; the incident runbook
// documents this. The code is region-agnostic.

import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { redactString, scrubEvent, type ScrubbableEvent } from './scrub';

// Direct member expression (not an aliased env object): babel-preset-expo only
// inlines EXPO_PUBLIC_* when accessed this way, and an aliased read breaks the
// Hermes production bundle (see apps/bestchef/CLAUDE.md EAS env contract).
const SENTRY_DSN = process.env.EXPO_PUBLIC_BESTCHEF_SENTRY_DSN;

const APP_VERSION =
  (typeof Constants?.expoConfig?.version === 'string' && Constants.expoConfig.version) ||
  ((Constants as { nativeAppVersion?: string }).nativeAppVersion ?? 'dev');

const APP_BUILD =
  (typeof Constants?.expoConfig?.runtimeVersion === 'string' && Constants.expoConfig.runtimeVersion) ||
  ((Constants as { nativeBuildVersion?: string }).nativeBuildVersion ?? '');

let initialized = false;

// Idempotent. Returns true if the Sentry client was actually started (DSN
// present), false when it stayed inert. Safe to call from the root layout on
// every mount.
export function initSentry(): boolean {
  if (initialized) return true;
  if (!SENTRY_DSN) return false;

  Sentry.init({
    dsn: SENTRY_DSN,
    // No performance tracing = no behavioral telemetry, only crashes/errors.
    tracesSampleRate: 0,
    // Never attach IP/PII automatically; scrubEvent enforces this too.
    sendDefaultPii: false,
    release: APP_VERSION ? `bestchef@${APP_VERSION}` : undefined,
    dist: APP_BUILD || undefined,
    beforeSend(event) {
      return scrubEvent(event as ScrubbableEvent) as typeof event;
    },
    beforeBreadcrumb(crumb) {
      // Console breadcrumbs can echo any logged string (tokens, emails). Drop
      // them wholesale rather than trying to scrub arbitrary console output.
      if (crumb.category === 'console') return null;
      if (typeof crumb.message === 'string') crumb.message = redactString(crumb.message);
      return crumb;
    },
  });

  initialized = true;
  return true;
}

// Thin wrapper so callers do not import the SDK directly and cannot bypass the
// inert-when-unconfigured guard. No-op when Sentry was never initialized.
export function captureAppException(error: unknown): void {
  if (!initialized) return;
  Sentry.captureException(error);
}
