/**
 * Same-origin guard for state-changing route handlers (plan 48 WP12).
 *
 * None of the POST endpoints (report, OTP send, OTP verify, signout, DMCA) sent
 * a CSRF check, and `request.json()` ignores Content-Type, so a cross-site
 * `<form enctype="text/plain">` reached them as a simple request with no
 * preflight. The dangerous case is OTP verify, which CREATES a session: an
 * attacker requests a code for their own address, has the victim's browser POST
 * that email+code, the browser accepts the Set-Cookie, and the victim is now
 * signed in as the attacker (session fixation). SameSite=Lax is the only other
 * barrier and it is a cookie default this app never asserts.
 *
 * The check is deliberately strict and header-based (no token plumbing needed):
 * a genuine same-origin fetch/navigation from this site carries either a
 * `Sec-Fetch-Site` of `same-origin`/`same-site`/`none` (browsers that send it)
 * or an `Origin` matching the request host. A cross-site form post carries
 * `Sec-Fetch-Site: cross-site` (modern browsers) or an `Origin` that does not
 * match. A request with neither header is treated as untrusted for a
 * state-changing endpoint: real browser POSTs to our own routes always carry at
 * least one.
 */

function hostFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export function isSameOriginRequest(request: Request): boolean {
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite) {
    // `none` = user-initiated (address bar, bookmark); the others are our own UI.
    return (
      secFetchSite === 'same-origin' ||
      secFetchSite === 'same-site' ||
      secFetchSite === 'none'
    );
  }

  // Browsers that do not send Sec-Fetch-Site: fall back to Origin vs the request
  // host. The request URL's host is the host the browser actually connected to.
  const originHost = hostFromUrl(request.headers.get('origin'));
  const selfHost = hostFromUrl(request.url);
  if (originHost && selfHost) return originHost === selfHost;

  // Neither signal present on a state-changing endpoint: fail closed.
  return false;
}
