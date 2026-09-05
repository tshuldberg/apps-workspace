// App unlock (Plan 22 Part 1, web rail). The $4.99 one-time unlock via Stripe
// Checkout + account restore + the cross-rail Link code. Byte-aligned in intent
// with the mobile Unlock screen (apps/meerkat/app/(root)/upgrade.tsx), differing
// only "device"<->"browser".
//
// HONESTY: nothing here fakes an unlock. Checkout/restore drive the real hosted
// endpoints and surface the real server outcome; a redeemed Link code is verified
// server-side (the browser only caches the result). When no hosted API URL is
// configured, the section fails closed with honest copy.

import { useCallback, useEffect, useState } from 'react';
import { MEERKAT_APP_UNLOCK_PRODUCT } from '@mylife/billing-config';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  HOSTED_API_URL,
  redeemAppUnlockLink,
  fetchAppUnlockState,
  mintAppUnlockLink,
  startAppUnlockCheckout,
  setCachedAppUnlock,
} from '../../lib/hosted-access';
import { HonestNotice } from '../shell/HonestNotice';
import { AccountSection } from './AccountSection';

// The price is founder-locked and sourced from @mylife/billing-config, never hardcoded.
const PRICE_LABEL = `$${MEERKAT_APP_UNLOCK_PRODUCT.price.toFixed(2)}`;

