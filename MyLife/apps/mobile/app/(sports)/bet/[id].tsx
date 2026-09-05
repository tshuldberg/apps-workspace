import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  deleteBet,
  getBet,
  listBetLegs,
  settleBet,
  settleBetLeg,
  updateBetNotes,
  type Bet,
  type BetLeg,
  type BetResult,
} from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

const RESULT_COLOR: Record<string, string> = {
  won: SPORTS_ACCENT,
  lost: '#E57373',
  push: '#9F8E81',
  void: '#9F8E81',
  pending: '#9F8E81',
};

const RESULT_OPTIONS: Array<{ key: BetResult; label: string }> = [
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'push', label: 'Push' },
  { key: 'void', label: 'Void' },
];

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatSignedMoney(cents: number): string {
  const sign = cents > 0 ? '+' : '';
  return `${sign}${formatMoney(cents)}`;
}

export default function SportsBetDetailScreen() {
  const router = useRouter();
  const db = useDatabase();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const betId = typeof id === 'string' ? id : null;

  const [bet, setBet] = useState<Bet | null>(null);
  const [legs, setLegs] = useState<BetLeg[]>([]);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!betId) return;
    try {
      const b = getBet(db, betId);
      setBet(b);
      setLegs(b ? listBetLegs(db, betId) : []);
      setNotesDraft(b?.notes_md ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load bet');
    }
  }, [betId, db]);

  useEffect(() => {
    reload();
  }, [reload]);

  const confirmSettle = (result: BetResult) => {
    if (!bet) return;
    if (bet.bet_type === 'parlay') {
      Alert.alert(
        'Settle legs individually',
        'Parlay parents settle automatically after every leg is marked. Use the leg buttons below.',
      );
      return;
    }
    Alert.alert(
      `Mark as ${result}?`,
      'You can change this later if needed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            try {
              settleBet(db, bet.id, result);
              reload();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : 'Could not settle bet',
              );
            }
          },
        },
      ],
    );
  };

  const settleLeg = (legId: string, result: BetResult) => {
    try {
      settleBetLeg(db, legId, result);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not settle leg');
    }
  };

  const confirmDelete = () => {
    if (!bet) return;
    Alert.alert(
      'Delete this bet?',
      'This permanently removes the record from your journal.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteBet(db, bet.id);
              router.back();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : 'Could not delete bet',
              );
            }
          },
        },
      ],
    );
  };

  const saveNotes = () => {
    if (!bet) return;
    try {
      updateBetNotes(db, bet.id, notesDraft.trim() === '' ? null : notesDraft);
      setEditingNotes(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save notes');
    }
  };

  if (!bet) {
    return (
      <View style={[styles.screen, styles.emptyState]}>
        <Text style={styles.emptyText}>
          {error ?? 'Loading bet…'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>{bet.bet_type.toUpperCase()}</Text>
          <View
            style={[
              styles.statusBadge,
              { borderColor: RESULT_COLOR[bet.result] },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                { color: RESULT_COLOR[bet.result] },
              ]}
            >
              {bet.result.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.title}>{bet.description}</Text>
        <Text style={styles.subtitle}>
          Placed{' '}
          {new Date(bet.placed_at).toLocaleDateString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}{' '}
          at {bet.sportsbook}
        </Text>
      </View>

      <View style={styles.metricsCard}>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Stake</Text>
          <Text style={styles.metricValue}>{formatMoney(bet.stake_cents)}</Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Odds</Text>
          <Text style={styles.metricValue}>
            {bet.odds_american > 0 ? '+' : ''}
            {bet.odds_american}
          </Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Payout</Text>
          <Text style={styles.metricValue}>
            {formatMoney(bet.potential_payout_cents)}
          </Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>P/L</Text>
          <Text
            style={[
              styles.metricValue,
              {
                color:
                  bet.profit_loss_cents > 0
                    ? SPORTS_ACCENT
                    : bet.profit_loss_cents < 0
                      ? '#E57373'
                      : colors.textSecondary,
              },
            ]}
          >
            {formatSignedMoney(bet.profit_loss_cents)}
          </Text>
        </View>
      </View>

      {/* Notes */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.label}>Notes</Text>
          {!editingNotes ? (
            <Pressable onPress={() => setEditingNotes(true)} hitSlop={6}>
              <Text style={styles.linkText}>Edit</Text>
            </Pressable>
          ) : null}
        </View>
        {editingNotes ? (
          <>
            <TextInput
              value={notesDraft}
              onChangeText={setNotesDraft}
              style={styles.notesInput}
              multiline
              textAlignVertical="top"
              placeholder="Why did you take this one?"
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.editRow}>
              <Pressable onPress={saveNotes} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setEditingNotes(false);
                  setNotesDraft(bet.notes_md ?? '');
                }}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={styles.notesBody}>
            {bet.notes_md ?? 'No notes yet.'}
          </Text>
        )}
      </View>

      {/* Legs */}
      {legs.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.label}>Legs</Text>
          {legs.map((leg) => (
            <View key={leg.id} style={styles.legRow}>
              <View style={styles.legInfo}>
                <Text style={styles.legDescription}>{leg.description}</Text>
                <Text style={styles.legMeta}>
                  {leg.leg_type.toUpperCase()} ·{' '}
                  {leg.odds_american > 0 ? '+' : ''}
                  {leg.odds_american}
                </Text>
              </View>
              <View style={styles.legActions}>
                {RESULT_OPTIONS.map((opt) => {
                  const active = leg.result === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => settleLeg(leg.id, opt.key)}
                      style={[
                        styles.legActionBtn,
                        active && {
                          backgroundColor: RESULT_COLOR[opt.key],
                          borderColor: RESULT_COLOR[opt.key],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.legActionText,
                          active && { color: '#0E0E13' },
                        ]}
                      >
                        {opt.label.charAt(0)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          <Text style={styles.legHelper}>
            Tap W/L/P/V to settle each leg. Parent bet recomputes automatically.
          </Text>
        </View>
      ) : null}

      {/* Settle row for singles */}
      {bet.bet_type !== 'parlay' && bet.result === 'pending' ? (
        <View style={styles.settleRow}>
          {RESULT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => confirmSettle(opt.key)}
              style={[
                styles.settleBtn,
                { borderColor: RESULT_COLOR[opt.key] },
              ]}
            >
              <Text
                style={[
                  styles.settleBtnText,
                  { color: RESULT_COLOR[opt.key] },
                ]}
              >
                Mark as {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable onPress={confirmDelete} style={styles.deleteBtn}>
        <Text style={styles.deleteBtnText}>Delete bet</Text>
      </Pressable>
    </ScrollView>
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
    gap: 14,
  },
  emptyState: {
    padding: 20,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  headerCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  metricsCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: 10,
  },
  metricCell: {
    flex: 1,
    gap: 2,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
  },
  metricValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  linkText: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
  notesBody: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  notesInput: {
    minHeight: 100,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.lowest,
    color: colors.text,
    padding: 12,
    fontSize: 14,
  },
  editRow: {
    flexDirection: 'row',
    gap: 8,
  },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: SPORTS_ACCENT,
  },
  saveBtnText: {
    color: '#0E0E13',
    fontSize: 13,
    fontWeight: '800',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  legRow: {
    gap: 6,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legInfo: { gap: 2 },
  legDescription: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  legMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  legActions: {
    flexDirection: 'row',
    gap: 6,
  },
  legActionBtn: {
    width: 36,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legActionText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  legHelper: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  settleRow: {
    gap: 8,
  },
  settleBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    backgroundColor: surfaceTiers.container,
  },
  settleBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
  },
  deleteBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E57373',
    alignItems: 'center',
    marginTop: 10,
  },
  deleteBtnText: {
    color: '#E57373',
    fontSize: 14,
    fontWeight: '700',
  },
});
