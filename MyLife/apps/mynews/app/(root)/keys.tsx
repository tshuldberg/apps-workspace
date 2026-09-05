// Keys and Recovery (plan 48 WP6, design docs/designs/mynews-key-custody.md
// section "App UI"). Everything a journalist can do about their own signing
// custody: see the chain, create or import a recovery kit, rotate, revoke a lost
// device, and see the state of any recovery in flight.
//
// Two honesty rules run through this screen. Nothing claims a capability the
// deployment lacks (no-kit recovery renders as unavailable, with the reason,
// rather than as a button that always refuses). And nothing reports success it
// cannot see: a rotation installs the new key on this device only AFTER the
// server has accepted it, so a failed rotation leaves the device still able to
// publish with the key it can prove.

import { useCallback, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  approveDeviceKey,
  cancelKeyRecoveryWithKey,
  createRecoveryKit,
  escrowRecoveryKit,
  fetchCustodyStatus,
  fetchEscrowedKit,
  formatRecoveryCode,
  generateRecoveryCode,
  openRecoveryKit,
  parseRecoveryKit,
  recoveryCodesMatch,
  revokeDeviceKey,
  rotateSigningKey,
  serializeRecoveryKit,
  type CustodyStatusView,
  type RecoveryKitEnvelope,
} from '@mylife/mynews';
import { tokens } from './theme/tokens';
import { useMyNewsAuth } from './providers/AuthProvider';
import { useMyNewsCloud } from './providers/CloudProvider';
import {
  useMyNewsIdentity,
  useMyNewsIdentityActions,
  type CandidateIdentity,
} from './providers/IdentityProvider';
import { ScreenHeader } from './components/ScreenHeader';
import { LoadingView, MessageView } from './components/StateViews';
import { PrimaryButton, SecondaryButton } from './components/Buttons';
import { absoluteDate, shortKey } from './lib/format';
import {
  CUSTODY_EXPLANATION,
  custodyErrorMessage,
  custodyPosture,
  noKitRecoveryCopy,
  postureCopy,
  toKeyRows,
} from './lib/keys';
import { ErrorText } from './components/ErrorText';

type LoadState =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; custody: CustodyStatusView };

/** The kit-creation wizard: show the code once, then require re-entry. */
type KitFlow =
  | { step: 'idle' }
  | { step: 'show-code'; code: string }
  | { step: 'confirm-code'; code: string; typed: string }
  | { step: 'done'; envelope: RecoveryKitEnvelope; escrowed: boolean };

