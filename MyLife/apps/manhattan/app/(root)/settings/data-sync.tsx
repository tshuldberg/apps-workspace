import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { disableModuleLock, enableModuleLock, getModuleLock } from '@mylife/auth';
import {
  buildSourceRegistry,
  ensureSource,
  getSources,
  setSourceEnabled,
  type SourceRow,
} from '@mylife/manhattan';
import { Button, Card, Text } from '@mylife/ui';
import { useManhattanDatabase } from '../providers/DatabaseProvider';
import { useManhattanCloud } from '../providers/ManhattanCloudProvider';
import { useManhattanBilling, useManhattanUnlocked } from '../providers/ManhattanEntitlementsProvider';
import {
  isDeviceCalendarImportEnabled,
  setDeviceCalendarImportEnabled,
} from '../lib/device-calendar';

const MODULE_ID = 'manhattan';

export default function DataSyncScreen() {
  const db = useManhattanDatabase();
  const { isConfigured } = useManhattanCloud();
  const [lockEnabled, setLockEnabled] = useState(false);
  const [editingPin, setEditingPin] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sourceRows, setSourceRows] = useState<SourceRow[]>([]);
  const [calendarImportEnabled, setCalendarImportEnabledState] = useState(false);

  const sourceRegistry = useMemo(
    () => buildSourceRegistry().filter((source) =>
      source.tier === 'gap' || source.coverage.ingestKinds.includes('api')),
    [],
  );
  const sourceRowById = useMemo(() => {
    const map = new Map<string, SourceRow>();
    for (const row of sourceRows) map.set(row.id, row);
    return map;
  }, [sourceRows]);

  const refresh = useCallback(() => {
    for (const source of sourceRegistry) ensureSource(db, source.id);
    setLockEnabled(getModuleLock(db, MODULE_ID) !== null);
    setSourceRows(getSources(db));
    setCalendarImportEnabledState(isDeviceCalendarImportEnabled(db));
  }, [db, sourceRegistry]);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const unlocked = useManhattanUnlocked();
  const { isTestMode } = useManhattanBilling();

  const handleToggleSource = (id: string, enabled: boolean) => {
    setSourceEnabled(db, id, enabled);
    refresh();
  };

  const handleToggleCalendarImport = (enabled: boolean) => {
    setDeviceCalendarImportEnabled(db, enabled);
    setCalendarImportEnabledState(enabled);
  };

  const handleToggleLock = (value: boolean) => {
    if (value) {
      setEditingPin(true);
      setPin('');
      setConfirmPin('');
      setError(null);
    } else {
      disableModuleLock(db, MODULE_ID);
      setEditingPin(false);
      refresh();
    }
  };

  const handleSavePin = async () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }
    try {
      await enableModuleLock(db, MODULE_ID, pin);
    } catch {
      setError('Could not enable the lock. Try again.');
      return;
    }
    setEditingPin(false);
    setPin('');
    setConfirmPin('');
    setError(null);
    refresh();
    Alert.alert('App lock enabled', 'Manhattan will require your PIN to open.');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="heading" style={styles.title}>Data & Sync</Text>

      <Card>
        <Text variant="label" color="#9F8E81">Cloud sync</Text>
        <Text variant="body" style={styles.cardBody}>
          {isConfigured
            ? 'Cloud account connected. Sync arrives in a later update.'
            : 'Local only. Your data stays on this device.'}
        </Text>
      </Card>

      <Card>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text variant="body">Import device calendar events</Text>
            <Text variant="caption" color="#9F8E81">
              Pull upcoming events from your device calendars during calendar sync.
            </Text>
          </View>
          <Switch
            value={calendarImportEnabled}
            accessibilityLabel="Import device calendar events"
            onValueChange={handleToggleCalendarImport}
            trackColor={{ false: '#2A292F', true: '#E4572E' }}
            thumbColor="#E4E1E9"
          />
        </View>
      </Card>

      <Card>
        <Text variant="label" color="#9F8E81">Event sources</Text>
        <View style={styles.sourceList}>
          {sourceRegistry.map((source) => {
            const enabled = sourceRowById.get(source.id)?.enabled !== 0;
            const isGap = source.tier === 'gap';
            return (
              <View key={source.id} style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <Text variant="body">{source.displayName}</Text>
                  <Text variant="caption" color="#9F8E81">
                    {isGap
                      ? source.gapFlag?.note ?? 'Coming later.'
                      : source.coverage.categories.join(', ') || 'General events'}
                  </Text>
                </View>
                <Switch
                  value={!isGap && enabled}
                  accessibilityLabel={`${source.displayName} source`}
                  onValueChange={(value) => handleToggleSource(source.id, value)}
                  disabled={isGap}
                  trackColor={{ false: '#2A292F', true: '#E4572E' }}
                  thumbColor="#E4E1E9"
                />
              </View>
            );
          })}
        </View>
      </Card>

      <Card>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text variant="body">App lock</Text>
            <Text variant="caption" color="#9F8E81">
              Require a PIN to open Manhattan.
            </Text>
          </View>
          <Switch
            value={lockEnabled || editingPin}
            accessibilityLabel="App lock"
            onValueChange={handleToggleLock}
            trackColor={{ false: '#2A292F', true: '#E4572E' }}
            thumbColor="#E4E1E9"
          />
        </View>

        {editingPin && (
          <View style={styles.pinForm}>
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={(value) => { setPin(value.replace(/[^0-9]/g, '')); setError(null); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              placeholder="New PIN"
              placeholderTextColor="#52443A"
            />
            <TextInput
              style={styles.input}
              value={confirmPin}
              onChangeText={(value) => { setConfirmPin(value.replace(/[^0-9]/g, '')); setError(null); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              placeholder="Confirm PIN"
              placeholderTextColor="#52443A"
            />
            {error && (
              <Text variant="caption" color="#FFB4AB">{error}</Text>
            )}
            <Button title="Save PIN" onPress={() => void handleSavePin()} />
          </View>
        )}
      </Card>

      <Card>
        <Text variant="label" color="#9F8E81">Entitlement</Text>
        <Text variant="body" style={styles.cardBody}>
          {unlocked ? (isTestMode ? 'Unlocked (test mode)' : 'Unlocked') : 'Locked'}
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131318' },
  content: { padding: 20, paddingTop: 64, gap: 16 },
  title: { marginBottom: 4 },
  cardBody: { marginTop: 8 },
  sourceList: { marginTop: 12, gap: 14 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  switchCopy: { flex: 1, gap: 2 },
  pinForm: { marginTop: 16, gap: 12 },
  input: {
    backgroundColor: '#1F1F25',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#E4E1E9',
    fontSize: 16,
  },
});
