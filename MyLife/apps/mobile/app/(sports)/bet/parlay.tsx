import { useCallback, useMemo, useState } from 'react';
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
  americanToDecimal,
  combineDecimalOdds,
  decimalToAmerican,
  getBetLimits,
  insertBet,
  type BetLegType,
} from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

const LEG_TYPES: Array<{ key: BetLegType; label: string }> = [
  { key: 'moneyline', label: 'ML' },
  { key: 'spread', label: 'Spread' },
  { key: 'total', label: 'Total' },
  { key: 'prop', label: 'Prop' },
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

interface LegDraft {
  id: string;
  description: string;
  oddsSign: '+' | '-';
  oddsMagnitude: string;
  leg_type: BetLegType;
}

function makeLeg(): LegDraft {
  return {
    id: `ld_${Math.random().toString(36).slice(2, 8)}`,
    description: '',
    oddsSign: '-',
    oddsMagnitude: '110',
    leg_type: 'moneyline',
  };
}

function legToAmerican(leg: LegDraft): number | null {
  const mag = Number(leg.oddsMagnitude);
  if (!Number.isFinite(mag) || mag < 100) return null;
  return leg.oddsSign === '+' ? Math.round(mag) : -Math.round(mag);
}

function parseStakeCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function SportsParlayBuilderScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [legs, setLegs] = useState<LegDraft[]>(() => [makeLeg(), makeLeg()]);
  const [stakeText, setStakeText] = useState('');
  const [sportsbook, setSportsbook] = useState<string>('fanduel');
  const [league, setLeague] = useState<string>('nfl');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unitSizeCents = useMemo(() => getBetLimits(db).unit_size_cents, [db]);

  const legsValid = legs.every(
    (l) => legToAmerican(l) !== null && l.description.trim().length > 0,
  );

  const combinedDecimal = useMemo(() => {
    if (!legsValid || legs.length < 2) return null;
    const decimals: number[] = [];
    for (const l of legs) {
      const a = legToAmerican(l);
      if (a === null) return null;
      try {
        decimals.push(americanToDecimal(a));
      } catch {
        return null;
      }
    }
    return combineDecimalOdds(decimals);
  }, [legs, legsValid]);

  const combinedAmerican = useMemo(() => {
    if (combinedDecimal === null) return null;
    try {
      return decimalToAmerican(combinedDecimal);
    } catch {
      return null;
    }
  }, [combinedDecimal]);

  const stakeCents = useMemo(() => parseStakeCents(stakeText), [stakeText]);

  const potentialPayoutCents = useMemo(() => {
    if (stakeCents === null || combinedDecimal === null) return null;
    return Math.round(stakeCents * combinedDecimal);
  }, [stakeCents, combinedDecimal]);

  const addLeg = () => setLegs((prev) => [...prev, makeLeg()]);
  const removeLeg = (id: string) =>
    setLegs((prev) => (prev.length <= 2 ? prev : prev.filter((l) => l.id !== id)));
  const updateLeg = (id: string, patch: Partial<LegDraft>) =>
    setLegs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const canSave =
    legs.length >= 2 &&
    legsValid &&
    stakeCents !== null &&
    combinedDecimal !== null &&
    !saving;

  const save = useCallback(() => {
    if (!canSave || stakeCents === null || combinedAmerican === null) return;
    setSaving(true);
    setError(null);
    try {
      const americans = legs.map((l) => legToAmerican(l)!);
      insertBet(
        db,
        {
          sport: 'parlay',
          league,
          bet_type: 'parlay',
          description: `${legs.length}-leg parlay (${legs
            .map((l) => l.description.trim())
            .slice(0, 2)
            .join(' + ')}${legs.length > 2 ? ' + …' : ''})`,
          sportsbook,
          odds_american: combinedAmerican,
          stake_cents: stakeCents,
          units: stakeCents / unitSizeCents,
          notes_md: notes.trim() === '' ? null : notes.trim(),
        },
        legs.map((l, idx) => ({
          description: l.description.trim(),
          odds_american: americans[idx],
          leg_type: l.leg_type,
        })),
      );
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save parlay');
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    combinedAmerican,
    db,
    league,
    legs,
    notes,
    router,
    sportsbook,
    stakeCents,
    unitSizeCents,
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
        <Text style={styles.eyebrow}>Build parlay</Text>
        <Text style={styles.title}>
          {legs.length} leg{legs.length === 1 ? '' : 's'}
        </Text>

        {legs.map((leg, idx) => (
          <View key={leg.id} style={styles.legCard}>
            <View style={styles.legHeader}>
              <Text style={styles.legTag}>Leg {idx + 1}</Text>
              {legs.length > 2 ? (
                <Pressable
                  onPress={() => removeLeg(leg.id)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove leg ${idx + 1}`}
                >
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
              ) : null}
            </View>
            <TextInput
              value={leg.description}
              onChangeText={(v) => updateLeg(leg.id, { description: v })}
              placeholder="Cowboys -3.5 vs Eagles, etc."
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              multiline
            />
            <View style={styles.legTypeRow}>
              {LEG_TYPES.map((t) => {
                const active = leg.leg_type === t.key;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => updateLeg(leg.id, { leg_type: t.key })}
                    style={[styles.segment, active && styles.segmentActive]}
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
            <View style={styles.oddsRow}>
              <View style={styles.signToggle}>
                {(['+', '-'] as const).map((s) => {
                  const active = leg.oddsSign === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => updateLeg(leg.id, { oddsSign: s })}
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
                value={leg.oddsMagnitude}
                onChangeText={(v) => updateLeg(leg.id, { oddsMagnitude: v })}
                keyboardType="number-pad"
                style={[styles.input, { flex: 1 }]}
                placeholder="110"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>
        ))}

        <Pressable onPress={addLeg} style={styles.addBtn}>
          <Text style={styles.addBtnText}>＋ Add leg</Text>
        </Pressable>

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

        <Text style={styles.label}>Stake (USD)</Text>
        <TextInput
          value={stakeText}
          onChangeText={setStakeText}
          keyboardType="decimal-pad"
          placeholder="25.00"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Why you like this parlay…"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { minHeight: 70 }]}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Combined odds</Text>
          <Text style={styles.summaryValue}>
            {combinedDecimal !== null
              ? `${combinedDecimal.toFixed(2)} decimal`
              : 'Enter odds for each leg'}
          </Text>
          {combinedAmerican !== null ? (
            <Text style={styles.summaryAmerican}>
              {combinedAmerican > 0 ? '+' : ''}
              {combinedAmerican} American
            </Text>
          ) : null}
          {potentialPayoutCents !== null && stakeCents !== null ? (
            <Text style={styles.summaryPayout}>
              Pays {formatMoney(potentialPayoutCents)} on {formatMoney(stakeCents)} stake (profit{' '}
              {formatMoney(potentialPayoutCents - stakeCents)})
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {(['nfl', 'nba', 'mlb', 'nhl', 'mls', 'other'] as const).map((l) => {
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

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.footer}>
          <Pressable
            style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
            onPress={save}
            disabled={!canSave}
          >
            <Text style={styles.primaryBtnText}>
              {saving ? 'Saving…' : 'Save parlay'}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { padding: 20, paddingBottom: 160, gap: 10 },
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
  },
  legCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  legHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legTag: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  removeText: {
    color: '#E57373',
    fontSize: 22,
    fontWeight: '800',
    paddingHorizontal: 6,
  },
  input: {
    borderRadius: 12,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  legTypeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
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
    backgroundColor: surfaceTiers.lowest,
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
  addBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
  },
  addBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 8,
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
  summaryCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    marginTop: 10,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  summaryAmerican: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  summaryPayout: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
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
