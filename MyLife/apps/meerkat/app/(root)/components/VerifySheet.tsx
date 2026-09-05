// Humanity verification sheet (Plan 24 P4, item 14). The one honest gate a joiner
// or publisher crosses before an action reaches other people. It never fakes a
// verified state: when no verification service is configured (the case in this
// build) it says so plainly and the gated action stays blocked; when a service
// is configured it runs the REAL challenge -> issue flow and only reports success
// after a token is actually issued and stored.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { Button, HonestNotice, SectionHeader } from './kit';
import {
  acquireHumanityTokenBatch,
  describeHumanityGate,
  humanityGateState,
  humanityServiceConfig,
  setStoredHumanityTokens,
  type HumanityAttestationSolver,
  type HumanityChallengeKind,
} from '../data/humanity-core';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useMkStyles } from '../providers/AppThemeProvider';

/**
 * The mobile attestation solver. App Attest (iOS) / Play Integrity (Android) need
 * native modules that are absent in Expo Go and are founder-ops to wire in a dev
 * build, so this returns null (attestation unavailable) rather than a faked pass.
 * Kept as an injectable seam so a native build can supply a real solver later.
 */
const mobileAttestationSolver: HumanityAttestationSolver = async () => null;

export function VerifySheet({
  visible,
  onClose,
  onVerified,
  onDismissed,
  purpose,
}: {
  visible: boolean;
  onClose: () => void;
  /** Called once a real token is issued + stored. The caller then retries the gated action. */
  onVerified: () => void;
  /**
   * Called after the Modal has fully dismissed (iOS onDismiss; a visibility effect
   * elsewhere). Hosts whose retried action presents an Alert or navigates MUST queue
   * that action and flush it from here, never from onVerified, or the RN modal
   * dismissal race freezes the screen.
   */
  onDismissed?: () => void;
  /** What the verification unlocks, for honest copy (e.g. 'join this community'). */
  purpose: string;
}) {
  const styles = useMkStyles(makeStyles);
  const db = useMeerkatDatabase();
  const config = useMemo(() => humanityServiceConfig(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = humanityGateState(db, config);

  // Android (and any non-iOS platform) never fires Modal onDismiss; flush the
  // host's post-dismissal queue from the visibility flip instead.
  useEffect(() => {
    if (Platform.OS !== 'ios' && !visible) onDismissed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onVerify = useCallback(() => {
    setBusy(true);
    setError(null);
    void (async () => {
      const kind: HumanityChallengeKind = 'app-attest';
      const result = await acquireHumanityTokenBatch(config, kind, mobileAttestationSolver);
      if (result.ok) {
        setStoredHumanityTokens(db, result.tokens);
        onVerified();
        onClose();
      } else {
        setError(
          result.reason === 'attestation_unavailable'
            ? 'Human verification needs a development build with the device-integrity check. It is not available in this build, so this action stays off.'
            : result.reason === 'service_unreachable'
              ? 'The verification service could not be reached. Try again when you are online.'
              : 'Verification could not be completed right now. This action stays off until it succeeds.',
        );
      }
      setBusy(false);
    })();
  }, [config, db, onVerified, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={Platform.OS === 'ios' ? onDismissed : undefined}
    >
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <SectionHeader title="Verify you're human" hint={`Needed once to ${purpose}`} />
          <Text style={styles.body}>{describeHumanityGate(state)}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {state === 'verified' ? (
            <Button title="Continue" onPress={() => { onVerified(); onClose(); }} />
          ) : state === 'needs_verification' ? (
            <Button title={busy ? 'Verifying...' : "Verify I'm human"} onPress={onVerify} disabled={busy} />
          ) : null}
          <Button title="Not now" variant="secondary" onPress={onClose} />
          <HonestNotice text="This check is anonymous. It proves you are a person to keep out bulk spam accounts; it never proves who you are and is never shown to anyone. Reading and private, on-device features never require it." />
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.34)', justifyContent: 'center', paddingHorizontal: 16 },
  sheet: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 18,
    gap: 12,
  },
  body: { color: c.textSecondary, fontSize: 14, lineHeight: 21 },
  error: { color: c.danger, fontSize: 13, lineHeight: 19 },
});
