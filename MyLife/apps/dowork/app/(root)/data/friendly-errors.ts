// Friendly-error mapper. Raw Supabase/RevenueCat/fetch error strings must not
// reach users ("JWT expired", "new row violates row-level security policy").
// Screens pass whatever the data layer returned; this maps known technical
// failures to human copy, passes through short copy that is already written
// for users (our own validation messages), and falls back to a generic line
// for anything that still smells technical.

const OFFLINE = /network request failed|failed to fetch|fetch failed|network error|timed? ?out|econn|enotfound|socket|offline/i;
const SESSION = /jwt|token|expired|unauthorized|not authenticated|401|invalid claim|refresh_token/i;
const FORBIDDEN = /row-level security|violates.*policy|permission denied|forbidden|403|not allowed/i;
const RATE_LIMITED = /rate limit|too many requests|429/i;
const CONFLICT = /duplicate key|unique constraint|already exists|409/i;

// Fragments that mark a message as technical plumbing, never user copy.
const JARGON = /jwt|rls|policy|pgrst|postgres|supabase|uuid|constraint|violates|schema|column|relation|null value|undefined|exception|stack|econn|http [45]\d\d|status code/i;

export const GENERIC_ERROR = 'Something went wrong. Try again.';
export const OFFLINE_ERROR = "You're offline. Check your connection and try again.";

// True for a transient/network-shaped failure that is worth retrying without
// burning down an offline queue item's attempt budget (DL-4). A permanent
// rejection (RLS denial, validation, conflict) will fail identically on every
// retry, so those DO count against the cap.
export function isTransientQueueError(raw: string | null | undefined): boolean {
  const message = typeof raw === 'string' ? raw.trim() : '';
  if (!message) return false;
  return OFFLINE.test(message) || RATE_LIMITED.test(message);
}

export function friendlyError(
  raw: string | null | undefined,
  fallback: string = GENERIC_ERROR,
): string {
  const message = typeof raw === 'string' ? raw.trim() : '';
  if (!message) return fallback;

  if (message === 'not_entitled') {
    return 'This video is for subscribers and coaching clients.';
  }
  if (message === 'not_found') return 'That content is no longer available.';
  if (OFFLINE.test(message)) return OFFLINE_ERROR;
  if (SESSION.test(message)) return 'Your session expired. Close and reopen the app, then try again.';
  if (FORBIDDEN.test(message)) return "You don't have access to do that.";
  if (RATE_LIMITED.test(message)) return 'Too many attempts. Wait a moment and try again.';
  if (CONFLICT.test(message)) return 'That was already done. Pull to refresh and check.';

  // Our own data-layer validation copy is already user-facing: short, ends in
  // a period, no jargon. Let it through untouched.
  if (message.length <= 90 && /[.!]$/.test(message) && !JARGON.test(message)) {
    return message;
  }
  return fallback;
}
