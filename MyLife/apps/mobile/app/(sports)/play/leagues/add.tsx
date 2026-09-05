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
import { createRecLeague } from '@mylife/sports';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../../_ui';

const SPORTS: Array<{ key: string; label: string }> = [
  { key: 'basketball', label: 'Basketball' },
  { key: 'soccer', label: 'Soccer' },
  { key: 'softball', label: 'Softball' },
  { key: 'baseball', label: 'Baseball' },
  { key: 'volleyball', label: 'Volleyball' },
  { key: 'hockey', label: 'Hockey' },
  { key: 'tennis', label: 'Tennis' },
  { key: 'other', label: 'Other' },
];

export default function SportsRecLeagueAddScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [sport, setSport] = useState<string>('softball');
  const [leagueName, setLeagueName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [season, setSeason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    leagueName.trim() !== '' && teamName.trim() !== '' && season.trim() !== '';

  const handleSave = useCallback(() => {
    if (!canSave) {
      setError('League, team, and season are required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const row = createRecLeague(db, {
        sport,
        league_name: leagueName.trim(),
        team_name: teamName.trim(),
        season: season.trim(),
        notes_md: notes.trim() === '' ? null : notes.trim(),
      });
      router.replace(`/(sports)/play/leagues/${row.id}` as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create league');
    } finally {
      setSaving(false);
    }
  }, [canSave, db, leagueName, notes, router, season, sport, teamName]);

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
        <Text style={styles.eyebrow}>Rec leagues</Text>
        <Text style={styles.title}>Add league</Text>

        <Text style={styles.label}>Sport</Text>
        <View style={styles.wrapRow}>
          {SPORTS.map((s) => {
            const active = sport === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSport(s.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>League name</Text>
        <TextInput
          value={leagueName}
          onChangeText={setLeagueName}
          placeholder="Monday Night Softball"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>Team name</Text>
        <TextInput
          value={teamName}
          onChangeText={setTeamName}
          placeholder="The Benchwarmers"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>Season</Text>
        <TextInput
          value={season}
          onChangeText={setSeason}
          placeholder="Spring 2026"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Field location, teammates, league rules…"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, styles.notesInput]}
          multiline
          textAlignVertical="top"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.footer}>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, (saving || !canSave) && styles.disabled]}
            onPress={handleSave}
            disabled={saving || !canSave}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>
              {saving ? 'Saving…' : 'Save league'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 180,
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
    color: colors.textSecondary,
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
  notesInput: {
    minHeight: 90,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
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
  primaryBtnText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.5,
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