export function AppUnlockSection(): React.ReactElement {
  const m = useMeerkat();
  const configured = HOSTED_API_URL.trim().length > 0;
  // The validated unlock machine lives in MeerkatProvider (NC-2: the cache is
  // only a hint; the provider re-validates against the account and this section
  // reads the SAME state the shell gates on, so the two can never contradict
  // each other on one screen).
  const unlocked = m.appUnlock.status === 'unlocked';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'checkout' | 'restore' | 'redeem' | 'link' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [link, setLink] = useState<{ code: string; expiresAt: string } | null>(null);

  // Returning from Stripe Checkout (?unlock=success / ?unlock=cancel): confirm
  // the real entitlement with the hosted API and clean the query param. The
  // param itself is NEVER treated as an unlock; only the server answer is.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('unlock');
    if (!outcome) return;
    params.delete('unlock');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    if (outcome === 'cancel') {
      setNote('Checkout was canceled. Nothing was charged.');
      return;
    }
    if (outcome !== 'success' || !configured) return;
    let authorization: string;
    try {
      authorization = m.hostedAccess.createAuthorization();
    } catch {
      return;
    }
    let cancelled = false;
    setBusy('restore');
    void fetchAppUnlockState(authorization)
      .then((state) => {
        if (cancelled) return;
        if (!state.unlocked) {
          setNote('The unlock is not confirmed by the connection server yet. Tap Restore purchase in a moment.');
        }
      })
      .catch(() => {
        if (!cancelled) setNote('Could not confirm the checkout with the connection server. Tap Restore purchase.');
      })
      .finally(() => { if (!cancelled) setBusy(null); });
    return () => { cancelled = true; };
  }, [configured, m.hostedAccess]);

  const onCheckout = useCallback(async () => {
    setBusy('checkout');
    setNote(null);
    try {
      const url = await startAppUnlockCheckout(
        m.hostedAccess.createAuthorization(),
        `${window.location.origin}/?unlock=success`,
        `${window.location.origin}/?unlock=cancel`,
      );
      window.location.assign(url);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Checkout could not start.');
    } finally {
      setBusy(null);
    }
  }, [m.hostedAccess]);

  const onRestore = useCallback(async () => {
    setBusy('restore');
    setNote(null);
    try {
      const state = await fetchAppUnlockState(m.hostedAccess.createAuthorization());
      if (!state.unlocked) setNote('No purchase found on this account.');
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Restore failed.');
    } finally {
      setBusy(null);
    }
  }, [m.hostedAccess]);

  const onMintLink = useCallback(async () => {
    setBusy('link');
    setNote(null);
    try {
      setLink(await mintAppUnlockLink(m.hostedAccess.createAuthorization()));
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not create a link code.');
    } finally {
      setBusy(null);
    }
  }, [m.hostedAccess]);

  const onRedeem = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy('redeem');
    setNote(null);
    try {
      const state = await redeemAppUnlockLink(trimmed, m.hostedAccess.createAuthorization());
      if (state.unlocked) {
        setCachedAppUnlock(state);
      } else {
        setNote('That code is invalid, expired, or already used.');
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not check that code.');
    } finally {
      setBusy(null);
    }
  }, [code, m.hostedAccess]);

  return (
    <>
      <AccountSection />
      <section className="mk-settings-section">
      <h3 className="mk-settings-section-title">Unlock Meerkat</h3>

      {unlocked ? (
        <p className="mk-muted">
          Unlocked on this browser. Full private use is on, forever. No subscription.
        </p>
      ) : m.appUnlock.status === 'checking' ? (
        <p className="mk-muted">Checking your saved purchase with the connection server…</p>
      ) : m.appUnlock.status === 'cannot_verify' ? (
        <>
          {m.appUnlock.detail ? <HonestNotice>{m.appUnlock.detail}</HonestNotice> : null}
          <div className="mk-hosted-actions">
            <button type="button" className="mk-btn mk-btn-secondary" onClick={() => m.appUnlock.revalidate()}>
              Try verification again
            </button>
          </div>
        </>
      ) : (
        <p className="mk-muted">
          Meerkat is free to browse public channels, communities, and forums. A one-time <strong>{PRICE_LABEL}</strong> unlocks
          full private use forever: create and seal your own content, direct messages, your own communities,
          device-to-device sync, and self-hosting. No subscription. No account required. Buying on the web does not
          automatically unlock iOS or Android (and vice-versa); use a link code to cover both.
        </p>
      )}

      {!configured ? (
        <HonestNotice>
          Hosted checkout is not configured in this build. The app unlock is sold through the app stores on mobile; on
          the web it needs a connection server.
        </HonestNotice>
      ) : unlocked ? null : (
        <div className="mk-hosted-actions">
          <button type="button" className="mk-btn" disabled={busy !== null} onClick={onCheckout}>
            {busy === 'checkout' ? 'Starting…' : `Unlock for ${PRICE_LABEL}`}
          </button>
          <button type="button" className="mk-btn mk-btn-secondary" disabled={busy !== null} onClick={onRestore}>
            {busy === 'restore' ? 'Checking…' : 'Restore purchase'}
          </button>
        </div>
      )}

      {configured && !unlocked ? (
        <div className="mk-app-unlock-link">
          <label className="mk-muted" htmlFor="mk-link-code">Bought on another device? Enter a link code:</label>
          <div className="mk-hosted-actions">
            <input
              id="mk-link-code"
              className="mk-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Link code"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button type="button" className="mk-btn mk-btn-secondary" disabled={busy !== null || code.trim().length === 0} onClick={onRedeem}>
              {busy === 'redeem' ? 'Checking…' : 'Redeem code'}
            </button>
          </div>
        </div>
      ) : null}

      {configured && unlocked ? (
        <div className="mk-app-unlock-link">
          <p className="mk-muted">Use this purchase on another rail with a single-use code.</p>
          <button type="button" className="mk-btn mk-btn-secondary" disabled={busy !== null} onClick={onMintLink}>
            {busy === 'link' ? 'Creating…' : 'Link this purchase'}
          </button>
          {link ? (
            <p className="mk-muted"><strong>{link.code}</strong><br />Expires {new Date(link.expiresAt).toLocaleString()}.</p>
          ) : null}
        </div>
      ) : null}

      {m.appUnlock.status === 'locked' && m.appUnlock.detail ? (
        <HonestNotice>{m.appUnlock.detail}</HonestNotice>
      ) : null}
      {note ? <HonestNotice>{note}</HonestNotice> : null}
      </section>
    </>
  );
}