export default function KeysScreen() {
  const auth = useMyNewsAuth();
  const { isConfigured, port } = useMyNewsCloud();
  const identity = useMyNewsIdentity();
  const actions = useMyNewsIdentityActions();

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [kit, setKit] = useState<KitFlow>({ step: 'idle' });
  const [importText, setImportText] = useState('');
  const [importCode, setImportCode] = useState('');

  const userId = auth.status === 'anonymous' || auth.status === 'linked' ? auth.userId : null;

  const load = useCallback(async () => {
    if (!isConfigured || !port) {
      setState({ status: 'not-configured' });
      return;
    }
    const result = await fetchCustodyStatus(port);
    if (!result.ok) {
      setState({ status: 'error', message: custodyErrorMessage(result.code, result.detail) });
      return;
    }
    const { ok: _ok, ...custody } = result;
    setState({ status: 'loaded', custody });
  }, [isConfigured, port]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const run = useCallback(
    async (label: string, work: () => Promise<string | null>) => {
      setBusy(label);
      setError(null);
      setNotice(null);
      try {
        const failure = await work();
        if (failure) setError(failure);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
      await load();
    },
    [load],
  );

  /* ------------------------------- kit creation ------------------------------ */

  const startKit = useCallback(() => {
    setError(null);
    setNotice(null);
    // 160 bits from the platform CSPRNG. Shown once; the app never stores it.
    setKit({ step: 'show-code', code: generateRecoveryCode().code });
  }, []);

  const confirmKit = useCallback(() => {
    if (kit.step !== 'confirm-code') return;
    if (!recoveryCodesMatch(kit.code, kit.typed)) {
      setError('That does not match the code shown. Check it and type it again.');
      return;
    }
    if (!identity || state.status !== 'loaded') return;
    setError(null);
    try {
      const envelope = createRecoveryKit({
        profileId: state.custody.profileId,
        pubkey: identity.pubkeyHex,
        privateKeyHex: identity.privateKeyHex,
        code: kit.code,
        createdAt: new Date().toISOString(),
      });
      setKit({ step: 'done', envelope, escrowed: false });
      setNotice(
        'Recovery kit created. Save the file somewhere durable and keep the code separately: either one alone is useless.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [identity, kit, state]);

  const exportKit = useCallback(async () => {
    if (kit.step !== 'done') return;
    try {
      await Share.share({ message: serializeRecoveryKit(kit.envelope) });
    } catch {
      // The user cancelled or the share sheet failed; nothing to fake.
    }
  }, [kit]);

  const escrowKit = useCallback(() => {
    if (kit.step !== 'done' || !port || !userId || !identity) return;
    void run('escrow', async () => {
      const result = await escrowRecoveryKit({
        port,
        userId,
        signer: identity,
        envelope: kit.envelope as unknown as Record<string, unknown>,
      });
      if (!result.ok) return custodyErrorMessage(result.code, result.detail);
      setKit({ ...kit, escrowed: true });
      setNotice(
        `Encrypted kit stored on the server as version ${result.version}. Only your recovery code can open it, and every read of it shows up in your access log below.`,
      );
      return null;
    });
  }, [identity, kit, port, run, userId]);

  /* --------------------------------- import --------------------------------- */

  const importKit = useCallback(
    (raw: string, code: string) => {
      if (!port || !userId || !actions || state.status !== 'loaded') return;
      const envelope = parseRecoveryKit(raw);
      if (!envelope) {
        setError('That does not look like a MyNews recovery kit.');
        return;
      }
      const opened = openRecoveryKit(envelope, code);
      if (!opened.ok) {
        setError(
          opened.reason === 'bad-code'
            ? 'That recovery code is not the right shape. It is 8 groups of 4 characters.'
            : opened.reason === 'wrong-code'
              ? 'That code did not open this kit. The kit may also have been altered.'
              : opened.reason === 'pubkey-mismatch'
                ? 'This kit opened, but the key inside does not match the key it claims. Do not use it.'
                : 'That kit file is not a version this app understands.',
        );
        return;
      }

      // The recovered key becomes this device's key by ROTATING the chain onto a
      // freshly minted key, not by adopting the recovered one directly: the
      // recovered key may already be revoked, and a rotation proves possession of
      // both halves in one atomic step.
      void run('import', async () => {
        const next = actions.generateCandidate();
        const result = await rotateSigningKey({
          port,
          userId,
          current: { pubkeyHex: opened.pubkey, privateKeyHex: opened.privateKeyHex },
          next: { pubkeyHex: next.pubkeyHex, privateKeyHex: next.privateKeyHex },
        });
        if (!result.ok) return custodyErrorMessage(result.code, result.detail);
        // Only now is it safe to replace the local key.
        if (!(await actions.installIdentity(next))) {
          return 'Your account key was rotated, but this device could not store the new key. Sign in again on this device.';
        }
        setImportText('');
        setImportCode('');
        setNotice(
          result.backupRestore
            ? 'Signing restored from your encrypted backup. That is recorded publicly on your profile, so a silent restore is impossible.'
            : 'Signing restored on this device with a fresh key. Your past revisions stay verifiable against the keys that signed them.',
        );
        return null;
      });
    },
    [actions, port, run, state, userId],
  );

  /* --------------------------- rotate, approve, revoke --------------------------- */

  const rotate = useCallback(() => {
    if (!port || !userId || !identity || !actions) return;
    void run('rotate', async () => {
      const next = actions.generateCandidate();
      const result = await rotateSigningKey({ port, userId, current: identity, next });
      if (!result.ok) return custodyErrorMessage(result.code, result.detail);
      if (!(await actions.installIdentity(next))) {
        return 'Your account key was rotated, but this device could not store the new key. Sign in again on this device.';
      }
      setNotice(
        'Signing key rotated. Your previous key is retired: it can no longer publish, and everything it already signed stays verifiable.',
      );
      return null;
    });
  }, [actions, identity, port, run, userId]);

  const approveThisDevice = useCallback(() => {
    if (!port || !userId || !identity) return;
    setError(
      'Approving this device needs the device that still holds your primary key: open Keys and Recovery there and approve this key, ' +
        `${shortKey(identity.pubkeyHex)}.`,
    );
  }, [identity, port, userId]);

  const revoke = useCallback(
    (targetKeyId: string) => {
      if (!port || !userId || !identity) return;
      void run(`revoke:${targetKeyId}`, async () => {
        const result = await revokeDeviceKey({ port, userId, actor: identity, targetKeyId });
        if (!result.ok) return custodyErrorMessage(result.code, result.detail);
        setNotice('That device key is revoked and is recorded publicly on your profile.');
        return null;
      });
    },
    [identity, port, run, userId],
  );

  const cancelRecovery = useCallback(
    (requestId: string) => {
      if (!port || !userId || !identity) return;
      void run('cancel-recovery', async () => {
        const result = await cancelKeyRecoveryWithKey({ port, userId, actor: identity, requestId });
        if (!result.ok) return custodyErrorMessage(result.code, result.detail);
        setNotice(
          result.status === 'frozen'
            ? 'Recovery cancelled. That is the second cancelled attempt in 90 days, so recovery without a kit is now frozen on this account.'
            : 'Recovery cancelled. Your current signing key is unchanged.',
        );
        return null;
      });
    },
    [identity, port, run, userId],
  );

  const readEscrow = useCallback(() => {
    if (!port) return;
    void run('escrow-get', async () => {
      const result = await fetchEscrowedKit(port);
      if (!result.ok) return custodyErrorMessage(result.code, result.detail);
      setImportText(JSON.stringify(result.envelope));
      setNotice(
        `Loaded encrypted kit version ${result.version}. Enter your recovery code below to open it. This read is now in your access log.`,
      );
      return null;
    });
  }, [port, run]);

  /* ---------------------------------- render --------------------------------- */

  if (state.status === 'loading') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Keys and Recovery" />
        <LoadingView />
      </View>
    );
  }
  if (state.status === 'not-configured') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Keys and Recovery" />
        <MessageView
          title="Not connected to a MyNews server yet"
          body="Signing keys live on your device, but managing them needs a MyNews server. None is configured for this build."
        />
      </View>
    );
  }
  if (state.status === 'error') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Keys and Recovery" />
        <MessageView title="Could not load your keys" body={state.message} />
      </View>
    );
  }

  const custody = state.custody;
  const posture = custodyPosture(custody, identity?.pubkeyHex ?? null);
  const copy = postureCopy(posture);
  const rows = toKeyRows(custody, identity?.pubkeyHex ?? null);
  const noKit = noKitRecoveryCopy(custody);
  const hasKit = custody.escrow.length > 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Keys and Recovery" />
      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.banner,
            copy.tone === 'ok' && styles.bannerOk,
            copy.tone === 'warn' && styles.bannerWarn,
            copy.tone === 'bad' && styles.bannerBad,
          ]}
        >
          <Text style={styles.bannerTitle}>{copy.title}</Text>
          <Text style={styles.bannerBody}>{copy.body}</Text>
        </View>

        {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}
        {notice ? <Text style={styles.success}>{notice}</Text> : null}

        {/* Recovery in flight */}
        {custody.recovery?.status === 'pending' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recovery in progress</Text>
            <Text style={styles.cardBody}>
              Opened {absoluteDate(custody.recovery.requestedAt)}, and it can complete after{' '}
              {absoluteDate(custody.recovery.unlocksAt)}. It would replace your signing key with{' '}
              {shortKey(custody.recovery.newPubkey)}.
            </Text>
            <Text style={styles.cardMeta}>
              If you did not start this, cancel it now. Cancelling from this device needs a key that
              is still active here.
            </Text>
            <SecondaryButton
              label="Cancel this recovery"
              onPress={() => cancelRecovery(custody.recovery!.id)}
              loading={busy === 'cancel-recovery'}
              disabled={!identity}
            />
          </View>
        ) : null}

        {/* Device list */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Keys on this account</Text>
          {rows.length === 0 ? (
            <Text style={styles.cardBody}>No signing keys yet.</Text>
          ) : (
            rows.map((row) => (
              <View key={row.id} style={styles.keyRow}>
                <Text style={styles.keyLabel}>{row.label}</Text>
                <Text style={styles.keyValue}>{shortKey(row.pubkey)}</Text>
                <Text style={styles.cardMeta}>
                  {row.active ? 'Active' : 'Retired'} · {row.detail}
                </Text>
                {row.canRevoke ? (
                  <SecondaryButton
                    label="Revoke this device"
                    onPress={() => revoke(row.id)}
                    loading={busy === `revoke:${row.id}`}
                  />
                ) : null}
              </View>
            ))
          )}
          {posture === 'signing-blocked' ? (
            <SecondaryButton label="How do I approve this device?" onPress={approveThisDevice} />
          ) : null}
        </View>

        {/* Recovery kit */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recovery kit</Text>
          {kit.step === 'idle' ? (
            <>
              <Text style={styles.cardBody}>
                A recovery kit is your own encrypted copy of your signing key. With the kit and its
                code you can publish again from a new device. Without either, you cannot.
              </Text>
              {hasKit ? (
                <Text style={styles.cardMeta}>
                  A kit is stored on the server (version {custody.escrow[0]!.version}, saved{' '}
                  {absoluteDate(custody.escrow[0]!.createdAt)}). Creating a new one adds a version
                  and never overwrites the old one.
                </Text>
              ) : null}
              <PrimaryButton
                label={hasKit ? 'Create a new recovery kit' : 'Create a recovery kit'}
                onPress={startKit}
                disabled={!identity}
              />
              {!identity ? (
                <Text style={styles.cardMeta}>
                  This device has no signing key loaded yet, so there is nothing to put in a kit.
                </Text>
              ) : null}
            </>
          ) : null}

          {kit.step === 'show-code' ? (
            <>
              <Text style={styles.cardBody}>
                This is your recovery code. It is shown once and is never stored by the app. Write it
                down or put it in a password manager now.
              </Text>
              <Text style={styles.code}>{formatRecoveryCode(kit.code)}</Text>
              <PrimaryButton
                label="I have saved it"
                onPress={() => setKit({ step: 'confirm-code', code: kit.code, typed: '' })}
              />
            </>
          ) : null}

          {kit.step === 'confirm-code' ? (
            <>
              <Text style={styles.cardBody}>
                Type the code back to confirm you really have it. This is the last point at which
                you can see it again.
              </Text>
              <TextInput
                accessibilityLabel="Recovery code, typed back to confirm"
                value={kit.typed}
                onChangeText={(typed) => {
                  setKit({ ...kit, typed });
                  setError(null);
                }}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                placeholderTextColor={tokens.textTertiary}
                style={styles.input}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <PrimaryButton label="Confirm and create kit" onPress={confirmKit} />
              <SecondaryButton
                label="Show the code again"
                onPress={() => setKit({ step: 'show-code', code: kit.code })}
              />
            </>
          ) : null}

          {kit.step === 'done' ? (
            <>
              <Text style={styles.cardBody}>
                Your kit is encrypted with that code. Export it somewhere durable. You can also let
                the server hold the encrypted file, which it cannot open.
              </Text>
              <PrimaryButton label="Export kit file" onPress={() => void exportKit()} />
              {kit.escrowed ? (
                <Text style={styles.success}>Stored on the server, encrypted.</Text>
              ) : (
                <SecondaryButton
                  label="Also store the encrypted kit on the server"
                  onPress={escrowKit}
                  loading={busy === 'escrow'}
                />
              )}
              <SecondaryButton label="Done" onPress={() => setKit({ step: 'idle' })} />
            </>
          ) : null}
        </View>

        {/* Import / restore */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Restore from a kit</Text>
          <Text style={styles.cardBody}>
            Paste a kit file and enter its recovery code to get signing back on this device.
          </Text>
          {hasKit ? (
            <SecondaryButton
              label="Load the kit stored on the server"
              onPress={readEscrow}
              loading={busy === 'escrow-get'}
            />
          ) : null}
          <TextInput
            accessibilityLabel="Recovery kit file contents"
            value={importText}
            onChangeText={setImportText}
            placeholder="Paste the kit file contents"
            placeholderTextColor={tokens.textTertiary}
            style={[styles.input, styles.inputTall]}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            accessibilityLabel="Recovery code"
            value={importCode}
            onChangeText={setImportCode}
            placeholder="Recovery code"
            placeholderTextColor={tokens.textTertiary}
            style={styles.input}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <PrimaryButton
            label="Restore signing on this device"
            onPress={() => importKit(importText, importCode)}
            disabled={importText.trim() === '' || importCode.trim() === ''}
            loading={busy === 'import'}
          />
        </View>

        {/* Rotation */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rotate your signing key</Text>
          <Text style={styles.cardBody}>
            Replace your key with a new one, for instance if you think this device was compromised.
            Your old revisions stay verifiable; the old key just cannot sign anything new.
          </Text>
          <SecondaryButton
            label="Rotate now"
            onPress={rotate}
            loading={busy === 'rotate'}
            disabled={!identity || posture === 'signing-blocked'}
          />
          {hasKit ? (
            <Text style={styles.cardMeta}>
              After rotating, create a new recovery kit: your existing kit holds the old key.
            </Text>
          ) : null}
        </View>

        {/* No-kit recovery */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lost the kit and every device?</Text>
          <Text style={styles.cardBody}>{noKit.body}</Text>
          {noKit.available ? (
            <Text style={styles.cardMeta}>
              Start this from the sign-in screen on the device you want to publish from.
            </Text>
          ) : null}
        </View>

        {/* Escrow access log */}
        {custody.escrowAccess.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recovery kit access log</Text>
            <Text style={styles.cardBody}>
              Every time the encrypted kit is stored or read, it is recorded here, so a quiet read of
              your backup is impossible.
            </Text>
            {custody.escrowAccess.map((entry, index) => (
              <View key={index} style={styles.keyRow}>
                <Text style={styles.keyLabel}>
                  {entry.action === 'put'
                    ? 'Stored'
                    : entry.action === 'get'
                      ? 'Read'
                      : 'Read refused'}
                </Text>
                <Text style={styles.cardMeta}>
                  {absoluteDate(entry.createdAt)} · {entry.detail}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Plain-language explanation */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How this works</Text>
          {CUSTODY_EXPLANATION.map((paragraph) => (
            <Text key={paragraph} style={styles.cardBody}>
              {paragraph}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 20, paddingBottom: 48, gap: 14 },
  banner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  bannerOk: { borderColor: tokens.success, backgroundColor: 'rgba(48, 209, 88, 0.10)' },
  bannerWarn: { borderColor: tokens.accent, backgroundColor: tokens.accentDim },
  bannerBad: { borderColor: tokens.danger, backgroundColor: 'rgba(255, 180, 171, 0.12)' },
  bannerTitle: { color: tokens.text, fontSize: 16, fontWeight: '800' },
  bannerBody: { color: tokens.textSecondary, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: tokens.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    color: tokens.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardBody: { color: tokens.textSecondary, fontSize: 14, lineHeight: 20 },
  cardMeta: { color: tokens.textTertiary, fontSize: 13, lineHeight: 19 },
  keyRow: {
    borderTopColor: tokens.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    gap: 4,
  },
  keyLabel: { color: tokens.text, fontSize: 14, fontWeight: '700' },
  keyValue: {
    color: tokens.accent,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  code: {
    color: tokens.accent,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.2,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },
  input: {
    backgroundColor: tokens.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    color: tokens.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputTall: { minHeight: 96, textAlignVertical: 'top' },
  error: { color: tokens.danger, fontSize: 13, lineHeight: 19 },
  success: { color: tokens.success, fontSize: 13, lineHeight: 19, fontWeight: '600' },
});
