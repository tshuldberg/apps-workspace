// Automatic connections card (Plan 29 Phase 2-3, item 12). Opt-in automatic
// dialing over real recorded sessions. Every line here is honest: the toggle
// reflects the stored flag, the last-round line reports real counts from the
// engine, and "Sync now" runs one real composed round. Nothing claims a peer is
// online or that data moved unless a real session did it.

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSync } from '../providers/SyncProvider';
import { Button, HonestNotice, Panel, SectionHeader } from './kit';
import { describeAutoConnectRound, describeAutoConnectRecovery } from '../data/auto-connect-core';
import { type MkColors } from '../theme/tokens';
import { useMkStyles } from '../providers/AppThemeProvider';

export function AutoConnectCard() {
  const styles = useMkStyles(makeStyles);
  const {
    ready,
    autoConnectEnabled,
    setAutoConnect,
    lastAutoConnectRound,
    lastAutoConnectError,
    autoConnectRound,
  } = useSync();
  const recovery = describeAutoConnectRecovery(lastAutoConnectRound);
  const [running, setRunning] = useState(false);


  const onRunNow = useCallback(() => {
    setRunning(true);
    void autoConnectRound('manual').catch(() => undefined).finally(() => setRunning(false));
  }, [autoConnectRound]);

  return (
    <Panel>
      <SectionHeader
        title="Automatic connections"
        hint="Try to catch up with your contacts while Meerkat is open"
      />
      <View style={styles.row}>
        <Text style={styles.rowLabel}>
          {autoConnectEnabled ? 'Automatic dialing is on' : 'Automatic dialing is off'}
        </Text>
        <Button
          title={autoConnectEnabled ? 'Turn off' : 'Turn on'}
          variant="secondary"
          onPress={() => setAutoConnect(!autoConnectEnabled)}
        />
      </View>
      {recovery ? <HonestNotice text={recovery} /> : null}
      {lastAutoConnectError ? <HonestNotice text={lastAutoConnectError} /> : null}
      <Text style={styles.lastRun}>{describeAutoConnectRound(lastAutoConnectRound)}</Text>
      <Button
        title={running ? 'Catching up...' : 'Catch up now'}
        onPress={onRunNow}
        disabled={!ready || running}
      />
      <HonestNotice text="When on, Meerkat runs one round each time you open the app and when a paired device appears on your Wi-Fi: it drains anything queued for you, then dials your paired devices over a reachable connection server (and over local Wi-Fi on a development build). Each dial is a real sync session; a device that does not answer is retried later with a growing delay. This runs only while the app is open. It is not background sync and never turns background sync on. Numbers below come from real sessions, never a simulated dial or an online count." />
    </Panel>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { flex: 1, color: c.text, fontSize: 14, fontWeight: '600' },
  lastRun: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
});
