import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { ChevronDown, RotateCcw, Trash2, X } from 'lucide-react-native';
import { Text } from '@mylife/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useAppThemeColors, useAppThemeProfile } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';
import {
  PINWHEEL_ACTION_CATALOG,
  PINWHEEL_MAX_ACTIONS,
  PINWHEEL_PAGE_KEYS,
  clearPageActionIds,
  loadDefaultActionIds,
  loadEnabled,
  loadPageActionIds,
  loadShowLabels,
  saveDefaultActionIds,
  saveEnabled,
  savePageActionIds,
  saveShowLabels,
  type PinwheelActionDef,
} from '../../data/pinwheel-config';
import { PinwheelMenu } from '../PinwheelMenu';
import { ForwardChevron } from '../DirectionalIcons';

const PAGE_LABEL: Record<string, string> = {
  home: 'Home',
  leaderboard: 'Leaderboard',
  vote: 'Vote',
  kitchen: 'My Kitchen',
  profile: 'Profile',
  dishes: 'Browse Dishes',
  discover: 'Discover',
  feed: 'Cooking Videos',
  submit: 'Submit',
  recipe: 'Recipe Detail',
  dish: 'Dish Detail',
  grocery: 'Grocery',
  pantry: 'Pantry',
  settings: 'Settings',
};

export function PinwheelSettingsSection() {
  const db = useDatabase();
  const tc = useAppThemeColors();
  const theme = useAppThemeProfile();
  const { t } = useI18n();

  const [defaultIds, setDefaultIds] = useState<string[]>(() => loadDefaultActionIds(db));
  const [showLabels, setShowLabels] = useState<boolean>(() => loadShowLabels(db));
  const [enabled, setEnabled] = useState<boolean>(() => loadEnabled(db));
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<string | null>(null);
  const [pageOverrides, setPageOverrides] = useState<Record<string, string[] | null>>(() => {
    const map: Record<string, string[] | null> = {};
    for (const key of PINWHEEL_PAGE_KEYS) map[key] = loadPageActionIds(db, key);
    return map;
  });

  const handleToggleEnabled = (v: boolean) => {
    setEnabled(v);
    saveEnabled(db, v);
  };

  const handleToggleLabels = (v: boolean) => {
    setShowLabels(v);
    saveShowLabels(db, v);
  };

  const openDefaultEditor = () => {
    setEditorTarget(null);
    setEditorOpen(true);
  };

  const openPageEditor = (pageKey: string) => {
    setEditorTarget(pageKey);
    setEditorOpen(true);
  };

  const closeEditor = () => setEditorOpen(false);

  const editorIds = useMemo(() => {
    if (editorTarget == null) return defaultIds;
    return pageOverrides[editorTarget] ?? defaultIds;
  }, [editorTarget, defaultIds, pageOverrides]);

  const onCommit = useCallback(
    (ids: string[]) => {
      if (editorTarget == null) {
        setDefaultIds(ids);
        saveDefaultActionIds(db, ids);
      } else {
        setPageOverrides((prev) => ({ ...prev, [editorTarget]: ids }));
        savePageActionIds(db, editorTarget, ids);
      }
    },
    [db, editorTarget],
  );

  const onClearOverride = (pageKey: string) => {
    setPageOverrides((prev) => ({ ...prev, [pageKey]: null }));
    clearPageActionIds(db, pageKey);
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: tc.text }]}>{t('Pinwheel Quick Actions')}</Text>
          <Text style={[styles.cardSubtitle, { color: tc.textSecondary }]}>
            {t('Pick up to 6 actions to fan out from the BestChef header. Customize per-page if you want different shortcuts on Home vs. Kitchen.')}
          </Text>
        </View>
        <View style={styles.previewWrap}>
          <PinwheelMenu pageKey="settings" size={32} />
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: tc.border }]} />

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: tc.text }]}>{t('Show pinwheel')}</Text>
          <Text style={[styles.rowDesc, { color: tc.textSecondary }]}>
            {t('When off the header reverts to its standard buttons.')}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggleEnabled}
          trackColor={{ false: tc.surfaceElevated, true: tc.accent }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={tc.surfaceElevated}
        />
      </View>

      <View style={[styles.divider, { backgroundColor: tc.border }]} />

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: tc.text }]}>{t('Show action labels')}</Text>
          <Text style={[styles.rowDesc, { color: tc.textSecondary }]}>
            {t('Caption text below each fan-out icon.')}
          </Text>
        </View>
        <Switch
          value={showLabels}
          onValueChange={handleToggleLabels}
          trackColor={{ false: tc.surfaceElevated, true: tc.accent }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={tc.surfaceElevated}
        />
      </View>

      <View style={[styles.divider, { backgroundColor: tc.border }]} />

      <Pressable onPress={openDefaultEditor} style={styles.row}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={[styles.rowTitle, { color: tc.text }]}>{t('Default actions')}</Text>
          <ActionPreviewStrip ids={defaultIds} />
          <Text style={[styles.rowDesc, { color: tc.textSecondary }]}>
            {t('{n} of {max} chosen', { n: String(defaultIds.length), max: String(PINWHEEL_MAX_ACTIONS) })}
          </Text>
        </View>
        <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
      </Pressable>

      <View style={[styles.divider, { backgroundColor: tc.border }]} />

      <Text style={[styles.sectionLabel, { color: tc.textSecondary }]}>{t('Per-page overrides')}</Text>

      {PINWHEEL_PAGE_KEYS.map((pageKey, idx) => {
        const override = pageOverrides[pageKey];
        const hasOverride = override != null;
        const ids = override ?? defaultIds;
        return (
          <View key={pageKey}>
            <Pressable style={styles.row} onPress={() => openPageEditor(pageKey)}>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.pageRowTop}>
                  <Text style={[styles.rowTitle, { color: tc.text }]}>{t(PAGE_LABEL[pageKey] ?? pageKey)}</Text>
                  {hasOverride && (
                    <View style={[styles.overrideBadge, { backgroundColor: `${tc.accent}26`, borderColor: tc.accent }]}>
                      <Text style={[styles.overrideBadgeText, { color: tc.accent }]}>{t('Custom')}</Text>
                    </View>
                  )}
                </View>
                <ActionPreviewStrip ids={ids} faded={!hasOverride} />
              </View>
              {hasOverride ? (
                <Pressable
                  onPress={() => onClearOverride(pageKey)}
                  hitSlop={10}
                  style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.6 }]}
                  accessibilityLabel={t('Reset to defaults')}
                >
                  <RotateCcw size={14} color={tc.textSecondary} strokeWidth={2} />
                </Pressable>
              ) : (
                <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
              )}
            </Pressable>
            {idx < PINWHEEL_PAGE_KEYS.length - 1 && (
              <View style={[styles.thinDivider, { backgroundColor: tc.border }]} />
            )}
          </View>
        );
      })}

      <ActionEditorModal
        visible={editorOpen}
        title={
          editorTarget == null
            ? t('Default Actions')
            : t('Override: {page}', { page: t(PAGE_LABEL[editorTarget] ?? editorTarget) })
        }
        initialIds={editorIds}
        onClose={closeEditor}
        onCommit={onCommit}
      />
    </View>
  );
}

