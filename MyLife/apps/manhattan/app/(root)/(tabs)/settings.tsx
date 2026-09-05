import { useCallback, useState } from 'react';
import { View, ScrollView, TextInput, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, Card, Button } from '@mylife/ui';
import { getSetting, setSetting } from '@mylife/manhattan';
import { useManhattanDatabase, useResetDatabase } from '../providers/DatabaseProvider';

const KEY_DEFAULT_CITY = 'defaultCity';

export default function SettingsScreen() {
  const db = useManhattanDatabase();
  const resetDatabase = useResetDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [defaultCity, setDefaultCity] = useState('');

  const refresh = useCallback(() => {
    setDefaultCity(getSetting(db, KEY_DEFAULT_CITY) ?? '');
  }, [db]);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const handleCityBlur = () => {
    setSetting(db, KEY_DEFAULT_CITY, defaultCity.trim());
  };

  const handleReset = () => {
    Alert.alert(
      'Reset local data?',
      'This permanently deletes all pins, plans, events, and settings on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => { void resetDatabase(); },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="heading" style={styles.title}>Settings</Text>

      <Card>
        <Text variant="label" color="#9F8E81">Default city</Text>
        <TextInput
          style={styles.input}
          value={defaultCity}
          onChangeText={setDefaultCity}
          onBlur={handleCityBlur}
          placeholder="New York"
          placeholderTextColor="#52443A"
        />
      </Card>

      <Card>
        <Text variant="label" color="#9F8E81">Data & Sync</Text>
        <Text variant="caption" color="#9F8E81" style={styles.dataSyncCaption}>
          Cloud sync, app lock, and unlock status.
        </Text>
        <View style={styles.dataSyncButton}>
          <Button
            title="Open Data & Sync"
            variant="secondary"
            onPress={() => router.push('/(root)/settings/data-sync')}
          />
        </View>
      </Card>

      <View style={styles.danger}>
        <Button title="Reset local data" variant="danger" onPress={handleReset} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131318' },
  content: { padding: 20, gap: 16 },
  title: { marginBottom: 4 },
  input: {
    backgroundColor: '#1F1F25',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#E4E1E9',
    fontSize: 16,
    marginTop: 8,
  },
  dataSyncCaption: { marginTop: 4 },
  dataSyncButton: { marginTop: 12 },
  danger: { marginTop: 8 },
});
