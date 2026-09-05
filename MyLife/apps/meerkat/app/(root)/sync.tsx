// Sync screen (MK-008): pair devices, run a manual relay session, watch real
// sessions land. The pad is the bellwether: edit it here, sync, and the same
// text appears on the paired device. Every number on this screen comes from
// the engine or the sync_ tables; nothing is simulated.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { encodeMeerkatPairingCode, formatMeerkatPairingCode } from '@mylife/sync';
import { loadNativeNearbyModule } from '@mylife/meerkat-native-transport';
import { useSync } from './providers/SyncProvider';
import { useMeerkatDatabase } from './providers/DatabaseProvider';
import { getSetting, setSetting } from './data/db';
import { RELAY_PHRASE_SETTING_KEY, RELAY_URL_SETTING_KEY } from './data/sync-core';
import {
  IN_PERSON_NEEDS_DEV_BUILD_LINE,
  IN_PERSON_PAIR_ENTRY_HINT,
  IN_PERSON_PAIR_ENTRY_TITLE,
} from './data/proximity-ceremony-view-core';
import { Button, CopyRow, HonestNotice, Mono, Panel, SectionHeader } from './components/kit';
import { AdoptServerPanel, ConnectionStatusCard } from './components/ConnectionStatusCard';
import { AutoConnectCard } from './components/AutoConnectCard';
import { type MkColors, MK_MONO, MK_RADIUS, shortHex } from './theme/tokens';
import { useAppThemeColors, useMkStyles } from './providers/AppThemeProvider';

