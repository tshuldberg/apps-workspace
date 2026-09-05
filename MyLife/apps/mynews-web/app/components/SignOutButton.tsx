'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Ends the reader's website session (plan 48 WP10).
 *
 * A site that can sign a reader in has to be able to sign them out, and the
 * control has to be somewhere they can find it, which is why it sits in the
 * footer of every page rather than inside the report card they may never open
 * again.
 *
 * `router.refresh()` after the POST re-renders the server tree so the footer and
 * every report card on the page agree that the session is gone. Without it the UI
 * would keep claiming a session the cookie jar no longer holds.
 */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch {
      // The SDK clears local cookies before its network call, so the reader is
      // signed out here either way; refresh and let the server state speak.
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <button type="button" className="site-signout" disabled={busy} aria-busy={busy} onClick={() => void onClick()}>
      {busy ? 'Signing out...' : 'Sign out'}
    </button>
  );
}
