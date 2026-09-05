import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BG_ACCENT,
  BG_CARD_RADIUS,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  createEnvelope,
  getCategoryGroups,
  setEnvelopeGroup,
  type CategoryGroup,
} from '@mylife/budget';
import {
  BudgetButton,
  BudgetHeadline,
  BudgetInput,
  BudgetScreen,
  BudgetSectionLabel,
  parseBudgetCurrencyInput,
} from '../../components/budget/BudgetPhase2Primitives';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const ICON_OPTIONS = ['🛒', '🏠', '🚗', '🍽️', '✈️', '🎁', '💡', '💳'];

export default function BudgetCreateEnvelopeScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICON_OPTIONS[0]);
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [rolloverEnabled, setRolloverEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const rows = getCategoryGroups(db, false);
      setGroups(rows);
      if (rows[0]) {
        setSelectedGroupId(rows[0].id);
      }
    } catch (groupError) {
      setError(groupError instanceof Error ? groupError.message : 'Failed to load groups.');
    }
  }, [db]);

  const selectedGroupName = useMemo(
    () => groups.find((group) => group.id === selectedGroupId)?.name ?? 'No group',
    [groups, selectedGroupId],
  );

  const handleCreate = () => {
    if (submitting) {
      return;
    }

    const parsedBudget = parseBudgetCurrencyInput(monthlyBudget);
    if (!name.trim()) {
      setError('Envelope name is required.');
      return;
    }
    if (parsedBudget === null || parsedBudget < 0) {
      setError('Enter a valid target amount.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const newId = uuid();
      createEnvelope(db, newId, {
        name: name.trim(),
        icon: icon.trim() || null,
        monthly_budget: parsedBudget,
        rollover_enabled: rolloverEnabled ? 1 : 0,
      });
      if (selectedGroupId) {
        setEnvelopeGroup(db, newId, selectedGroupId);
      }
      router.replace(`/(budget)/${newId}?refresh=${Date.now()}` as never);
    } catch (createError) {
      const message =
        createError instanceof Error ? createError.message : 'Failed to create envelope.';
      setError(message.toLowerCase().includes('unique') ? 'That envelope name already exists.' : message);
      setSubmitting(false);
    }
  };

  return (
    <BudgetScreen>
      <BudgetHeadline
        title="New Envelope"
        subtitle="Create a new budget category with a monthly target and group."
      />

      <GlassCard style={styles.card}>
        <BudgetSectionLabel>Name</BudgetSectionLabel>
        <BudgetInput
          value={name}
          onChangeText={setName}
          placeholder="Groceries"
          autoFocus
        />

        <BudgetSectionLabel>Icon</BudgetSectionLabel>
        <View style={styles.iconGrid}>
          {ICON_OPTIONS.map((choice) => {
            const selected = icon === choice;
            return (
              <BudgetButton
                key={choice}
                label={choice}
                tone={selected ? 'primary' : 'secondary'}
                onPress={() => setIcon(choice)}
                style={styles.iconButton}
              />
            );
          })}
        </View>

        <BudgetSectionLabel>Monthly target</BudgetSectionLabel>
        <BudgetInput
          value={monthlyBudget}
          onChangeText={setMonthlyBudget}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />

        <BudgetSectionLabel>Category group</BudgetSectionLabel>
        <View style={styles.groupGrid}>
          {groups.length === 0 ? (
            <Text style={styles.helperText}>No category groups yet. You can assign one later.</Text>
          ) : (
            groups.map((group) => (
              <BudgetButton
                key={group.id}
                label={group.name}
                tone={selectedGroupId === group.id ? 'primary' : 'secondary'}
                onPress={() => setSelectedGroupId(group.id)}
              />
            ))
          )}
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Rollover</Text>
            <Text style={styles.switchDescription}>
              Carry extra money forward instead of resetting each month.
            </Text>
          </View>
          <Switch
            value={rolloverEnabled}
            onValueChange={setRolloverEnabled}
            trackColor={{ true: BG_MONEY, false: BG_SURFACES.high }}
            thumbColor={BG_TEXT}
          />
        </View>

        <GlassCard style={styles.goalNotice}>
          <BudgetSectionLabel>Linked goal</BudgetSectionLabel>
          <Text style={styles.helperText}>
            Goal linking happens after save from the goals workflow. Create the envelope first,
            then attach a savings goal from its detail screen.
          </Text>
        </GlassCard>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Text style={styles.summaryText}>
          {selectedGroupName} • {rolloverEnabled ? 'Rollover on' : 'Rollover off'}
        </Text>
        <View style={styles.actions}>
          <BudgetButton tone="ghost" label="Cancel" onPress={() => router.back()} />
          <BudgetButton
            label={submitting ? 'Creating…' : 'Create Envelope'}
            onPress={handleCreate}
            disabled={submitting}
          />
        </View>
      </GlassCard>
    </BudgetScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconButton: {
    minWidth: 68,
  },
  groupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: BG_SURFACES.low,
    borderRadius: BG_CARD_RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  switchCopy: {
    flex: 1,
    gap: 4,
  },
  switchTitle: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: BG_TEXT,
  },
  switchDescription: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 17,
    color: BG_TEXT_SECONDARY,
  },
  goalNotice: {
    gap: 8,
    backgroundColor: `${BG_ACCENT}14`,
  },
  helperText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: BG_TEXT_SECONDARY,
  },
  errorText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: '#FFB4AB',
  },
  summaryText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT_TERTIARY,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});
