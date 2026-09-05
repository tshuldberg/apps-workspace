// AccountSection.tsx: the verification-account UI at the ENTITLEMENT BOUNDARY
// (Plan 51 P3). It is NOT shown at first launch; private mesh use stays
// account-free (AC-4). Two render modes:
//   - 'unlock' (upgrade screen): signed-out sign-in buttons + signed-in status +
//     the mint/renew affordance (shown only when entitled).
//   - 'settings' (settings screen): signed-in status + the "Delete verification
//     account" flow, clearly separate from "Delete my data".
//
// HONESTY: every state comes from a real server response. Unconfigured => the
// honest "not connected in this build" copy; nothing fabricates a signed-in,
// verified, or entitled state (AC-6). Signing in also consumes a store age signal
// into the neutral age gate when the store reports an adult (AC store policy).

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Button, HonestNotice, SectionHeader } from './kit';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
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
  signIn,
  signOut,
  type StoredCredentialState,
  type AccountReason,
  type AccountSummary,
  type SsoProvider,
} from '../data/account-core';

type Mode = 'unlock' | 'settings';

interface AccountView {
  configured: boolean;
  signedIn: boolean;
  account: AccountSummary | null;
  hasCredential: boolean;
  credentialState: StoredCredentialState;
  renewalOpen: boolean;
  renewalRefused: boolean;
}

function reasonToCopy(reason: AccountReason): string {
  switch (reason) {
    case 'not_configured':
      return ACCOUNT_COPY.needsServer;
    case 'unavailable_in_build':
      return ACCOUNT_COPY.providerUnavailable;
    case 'invalid_token':
      return ACCOUNT_COPY.invalidToken;
    case 'account_deleted':
      return ACCOUNT_COPY.accountDeleted;
    case 'unreachable':
      return ACCOUNT_COPY.unreachable;
    case 'mint_recovery_required':
      return ACCOUNT_COPY.mintRecoveryRequired;
    case 'renewal_refused':
      return ACCOUNT_COPY.credentialRenewalRefused;
    default:
      return ACCOUNT_COPY.mintFailed;
  }
}

