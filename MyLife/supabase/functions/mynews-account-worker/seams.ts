/**
 * Account-deletion side-effect seams (plan 48 WP5).
 *
 * Content disposition happens in one SQL transaction and the auth user is
 * deleted through the store's admin seam. What is left is the PROCESSOR side:
 * closing or detaching the payment-processor objects that live outside our
 * database (connected account, customer, active subscriptions).
 *
 * The MyNews support rail is not activated yet (WP7 owns the Stripe Connect
 * implementation and founder-ops owns the credentials), so this seam is
 * configuration-driven rather than provider-specific:
 *
 *   - Unconfigured (the state today): returns 'unconfigured'. The worker records
 *     processor_cleanup_state = 'skipped-unconfigured', which stays VISIBLE in
 *     the user's deletion status. It is never recorded as 'done'.
 *   - Configured: POSTs the deletion facts to the operator-owned cleanup
 *     endpoint with the shared secret and maps the response. A non-2xx or a
 *     thrown request is an 'error', so the request lands 'failed' and the next
 *     worker pass retries it. It never assumes success.
 */

export type ProcessorCleanupResult =
  | { kind: 'done'; detail?: string }
  | { kind: 'error'; detail: string }
  | { kind: 'unconfigured' };

/** Founder-ops env keys (unset by default). */
export const ENV_PROCESSOR_CLEANUP_URL = 'MYNEWS_PROCESSOR_CLEANUP_URL';
export const ENV_PROCESSOR_CLEANUP_SECRET = 'MYNEWS_PROCESSOR_CLEANUP_SECRET';

export interface ProcessorCleanupInput {
  requestId: string;
  userId: string;
  profileId: string | null;
}

export async function cleanUpProcessorAccount(
  input: ProcessorCleanupInput,
  env: (key: string) => string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<ProcessorCleanupResult> {
  const url = env(ENV_PROCESSOR_CLEANUP_URL)?.trim();
  const secret = env(ENV_PROCESSOR_CLEANUP_SECRET)?.trim();
  if (!url || !secret) {
    // No processor rail wired: honest skip, visible in the deletion status.
    return { kind: 'unconfigured' };
  }
  if (!url.startsWith('https://')) {
    return { kind: 'error', detail: 'processor cleanup endpoint must be https' };
  }

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MyNews-Processor-Secret': secret,
      },
      body: JSON.stringify({
        requestId: input.requestId,
        userId: input.userId,
        profileId: input.profileId,
        reason: 'account_deleted',
      }),
    });
    if (res.status >= 200 && res.status < 300) return { kind: 'done' };
    return { kind: 'error', detail: `processor cleanup responded ${res.status}` };
  } catch (error) {
    return {
      kind: 'error',
      detail: `processor cleanup request failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