export default function SyncScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const {
    ready, initError, status, pad, savePad, myPairingJson, pairWithJson,
    publishFriendCode, pairWithFriendCode,
    getPeerSas, isPeerSasVerified, confirmPeerSas, isPeerRevoked, revokePeer,
    pairedDevices, sessions, rungStats, runRelaySession,
    runLanSession, lanPort, startLanListening, stopLanListening, discoveredPeers,
  } = useSync();

  // Plan 53: whether the native Nearby module exists on this build. Null in
  // Expo Go; the pair-in-person entry then shows honest copy, never a dead control.
  const nearbyAvailable = useMemo(() => loadNativeNearbyModule() !== null, []);

  const [draft, setDraft] = useState('');
  const [pairInput, setPairInput] = useState('');
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairShareMessage, setPairShareMessage] = useState<string | null>(null);
  const [relayUrl, setRelayUrl] = useState(() => getSetting(db, RELAY_URL_SETTING_KEY) ?? 'ws://');
  const [phrase, setPhrase] = useState(() => getSetting(db, RELAY_PHRASE_SETTING_KEY) ?? '');
  const [busy, setBusy] = useState<'initiate' | 'listen' | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [lanHost, setLanHost] = useState('');
  const [lanPortInput, setLanPortInput] = useState('42420');
  const [lanBusy, setLanBusy] = useState<'connect' | 'listen' | null>(null);
  const [lanError, setLanError] = useState<string | null>(null);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [myFriendCode, setMyFriendCode] = useState<string | null>(null);
  const [friendBusy, setFriendBusy] = useState<'publish' | 'pair' | null>(null);
  const [friendError, setFriendError] = useState<string | null>(null);
  const [friendCopyMessage, setFriendCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(pad?.body ?? '');
  }, [pad?.body]);

  // Friendly label for a session's peer, from the trusted paired-device list
  // only (a session row's peer is always a device we paired with). Unknown ->
  // short hex. A name is never proof of identity; the SAS emoji do that.
  const peerNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const device of pairedDevices) {
      if (device.displayName) map.set(device.deviceId, device.displayName);
    }
    return map;
  }, [pairedDevices]);
  const sessionPeerName = useCallback(
    (deviceId: string): string => peerNames.get(deviceId) ?? shortHex(deviceId),
    [peerNames],
  );
  const myPairingCode = useMemo(
    () => encodeMeerkatPairingCode(myPairingJson),
    [myPairingJson],
  );
  const formattedPairingCode = useMemo(
    () => formatMeerkatPairingCode(myPairingCode),
    [myPairingCode],
  );

  const peer = pairedDevices[0] ?? null;
  const canRunSession =
    ready && busy === null && peer !== null
    && relayUrl.trim().startsWith('ws') && phrase.trim().length > 0;

  const onPair = useCallback(() => {
    const error = pairWithJson(pairInput.trim());
    setPairError(error);
    if (!error) setPairInput('');
  }, [pairInput, pairWithJson]);

  const onCopyPairingCode = useCallback(() => {
    Clipboard.setStringAsync(myPairingCode)
      .then(() => setPairShareMessage('Pairing code copied.'))
      .catch(() => setPairShareMessage('Could not copy. The pairing code was not copied.'));
  }, [myPairingCode]);

  const onSharePairingCode = useCallback(() => {
    Share.share({
      message: `Pair with me in Meerkat:\n${myPairingCode}`,
    })
      .then(() => setPairShareMessage('Share sheet opened.'))
      .catch(() => setPairShareMessage('Could not open share sheet. Pairing code was not sent.'));
  }, [myPairingCode]);

  const relayReady = relayUrl.trim().startsWith('ws');

  const onPublishCode = useCallback(() => {
    setSetting(db, RELAY_URL_SETTING_KEY, relayUrl.trim());
    setFriendBusy('publish');
    setFriendError(null);
    setFriendCopyMessage(null);
    setMyFriendCode(null);
    publishFriendCode(relayUrl)
      .then((code) => setMyFriendCode(code))
      .catch((error: unknown) => {
        setFriendError(error instanceof Error ? error.message : 'Could not publish friend code.');
      })
      .finally(() => setFriendBusy(null));
  }, [db, relayUrl, publishFriendCode]);

  const onPairByCode = useCallback(() => {
    setSetting(db, RELAY_URL_SETTING_KEY, relayUrl.trim());
    setFriendBusy('pair');
    setFriendError(null);
    pairWithFriendCode(relayUrl, friendCodeInput)
      .then((error) => {
        setFriendError(error);
        if (!error) setFriendCodeInput('');
      })
      .catch((error: unknown) => {
        setFriendError(error instanceof Error ? error.message : 'Could not resolve friend code.');
      })
      .finally(() => setFriendBusy(null));
  }, [db, relayUrl, friendCodeInput, pairWithFriendCode]);

  const onRunSession = useCallback(
    (role: 'initiate' | 'listen') => {
      if (!peer) return;
      setSetting(db, RELAY_URL_SETTING_KEY, relayUrl.trim());
      setSetting(db, RELAY_PHRASE_SETTING_KEY, phrase.trim());
      setBusy(role);
      setSessionError(null);
      runRelaySession({ relayUrl, phrase, peerDeviceId: peer.deviceId, role })
        .catch((error: unknown) => {
          setSessionError(error instanceof Error ? error.message : 'Session failed.');
        })
        .finally(() => setBusy(null));
    },
    [db, peer, phrase, relayUrl, runRelaySession],
  );

  const onLanListenToggle = useCallback(() => {
    setLanBusy('listen');
    setLanError(null);
    const action = lanPort === null
      ? startLanListening(Number(lanPortInput) || 0).then(() => undefined)
      : stopLanListening();
    action
      .catch((error: unknown) => {
        setLanError(error instanceof Error ? error.message : 'LAN listener failed.');
      })
      .finally(() => setLanBusy(null));
  }, [lanPort, lanPortInput, startLanListening, stopLanListening]);

  const onLanConnect = useCallback(() => {
    if (!peer) return;
    setLanBusy('connect');
    setLanError(null);
    runLanSession({ host: lanHost, port: Number(lanPortInput) || 0, peerDeviceId: peer.deviceId })
      .catch((error: unknown) => {
        setLanError(error instanceof Error ? error.message : 'LAN session failed.');
      })
      .finally(() => setLanBusy(null));
  }, [lanHost, lanPortInput, peer, runLanSession]);

  const canLanConnect =
    ready && lanBusy === null && peer !== null
    && lanHost.trim().length > 0 && Number(lanPortInput) > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Sync</Text>
          <CopyRow label="Close" onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/me'); }} accessibilityLabel="Close sync" />
        </View>

        <ConnectionStatusCard lanPort={lanPort} />

        <AdoptServerPanel />

        <Panel>
          <SectionHeader title="Engine" />
          <Text style={styles.statusText}>
            {ready ? `State: ${status.state}` : initError ? `Engine failed to start: ${initError}` : 'Starting engine...'}
            {status.pendingChanges > 0 ? `  ·  ${status.pendingChanges} pending` : ''}
          </Text>
          <Text style={styles.statusMeta}>
            {status.lastSyncAt
              ? `Last sync ${new Date(status.lastSyncAt).toLocaleString()}`
              : 'No sync has completed on this device yet.'}
          </Text>
        </Panel>

        <AutoConnectCard />

        <Panel>
          <SectionHeader
            title="Sync pad"
            hint="Save here, then sync with a safety-verified device linked as your own. Friends cannot read this pad."
          />
          <TextInput
            style={styles.padInput}
            multiline
            value={draft}
            onChangeText={setDraft}
            placeholder="Write something to sync..."
            placeholderTextColor={c.textTertiary}
            accessibilityLabel="Sync pad text"
          />
          <Button
            title="Save pad"
            onPress={() => savePad(draft)}
            disabled={!ready || draft === (pad?.body ?? '')}
          />
          {pad ? (
            <Text style={styles.statusMeta}>
              Saved {new Date(pad.updated_at).toLocaleString()}
            </Text>
          ) : null}
        </Panel>

        <Panel>
          <SectionHeader title="Pairing" hint="Copy or share this code once per device pair" />
          <Text style={styles.fieldLabel}>This device&apos;s pairing code</Text>
          <View style={styles.pairCodeCard}>
            <Mono>{formattedPairingCode}</Mono>
          </View>
          <View style={styles.buttonRow}>
            <View style={styles.buttonCell}>
              <Button title="Copy code" variant="secondary" onPress={onCopyPairingCode} />
            </View>
            <View style={styles.buttonCell}>
              <Button title="Share" variant="secondary" onPress={onSharePairingCode} />
            </View>
          </View>
          {pairShareMessage ? <Text style={styles.statusMeta}>{pairShareMessage}</Text> : null}
          {/* Plan 53: the same proximity ceremony pairs own devices, replacing
              copy-paste MKPAIR1 codes when both devices are together. */}
          <Text style={styles.fieldLabel}>{IN_PERSON_PAIR_ENTRY_TITLE}</Text>
          {nearbyAvailable ? (
            <>
              <Text style={styles.statusMeta}>{IN_PERSON_PAIR_ENTRY_HINT}</Text>
              <Button
                title={IN_PERSON_PAIR_ENTRY_TITLE}
                variant="secondary"
                onPress={() => router.push('/add-in-person?mode=device')}
              />
            </>
          ) : (
            <Text style={styles.statusMeta}>{IN_PERSON_NEEDS_DEV_BUILD_LINE}</Text>
          )}
          <Text style={styles.fieldLabel}>Paste the other device&apos;s pairing code</Text>
          <TextInput
            style={styles.pairInput}
            multiline
            value={pairInput}
            onChangeText={setPairInput}
            placeholder="MKPAIR1-..."
            placeholderTextColor={c.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Peer pairing code"
          />
          <Button title="Pair device" onPress={onPair} disabled={pairInput.trim().length === 0} />
          {pairError ? <Text style={styles.errorText}>{pairError}</Text> : null}
          {pairedDevices.map((device) => {
            const revoked = isPeerRevoked(device.deviceId);
            const sas = revoked ? null : getPeerSas(device.deviceId);
            const verified = isPeerSasVerified(device.deviceId);
            return (
              <View key={device.deviceId} style={styles.peerCard}>
                <View style={styles.peerRow}>
                  <Text style={styles.peerName}>{device.displayName}</Text>
                  <Text style={styles.peerKey}>{shortHex(device.deviceId)}</Text>
                </View>
                {revoked ? (
                  <Text style={styles.peerRevoked}>⛔ Revoked. This device can no longer sync here</Text>
                ) : (
                  <>
                    {sas ? (
                      <>
                        <Text style={styles.sasEmoji}>{sas.emoji.join('  ')}</Text>
                        {verified ? (
                          <Text style={styles.sasVerified}>✓ Verified out of band</Text>
                        ) : (
                          <Button
                            title="These 5 emoji match my friend's"
                            variant="secondary"
                            onPress={() => confirmPeerSas(device.deviceId)}
                          />
                        )}
                      </>
                    ) : null}
                    <Button
                      title="Revoke this device"
                      variant="danger"
                      onPress={() => revokePeer(device.deviceId, 'revoked by user')}
                    />
                  </>
                )}
              </View>
            );
          })}
          {pairedDevices.length > 0 ? (
            <HonestNotice text="Compare the five emoji with your friend out loud. Matching emoji prove your pairing was not intercepted at first contact. Required before a sensitive module can share into a group; the demo pad is not sensitive." />
          ) : (
            <HonestNotice text="Exchange signed pairing codes out of band. Unsigned or tampered codes are rejected. Short friend codes below are easier for manual typing, but they require a connection server." />
          )}
        </Panel>

        <Panel>
          <SectionHeader
            title="Pair by friend code"
            hint="No copy/paste: publish a code on the relay, your friend types it in"
          />
          <Button
            title={friendBusy === 'publish' ? 'Publishing...' : 'Publish my friend code'}
            variant="secondary"
            onPress={onPublishCode}
            disabled={!ready || friendBusy !== null || !relayReady}
          />
          {myFriendCode ? (
            <>
              <Text style={styles.friendCode}>{myFriendCode}</Text>
              <CopyRow
                label="Copy code"
                onPress={() => {
                  Clipboard.setStringAsync(myFriendCode)
                    .then(() => setFriendCopyMessage('Friend code copied.'))
                    .catch(() => setFriendCopyMessage('Could not copy. The friend code was not copied.'));
                }}
              />
              {friendCopyMessage ? <Text style={styles.statusMeta}>{friendCopyMessage}</Text> : null}
            </>
          ) : null}
          <Text style={styles.fieldLabel}>Enter a friend&apos;s code</Text>
          <TextInput
            style={styles.fieldInput}
            value={friendCodeInput}
            onChangeText={setFriendCodeInput}
            placeholder="MEER-XXXX-XXXX-XXXX"
            placeholderTextColor={c.textTertiary}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Friend code"
          />
          <Button
            title={friendBusy === 'pair' ? 'Resolving...' : 'Resolve + pair'}
            onPress={onPairByCode}
            disabled={!ready || friendBusy !== null || !relayReady || friendCodeInput.trim().length === 0}
          />
          {friendError ? <Text style={styles.errorText}>{friendError}</Text> : null}
          <HonestNotice text="Set the connection server URL below first. A code works once, expires in 10 minutes, and publishes only an encrypted record the server cannot read, keyed by the secret half of the code you share, never a private key. Both devices still pin each other's identity on first pair." />
        </Panel>

        <Panel>
          <SectionHeader
            title="Manual session"
            hint="Both devices use the same server with the same phrase"
          />
          <Text style={styles.fieldLabel}>Connection server URL</Text>
          <TextInput
            style={styles.fieldInput}
            value={relayUrl}
            onChangeText={setRelayUrl}
            placeholder="ws://192.168.1.20:8787"
            placeholderTextColor={c.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Connection server URL"
          />
          <Text style={styles.fieldLabel}>Shared phrase</Text>
          <TextInput
            style={styles.fieldInput}
            value={phrase}
            onChangeText={setPhrase}
            placeholder="a phrase both devices type"
            placeholderTextColor={c.textTertiary}
            autoCapitalize="none"
            accessibilityLabel="Shared rendezvous phrase"
          />
          <View style={styles.buttonRow}>
            <View style={styles.buttonCell}>
              <Button
                title={busy === 'listen' ? 'Listening...' : 'Listen'}
                variant="secondary"
                onPress={() => onRunSession('listen')}
                disabled={!canRunSession}
              />
            </View>
            <View style={styles.buttonCell}>
              <Button
                title={busy === 'initiate' ? 'Syncing...' : 'Sync now'}
                onPress={() => onRunSession('initiate')}
                disabled={!canRunSession}
              />
            </View>
          </View>
          {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}
          <HonestNotice text="This is a manual session: tap Listen on one device, then Sync now on the other within a few minutes. For hands-off syncing while the app is open, turn on Automatic connections above. A connection server is a zero-knowledge meeting point that only ever sees scrambled bytes, never your messages or who you talk to; the Connection card above shows whether one is reachable. The paid tier ($4.99/mo) adds capacity, backup, public reach, and always-on history, not a different meeting point. Scheduled background sync that runs while the app is closed is still pending and off by default; you can drain messages queued for you while offline on demand from Settings > Background sync." />
        </Panel>

        <Panel>
          <SectionHeader
            title="LAN (Wi-Fi)"
            hint="Same network, no relay. Requires a development build."
          />
          <View style={styles.buttonRow}>
            <View style={styles.buttonCell}>
              <Button
                title={
                  lanBusy === 'listen'
                    ? 'Working...'
                    : lanPort !== null
                      ? `Stop listening (:${lanPort})`
                      : 'Listen on LAN'
                }
                variant="secondary"
                onPress={onLanListenToggle}
                disabled={!ready || lanBusy !== null}
              />
            </View>
          </View>
          {discoveredPeers.map((found) => (
            <CopyRow
              key={found.deviceId}
              label={`${found.displayName} · ${found.host}:${found.port}`}
              accessibilityLabel={`Use discovered peer ${found.displayName}`}
              onPress={() => {
                setLanHost(found.host);
                setLanPortInput(String(found.port));
              }}
            />
          ))}
          <Text style={styles.fieldLabel}>Peer host (IP)</Text>
          <TextInput
            style={styles.fieldInput}
            value={lanHost}
            onChangeText={setLanHost}
            placeholder="192.168.1.30"
            placeholderTextColor={c.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel="LAN peer host"
          />
          <Text style={styles.fieldLabel}>Port</Text>
          <TextInput
            style={styles.fieldInput}
            value={lanPortInput}
            onChangeText={setLanPortInput}
            placeholder="42420"
            placeholderTextColor={c.textTertiary}
            keyboardType="number-pad"
            accessibilityLabel="LAN peer port"
          />
          <Button
            title={lanBusy === 'connect' ? 'Syncing...' : 'Connect + sync'}
            onPress={onLanConnect}
            disabled={!canLanConnect}
          />
          {lanError ? <Text style={styles.errorText}>{lanError}</Text> : null}
          <HonestNotice text="One device taps Listen on LAN; the other enters its IP and port (or taps a discovered peer) and connects. If Local Network permission was denied, enable it in Settings > Privacy & Security > Local Network, or use a relay session instead." />
        </Panel>

        <Panel>
          <SectionHeader
            title="Transport rungs"
            hint="Attempts and successes from this device's real sessions. Local only, never uploaded."
          />
          {rungStats.length === 0 ? (
            <Text style={styles.statusMeta}>No sessions recorded yet.</Text>
          ) : (
            rungStats.map((rung) => (
              <View key={rung.transport} style={styles.peerRow}>
                <Text style={styles.peerName}>{rung.transport}</Text>
                <Text style={styles.sessionMeta}>
                  {rung.successes}/{rung.attempts} succeeded
                  {rung.lastAttemptAt ? `  ·  last ${new Date(rung.lastAttemptAt).toLocaleTimeString()}` : ''}
                </Text>
              </View>
            ))
          )}
        </Panel>

        <Panel>
          <SectionHeader title="Recent sessions" hint="Every row is a real recorded session" />
          {sessions.length === 0 ? (
            <Text style={styles.statusMeta}>No sessions yet.</Text>
          ) : (
            sessions.map((session) => (
              <View key={session.id} style={styles.sessionRow}>
                <View style={styles.sessionTop}>
                  <Text
                    style={[
                      styles.sessionStatus,
                      session.status !== 'completed' && styles.sessionStatusBad,
                    ]}
                  >
                    {session.status}
                  </Text>
                  <Text style={styles.sessionMeta}>{session.transport}</Text>
                </View>
                <Text style={styles.sessionMeta}>
                  peer {sessionPeerName(session.peerDeviceId)}
                  {'  ·  '}sent {session.changesSent} / received {session.changesReceived}
                  {'  ·  '}{new Date(session.startedAt).toLocaleTimeString()}
                </Text>
                {session.error ? <Text style={styles.errorText}>{session.error}</Text> : null}
              </View>
            ))
          )}
        </Panel>

        <View style={{ height: insets.bottom + 96 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  statusText: { color: c.text, fontSize: 15, fontWeight: '600' },
  statusMeta: { color: c.textTertiary, fontSize: 12 },
  padInput: {
    minHeight: 96,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    color: c.text,
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  fieldLabel: {
    color: c.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  fieldInput: {
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  pairInput: {
    minHeight: 72,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    color: c.text,
    padding: 12,
    fontSize: 12,
    fontFamily: MK_MONO,
    textAlignVertical: 'top',
  },
  pairCodeCard: {
    maxHeight: 118,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    padding: 12,
    overflow: 'hidden',
  },
  buttonRow: { flexDirection: 'row', gap: 10 },
  buttonCell: { flex: 1 },
  errorText: { color: c.danger, fontSize: 13 },
  friendCode: {
    color: c.accent,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: MK_MONO,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: 4,
  },
  peerCard: {
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    padding: 12,
    gap: 8,
  },
  peerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  peerName: { color: c.text, fontSize: 14, fontWeight: '600' },
  peerKey: { color: c.textTertiary, fontSize: 12, fontFamily: MK_MONO },
  sasEmoji: { fontSize: 28, letterSpacing: 2, textAlign: 'center', paddingVertical: 2 },
  sasVerified: { color: c.accent, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  peerRevoked: { color: c.danger, fontSize: 13, fontWeight: '700' },
  sessionRow: {
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    padding: 10,
    gap: 4,
  },
  sessionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionStatus: { color: c.success, fontSize: 13, fontWeight: '700' },
  sessionStatusBad: { color: c.warning },
  sessionMeta: { color: c.textSecondary, fontSize: 12 },
});
