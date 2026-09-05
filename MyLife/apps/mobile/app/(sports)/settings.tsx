import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, surfaceTiers } from '@mylife/ui';
import { clearOddsCache, getSetting, setSetting } from '@mylife/sports';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  getSportsNotificationPermissionStatus,
  requestSportsNotificationPermission,
  type SportsPermissionStatus,
} from '../../lib/sports-notifications';
import { SPORTS_ACCENT } from './_ui';

const ENABLED_KEY = 'sports.notifications.enabled';

function readEnabled(db: ReturnType<typeof useDatabase>): boolean {
  try {
    const rows = db.query<{ value: string }>(
      'SELECT value FROM hub_settings WHERE key = ?',
      [ENABLED_KEY],
    );
    // Default to ON so per-team toggles actually fire for new users.
    return rows[0]?.value !== '0';
  } catch {
    return true;
  }
}

function writeEnabled(db: ReturnType<typeof useDatabase>, on: boolean): void {
  db.execute(
    `INSERT OR REPLACE INTO hub_settings (key, value) VALUES (?, ?)`,
    [ENABLED_KEY, on ? '1' : '0'],
  );
}

function permissionLabel(status: SportsPermissionStatus): string {
  if (status === 'granted') return 'Granted';
  if (status === 'denied') return 'Denied';
  return 'Not determined';
}

export default function SportsSettingsScreen() {
  const db = useDatabase();
  const [enabled, setEnabled] = useState<boolean>(() => readEnabled(db));
  const [permission, setPermission] =
    useState<SportsPermissionStatus>('undetermined');
  const [checking, setChecking] = useState<boolean>(true);
  const [requesting, setRequesting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeyStored, setApiKeyStored] = useState<boolean>(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<string | null>(null);

  useEffect(() => {
    try {
      const k = getSetting(db, 'odds_api_key');
      setApiKeyStored(k !== null && k !== '');
    } catch {
      setApiKeyStored(false);
    }
  }, [db]);

  const onSaveApiKey = useCallback(() => {
    const trimmed = apiKey.trim();
    if (trimmed.length === 0) {
      setApiKeyStatus('Enter a key to save.');
      return;
    }
    try {
      setSetting(db, 'odds_api_key', trimmed);
      clearOddsCache();
      setApiKey('');
      setApiKeyStored(true);
      setApiKeyStatus('Saved.');
    } catch (err) {
      setApiKeyStatus(err instanceof Error ? err.message : 'Could not save');
    }
  }, [apiKey, db]);

  const onClearApiKey = useCallback(() => {
    try {
      setSetting(db, 'odds_api_key', null);
      clearOddsCache();
      setApiKey('');
      setApiKeyStored(false);
      setApiKeyStatus('Cleared.');
    } catch (err) {
      setApiKeyStatus(err instanceof Error ? err.message : 'Could not clear');
    }
  }, [db]);

  const refreshPermission = useCallback(async () => {
    setChecking(true);
    try {
      const s = await getSportsNotificationPermissionStatus();
      setPermission(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permission check failed');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refreshPermission();
  }, [refreshPermission]);

  const onToggle = useCallback(
    (value: boolean) => {
      setEnabled(value);
      try {
        writeEnabled(db, value);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save toggle');
      }
    },
    [db],
  );

  const onRequestPermission = useCallback(async () => {
    setRequesting(true);
    setError(null);
    try {
      const s = await requestSportsNotificationPermission();
      setPermission(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permission request failed');
    } finally {
      setRequesting(false);
    }
  }, []);

  const masterLive = enabled && permission === 'granted';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Settings</Text>
        <Text style={styles.title}>Score notifications</Text>
        <Text style={styles.subtitle}>
          Get a heads-up before your followed teams play, when the game
          ends, and during close finishes.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Score notifications</Text>
            <Text style={styles.rowSubtitle}>
              Master switch. Leave on to let each team's per-team
              settings decide what fires.
            </Text>
          </View>
          <Switch
            value={masterLive}
            onValueChange={onToggle}
            disabled={permission !== 'granted'}
            trackColor={{ false: surfaceTiers.container, true: SPORTS_ACCENT }}
            thumbColor="#0E0E13"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Permission</Text>
            <Text style={styles.rowSubtitle}>
              {checking ? 'Checking…' : permissionLabel(permission)}
            </Text>
          </View>
          {permission !== 'granted' ? (
            <Pressable
              style={styles.requestButton}
              onPress={onRequestPermission}
              disabled={requesting}
              accessibilityRole="button"
              accessibilityLabel="Request notification permission"
            >
              {requesting ? (
                <ActivityIndicator color="#0E0E13" />
              ) : (
                <Text style={styles.requestButtonText}>
                  {permission === 'denied' ? 'Open Settings' : 'Allow'}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <View style={styles.helperCard}>
        <Text style={styles.helperText}>
          Per-team notification preferences (game start, close game,
          final, trades) live on each team's detail page. Tap a team on
          the Teams tab to configure them.
        </Text>
        <Text style={styles.helperFootnote}>
          Close-game, final, and overtime alerts only fire while the
          scoreboard is open. Game-start alerts are scheduled 5 minutes
          before kickoff and fire even if the app is closed.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.rowTitle}>Odds API key</Text>
        <Text style={styles.rowSubtitle}>
          Bring your own from the-odds-api.com (free tier: 500 requests
          /month). We never store it outside this device.
        </Text>
        <Text style={styles.rowSubtitle}>
          Status: {apiKeyStored ? 'Saved on this device' : 'Not set'}
        </Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="Paste your API key"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          autoCorrect={false}
          autoCapitalize="none"
        />
        <View style={styles.apiKeyButtonRow}>
          <Pressable
            style={styles.requestButton}
            onPress={onSaveApiKey}
            accessibilityRole="button"
          >
            <Text style={styles.requestButtonText}>Save key</Text>
          </Pressable>
          <Pressable
            style={styles.clearButton}
            onPress={onClearApiKey}
            accessibilityRole="button"
          >
            <Text style={styles.clearButtonText}>Clear key</Text>
          </Pressable>
        </View>
        {apiKeyStatus ? (
          <Text style={styles.helperFootnote}>{apiKeyStatus}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 14,
  },
  heroCard: {
    gap: 8,
    padding: 20,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  rowSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  requestButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: SPORTS_ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestButtonText: {
    color: '#0E0E13',
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.lowest,
  },
  apiKeyButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  clearButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
  },
  helperCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  helperFootnote: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.85,
  },
});
