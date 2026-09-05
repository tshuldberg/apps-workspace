import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  getDesigns,
  getDesignsByCategory,
  getEventDesign,
  setEventDesign,
  getEvents,
} from '@mylife/rsvp';
import type { DesignCategory, InvitationDesign } from '@mylife/rsvp';
import { Card, Text, EmptyState, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { useRsvpContext } from '../../components/rsvp/RsvpContext';

const ACCENT = colors.modules.rsvp;
const CATEGORIES: DesignCategory[] = ['celebration', 'elegant', 'casual', 'seasonal', 'minimal'];

export default function InvitationDesignScreen() {
  const db = useDatabase();
  const { selectedEventId } = useRsvpContext();
  const [tick, setTick] = useState(0);
  const [filterCategory, setFilterCategory] = useState<DesignCategory | null>(null);

  const refresh = () => setTick((v) => v + 1);
  const events = useMemo(() => getEvents(db), [db, tick]);
  const eventId = selectedEventId ?? events[0]?.id ?? null;

  const allDesigns = useMemo(() => getDesigns(), []);
  const filteredDesigns = useMemo(
    () => (filterCategory ? getDesignsByCategory(filterCategory) : allDesigns),
    [filterCategory, allDesigns],
  );

  const currentDesignData = useMemo(
    () => (eventId ? getEventDesign(db, eventId) : null),
    [db, eventId, tick],
  );
  const currentDesignId = currentDesignData?.designId ?? null;

  const handleSelectDesign = (design: InvitationDesign) => {
    if (!eventId) return;
    setEventDesign(db, eventId, design.id, null);
    refresh();
  };

  if (!eventId) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyState
          icon={'\uD83C\uDF89'}
          title="No event selected"
          message="Select an event to choose an invitation design."
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Invitation Design</Text>
        {currentDesignId ? (
          <Text variant="caption" color={colors.textSecondary}>
            Current design: {currentDesignId}
          </Text>
        ) : (
          <Text variant="caption" color={colors.textSecondary}>
            No design selected. Choose one below.
          </Text>
        )}
      </Card>

      {/* Category filter */}
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, !filterCategory && styles.chipActive]}
          onPress={() => setFilterCategory(null)}
        >
          <Text variant="caption" color={!filterCategory ? colors.background : colors.textSecondary}>
            All
          </Text>
        </Pressable>
        {CATEGORIES.map((cat) => {
          const selected = cat === filterCategory;
          return (
            <Pressable
              key={cat}
              onPress={() => setFilterCategory(cat)}
              style={[styles.chip, selected && styles.chipActive]}
            >
              <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                {cat}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Design gallery */}
      <View style={styles.grid}>
        {filteredDesigns.map((design) => (
          <Pressable
            key={design.id}
            style={[
              styles.designCard,
              { borderColor: currentDesignId === design.id ? ACCENT : colors.border },
              currentDesignId === design.id && { borderWidth: 2 },
            ]}
            onPress={() => handleSelectDesign(design)}
          >
            <View style={[styles.colorPreview, { backgroundColor: design.accentColor }]} />
            <Text variant="body">{design.name}</Text>
            <Text variant="caption" color={colors.textSecondary}>{design.category}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Font: {design.headerFont}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  designCard: {
    width: '48%' as unknown as number,
    padding: spacing.md, borderRadius: 12, gap: spacing.xs,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  colorPreview: { width: '100%' as unknown as number, height: 40, borderRadius: 8 },
});
