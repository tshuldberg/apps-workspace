// Verification account (Plan 51 P3, web). The OUTER identity layer: Sign in with
// Apple / Google backs an anonymous credential for the public layer. SEPARATE from
// the one-time app unlock (Stripe rail) below it in AppUnlockSection, and from the
// inner mesh identity (never signed in here, AC-4). Verbatim twin of the mobile
// account section: it reuses the shared ACCOUNT_COPY / ACCOUNT_DELETE_COPY strings.
//
// HONESTY (binding): nothing here fabricates a signed-in / verified / entitled /
// signed state. Unconfigured => honest disabled copy (AC-6). Mint / renew / delete
// drive the REAL account service and surface its real outcome.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  ACCOUNT_COPY,
  ACCOUNT_DELETE_COPY,
  applyStoreAgeSignal,
  deleteAccount,
  getStoredCredentialState,
  isEntitled,
  isSignedIn,
  isWithinRenewalWindowNow,
  liveAccountDeps,
  mintCredential,
  refreshStatus,
  renewIfInWindow,
  pendingSsoCallbackProvider,
  resolveAccountConfig,
  signIn,
  signOut,
  type AccountSummary,
  type SsoAdapterReason,
  type SsoProvider,
} from '../../lib/account';
import { HonestNotice } from '../shell/HonestNotice';

type Busy = 'apple' | 'google' | 'mint' | 'delete' | null;

const DELETE_BUTTON_LABEL = 'Delete verification account';

