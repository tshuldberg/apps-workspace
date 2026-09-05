import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  deleteFantasyLeague,
  getFantasyLeague,
  listFantasyTransactions,
  updateFantasyLeague,
  updateFantasyLeagueRecord,
  type FantasyLeague,
  type FantasyPlayer,
  type FantasyTransaction,
} from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function parseCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseIntOrZero(raw: string): number {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseFloatOrZero(raw: string): number {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

export default function SportsFantasyDetailScreen() {
  const router = useRouter();
  const db = useDatabase();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const leagueId = typeof id === 'string' ? id : null;

  const [league, setLeague] = useState<FantasyLeague | null>(null);
  const [transactions, setTransactions] = useState<FantasyTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  // edit state
  const [editingHeader, setEditingHeader] = useState(false);
  const [teamNameDraft, setTeamNameDraft] = useState('');
  const [winsDraft, setWinsDraft] = useState('');
  const [lossesDraft, setLossesDraft] = useState('');
  const [tiesDraft, setTiesDraft] = useState('');
  const [posDraft, setPosDraft] = useState('');
  const [pfDraft, setPfDraft] = useState('');
  const [paDraft, setPaDraft] = useState('');
  const [buyInDraft, setBuyInDraft] = useState('');
  const [prizeDraft, setPrizeDraft] = useState('');

  // roster editing
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPos, setNewPlayerPos] = useState('');
  const [newPlayerTeam, setNewPlayerTeam] = useState('');

  // notes
  const [notesDraft, setNotesDraft] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);

  const reload = useCallback(() => {
    if (!leagueId) return;
    try {
      const l = getFantasyLeague(db, leagueId);
      setLeague(l);
      if (l) {
        setTeamNameDraft(l.team_name);
        setWinsDraft(String(l.record_wins));
        setLossesDraft(String(l.record_losses));
        setTiesDraft(String(l.record_ties));
        setPosDraft(l.standings_position === null ? '' : String(l.standings_position));
        setPfDraft(String(l.points_for));
        setPaDraft(String(l.points_against));
        setBuyInDraft(l.buy_in_cents === null ? '' : String(l.buy_in_cents / 100));
        setPrizeDraft(l.prize_cents === null ? '' : String(l.prize_cents / 100));
        setNotesDraft(l.notes_md ?? '');
        setNotesDirty(false);
        setTransactions(listFantasyTransactions(db, leagueId).slice(0, 10));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load league');
    }
  }, [db, leagueId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveHeader = useCallback(() => {
    if (!league) return;
    try {
      const posNum = posDraft.trim() === '' ? null : parseInt(posDraft, 10);
      updateFantasyLeague(db, league.id, {
        team_name: teamNameDraft.trim() || league.team_name,
        buy_in_cents: buyInDraft.trim() === '' ? null : parseCents(buyInDraft) ?? null,
        prize_cents: prizeDraft.trim() === '' ? null : parseCents(prizeDraft) ?? null,
      });
      updateFantasyLeagueRecord(db, league.id, {
        wins: parseIntOrZero(winsDraft),
        losses: parseIntOrZero(lossesDraft),
        ties: parseIntOrZero(tiesDraft),
        pointsFor: parseFloatOrZero(pfDraft),
        pointsAgainst: parseFloatOrZero(paDraft),
        standingsPosition:
          posNum !== null && Number.isFinite(posNum) ? posNum : null,
      });
      setEditingHeader(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }, [
    buyInDraft,
    db,
    league,
    lossesDraft,
    paDraft,
    pfDraft,
    posDraft,
    prizeDraft,
    reload,
    teamNameDraft,
    tiesDraft,
    winsDraft,
  ]);

  const addPlayer = useCallback(() => {
    if (!league) return;
    const name = newPlayerName.trim();
    const position = newPlayerPos.trim();
    if (!name || !position) return;
    const newPlayer: FantasyPlayer = {
      name,
      position,
      team: newPlayerTeam.trim() || null,
    };
    try {
      updateFantasyLeague(db, league.id, {
        roster: [...league.roster, newPlayer],
      });
      setNewPlayerName('');
      setNewPlayerPos('');
      setNewPlayerTeam('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add player');
    }
  }, [db, league, newPlayerName, newPlayerPos, newPlayerTeam, reload]);

  const removePlayer = useCallback(
    (index: number) => {
      if (!league) return;
      try {
        const next = league.roster.filter((_, i) => i !== index);
        updateFantasyLeague(db, league.id, { roster: next });
        reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not remove player');
      }
    },
    [db, league, reload],
  );

  const saveNotes = useCallback(() => {
    if (!league) return;
    try {
      updateFantasyLeague(db, league.id, {
        notes_md: notesDraft.trim() === '' ? null : notesDraft,
      });
      setNotesDirty(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save notes');
    }
  }, [db, league, notesDraft, reload]);

  const confirmDelete = useCallback(() => {
    if (!league) return;
    Alert.alert(
      'Delete this league?',
      'This permanently removes the league and all its logged transactions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteFantasyLeague(db, league.id);
              router.back();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : 'Could not delete league',
              );
            }
          },
        },
      ],
    );
  }, [db, league, router]);

  const recordLabel = useMemo(() => {
    if (!league) return '';
    return league.record_ties > 0
      ? `${league.record_wins}-${league.record_losses}-${league.record_ties}`
      : `${league.record_wins}-${league.record_losses}`;
  }, [league]);

  if (!league) {
    return (
      <View style={[styles.screen, styles.emptyState]}>
        <Text style={styles.emptyText}>{error ?? 'Loading league…'}</Text>
      </View>
    );
  }

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
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Text style={styles.eyebrow}>{league.platform.toUpperCase()}</Text>
            <Pressable
              onPress={() => setEditingHeader((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Edit league"
            >
              <Text style={styles.linkText}>
                {editingHeader ? 'Done' : 'Edit'}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.title}>{league.league_name}</Text>
          {editingHeader ? (
            <TextInput
              value={teamNameDraft}
              onChangeText={setTeamNameDraft}
              style={styles.inlineInput}
              placeholder="Team name"
              placeholderTextColor={colors.textSecondary}
            />
          ) : (
            <Text style={styles.subtitle}>{league.team_name}</Text>
          )}
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{league.format.toUpperCase()}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{league.sport.toUpperCase()}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{league.season}</Text>
            </View>
          </View>
        </View>

        {/* Record */}
        <View style={styles.card}>
          <Text style={styles.label}>Record</Text>
          {editingHeader ? (
            <View style={styles.recordEditRow}>
              <View style={styles.recordCell}>
                <Text style={styles.recordCellLabel}>W</Text>
                <TextInput
                  value={winsDraft}
                  onChangeText={setWinsDraft}
                  keyboardType="number-pad"
                  style={styles.inlineInput}
                />
              </View>
              <View style={styles.recordCell}>
                <Text style={styles.recordCellLabel}>L</Text>
                <TextInput
                  value={lossesDraft}
                  onChangeText={setLossesDraft}
                  keyboardType="number-pad"
                  style={styles.inlineInput}
                />
              </View>
              <View style={styles.recordCell}>
                <Text style={styles.recordCellLabel}>T</Text>
                <TextInput
                  value={tiesDraft}
                  onChangeText={setTiesDraft}
                  keyboardType="number-pad"
                  style={styles.inlineInput}
                />
              </View>
            </View>
          ) : (
            <Text style={styles.bigRecord}>{recordLabel}</Text>
          )}

          <View style={styles.metricsRow}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Position</Text>
              {editingHeader ? (
                <TextInput
                  value={posDraft}
                  onChangeText={setPosDraft}
                  keyboardType="number-pad"
                  style={styles.inlineInput}
                  placeholder="—"
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <Text style={styles.metricValue}>
                  {league.standings_position === null
                    ? '—'
                    : `#${league.standings_position}`}
                </Text>
              )}
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Points for</Text>
              {editingHeader ? (
                <TextInput
                  value={pfDraft}
                  onChangeText={setPfDraft}
                  keyboardType="decimal-pad"
                  style={styles.inlineInput}
                />
              ) : (
                <Text style={styles.metricValue}>
                  {league.points_for.toFixed(1)}
                </Text>
              )}
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Points against</Text>
              {editingHeader ? (
                <TextInput
                  value={paDraft}
                  onChangeText={setPaDraft}
                  keyboardType="decimal-pad"
                  style={styles.inlineInput}
                />
              ) : (
                <Text style={styles.metricValue}>
                  {league.points_against.toFixed(1)}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Buy-in</Text>
              {editingHeader ? (
                <TextInput
                  value={buyInDraft}
                  onChangeText={setBuyInDraft}
                  keyboardType="decimal-pad"
                  style={styles.inlineInput}
                  placeholder="—"
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <Text style={styles.metricValue}>
                  {league.buy_in_cents === null
                    ? '—'
                    : formatMoney(league.buy_in_cents)}
                </Text>
              )}
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Prize</Text>
              {editingHeader ? (
                <TextInput
                  value={prizeDraft}
                  onChangeText={setPrizeDraft}
                  keyboardType="decimal-pad"
                  style={styles.inlineInput}
                  placeholder="—"
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <Text style={styles.metricValue}>
                  {league.prize_cents === null
                    ? '—'
                    : formatMoney(league.prize_cents)}
                </Text>
              )}
            </View>
          </View>

          {editingHeader ? (
            <View style={styles.editRow}>
              <Pressable onPress={saveHeader} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setEditingHeader(false);
                  reload();
                }}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Roster */}
        <View style={styles.card}>
          <Text style={styles.label}>Roster ({league.roster.length})</Text>
          {league.roster.length === 0 ? (
            <Text style={styles.muted}>No players on roster yet.</Text>
          ) : (
            league.roster.map((p, idx) => (
              <View key={`${p.name}-${idx}`} style={styles.rosterRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rosterName}>{p.name}</Text>
                  <Text style={styles.rosterMeta}>
                    {p.position}
                    {p.team ? ` · ${p.team}` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => removePlayer(idx)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${p.name}`}
                >
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            ))
          )}
          <View style={styles.addPlayerBlock}>
            <Text style={styles.sublabel}>Add player</Text>
            <TextInput
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              placeholder="Name"
              placeholderTextColor={colors.textSecondary}
              style={styles.inlineInput}
            />
            <TextInput
              value={newPlayerPos}
              onChangeText={setNewPlayerPos}
              placeholder="Position (QB, RB, PG…)"
              placeholderTextColor={colors.textSecondary}
              style={styles.inlineInput}
            />
            <TextInput
              value={newPlayerTeam}
              onChangeText={setNewPlayerTeam}
              placeholder="Team (optional)"
              placeholderTextColor={colors.textSecondary}
              style={styles.inlineInput}
            />
            <Pressable
              onPress={addPlayer}
              style={[
                styles.saveBtn,
                !(newPlayerName.trim() && newPlayerPos.trim()) &&
                  styles.primaryBtnDisabled,
              ]}
              disabled={!(newPlayerName.trim() && newPlayerPos.trim())}
            >
              <Text style={styles.saveBtnText}>Add</Text>
            </Pressable>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            value={notesDraft}
            onChangeText={(v) => {
              setNotesDraft(v);
              setNotesDirty(true);
            }}
            style={styles.notesInput}
            multiline
            textAlignVertical="top"
            placeholder="Reasoning, matchup notes, trade targets…"
            placeholderTextColor={colors.textSecondary}
          />
          {notesDirty ? (
            <View style={styles.editRow}>
              <Pressable onPress={saveNotes} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save notes</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setNotesDraft(league.notes_md ?? '');
                  setNotesDirty(false);
                }}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Transactions */}
        <View style={styles.card}>
          <Text style={styles.label}>Recent transactions</Text>
          {transactions.length === 0 ? (
            <Text style={styles.muted}>
              No transactions yet. Drafts, trades, and waivers will appear here.
            </Text>
          ) : (
            transactions.map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View style={styles.txHead}>
                  <View style={styles.txTypeBadge}>
                    <Text style={styles.txTypeText}>
                      {tx.type.toUpperCase().replace('_', ' ')}
                    </Text>
                  </View>
                  <Text style={styles.txDate}>
                    {new Date(tx.happened_at).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <Text style={styles.txDescription}>{tx.description}</Text>
              </View>
            ))
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable onPress={confirmDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>Delete league</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    padding: 20,
    paddingBottom: 160,
    gap: 14,
  },
  emptyState: { padding: 20 },
  emptyText: { color: '#D6C3B5', fontSize: 14 },
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
  linkText: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  subtitle: { color: '#D6C3B5', fontSize: 14 },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.lowest,
  },
  chipText: {
    color: '#D6C3B5',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  label: {
    color: '#D6C3B5',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sublabel: {
    color: '#9F8E81',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  muted: { color: '#9F8E81', fontSize: 13 },
  bigRecord: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  recordEditRow: { flexDirection: 'row', gap: 8 },
  recordCell: { flex: 1, gap: 4 },
  recordCellLabel: {
    color: '#9F8E81',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
  },
  metricsRow: { flexDirection: 'row', gap: 10 },
  metricCell: { flex: 1, gap: 4 },
  metricLabel: {
    color: '#9F8E81',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
  },
  metricValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  inlineInput: {
    borderRadius: 10,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
  },
  editRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
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
  primaryBtnDisabled: { opacity: 0.5 },
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
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rosterName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  rosterMeta: { color: '#9F8E81', fontSize: 12, marginTop: 2 },
  removeText: {
    color: '#E57373',
    fontSize: 12,
    fontWeight: '700',
  },
  addPlayerBlock: {
    marginTop: 6,
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  txRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  txHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SPORTS_ACCENT,
  },
  txTypeText: {
    color: SPORTS_ACCENT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  txDate: { color: '#9F8E81', fontSize: 12 },
  txDescription: { color: colors.text, fontSize: 13, lineHeight: 18 },
  errorText: { color: '#F87171', fontSize: 13 },
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
