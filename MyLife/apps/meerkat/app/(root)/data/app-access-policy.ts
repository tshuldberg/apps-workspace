/**
 * One authoritative mobile capability boundary for the one-time Meerkat unlock.
 * Public reading and purchase/account-recovery surfaces remain free. Everything
 * else fails closed, including unknown future routes, until it is deliberately
 * classified here and covered by the route-policy tests.
 */

const FREE_EXACT_PATHS = new Set([
  '/upgrade',
  '/discover',
  '/public',
  '/about-status',
  '/appearance',
  '/identity',
  '/persona/create',
  '/persona/settings',
]);

const FREE_PATH_PREFIXES = ['/public/'];

export function mobilePathRequiresAppUnlock(pathname: string): boolean {
  const normalized = pathname.trim().replace(/\/+$/u, '') || '/';
  if (FREE_EXACT_PATHS.has(normalized)) return false;
  return !FREE_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}
