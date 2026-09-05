import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
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
  getBetLimits,
  setBetLimits,
  type BetLimits,
} from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

const DAY_MS = 24 * 60 * 60 * 1000;
const MUTED = '#9F8E81';
const DANGER = '#E57373';

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function parseDollarsToCents(
  raw: string,
): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return 'invalid';
  return Math.round(n * 100);
}

function centsToDollarString(cents: number | null): string {
  if (cents === null) return '';
  return (cents / 100).toString();
}

function formatCooldownPill(until: number | null): string {
  if (until === null || until <= Date.now()) return 'None';
  return `Active until ${new Date(until).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })}`;
}

function toDateInputString(ms: number | null): string {
  if (ms === null) return '';
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateInputToMs(iso: string): number | null {
  const trimmed = iso.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  const ms = dt.getTime();
  if (!Number.isFinite(ms)) return null;
  return ms;
}

export default function SportsBettingLimitsScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [limits, setLimits] = useState<BetLimits | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [dailyInput, setDailyInput] = useState<string>('');
  const [weeklyInput, setWeeklyInput] = useState<string>('');
  const [unitInput, setUnitInput] = useState<string>('');
  const [customDate, setCustomDate] = useState<string>('');

  const reload = useCallback(() => {
    try {
      const next = getBetLimits(db);
      setLimits(next);
      setDailyInput(centsToDollarString(next.daily_cents));
      setWeeklyInput(centsToDollarString(next.weekly_cents));
      setUnitInput(centsToDollarString(next.unit_size_cents));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load limits');
    }
  }, [db]);

  useEffect(() => {
    reload();
  }, [reload]);

  const cooldownActive = useMemo(
    () =>
      limits?.cooldown_until != null && limits.cooldown_until > Date.now(),
    [limits],
  );

  const applyPatch = useCallback(
    (patch: Parameters<typeof setBetLimits>[1]) => {
      setError(null);
      startTransition(() => {
        try {
          setBetLimits(db, patch);
          reload();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Save failed');
        }
      });
    },
    [db, reload],
  );

  const onSaveDaily = useCallback(() => {
    const parsed = parseDollarsToCents(dailyInput);
    if (parsed === 'invalid') {
      setError('Enter a whole-dollar amount, or leave blank to clear.');
      return;
    }
    applyPatch({ daily_cents: parsed });
  }, [dailyInput, applyPatch]);

  const onClearDaily = useCallback(() => {
    setDailyInput('');
    applyPatch({ daily_cents: null });
  }, [applyPatch]);

  const onSaveWeekly = useCallback(() => {
    const parsed = parseDollarsToCents(weeklyInput);
    if (parsed === 'invalid') {
      setError('Enter a whole-dollar amount, or leave blank to clear.');
      return;
    }
    applyPatch({ weekly_cents: parsed });
  }, [weeklyInput, applyPatch]);

  const onClearWeekly = useCallback(() => {
    setWeeklyInput('');
    applyPatch({ weekly_cents: null });
  }, [applyPatch]);

  const onSaveUnit = useCallback(() => {
    const parsed = parseDollarsToCents(unitInput);
    if (parsed === 'invalid' || parsed === null || parsed < 1) {
      setError('Unit size must be at least $0.01.');
      return;
    }
    applyPatch({ unit_size_cents: parsed });
  }, [unitInput, applyPatch]);

  const onPreset = useCallback(
    (days: number) => {
      applyPatch({ cooldown_until: Date.now() + days * DAY_MS });
    },
    [applyPatch],
  );

  const onClearPause = useCallback(() => {
    setCustomDate('');
    applyPatch({ cooldown_until: null });
  }, [applyPatch]);

  const onSaveCustomDate = useCallback(() => {
    const ms = parseDateInputToMs(customDate);
    if (ms === null) {
      setError('Enter a date as YYYY-MM-DD.');
      return;
    }
    if (ms <= Date.now()) {
      setError('Pick a date in the future.');
      return;
    }
    applyPatch({ cooldown_until: ms });
  }, [customDate, applyPatch]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Betting</Text>
          <Text style={styles.title}>Betting limits</Text>
        </View>
      </View>

      <Text style={styles.intro}>
        Set your own guardrails. Limits are private, stored on this device,
        and never shared.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Daily limit</Text>
        <Text style={styles.cardHelper}>
          When your day's wagers approach 80% of this, the dashboard shows a
          soft banner.
        </Text>
        <View style={styles.inputRow}>
          <Text style={styles.inputPrefix}>$</Text>
          <TextInput
            style={styles.input}
            value={dailyInput}
            onChangeText={setDailyInput}
            placeholder="None"
            placeholderTextColor={MUTED}
            keyboardType="decimal-pad"
            inputMode="decimal"
            editable={!isPending}
          />
          <Pressable
            style={styles.saveChip}
            onPress={onSaveDaily}
            disabled={isPending}
            accessibilityRole="button"
          >
            <Text style={styles.saveChipText}>Save</Text>
          </Pressable>
        </View>
        {limits?.daily_cents !== null && limits?.daily_cents !== undefined ? (
          <Pressable
            style={styles.clearRow}
            onPress={onClearDaily}
            disabled={isPending}
            accessibilityRole="button"
          >
            <Text style={styles.clearRowText}>Clear daily limit</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Weekly limit</Text>
        <Text style={styles.cardHelper}>Rolling 7-day window from now.</Text>
        <View style={styles.inputRow}>
          <Text style={styles.inputPrefix}>$</Text>
          <TextInput
            style={styles.input}
            value={weeklyInput}
            onChangeText={setWeeklyInput}
            placeholder="None"
            placeholderTextColor={MUTED}
            keyboardType="decimal-pad"
            inputMode="decimal"
            editable={!isPending}
          />
          <Pressable
            style={styles.saveChip}
            onPress={onSaveWeekly}
            disabled={isPending}
            accessibilityRole="button"
          >
            <Text style={styles.saveChipText}>Save</Text>
          </Pressable>
        </View>
        {limits?.weekly_cents !== null && limits?.weekly_cents !== undefined ? (
          <Pressable
            style={styles.clearRow}
            onPress={onClearWeekly}
            disabled={isPending}
            accessibilityRole="button"
          >
            <Text style={styles.clearRowText}>Clear weekly limit</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Unit size</Text>
        <Text style={styles.cardHelper}>
          Used to convert stakes into units (e.g. 3U = 3 x unit size). Defaults
          to $10.
        </Text>
        <View style={styles.inputRow}>
          <Text style={styles.inputPrefix}>$</Text>
          <TextInput
            style={styles.input}
            value={unitInput}
            onChangeText={setUnitInput}
            placeholder="10"
            placeholderTextColor={MUTED}
            keyboardType="decimal-pad"
            inputMode="decimal"
            editable={!isPending}
          />
          <Pressable
            style={styles.saveChip}
            onPress={onSaveUnit}
            disabled={isPending}
            accessibilityRole="button"
          >
            <Text style={styles.saveChipText}>Save</Text>
          </Pressable>
        </View>
        {limits ? (
          <Text style={styles.currentValue}>
            Current: {formatMoney(limits.unit_size_cents)}
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Pause logging</Text>
        <Text style={styles.cardHelper}>
          While paused, the dashboard hides log CTAs and new bets are blocked.
        </Text>
        <View style={styles.pillRow}>
          <View
            style={[
              styles.statusPill,
              cooldownActive
                ? { borderColor: SPORTS_ACCENT }
                : { borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                cooldownActive ? { color: SPORTS_ACCENT } : { color: MUTED },
              ]}
            >
              {formatCooldownPill(limits?.cooldown_until ?? null)}
            </Text>
          </View>
        </View>
        <View style={styles.presetRow}>
          <Pressable
            style={styles.presetBtn}
            onPress={() => onPreset(1)}
            disabled={isPending}
            accessibilityRole="button"
          >
            <Text style={styles.presetBtnText}>Pause 24h</Text>
          </Pressable>
          <Pressable
            style={styles.presetBtn}
            onPress={() => onPreset(7)}
            disabled={isPending}
            accessibilityRole="button"
          >
            <Text style={styles.presetBtnText}>Pause 7 days</Text>
          </Pressable>
          <Pressable
            style={styles.presetBtn}
            onPress={() => onPreset(30)}
            disabled={isPending}
            accessibilityRole="button"
          >
            <Text style={styles.presetBtnText}>Pause 30 days</Text>
          </Pressable>
        </View>
        <Text style={styles.subCardLabel}>Custom date</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { marginLeft: 0 }]}
            value={customDate}
            onChangeText={setCustomDate}
            placeholder={toDateInputString(Date.now() + 14 * DAY_MS)}
            placeholderTextColor={MUTED}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isPending}
          />
          <Pressable
            style={styles.saveChip}
            onPress={onSaveCustomDate}
            disabled={isPending}
            accessibilityRole="button"
          >
            <Text style={styles.saveChipText}>Set</Text>
          </Pressable>
        </View>
        <Text style={styles.cardHelper}>
          Format: YYYY-MM-DD (e.g. {toDateInputString(Date.now() + 14 * DAY_MS)}).
        </Text>
        {cooldownActive ? (
          <Pressable
            style={[styles.clearRow, { borderColor: DANGER }]}
            onPress={onClearPause}
            disabled={isPending}
            accessibilityRole="button"
          >
            <Text style={[styles.clearRowText, { color: DANGER }]}>
              Clear pause
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.supportCard}>
        <Text style={styles.supportText}>
          If betting is hurting you, call or text the National Problem Gambling
          Helpline: 1-800-GAMBLER.
        </Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '700',
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
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  intro: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    color: DANGER,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  subCardLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  cardHelper: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputPrefix: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.lowest,
  },
  saveChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SPORTS_ACCENT,
  },
  saveChipText: {
    color: '#0E0E13',
    fontSize: 13,
    fontWeight: '800',
  },
  clearRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  clearRowText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  currentValue: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  pillRow: {
    flexDirection: 'row',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.lowest,
  },
  presetBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  supportCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: colors.border,
  },
  supportText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
