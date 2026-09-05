/**
 * Which routes render without a MyNews entitlement.
 *
 * PremiumGate wraps the whole (root) Stack, so before this list existed an
 * unentitled or unconfigured build could not reach the legal documents or the
 * moderation notices screen at all. Both are obligations, not features: app
 * store review requires reachable terms and privacy, and the EU DSA requires a
 * user to be able to read the statement of reasons for an action taken against
 * their own content. The same goes for account deletion and data export, which
 * a user must be able to run even after their purchase lapses.
 *
 * Everything not named here keeps the exact gating behaviour it had.
 */

/**
 * First non-group route segment of every entitlement-exempt screen. Naming the
 * ROOT segment covers the whole subtree, so `legal` also exempts
 * `legal/terms`, `legal/privacy`, `legal/guidelines`, `legal/dmca`, and
 * `legal/dmca-counter`.
 */
export const ENTITLEMENT_EXEMPT_ROOT_SEGMENTS: readonly string[] = [
  'legal',
  'notices',
  'account-delete',
  'account-export',
];

function isGroupSegment(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')');
}

/**
 * True when the given expo-router segments address an entitlement-exempt
 * screen. Group segments such as `(root)` and `(tabs)` are route-organisational
 * only and are skipped, so both `['(root)', 'legal']` and
 * `['(root)', '(tabs)', 'legal']` resolve to the same `legal` root.
 *
 * Empty segments (the index route) are NOT exempt: the reader surface stays
 * gated.
 */
export function isEntitlementExemptRoute(segments: readonly string[]): boolean {
  const root = segments.find((segment) => segment.length > 0 && !isGroupSegment(segment));
  return root !== undefined && ENTITLEMENT_EXEMPT_ROOT_SEGMENTS.includes(root);
}
