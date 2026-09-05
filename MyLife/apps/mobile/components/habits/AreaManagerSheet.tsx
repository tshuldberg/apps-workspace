import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { type Area, GlassCard, HB_ACCENT_LIGHT, HB_SURFACES, HB_TEXT, HB_TEXT_SECONDARY, HB_TEXT_TERTIARY, HB_TYPOGRAPHY, withAlpha } from '@mylife/habits';
import {
  AreaSwatchPicker,
  FilterChip,
  HABITS_AREA_PRESETS,
  HeaderIconButton,
  resolveAreaColor,
} from './phase1-shared';

type DraftState = {
  name: string;
  color: string;
};

function createDefaultDraft(area?: Area | null): DraftState {
  return {
    name: area?.name ?? '',
    color: area?.color ?? HABITS_AREA_PRESETS[0]?.color ?? HB_ACCENT_LIGHT,
  };
}

export function AreaManagerSheet({
  visible,
  areas,
  onClose,
  onAddArea,
  onRenameArea,
  onDeleteArea,
  onMoveArea,
}: {
  visible: boolean;
  areas: Area[];
  onClose: () => void;
  onAddArea: (name: string, color: string) => void;
  onRenameArea: (areaId: string, name: string, color: string) => void;
  onDeleteArea: (areaId: string) => void;
  onMoveArea: (areaId: string, direction: 'up' | 'down') => void;
}) {
  const [createDraft, setCreateDraft] = useState<DraftState>(createDefaultDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftState>(createDefaultDraft());

  useEffect(() => {
    if (!visible) {
      setCreateDraft(createDefaultDraft());
      setEditingId(null);
      setEditDraft(createDefaultDraft());
    }
  }, [visible]);

  const editingArea = useMemo(
    () => areas.find((area) => area.id === editingId) ?? null,
    [areas, editingId],
  );

  useEffect(() => {
    if (editingArea) {
      setEditDraft(createDefaultDraft(editingArea));
    }
  }, [editingArea]);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheetWrap}>
          <GlassCard level={3} contentStyle={styles.sheet}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Areas</Text>
                <Text style={styles.caption}>Add, rename, recolor, or reorder your life domains.</Text>
              </View>
              <HeaderIconButton icon="close" label="Close area editor" onPress={onClose} />
            </View>

            <GlassCard level={1} contentStyle={styles.createCard}>
              <Text style={styles.createTitle}>Create area</Text>
              <TextInput
                onChangeText={(name) => setCreateDraft((current) => ({ ...current, name }))}
                placeholder="New area name"
                placeholderTextColor={HB_TEXT_TERTIARY}
                style={styles.input}
                value={createDraft.name}
              />
              <AreaSwatchPicker
                onSelect={(color) => setCreateDraft((current) => ({ ...current, color }))}
                value={createDraft.color}
              />
              <FilterChip
                label="Add area"
                onPress={() => {
                  if (!createDraft.name.trim()) return;
                  onAddArea(createDraft.name.trim(), createDraft.color);
                  setCreateDraft(createDefaultDraft());
                }}
                selected
              />
            </GlassCard>

            <ScrollView contentContainerStyle={styles.areaList}>
              {areas.map((area, index) => {
                const editing = editingId === area.id;
                const draft = editing ? editDraft : createDefaultDraft(area);
                const tint = resolveAreaColor(area.name, area.color);

                return (
                  <GlassCard key={area.id} level={1} contentStyle={styles.areaRow}>
                    <View style={styles.areaRowTop}>
                      <View style={[styles.areaDot, { backgroundColor: tint }]} />
                      <View style={styles.areaCopy}>
                        <Text style={styles.areaName}>{area.name}</Text>
                        <Text style={styles.areaMeta}>
                          {index + 1} in order
                        </Text>
                      </View>
                      <View style={styles.areaActions}>
                        <HeaderIconButton icon="arrow_upward" label="Move area up" onPress={() => onMoveArea(area.id, 'up')} />
                        <HeaderIconButton icon="arrow_downward" label="Move area down" onPress={() => onMoveArea(area.id, 'down')} />
                        <HeaderIconButton
                          icon={editing ? 'close' : 'edit'}
                          label={editing ? 'Cancel editing area' : 'Edit area'}
                          onPress={() => {
                            setEditingId((current) => (current === area.id ? null : area.id));
                            setEditDraft(createDefaultDraft(area));
                          }}
                        />
                      </View>
                    </View>

                    {editing ? (
                      <View style={styles.editPanel}>
                        <TextInput
                          onChangeText={(name) => setEditDraft((current) => ({ ...current, name }))}
                          placeholder="Area name"
                          placeholderTextColor={HB_TEXT_TERTIARY}
                          style={styles.input}
                          value={draft.name}
                        />
                        <AreaSwatchPicker
                          onSelect={(color) => setEditDraft((current) => ({ ...current, color }))}
                          value={draft.color}
                        />
                        <View style={styles.editActions}>
                          <FilterChip
                            color={HB_TEXT_TERTIARY}
                            label="Delete"
                            onPress={() => onDeleteArea(area.id)}
                          />
                          <FilterChip
                            label="Save"
                            onPress={() => {
                              if (!draft.name.trim()) return;
                              onRenameArea(area.id, draft.name.trim(), draft.color);
                              setEditingId(null);
                            }}
                            selected
                          />
                        </View>
                      </View>
                    ) : null}
                  </GlassCard>
                );
              })}
            </ScrollView>
          </GlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: withAlpha('#000000', 0.68),
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    maxHeight: '88%',
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  sheet: {
    gap: 16,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  title: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 24,
    lineHeight: 28,
  },
  caption: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    marginTop: 4,
  },
  createCard: {
    gap: 12,
  },
  createTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 18,
    lineHeight: 22,
  },
  input: {
    borderRadius: 16,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: HB_TEXT,
    ...HB_TYPOGRAPHY.bodyMd,
  },
  areaList: {
    gap: 12,
    paddingBottom: 12,
  },
  areaRow: {
    gap: 12,
  },
  areaRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  areaDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  areaCopy: {
    flex: 1,
    gap: 2,
  },
  areaName: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
    fontSize: 15,
    lineHeight: 19,
    fontFamily: HB_TYPOGRAPHY.headlineMd.fontFamily,
  },
  areaMeta: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 16,
  },
  areaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editPanel: {
    gap: 12,
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
