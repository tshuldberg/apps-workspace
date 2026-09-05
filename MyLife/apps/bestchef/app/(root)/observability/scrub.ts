// Pure PII redaction for crash reports. No native/Expo imports so it is unit
// testable under vitest and cannot pull the Sentry SDK into a test process.
// The Sentry init in ./sentry.ts wires these into beforeSend/beforeBreadcrumb.
//
// Patterns are deliberately broad: over-redacting an operational crash report
// costs nothing, leaking PII costs a privacy incident (audit H14).

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Bearer/JWT and long opaque tokens (Supabase anon/service keys, access tokens).
const BEARER_RE = /\b[Bb]earer\s+[A-Za-z0-9._~+/-]+=*/g;
const JWT_RE = /\beyJ[A-Za-z0-9._-]{10,}/g;
// User home/sandbox directories on iOS/Android/macOS. Collapse the per-user /
// per-install segment so stack frames stay useful without exposing the account
// or device identifier embedded in the path.
const IOS_DATA_RE = /\/var\/mobile\/Containers\/[^\s"']+/g;
const APP_DATA_RE = /\/data\/(?:user\/\d+|data)\/[^\s"']+/g;
const HOME_RE = /\/Users\/[^/\s"']+/g;

export function redactString(input: string): string {
  return input
    .replace(EMAIL_RE, '[redacted-email]')
    .replace(BEARER_RE, 'Bearer [redacted-token]')
    .replace(JWT_RE, '[redacted-jwt]')
    .replace(IOS_DATA_RE, '/var/mobile/Containers/[redacted-path]')
    .replace(APP_DATA_RE, '/data/[redacted-path]')
    .replace(HOME_RE, '/Users/[redacted-user]');
}

function redactMaybe(value: unknown): unknown {
  return typeof value === 'string' ? redactString(value) : value;
}

// Recursively redact every string leaf in a value (objects and arrays are
// walked; strings are redacted; everything else is returned as-is). Mutates
// objects/arrays in place. A visited set guards against circular references so
// the scrubber can never throw on a self-referential payload.
function deepRedact(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return value;
  seen.add(value as object);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = deepRedact(value[i], seen);
    }
    return value;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    record[key] = deepRedact(record[key], seen);
  }
  return record;
}

// A single frame of a Sentry exception stacktrace. filename/abs_path carry the
// on-device source path (user home/sandbox segments), so both get redacted.
interface StackFrame {
  filename?: unknown;
  abs_path?: unknown;
}

// Loose Sentry event shape: only the fields that can carry PII. We touch these
// and leave everything else (level, platform) untouched.
export interface ScrubbableEvent {
  user?: unknown;
  message?: unknown;
  exception?: { values?: Array<{ value?: unknown; stacktrace?: { frames?: StackFrame[] } }> };
  breadcrumbs?: Array<{ message?: unknown; data?: Record<string, unknown> }>;
  request?: unknown;
  server_name?: unknown;
  contexts?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  tags?: Record<string, unknown>;
}

// Strips identity and redacts free-text fields. Mutates and returns the event.
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  // Identity: never send it. No user id, email, IP, or username.
  delete event.user;
  // Network/request contexts can carry the IP, headers, cookies. Not needed to
  // triage a crash.
  delete event.request;
  delete event.server_name;
  if (event.contexts && typeof event.contexts === 'object') {
    delete event.contexts.device;
  }

  if (typeof event.message === 'string') {
    event.message = redactString(event.message);
  }

  for (const ex of event.exception?.values ?? []) {
    if (typeof ex.value === 'string') ex.value = redactString(ex.value);
    // Stack frame source paths carry the on-device home/sandbox directory.
    for (const frame of ex.stacktrace?.frames ?? []) {
      if (typeof frame.filename === 'string') frame.filename = redactString(frame.filename);
      if (typeof frame.abs_path === 'string') frame.abs_path = redactString(frame.abs_path);
    }
  }

  for (const crumb of event.breadcrumbs ?? []) {
    if (typeof crumb.message === 'string') crumb.message = redactString(crumb.message);
    if (crumb.data && typeof crumb.data === 'object') {
      for (const key of Object.keys(crumb.data)) {
        crumb.data[key] = redactMaybe(crumb.data[key]);
      }
    }
  }

  // Deep-redact the remaining free-form containers so the scrubber is a true
  // backstop: extra, tags, and any surviving contexts.* (device is already
  // deleted above) can each hold arbitrary strings.
  if (event.extra && typeof event.extra === 'object') deepRedact(event.extra);
  if (event.tags && typeof event.tags === 'object') deepRedact(event.tags);
  if (event.contexts && typeof event.contexts === 'object') deepRedact(event.contexts);

  return event;
}
