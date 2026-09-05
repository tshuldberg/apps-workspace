import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  createFantasyLeague,
  type FantasyFormat,
  type FantasyPlatform,
} from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

const PLATFORMS: Array<{ key: FantasyPlatform; label: string }> = [
  { key: 'espn', label: 'ESPN' },
  { key: 'yahoo', label: 'Yahoo' },
  { key: 'sleeper', label: 'Sleeper' },
  { key: 'nfl', label: 'NFL' },
  { key: 'cbs', label: 'CBS' },
  { key: 'custom', label: 'Custom' },
];

const SPORTS = ['nfl', 'nba', 'mlb', 'nhl', 'mls'] as const;

const FORMATS: Array<{ key: FantasyFormat; label: string }> = [
  { key: 'redraft', label: 'Redraft' },
  { key: 'dynasty', label: 'Dynasty' },
  { key: 'keeper', label: 'Keeper' },
  { key: 'bestball', label: 'Best ball' },
];

function parseBuyInCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default function SportsFantasyAddScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [platform, setPlatform] = useState<FantasyPlatform>('espn');
  const [sport, setSport] = useState<string>('nfl');
  const [leagueName, setLeagueName] = useState('');
  const [season, setSeason] = useState('');
  const [format, setFormat] = useState<FantasyFormat>('redraft');
  const [teamName, setTeamName] = useState('');
  const [buyInText, setBuyInText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    !saving &&
    leagueName.trim().length > 0 &&
    season.trim().length > 0 &&
    teamName.trim().length > 0;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const buyInCents = parseBuyInCents(buyInText);
      const created = createFantasyLeague(db, {
        platform,
        sport,
        league_name: leagueName.trim(),
        season: season.trim(),
        format,
        team_name: teamName.trim(),
        buy_in_cents: buyInCents,
      });
      router.replace(
        `/(sports)/fantasy/${encodeURIComponent(created.id)}` as never,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save league');
      setSaving(false);
    }
  }, [
    buyInText,
    canSave,
    db,
    format,
    leagueName,
    platform,
    router,
    season,
    sport,
    teamName,
  ]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>Add league</Text>
        <Text style={styles.title}>New fantasy league</Text>

        <Text style={styles.label}>Platform</Text>
        <View style={styles.segmentRow}>
          {PLATFORMS.map((p) => {
            const active = platform === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => setPlatform(p.key)}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    active && styles.segmentTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Sport</Text>
        <View style={styles.segmentRow}>
          {SPORTS.map((s) => {
            const active = sport === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSport(s)}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    active && styles.segmentTextActive,
                  ]}
                >
                  {s.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>League name</Text>
        <TextInput
          value={leagueName}
          onChangeText={setLeagueName}
          placeholder="Monday Night Dynasty"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>Season</Text>
        <TextInput
          value={season}
          onChangeText={setSeason}
          placeholder="2025 or 2025-26"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>Format</Text>
        <View style={styles.segmentRow}>
          {FORMATS.map((f) => {
            const active = format === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFormat(f.key)}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    active && styles.segmentTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Team name</Text>
        <TextInput
          value={teamName}
          onChangeText={setTeamName}
          placeholder="The Gridiron Ghosts"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>Buy-in (USD, optional)</Text>
        <TextInput
          value={buyInText}
          onChangeText={setBuyInText}
          keyboardType="decimal-pad"
          placeholder="50"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.footer}>
          <Pressable
            style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>
              {saving ? 'Saving…' : 'Save league'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    padding: 20,
    paddingBottom: 160,
    gap: 10,
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
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  label: {
    color: '#D6C3B5',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  input: {
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  segment: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentActive: {
    backgroundColor: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
  },
  segmentText: {
    color: '#D6C3B5',
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#0E0E13',
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: SPORTS_ACCENT,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
});