export function AccountSection({ mode }: { mode: Mode }) {
  const styles = useMkStyles(makeStyles);
  const c = useAppThemeColors();
  const db = useMeerkatDatabase();

  const [view, setView] = useState<AccountView>({
    configured: false,
    signedIn: false,
    account: null,
    hasCredential: false,
    credentialState: 'none',
    renewalOpen: false,
    renewalRefused: false,
  });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    // Secure-store reads can throw; without the fold the `loaded` gate would
    // strand this card on its spinner forever.
    try {
      await reloadInner();
    } catch {
      setNote('The account state could not be read from secure storage. Close and reopen Settings to try again.');
      setLoaded(true);
    }
    async function reloadInner(): Promise<void> {
    const deps = liveAccountDeps();
    if (!deps.config.configured) {
      setView((v) => ({ ...v, configured: false }));
      setLoaded(true);
      return;
    }
    const signedIn = await isSignedIn(deps);
    let account: AccountSummary | null = null;
    if (signedIn) {
      const status = await refreshStatus(deps);
      if (status.ok) {
        account = status.account;
        // Consume a store adult signal into the neutral gate (never overwrites a
        // locked/passed record; a minor/unknown signal changes nothing).
        applyStoreAgeSignal(db, status.account);
      }
    }
    const credentialState = await getStoredCredentialState(deps);
    const hasCredential = credentialState !== 'none';
    setView({
      configured: true,
      signedIn,
      account,
      hasCredential,
      credentialState,
      renewalOpen: isWithinRenewalWindowNow(),
      // Reflect a server-reported flagged account immediately (before any renew
      // attempt), so the paused-posting copy shows on load.
      renewalRefused: account?.renewalFlagged === true,
    });
    setLoaded(true);
    }
  }, [db]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onSignIn = useCallback(
    (provider: SsoProvider) => {
      setBusy(true);
      setNote(null);
      void (async () => {
        try {
          const deps = liveAccountDeps();
          const result = await signIn(deps, provider);
          if (result.ok) {
            applyStoreAgeSignal(db, result.account);
            await reload();
          } else {
            setNote(reasonToCopy(result.reason));
          }
        } catch {
          // Secure-store writes inside the flow can throw; never strand busy.
          setNote('Sign-in did not complete on this device. Nothing was changed; try again.');
        } finally {
          setBusy(false);
        }
      })();
    },
    [db, reload],
  );

  const onSignOut = useCallback(() => {
    setBusy(true);
    void (async () => {
      try {
        await signOut(liveAccountDeps());
        await reload();
      } catch {
        setNote('Sign out could not be saved on this device. Try again.');
      } finally {
        setBusy(false);
      }
    })();
  }, [reload]);

  const onMintOrRenew = useCallback(() => {
    setBusy(true);
    setNote(null);
    void (async () => {
      try {
        const deps = liveAccountDeps();
        const result = view.renewalOpen && view.hasCredential
          ? await renewIfInWindow(deps)
          : await mintCredential(deps);
        if (result.ok) {
          await reload();
        } else {
          if (result.reason === 'renewal_refused') setView((v) => ({ ...v, renewalRefused: true }));
          setNote(result.reason === 'refused' ? ACCOUNT_COPY.credentialIssueRefused : reasonToCopy(result.reason));
        }
      } catch {
        setNote('That did not complete on this device. Nothing was changed; try again.');
      } finally {
        setBusy(false);
      }
    })();
  }, [reload, view.hasCredential, view.renewalOpen]);

  const onDelete = useCallback(
    (provider: SsoProvider) => {
      Alert.alert(
        'Delete verification account',
        `${ACCOUNT_DELETE_COPY.cannotTouchInApp}\n\n${ACCOUNT_DELETE_COPY.unsubmittedPassExpires}\n\n${ACCOUNT_DELETE_COPY.recreateAfterPeriod}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete account',
            style: 'destructive',
            onPress: () => {
              setBusy(true);
              setNote(null);
              void (async () => {
                try {
                  const result = await deleteAccount(liveAccountDeps(), provider);
                  if (result.ok) await reload();
                  else setNote(reasonToCopy(result.reason));
                } catch {
                  setNote('The deletion request did not complete. Your account was not deleted; try again.');
                } finally {
                  setBusy(false);
                }
              })();
            },
          },
        ],
      );
    },
    [reload],
  );

  if (!loaded) {
    return (
      <View style={styles.panel}>
        <SectionHeader title={ACCOUNT_COPY.sectionTitle} hint={ACCOUNT_COPY.sectionHint} />
        <View style={styles.centerRow}>
          <ActivityIndicator color={c.accent} />
        </View>
      </View>
    );
  }

  if (!view.configured) {
    return (
      <View style={styles.panel}>
        <SectionHeader title={ACCOUNT_COPY.sectionTitle} hint={ACCOUNT_COPY.sectionHint} />
        <HonestNotice text={ACCOUNT_COPY.notConfigured} />
      </View>
    );
  }

  if (!view.signedIn) {
    // Settings mode shows nothing to sign in; sign-in lives at the entitlement
    // boundary (the unlock screen), so settings only renders when already signed in.
    if (mode === 'settings') return null;
    return (
      <View style={styles.panel}>
        <SectionHeader title={ACCOUNT_COPY.sectionTitle} hint={ACCOUNT_COPY.sectionHint} />
        <Text style={styles.title}>{ACCOUNT_COPY.signedOutTitle}</Text>
        <Text style={styles.body}>{ACCOUNT_COPY.signedOutBody}</Text>
        {busy ? (
          <View style={styles.centerRow}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : (
          <>
            <Button title={ACCOUNT_COPY.appleButton} onPress={() => onSignIn('apple')} />
            <Button title={ACCOUNT_COPY.googleButton} variant="secondary" onPress={() => onSignIn('google')} />
          </>
        )}
        {note ? <HonestNotice text={note} /> : null}
      </View>
    );
  }

  const entitled = view.account !== null && isEntitled(view.account);
  const ageLine =
    view.account?.ageStatus === 'store_adult'
      ? ACCOUNT_COPY.ageAdult
      : view.account?.ageStatus === 'store_minor'
        ? ACCOUNT_COPY.ageMinor
        : ACCOUNT_COPY.ageUnknown;

  return (
    <View style={styles.panel}>
      <SectionHeader title={ACCOUNT_COPY.sectionTitle} hint={ACCOUNT_COPY.sectionHint} />
      <Text style={styles.title}>{ACCOUNT_COPY.signedInTitle}</Text>
      <Text style={styles.body}>{ageLine}</Text>
      <Text style={styles.body}>{entitled ? ACCOUNT_COPY.entitledLabel : ACCOUNT_COPY.notEntitledLabel}</Text>

      <Text style={styles.body}>
        {view.renewalRefused
          ? ACCOUNT_COPY.credentialRenewalRefused
          : ({ active: ACCOUNT_COPY.credentialActive, scheduled: ACCOUNT_COPY.credentialScheduled,
            expired: ACCOUNT_COPY.credentialExpired, none: ACCOUNT_COPY.credentialNone })[view.credentialState]}
      </Text>

      {/* The mint/renew affordance shows only when the account is entitled: an
          anonymous pass is only meaningful for a backed (paid) account. */}
      {mode === 'unlock' && entitled && !view.renewalRefused ? (
        busy ? (
          <View style={styles.centerRow}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : (
          <Button
            title={view.renewalOpen && view.hasCredential ? ACCOUNT_COPY.renewButton : ACCOUNT_COPY.mintButton}
            variant="secondary"
            onPress={onMintOrRenew}
          />
        )
      ) : null}

      {note ? <HonestNotice text={note} /> : null}

      {mode === 'settings' ? (
        <>
          <View style={styles.divider} />
          <Button
            title="Delete verification account"
            variant="danger"
            disabled={busy}
            onPress={() => onDelete('apple')}
          />
          <HonestNotice text={`${ACCOUNT_DELETE_COPY.cannotTouchInApp} ${ACCOUNT_DELETE_COPY.unsubmittedPassExpires} ${ACCOUNT_DELETE_COPY.recreateAfterPeriod}`} />
          <Button title={ACCOUNT_COPY.signOutButton} variant="ghost" disabled={busy} onPress={onSignOut} />
        </>
      ) : (
        <Button title={ACCOUNT_COPY.signOutButton} variant="ghost" disabled={busy} onPress={onSignOut} />
      )}
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
  },
  title: { color: c.text, fontSize: 16, fontWeight: '700' },
  body: { color: c.textSecondary, fontSize: 13.5, lineHeight: 20 },
  centerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: 2 },
});
