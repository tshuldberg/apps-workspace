import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import {
  GlassCard,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  MaterialSymbol,
  SectionHeader,
  createArea,
  deleteArea,
  getAreas,
  getHabits,
  reorderAreas,
  updateArea,
  type Area,
} from '@mylife/habits';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const AREA_COLORS = [
  '#30D158',
  '#A78BFA',
  '#FFB4AB',
  '#84CC16',
  '#FFB877',
  '#8BCFF0',
  '#9F8E81',
];

const AREA_ICONS = ['favorite', 'psychology', 'fitness_center', 'attach_money', 'people', 'eco'] as const;

function MiniButton({
  label,
  onPress,
  variant = 'default',
}: {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'danger' | 'primary';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.miniButton,
        variant === 'primary' ? styles.miniButtonPrimary : null,
        variant === 'danger' ? styles.miniButtonDanger : null,
      ]}
    >
      <Text
        style={[
          styles.miniButtonText,
          variant === 'primary' ? styles.miniButtonTextPrimary : null,
          variant === 'danger' ? styles.miniButtonTextDanger : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function HabitAreasScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [areaRows, setAreaRows] = useState<Area[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState(AREA_COLORS[0]);
  const [draftIcon, setDraftIcon] = useState<(typeof AREA_ICONS)[number]>('favorite');

  useEffect(() => {
    setAreaRows(getAreas(db));
  }, [db, tick]);

  const habits = useMemo(() => getHabits(db, { isArchived: false }), [db, tick]);
  const habitCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const area of areaRows) {
      counts.set(area.id, 0);
    }
    for (const habit of habits) {
      if (!habit.areaId) {
        continue;
      }
      counts.set(habit.areaId, (counts.get(habit.areaId) ?? 0) + 1);
    }
    return counts;
  }, [areaRows, habits]);

  const openCreateSheet = () => {
    setEditingAreaId(null);
    setDraftName('');
    setDraftColor(AREA_COLORS[0]);
    setDraftIcon('favorite');
    setSheetVisible(true);
  };

  const openEditSheet = (area: Area) => {
    setEditingAreaId(area.id);
    setDraftName(area.name);
    setDraftColor(area.color ?? AREA_COLORS[0]);
    setDraftIcon((area.icon as (typeof AREA_ICONS)[number] | null) ?? 'favorite');
    setSheetVisible(true);
  };

  const saveArea = () => {
    if (!draftName.trim()) {
      Alert.alert('MyHabits', 'Enter an area name first.');
      return;
    }

    try {
      if (editingAreaId) {
        updateArea(db, editingAreaId, {
          name: draftName.trim(),
          color: draftColor,
          icon: draftIcon,
        });
      } else {
        createArea(db, uuid(), {
          name: draftName.trim(),
          color: draftColor,
          icon: draftIcon,
        });
      }
      setSheetVisible(false);
      setTick((value) => value + 1);
    } catch (error) {
      Alert.alert('MyHabits', error instanceof Error ? error.message : 'Unable to save this area.');
    }
  };

  const handleDelete = (area: Area) => {
    const count = habitCounts.get(area.id) ?? 0;
    if (count > 0) {
      Alert.alert(
        'Reassign habits first',
        `${count} active habit${count === 1 ? '' : 's'} still use ${area.name}. Move them to another area before deleting.`,
      );
      return;
    }

    Alert.alert(
      'Delete area?',
      `Delete ${area.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteArea(db, area.id);
              setTick((value) => value + 1);
            } catch (error) {
              Alert.alert('MyHabits', error instanceof Error ? error.message : 'Unable to delete this area.');
            }
          },
        },
      ],
    );
  };

  const totalAssignedHabits = [...habitCounts.values()].reduce((sum, value) => sum + value, 0);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard level={2} contentStyle={styles.headerCard}>
          <Pressable onPress={() => router.back()} style={styles.headerAction}>
            <Text style={styles.headerActionText}>Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Areas</Text>
          <Pressable onPress={openCreateSheet} style={styles.headerAction}>
            <Text style={styles.headerActionText}>Add</Text>
          </Pressable>
        </GlassCard>

        <GlassCard level={4} contentStyle={styles.heroCard}>
          <Text style={styles.heroTitle}>Organize your habits.</Text>
          <Text style={styles.heroCopy}>
            Group routines by life domain, keep colors consistent, and drag areas into the order you want to see everywhere else in MyHabits.
          </Text>
          <View style={styles.summaryRow}>
            <GlassCard level={1} contentStyle={styles.summaryCard}>
              <Text style={styles.summaryValue}>{areaRows.length}</Text>
              <Text style={styles.summaryLabel}>areas</Text>
            </GlassCard>
            <GlassCard level={1} contentStyle={styles.summaryCard}>
              <Text style={styles.summaryValue}>{totalAssignedHabits}</Text>
              <Text style={styles.summaryLabel}>assigned habits</Text>
            </GlassCard>
          </View>
        </GlassCard>

        <GlassCard level={3} contentStyle={styles.listCard}>
          <SectionHeader title="Current areas" action={{ label: 'Add Area', onPress: openCreateSheet }} />
          <Text style={styles.sectionCopy}>
            Drag to reorder. Long-press a row to move it, then save persists immediately.
          </Text>
          <DraggableFlatList
            data={areaRows}
            keyExtractor={(item) => item.id}
            onDragEnd={({ data }) => {
              setAreaRows(data);
              try {
                reorderAreas(db, data.map((item) => item.id));
                setTick((value) => value + 1);
              } catch (error) {
                Alert.alert('MyHabits', error instanceof Error ? error.message : 'Unable to reorder areas.');
              }
            }}
            renderItem={({ item, drag, isActive }: RenderItemParams<Area>) => (
              <ScaleDecorator>
                <Pressable onLongPress={drag} delayLongPress={150}>
                  <GlassCard level={1} contentStyle={[styles.areaRow, isActive ? styles.areaRowActive : null]}>
                    <View style={styles.areaMain}>
                      <View style={[styles.areaSwatch, { backgroundColor: item.color ?? HB_ACCENT }]} />
                      <View style={styles.areaCopy}>
                        <View style={styles.areaTitleRow}>
                          {item.icon ? (
                            <View style={styles.areaIconBadge}>
                              <MaterialSymbol name={item.icon} size={14} color={item.color ?? HB_ACCENT_LIGHT} filled />
                            </View>
                          ) : null}
                          <Text style={styles.areaTitle}>{item.name}</Text>
                        </View>
                        <Text style={styles.areaMeta}>
                          {habitCounts.get(item.id) ?? 0} habit{(habitCounts.get(item.id) ?? 0) === 1 ? '' : 's'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.areaActions}>
                      <MiniButton label="Edit" onPress={() => openEditSheet(item)} />
                      <MiniButton label="Delete" onPress={() => handleDelete(item)} variant="danger" />
                    </View>
                  </GlassCard>
                </Pressable>
              </ScaleDecorator>
            )}
            scrollEnabled={false}
          />
        </GlassCard>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={sheetVisible}
        onRequestClose={() => setSheetVisible(false)}
      >
        <Pressable onPress={() => setSheetVisible(false)} style={styles.sheetBackdrop}>
          <Pressable style={styles.sheetWrap}>
            <GlassCard level={4} contentStyle={styles.sheetCard}>
              <SectionHeader
                title={editingAreaId ? 'Edit area' : 'Add area'}
                action={{ label: 'Close', onPress: () => setSheetVisible(false) }}
              />
              <TextInput
                autoFocus
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Mindfulness"
                placeholderTextColor={HB_TEXT_TERTIARY}
                style={styles.inlineInput}
              />
              <View style={styles.colorRail}>
                {AREA_COLORS.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => setDraftColor(color)}
                    style={[styles.colorDot, { backgroundColor: color }, draftColor === color ? styles.colorDotActive : null]}
                  />
                ))}
              </View>
              <View style={styles.iconRail}>
                {AREA_ICONS.map((icon) => (
                  <Pressable
                    key={icon}
                    onPress={() => setDraftIcon(icon)}
                    style={[styles.iconChip, draftIcon === icon ? styles.iconChipActive : null]}
                  >
                    <MaterialSymbol name={icon} size={16} color={draftIcon === icon ? HB_SURFACES.lowest : HB_TEXT_SECONDARY} filled />
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={saveArea} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{editingAreaId ? 'Save Changes' : 'Create Area'}</Text>
              </Pressable>
            </GlassCard>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.base,
  },
  content: {
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 120,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAction: {
    borderRadius: 999,
    backgroundColor: `${HB_ACCENT}18`,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  headerActionText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  headerTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
  },
  heroCard: {
    gap: 10,
    paddingTop: 20,
    paddingBottom: 20,
  },
  heroTitle: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
  },
  heroCopy: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  summaryValue: {
    ...HB_TYPOGRAPHY.streakDisplay,
    color: HB_ACCENT_LIGHT,
  },
  summaryLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  listCard: {
    gap: 12,
  },
  sectionCopy: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  areaRowActive: {
    backgroundColor: `${HB_ACCENT}18`,
  },
  areaMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  areaSwatch: {
    width: 18,
    height: 56,
    borderRadius: 14,
  },
  areaCopy: {
    flex: 1,
    gap: 4,
  },
  areaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  areaIconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: HB_SURFACES.lowest,
  },
  areaTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
  },
  areaMeta: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  areaActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  miniButton: {
    borderRadius: 999,
    backgroundColor: HB_SURFACES.lowest,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  miniButtonPrimary: {
    backgroundColor: HB_ACCENT,
  },
  miniButtonDanger: {
    backgroundColor: `${HB_ACCENT}12`,
  },
  miniButtonText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_SECONDARY,
  },
  miniButtonTextPrimary: {
    color: HB_SURFACES.lowest,
  },
  miniButtonTextDanger: {
    color: HB_TEXT,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.66)',
  },
  sheetWrap: {
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  sheetCard: {
    gap: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  inlineInput: {
    ...HB_TYPOGRAPHY.bodyMd,
    borderRadius: 16,
    backgroundColor: HB_SURFACES.lowest,
    color: HB_TEXT,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  colorRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorDotActive: {
    borderWidth: 2,
    borderColor: HB_TEXT,
  },
  iconRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconChip: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: HB_SURFACES.lowest,
  },
  iconChipActive: {
    backgroundColor: HB_ACCENT,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: HB_ACCENT,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_SURFACES.lowest,
  },
});
