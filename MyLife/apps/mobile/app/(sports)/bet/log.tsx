import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
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
  americanToDecimal,
  getBetLimits,
  insertBet,
  sumStakesSince,
  type BetType,
} from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const BET_TYPES: Array<{ key: BetType; label: string }> = [
  { key: 'moneyline', label: 'ML' },
  { key: 'spread', label: 'Spread' },
  { key: 'total', label: 'Total' },
  { key: 'prop', label: 'Prop' },
  { key: 'future', label: 'Future' },
];

const SPORTSBOOKS: Array<{ key: string; label: string }> = [
  { key: 'fanduel', label: 'FanDuel' },
  { key: 'draftkings', label: 'DraftKings' },
  { key: 'betmgm', label: 'BetMGM' },
  { key: 'caesars', label: 'Caesars' },
  { key: 'espnbet', label: 'ESPN BET' },
  { key: 'fanatics', label: 'Fanatics' },
  { key: 'local', label: 'Local' },
  { key: 'other', label: 'Other' },
];

const LEAGUES = ['nfl', 'nba', 'mlb', 'nhl', 'mls', 'other'] as const;
const SPORT_BY_LEAGUE: Record<string, string> = {
  nfl: 'football',
  nba: 'basketball',
  mlb: 'baseball',
  nhl: 'hockey',
  mls: 'soccer',
  other: 'other',
};

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function parseStakeCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export default function SportsBetLogScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [betType, setBetType] = useState<BetType>('moneyline');
  const [league, setLeague] = useState<string>('nfl');
  const [sportsbook, setSportsbook] = useState<string>('fanduel');
  const [description, setDescription] = useState<string>('');
  const [oddsSign, setOddsSign] = useState<'+' | '-'>('-');
  const [oddsMagnitude, setOddsMagnitude] = useState<string>('110');
  const [stakeText, setStakeText] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limits = useMemo(() => getBetLimits(db), [db]);
  const unitSizeCents = limits.unit_size_cents;

  const oddsAmerican = useMemo(() => {
    const mag = Number(oddsMagnitude);
    if (!Number.isFinite(mag) || mag < 100) return null;
    return oddsSign === '+' ? Math.round(mag) : -Math.round(mag);
  }, [oddsMagnitude, oddsSign]);

  const stakeCents = useMemo(() => parseStakeCents(stakeText), [stakeText]);

  const decimalOdds = useMemo(() => {
    if (oddsAmerican === null) return null;
    try {
      return americanToDecimal(oddsAmerican);
    } catch {
      return null;
    }
  }, [oddsAmerican]);

  const potentialPayoutCents = useMemo(() => {
    if (stakeCents === null || decimalOdds === null) return null;
    return Math.round(stakeCents * decimalOdds);
  }, [stakeCents, decimalOdds]);

  const units = useMemo(() => {
    if (stakeCents === null) return null;
    return stakeCents / unitSizeCents;
  }, [stakeCents, unitSizeCents]);

  const canSave =
    oddsAmerican !== null &&
    stakeCents !== null &&
    description.trim().length > 0 &&
    !saving;

  const runSave = useCallback(
    (override: boolean) => {
      if (!canSave || oddsAmerican === null || stakeCents === null) return;
      setSaving(true);
      setError(null);
      try {
        // Allowance check inline using the same helpers the web action uses.
        const now = Date.now();
        const currentLimits = getBetLimits(db);
        if (
          currentLimits.cooldown_until !== null &&
          currentLimits.cooldown_until > now
        ) {
          setError(
            `Logging paused until ${new Date(
              currentLimits.cooldown_until,
            ).toLocaleDateString()}. Adjust in settings.`,
          );
          setSaving(false);
          return;
        }
        if (!override) {
          const dailySpent = sumStakesSince(db, startOfTodayMs());
          if (
            currentLimits.daily_cents !== null &&
            dailySpent + stakeCents > currentLimits.daily_cents
          ) {
            setSaving(false);
            Alert.alert(
              'Daily target reached',
              `You've wagered ${formatMoney(dailySpent)} today of your ${formatMoney(
                currentLimits.daily_cents,
              )} target. This bet would exceed it.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Log anyway',
                  style: 'default',
                  onPress: () => runSave(true),
                },
              ],
            );
            return;
          }
          const weeklySpent = sumStakesSince(db, now - WEEK_MS);
          if (
            currentLimits.weekly_cents !== null &&
            weeklySpent + stakeCents > currentLimits.weekly_cents
          ) {
            setSaving(false);
            Alert.alert(
              'Weekly target reached',
              `You've wagered ${formatMoney(weeklySpent)} this week of your ${formatMoney(
                currentLimits.weekly_cents,
              )} target. This bet would exceed it.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Log anyway',
                  style: 'default',
                  onPress: () => runSave(true),
                },
              ],
            );
            return;
          }
        }

        insertBet(db, {
          sport: SPORT_BY_LEAGUE[league] ?? 'other',
          league,
          bet_type: betType,
          description: description.trim(),
          sportsbook,
          odds_american: oddsAmerican,
          stake_cents: stakeCents,
          units: stakeCents / currentLimits.unit_size_cents,
          notes_md: notes.trim() === '' ? null : notes.trim(),
        });
        router.back();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save bet');
      } finally {
        setSaving(false);
      }
    },
    [
      betType,
      canSave,
      db,
      description,
      league,
      notes,
      oddsAmerican,
      router,
      sportsbook,
      stakeCents,
    ],
  );

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
        <Text style={styles.eyebrow}>Log a bet</Text>
        <Text style={styles.title}>New bet</Text>

        <Text style={styles.label}>Type</Text>
        <View style={styles.segmentRow}>
          {BET_TYPES.map((t) => {
            const active = betType === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setBetType(t.key)}
                style={[styles.segment, active && styles.segmentActive]}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.segmentText,
                    active && styles.segmentTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>League</Text>
        <View style={styles.segmentRow}>
          {LEAGUES.map((l) => {
            const active = league === l;
            return (
              <Pressable
                key={l}
                onPress={() => setLeague(l)}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    active && styles.segmentTextActive,
                  ]}
                >
                  {l.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Cowboys ML vs Eagles, 1Q spread, Mahomes O2.5 TDs…"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          multiline
        />

        <Text style={styles.label}>Sportsbook</Text>
        <View style={styles.wrapRow}>
          {SPORTSBOOKS.map((sb) => {
            const active = sportsbook === sb.key;
            return (
              <Pressable
                key={sb.key}
                onPress={() => setSportsbook(sb.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {sb.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Odds (American)</Text>
        <View style={styles.oddsRow}>
          <View style={styles.signToggle}>
            {(['+', '-'] as const).map((s) => {
              const active = oddsSign === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setOddsSign(s)}
                  style={[styles.signBtn, active && styles.signBtnActive]}
                >
                  <Text
                    style={[
                      styles.signText,
                      active && styles.signTextActive,
                    ]}
                  >
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={oddsMagnitude}
            onChangeText={setOddsMagnitude}
            keyboardType="number-pad"
            style={[styles.input, { flex: 1 }]}
            placeholder="110"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
        <Text style={styles.helper}>
          {oddsAmerican === null
            ? 'Enter at least 100 (magnitude).'
            : `${oddsSign}${oddsMagnitude} = ${decimalOdds?.toFixed(2) ?? '—'} decimal`}
        </Text>

        <Text style={styles.label}>Stake (USD)</Text>
        <TextInput
          value={stakeText}
          onChangeText={setStakeText}
          keyboardType="decimal-pad"
          placeholder="25.00"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        {stakeCents !== null ? (
          <Text style={styles.helper}>
            {units !== null ? `${units.toFixed(2)}U` : ''}
            {potentialPayoutCents !== null
              ? ` · pays ${formatMoney(potentialPayoutCents)} (profit ${formatMoney(
                  potentialPayoutCents - stakeCents,
                )})`
              : ''}
          </Text>
        ) : null}

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Reasoning, injury notes, vibes…"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, styles.notesInput]}
          multiline
          textAlignVertical="top"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.footer}>
          <Pressable
            style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
            onPress={() => runSave(false)}
            disabled={!canSave}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>
              {saving ? 'Saving…' : 'Save bet'}
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
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
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
  helper: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
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
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#0E0E13',
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
  oddsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  signToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.container,
    overflow: 'hidden',
  },
  signBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signBtnActive: {
    backgroundColor: SPORTS_ACCENT,
  },
  signText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: '800',
  },
  signTextActive: {
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