export function AccountSection(): React.ReactElement {
  const m = useMeerkat();
  const config = useMemo(() => resolveAccountConfig(), []);
  const deps = useMemo(() => liveAccountDeps(m.storageSecretAccess), [m.storageSecretAccess]);

  const configured = config.configured;
  const appleConfigured = configured && config.appleServiceId.length > 0;
  const googleConfigured = configured && config.googleClientId.length > 0;

  const [signedIn, setSignedIn] = useState<boolean>(() => isSignedIn(deps));
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState<string | null>(null);

  const applyAge = useCallback((next: AccountSummary) => { applyStoreAgeSignal(m.db, next); }, [m.db]);

  // Complete a redirect sign-in: if the app loaded on an SSO callback (id_token in
  // the URL fragment matching a stored attempt), consume it. signIn() detects the
  // callback, verifies state + nonce, and finishes the account sign-in.
  useEffect(() => {
    const provider = pendingSsoCallbackProvider();
    if (!provider) return;
    let cancelled = false;
    setBusy(provider);
    void signIn(deps, provider)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setSignedIn(true);
          setAccount(result.account);
          applyAge(result.account);
        } else {
          const copy = reasonCopy(result.reason);
          if (copy) setNote(copy);
        }
      })
      .catch(() => {
        // A secret-store flush inside the flow can reject; never a silent drop.
        if (!cancelled) setNote('Sign-in did not complete in this browser. Nothing was changed; try again.');
      })
      .finally(() => { if (!cancelled) setBusy(null); });
    return () => { cancelled = true; };
  }, [deps, applyAge]);

  // On mount with a live session, refresh status once (best-effort, honest).
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    void refreshStatus(deps).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setAccount(result.account);
        applyAge(result.account);
      } else if (result.reason === 'no_session') {
        setSignedIn(false);
      }
    }).catch(() => {
      // Best-effort refresh; the last-known real state stays rendered.
    });
    return () => { cancelled = true; };
  }, [deps, signedIn, applyAge]);

  const onSignIn = useCallback(
    async (provider: SsoProvider) => {
      setBusy(provider);
      setNote(null);
      try {
        const result = await signIn(deps, provider);
        if (result.ok) {
          setSignedIn(true);
          setAccount(result.account);
          applyAge(result.account);
        } else {
          // 'redirecting' => the page is navigating to the provider; show nothing.
          const copy = reasonCopy(result.reason);
          if (copy) setNote(copy);
        }
      } catch {
        setNote('Sign-in did not complete in this browser. Nothing was changed; try again.');
      } finally {
        setBusy(null);
      }
    },
    [deps, applyAge],
  );

  const onSignOut = useCallback(async () => {
    try {
      await signOut(deps);
      setSignedIn(false);
      setAccount(null);
      setNote(null);
    } catch {
      // signOut flushes the secret store and can reject; the session may still
      // be stored, so do not render a signed-out state that is not real.
      setNote('Sign out could not be saved in this browser. Try again.');
    }
  }, [deps]);

  const onMint = useCallback(async () => {
    setBusy('mint');
    setNote(null);
    try {
      const result = isWithinRenewalWindowNow(Date.now()) && getStoredCredentialState(deps) !== 'none'
        ? await renewIfInWindow(deps)
        : await mintCredential(deps);
      if (result.ok) {
        const state = getStoredCredentialState(deps);
        setNote(state === 'active' ? ACCOUNT_COPY.credentialActive
          : state === 'scheduled' ? ACCOUNT_COPY.credentialScheduled : ACCOUNT_COPY.credentialExpired);
      } else if (result.reason === 'renewal_refused') {
        setNote(ACCOUNT_COPY.credentialRenewalRefused);
      } else if (result.reason === 'refused') {
        setNote(ACCOUNT_COPY.credentialIssueRefused);
      } else {
        setNote(reasonCopy(result.reason));
      }
    } catch {
      setNote(ACCOUNT_COPY.mintFailed);
    } finally {
      setBusy(null);
    }
  }, [deps]);

  const onDelete = useCallback(
    async (provider: SsoProvider) => {
      if (typeof window !== 'undefined' && !window.confirm(`${DELETE_BUTTON_LABEL}?\n\n${ACCOUNT_DELETE_COPY.cannotTouchInApp}\n\n${ACCOUNT_DELETE_COPY.unsubmittedPassExpires}`)) {
        return;
      }
      setBusy('delete');
      setNote(null);
      try {
        const result = await deleteAccount(deps, provider);
        if (result.ok) {
          setSignedIn(false);
          setAccount(null);
          setNote(`${ACCOUNT_DELETE_COPY.cannotTouchInApp} ${ACCOUNT_DELETE_COPY.unsubmittedPassExpires}`);
        } else {
          const copy = reasonCopy(result.reason);
          if (copy) setNote(copy);
        }
      } catch {
        setNote('The deletion request did not complete. Your account was not deleted; try again.');
      } finally {
        setBusy(null);
      }
    },
    [deps],
  );

  const entitled = account ? isEntitled(account) : false;
  const credentialState = getStoredCredentialState(deps);
  const deleteProvider: SsoProvider | null = appleConfigured ? 'apple' : googleConfigured ? 'google' : null;

  return (
    <section className="mk-settings-section">
      <h3 className="mk-settings-section-title">{ACCOUNT_COPY.sectionTitle}</h3>
      <p className="mk-muted">{ACCOUNT_COPY.sectionHint}</p>

      {!configured || (!appleConfigured && !googleConfigured) ? (
        <HonestNotice>{ACCOUNT_COPY.notConfigured}</HonestNotice>
      ) : signedIn ? (
        <>
          <p className="mk-muted">
            {ACCOUNT_COPY.signedInTitle}. {ageLabel(account)}.{' '}
            <strong>{entitled ? ACCOUNT_COPY.entitledLabel : ACCOUNT_COPY.notEntitledLabel}</strong>.
          </p>
          <p className="mk-muted">
            {credentialState === 'active' ? ACCOUNT_COPY.credentialActive
              : credentialState === 'scheduled' ? ACCOUNT_COPY.credentialScheduled
                : credentialState === 'expired' ? ACCOUNT_COPY.credentialExpired : ACCOUNT_COPY.credentialNone}
          </p>
          <div className="mk-hosted-actions">
            {entitled ? (
              <button type="button" className="mk-btn" disabled={busy !== null} onClick={onMint}>
                {busy === 'mint'
                  ? 'Preparing…'
                  : isWithinRenewalWindowNow(Date.now()) && getStoredCredentialState(deps) !== 'none'
                    ? ACCOUNT_COPY.renewButton
                    : ACCOUNT_COPY.mintButton}
              </button>
            ) : null}
            <button type="button" className="mk-btn mk-btn-secondary" disabled={busy !== null} onClick={onSignOut}>
              {ACCOUNT_COPY.signOutButton}
            </button>
            {deleteProvider ? (
              <button
                type="button"
                className="mk-btn mk-btn-secondary"
                disabled={busy !== null}
                onClick={() => void onDelete(deleteProvider)}
              >
                {busy === 'delete' ? 'Deleting…' : DELETE_BUTTON_LABEL}
              </button>
            ) : null}
          </div>
          <HonestNotice>{ACCOUNT_DELETE_COPY.cannotTouchInApp}</HonestNotice>
        </>
      ) : (
        <>
          <p className="mk-muted">{ACCOUNT_COPY.signedOutBody}</p>
          <div className="mk-hosted-actions">
            <button
              type="button"
              className="mk-btn"
              disabled={busy !== null || !appleConfigured}
              onClick={() => void onSignIn('apple')}
            >
              {busy === 'apple' ? 'Signing in…' : ACCOUNT_COPY.appleButton}
            </button>
            <button
              type="button"
              className="mk-btn"
              disabled={busy !== null || !googleConfigured}
              onClick={() => void onSignIn('google')}
            >
              {busy === 'google' ? 'Signing in…' : ACCOUNT_COPY.googleButton}
            </button>
          </div>
          {!appleConfigured || !googleConfigured ? (
            <HonestNotice>{ACCOUNT_COPY.providerUnavailable}</HonestNotice>
          ) : null}
        </>
      )}

      {note ? <HonestNotice>{note}</HonestNotice> : null}
    </section>
  );
}

function ageLabel(account: AccountSummary | null): string {
  switch (account?.ageStatus) {
    case 'store_adult':
      return ACCOUNT_COPY.ageAdult;
    case 'store_minor':
      return ACCOUNT_COPY.ageMinor;
    default:
      return ACCOUNT_COPY.ageUnknown;
  }
}

/** Map a reason to honest copy, or null when there is nothing to show (a redirect
 *  in progress: the page is navigating to the provider). */
function reasonCopy(reason: SsoAdapterReason): string | null {
  switch (reason) {
    case 'redirecting':
      return null;
    case 'unavailable_in_build':
      return ACCOUNT_COPY.providerUnavailable;
    case 'not_configured':
      return ACCOUNT_COPY.needsServer;
    case 'invalid_token':
      return ACCOUNT_COPY.invalidToken;
    case 'unreachable':
      return ACCOUNT_COPY.unreachable;
    case 'mint_recovery_required':
      return ACCOUNT_COPY.mintRecoveryRequired;
    default:
      return ACCOUNT_COPY.mintFailed;
  }
}