interface ActionPreviewStripProps {
  ids: string[];
  faded?: boolean;
}

function ActionPreviewStrip({ ids, faded }: ActionPreviewStripProps) {
  const tc = useAppThemeColors();
  return (
    <View style={styles.previewStrip}>
      {ids.map((id) => {
        const action = PINWHEEL_ACTION_CATALOG.find((a) => a.id === id);
        if (action == null) return null;
        const Icon = action.icon;
        return (
          <View
            key={id}
            style={[
              styles.previewDot,
              {
                backgroundColor: tc.surface,
                borderColor: tc.border,
                opacity: faded ? 0.55 : 1,
              },
            ]}
          >
            <Icon size={12} color={action.tint} strokeWidth={2.4} />
          </View>
        );
      })}
      {ids.length === 0 && (
        <Text style={[styles.previewEmpty, { color: tc.textTertiary }]}>(no actions)</Text>
      )}
    </View>
  );
}

interface ActionEditorModalProps {
  visible: boolean;
  title: string;
  initialIds: string[];
  onClose: () => void;
  onCommit: (ids: string[]) => void;
}

function ActionEditorModal({
  visible,
  title,
  initialIds,
  onClose,
  onCommit,
}: ActionEditorModalProps) {
  const tc = useAppThemeColors();
  const { t } = useI18n();
  const [selected, setSelected] = useState<string[]>(initialIds);

  useEffect(() => {
    if (visible) setSelected(initialIds);
  }, [visible, initialIds]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= PINWHEEL_MAX_ACTIONS) return prev;
      return [...prev, id];
    });
  };

  const move = (id: string, dir: -1 | 1) => {
    setSelected((prev) => {
      const i = prev.indexOf(id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };

  const remove = (id: string) => setSelected((prev) => prev.filter((x) => x !== id));

  const reset = () => setSelected(initialIds);

  const save = () => {
    onCommit(selected);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalRoot, { backgroundColor: tc.background }]}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.modalCloseBtn} accessibilityLabel={t('Close')}>
            <X size={18} color={tc.textSecondary} strokeWidth={2} />
          </Pressable>
          <Text style={[styles.modalTitle, { color: tc.text }]} numberOfLines={1}>{title}</Text>
          <Pressable onPress={save} hitSlop={10} style={styles.modalSaveBtn} accessibilityLabel={t('Save')}>
            <Text style={[styles.modalSaveText, { color: tc.accent }]}>{t('Save')}</Text>
          </Pressable>
        </View>
        <Text style={[styles.modalHint, { color: tc.textSecondary }]}>
          {t('Tap to add. Drag arrows to reorder. Up to {max} actions.', { max: String(PINWHEEL_MAX_ACTIONS) })}
        </Text>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalScroll}>
          <Text style={[styles.modalSection, { color: tc.textSecondary }]}>
            {t('Selected ({n}/{max})', { n: String(selected.length), max: String(PINWHEEL_MAX_ACTIONS) })}
          </Text>

          {selected.length === 0 ? (
            <Text style={[styles.modalEmpty, { color: tc.textTertiary }]}>
              {t('No actions selected yet. Pick from the catalog below.')}
            </Text>
          ) : (
            selected.map((id, i) => {
              const action = PINWHEEL_ACTION_CATALOG.find((a) => a.id === id);
              if (action == null) return null;
              const Icon = action.icon;
              return (
                <View
                  key={id}
                  style={[
                    styles.selectedRow,
                    { backgroundColor: tc.surface, borderColor: tc.border },
                  ]}
                >
                  <View
                    style={[
                      styles.selectedIconBox,
                      { backgroundColor: `${action.tint}26`, borderColor: `${action.tint}55` },
                    ]}
                  >
                    <Icon size={18} color={action.tint} strokeWidth={2.4} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.selectedTitle, { color: tc.text }]}>{t(action.label)}</Text>
                    <Text style={[styles.selectedSlot, { color: tc.textTertiary }]}>{t('Slot {n}', { n: String(i + 1) })}</Text>
                  </View>
                  <Pressable onPress={() => move(id, -1)} hitSlop={8} disabled={i === 0} style={styles.arrowBtn}>
                    <ChevronDown
                      size={16}
                      color={i === 0 ? tc.textTertiary : tc.textSecondary}
                      strokeWidth={2}
                      style={{ transform: [{ rotate: '180deg' }] }}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => move(id, 1)}
                    hitSlop={8}
                    disabled={i === selected.length - 1}
                    style={styles.arrowBtn}
                  >
                    <ChevronDown size={16} color={i === selected.length - 1 ? tc.textTertiary : tc.textSecondary} strokeWidth={2} />
                  </Pressable>
                  <Pressable onPress={() => remove(id)} hitSlop={8} style={styles.arrowBtn}>
                    <Trash2 size={15} color={tc.danger ?? '#FFB4AB'} strokeWidth={2} />
                  </Pressable>
                </View>
              );
            })
          )}

          <View style={{ height: 16 }} />

          <Text style={[styles.modalSection, { color: tc.textSecondary }]}>{t('Catalog')}</Text>
          <View style={styles.catalogGrid}>
            {PINWHEEL_ACTION_CATALOG.map((action) => {
              const picked = selected.includes(action.id);
              const Icon = action.icon;
              const disabled = !picked && selected.length >= PINWHEEL_MAX_ACTIONS;
              return (
                <Pressable
                  key={action.id}
                  onPress={() => !disabled && toggle(action.id)}
                  style={({ pressed }) => [
                    styles.catalogTile,
                    {
                      backgroundColor: picked ? `${action.tint}26` : tc.surface,
                      borderColor: picked ? action.tint : tc.border,
                      opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: picked, disabled }}
                  accessibilityLabel={action.label}
                >
                  <Icon size={20} color={action.tint} strokeWidth={2.4} />
                  <Text style={[styles.catalogTileText, { color: tc.text }]} numberOfLines={1}>
                    {t(action.label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ height: 16 }} />
          <Pressable onPress={reset} style={styles.resetRow}>
            <RotateCcw size={14} color={tc.textSecondary} strokeWidth={2} />
            <Text style={[styles.resetText, { color: tc.textSecondary }]}>{t('Reset to opened')}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

// Action type kept exported in case mission control / other surfaces need it.
export type { PinwheelActionDef };

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  previewWrap: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 17,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  cardSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  thinDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowTitle: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 14 },
  rowDesc: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12, lineHeight: 17 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  sectionLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  pageRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overrideBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  overrideBadgeText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 9,
    letterSpacing: 1,
  },
  resetBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  previewDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmpty: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    fontStyle: 'italic',
  },
  // Modal
  modalRoot: { flex: 1, paddingTop: 12 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  modalCloseBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalSaveBtn: { width: 56, height: 32, alignItems: 'flex-end', justifyContent: 'center' },
  modalSaveText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  modalTitle: { flex: 1, fontFamily: JAKARTA_FONTS.extraBold, fontSize: 16 },
  modalHint: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12, marginHorizontal: 18, marginBottom: 8 },
  modalScroll: { paddingHorizontal: 16, paddingBottom: 32 },
  modalSection: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    marginVertical: 8,
  },
  modalEmpty: { fontFamily: JAKARTA_FONTS.regular, fontSize: 13, fontStyle: 'italic', paddingVertical: 8 },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  selectedIconBox: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  selectedTitle: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 14 },
  selectedSlot: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, letterSpacing: 0.4 },
  arrowBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catalogTile: {
    flexBasis: '47%' as const,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  catalogTileText: { flex: 1, fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13 },
  resetRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  resetText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 },
});
