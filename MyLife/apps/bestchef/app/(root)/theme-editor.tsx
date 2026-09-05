import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, ChevronUp, RotateCcw, X } from 'lucide-react-native';
import { JAKARTA_FONTS, createCustomTheme } from '@mylife/bestchef';
import { useAddedToast } from '@mylife/bestchef/ui';
import {
  Text,
  COOL_OBSIDIAN,
  THEME_PRESETS,
  mergeTheme,
  type BaseColors,
  type ThemeProfile,
} from '@mylife/ui';
import { useAppTheme, useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from './providers/AppThemeProvider';
import { useDatabase } from './providers/DatabaseProvider';
import { useI18n } from './i18n/I18nProvider';
import { BackArrow } from './components/DirectionalIcons';

const COLOR_GROUPS: { label: string; fields: (keyof BaseColors)[] }[] = [
  { label: 'BACKGROUND & SURFACES', fields: ['background', 'surface', 'surfaceElevated'] },
  { label: 'TEXT', fields: ['text', 'textSecondary', 'textTertiary'] },
  { label: 'ACCENT & BRAND', fields: ['accent', 'primary', 'primaryContainer'] },
  { label: 'SEMANTIC', fields: ['danger', 'success', 'warning'] },
  { label: 'BORDER', fields: ['border'] },
];

const COLOR_FIELD_LABELS: Record<keyof BaseColors, string> = {
  background: 'Background',
  surface: 'Surface',
  surfaceElevated: 'Elevated Surface',
  text: 'Text',
  textSecondary: 'Secondary Text',
  textTertiary: 'Tertiary Text',
  border: 'Border',
  danger: 'Danger',
  success: 'Success',
  warning: 'Warning',
  accent: 'Accent',
  primary: 'Primary',
  primaryContainer: 'Primary Container',
};

const QUICK_COLORS = [
  '#131318', '#1B1B20', '#2A292F', '#0E0E13', '#FFFFFF', '#F5F5F5',
  '#E4E1E9', '#D6C3B5', '#22C55E', '#3B82F6', '#EF4444', '#FFB877',
  '#C9894D', '#8BCFF0', '#FF9F0A', '#A855F7', '#EC4899', '#14B8A6',
  '#84CC16', '#30D158', '#FFB4AB', '#F97316', '#FACC15', '#06B6D4',
];

const TREATMENT_OPTIONS = ['glass', 'solid', 'flat'] as const;

const PRESET_ORDER = [
  'cool-obsidian', 'arctic-light', 'warm-analog', 'neon-terminal',
  'soft-gradient', 'minimal-ink', 'candy-glass', 'earth-clay', 'neumorphic-slate',
] as const;

function Section({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const tc = useThemeColors();
  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHeader} onPress={onToggle}>
        <Text style={[styles.sectionTitle, { color: tc.accent }]}>{title}</Text>
        {expanded
          ? <ChevronUp size={18} color={tc.textSecondary} strokeWidth={2} />
          : <ChevronDown size={18} color={tc.textSecondary} strokeWidth={2} />
        }
      </Pressable>
      {expanded && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const tc = useThemeColors();
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  const handleSubmit = () => {
    const trimmed = inputValue.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(trimmed) || /^rgba?\(/.test(trimmed)) {
      onChange(trimmed);
    }
    setEditing(false);
  };

  return (
    <View style={styles.colorField}>
      <View style={styles.colorFieldTop}>
        <View style={[styles.colorCircle, { backgroundColor: value }]} />
        <View style={styles.colorFieldLabels}>
          <Text style={[styles.colorLabel, { color: tc.text }]}>{label}</Text>
          {editing ? (
            <TextInput
              style={[styles.hexInput, { color: tc.text, backgroundColor: theme.glass.cardFill }]}
              value={inputValue}
              onChangeText={setInputValue}
              onBlur={handleSubmit}
              onSubmitEditing={handleSubmit}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          ) : (
            <Pressable onPress={() => { setInputValue(value); setEditing(true); }}>
              <Text style={[styles.hexValue, { color: tc.textSecondary }]}>{value}</Text>
            </Pressable>
          )}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickColorRow}>
        {QUICK_COLORS.map((c) => (
          <Pressable
            key={c}
            style={[
              styles.quickColor,
              { backgroundColor: c },
              value === c && { borderWidth: 2, borderColor: tc.accent },
            ]}
            onPress={() => { onChange(c); setInputValue(c); }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function PresetCard({
  preset,
  isSelected,
  onPress,
}: {
  preset: ThemeProfile;
  isSelected: boolean;
  onPress: () => void;
}) {
  const tc = useThemeColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          styles.presetCard,
          { backgroundColor: preset.colors.background, transform: [{ scale: scaleAnim }] },
          isSelected
            ? { borderWidth: 2, borderColor: tc.accent }
            : { borderWidth: 2, borderColor: 'transparent' },
        ]}
      >
        <View style={styles.presetSwatches}>
          <View style={[styles.presetSwatch, { backgroundColor: preset.colors.accent }]} />
          <View style={[styles.presetSwatch, { backgroundColor: preset.colors.surface }]} />
          <View style={[styles.presetSwatch, { backgroundColor: preset.colors.primaryContainer }]} />
          <View style={[styles.presetSwatch, { backgroundColor: preset.colors.text }]} />
        </View>
        <Text style={[styles.presetCardName, { color: preset.colors.text }]} numberOfLines={1}>{preset.name}</Text>
        {isSelected && (
          <View style={[styles.presetSelectedBadge, { backgroundColor: tc.accent }]}>
            <Check size={10} color={tc.background} strokeWidth={3} />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default function ThemeEditorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tc = useThemeColors();
  const currentTheme = useTheme();
  const { setTheme, refreshCustomThemes } = useAppTheme();
  const { t } = useI18n();
  const db = useDatabase();
  const toast = useAddedToast();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const [draft, setDraft] = useState<ThemeProfile>(() => ({
    ...COOL_OBSIDIAN,
    id: 'custom',
    name: 'Custom Theme',
    description: 'Your personalized theme',
    author: 'You',
  }));

  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const [expanded, setExpanded] = useState({
    presets: true,
    colors: false,
    glass: false,
    surfaces: false,
  });

  const toggleSection = useCallback((key: keyof typeof expanded) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const updateColor = useCallback((field: keyof BaseColors, value: string) => {
    setDraft((prev) => ({
      ...prev,
      colors: { ...prev.colors, [field]: value },
    }));
  }, []);

  const updateBlur = useCallback((intensity: number) => {
    setDraft((prev) => ({
      ...prev,
      glass: { ...prev.glass, blurIntensity: intensity },
    }));
  }, []);

  const updateTreatment = useCallback((treatment: 'glass' | 'solid' | 'flat') => {
    setDraft((prev) => ({
      ...prev,
      surfaces: { ...prev.surfaces, treatment },
    }));
  }, []);

  const updateCornerRadius = useCallback((radius: number) => {
    setDraft((prev) => ({
      ...prev,
      surfaces: {
        ...prev.surfaces,
        cornerRadius: {
          card: radius,
          button: Math.max(4, radius - 4),
          icon: Math.max(4, radius - 4),
          tabBar: radius + 8,
        },
      },
    }));
  }, []);

  const startFromPreset = useCallback((id: string) => {
    const preset = THEME_PRESETS[id];
    if (!preset) return;
    setSelectedPresetId(id);
    setDraft(mergeTheme(preset, {
      id: 'custom',
      name: 'Custom Theme',
      description: `Based on ${preset.name}`,
      author: 'You',
    }));
  }, []);

  const resetToDefault = useCallback(() => {
    setDraft({
      ...COOL_OBSIDIAN,
      id: 'custom',
      name: 'Custom Theme',
      description: 'Your personalized theme',
      author: 'You',
    });
  }, []);

  const handleSave = useCallback(() => {
    setSaveError(null);
    setSaveName(draft.name && draft.name !== 'Custom Theme' ? draft.name : '');
    setSaveDialogOpen(true);
  }, [draft.name]);

  const confirmSave = useCallback(() => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      setSaveError(t('theme_name_label'));
      return;
    }
    try {
      const namedDraft: ThemeProfile = { ...draft, name: trimmed };
      const created = createCustomTheme(db, {
        name: trimmed,
        tokenOverrides: namedDraft,
      });
      refreshCustomThemes();
      setTheme(`custom:${created.id}`, namedDraft);
      toast.show(t('theme_save_action'));
      setSaveDialogOpen(false);
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Most likely a UNIQUE name violation; surface a friendly message.
      setSaveError(msg.toLowerCase().includes('unique') ? msg : msg);
    }
  }, [draft, saveName, db, setTheme, refreshCustomThemes, router, t, toast]);

  const previewCard = useMemo(() => ({
    bg: draft.glass.cardFill,
    border: draft.glass.cardBorder,
  }), [draft.glass.cardFill, draft.glass.cardBorder]);

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Theme Editor')}</Text>
        <Pressable onPress={handleSave} hitSlop={12}>
          <Check size={24} color={tc.accent} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Live preview */}
        <View style={[styles.previewCard, { backgroundColor: draft.colors.background }]}>
          <View style={[styles.previewInner, { backgroundColor: previewCard.bg, borderColor: previewCard.border }]}>
            <Text style={[styles.previewTitle, { color: draft.colors.text }]}>{t('Preview')}</Text>
            <Text style={[styles.previewBody, { color: draft.colors.textSecondary }]}>
              {t('This is how your theme will look.')}
            </Text>
            <View style={styles.previewDots}>
              <View style={[styles.previewDot, { backgroundColor: draft.colors.accent }]} />
              <View style={[styles.previewDot, { backgroundColor: draft.colors.primary }]} />
              <View style={[styles.previewDot, { backgroundColor: draft.colors.success }]} />
              <View style={[styles.previewDot, { backgroundColor: draft.colors.danger }]} />
            </View>
          </View>
        </View>

        {/* Select Preset */}
        <Section title={t('Select Preset')} expanded={expanded.presets} onToggle={() => toggleSection('presets')}>
          <View style={styles.presetGrid}>
            {PRESET_ORDER.map((id) => {
              const p = THEME_PRESETS[id];
              if (!p) return null;
              const isSelected = selectedPresetId === id;
              return (
                <PresetCard
                  key={id}
                  preset={p}
                  isSelected={isSelected}
                  onPress={() => startFromPreset(id)}
                />
              );
            })}
          </View>
          <Pressable style={styles.resetRow} onPress={() => { resetToDefault(); setSelectedPresetId('cool-obsidian'); }}>
            <RotateCcw size={14} color={tc.textSecondary} strokeWidth={2} />
            <Text style={[styles.resetText, { color: tc.textSecondary }]}>{t('Reset to Obsidian Noir')}</Text>
          </Pressable>
        </Section>

        {/* Colors */}
        <Section title={t('Colors')} expanded={expanded.colors} onToggle={() => toggleSection('colors')}>
          {COLOR_GROUPS.map((group) => (
            <View key={group.label} style={styles.colorGroup}>
              <Text style={[styles.colorGroupLabel, { color: tc.textSecondary }]}>{t(group.label)}</Text>
              {group.fields.map((field) => (
                <ColorField
                  key={field}
                  label={t(COLOR_FIELD_LABELS[field])}
                  value={draft.colors[field]}
                  onChange={(val) => updateColor(field, val)}
                />
              ))}
            </View>
          ))}
        </Section>

        {/* Glass */}
        <Section title={t('Glass Morphism')} expanded={expanded.glass} onToggle={() => toggleSection('glass')}>
          <View style={styles.sliderRow}>
            <Text style={[styles.sliderLabel, { color: tc.text }]}>{t('Blur Intensity')}</Text>
            <Text style={[styles.sliderValue, { color: tc.textSecondary }]}>{draft.glass.blurIntensity}</Text>
          </View>
          <View style={styles.sliderTrack}>
            {[0, 20, 40, 60, 80, 100].map((val) => (
              <Pressable
                key={val}
                style={[
                  styles.sliderStop,
                  { backgroundColor: draft.glass.blurIntensity >= val ? tc.accent : currentTheme.glass.cardFill },
                ]}
                onPress={() => updateBlur(val)}
              >
                <Text style={[styles.sliderStopText, { color: draft.glass.blurIntensity >= val ? tc.background : tc.textSecondary }]}>
                  {val}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.glassPreview, { backgroundColor: draft.glass.cardFill, borderColor: draft.glass.cardBorder }]}>
            <Text style={[styles.glassPreviewText, { color: tc.text }]}>{t('Glass card preview')}</Text>
          </View>
        </Section>

        {/* Surface Treatment */}
        <Section title={t('Surface Treatment')} expanded={expanded.surfaces} onToggle={() => toggleSection('surfaces')}>
          <View style={styles.treatmentRow}>
            {TREATMENT_OPTIONS.map((t) => (
              <Pressable
                key={t}
                style={[
                  styles.treatmentCard,
                  { backgroundColor: currentTheme.glass.cardFill, borderColor: currentTheme.glass.cardBorder },
                  draft.surfaces.treatment === t && { borderColor: tc.accent, borderWidth: 2 },
                ]}
                onPress={() => updateTreatment(t)}
              >
                <Text style={[styles.treatmentLabel, { color: draft.surfaces.treatment === t ? tc.accent : tc.text }]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.sliderRow}>
            <Text style={[styles.sliderLabel, { color: tc.text }]}>{t('Corner Radius')}</Text>
            <Text style={[styles.sliderValue, { color: tc.textSecondary }]}>{draft.surfaces.cornerRadius.card}px</Text>
          </View>
          <View style={styles.sliderTrack}>
            {[4, 8, 12, 16, 20, 24, 28].map((val) => (
              <Pressable
                key={val}
                style={[
                  styles.sliderStop,
                  { backgroundColor: draft.surfaces.cornerRadius.card >= val ? tc.accent : currentTheme.glass.cardFill },
                ]}
                onPress={() => updateCornerRadius(val)}
              >
                <Text style={[styles.sliderStopText, { color: draft.surfaces.cornerRadius.card >= val ? tc.background : tc.textSecondary }]}>
                  {val}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* Save */}
        <Pressable style={[styles.saveButton, { backgroundColor: tc.accent }]} onPress={handleSave}>
          <Check size={18} color={tc.background} strokeWidth={2.5} />
          <Text style={[styles.saveButtonText, { color: tc.background }]}>{t('theme_save_action')}</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={saveDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveDialogOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.glass.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: tc.text }]}>{t('theme_save_action')}</Text>
              <Pressable hitSlop={12} onPress={() => setSaveDialogOpen(false)}>
                <X size={20} color={tc.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>
            <Text style={[styles.modalLabel, { color: tc.textSecondary }]}>{t('theme_name_label')}</Text>
            <TextInput
              style={[styles.modalInput, {
                color: tc.text,
                backgroundColor: currentTheme.glass.cardFill,
                borderColor: saveError ? '#FFB4AB' : currentTheme.glass.cardBorder,
              }]}
              value={saveName}
              onChangeText={(v) => { setSaveName(v); setSaveError(null); }}
              placeholder={t('theme_name_label')}
              placeholderTextColor={tc.textTertiary}
              autoFocus
            />
            {saveError ? (
              <Text style={[styles.modalError, { color: '#FFB4AB' }]}>{saveError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalAction,
                  { borderColor: tc.border, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => setSaveDialogOpen(false)}
              >
                <Text style={[styles.modalActionText, { color: tc.textSecondary }]}>{t('Cancel')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalAction,
                  { backgroundColor: tc.accent, borderColor: tc.accent, opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={confirmSave}
              >
                <Text style={[styles.modalActionText, { color: tc.background }]}>{t('theme_save_action')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingBottom: 12, gap: 12,
  },
  topBarTitle: { flex: 1, fontFamily: JAKARTA_FONTS.bold, fontSize: 17, textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 16 },

  previewCard: { borderRadius: 20, padding: 16 },
  previewInner: { borderRadius: 16, padding: 20, gap: 8, borderWidth: 1 },
  previewTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 18 },
  previewBody: { fontFamily: JAKARTA_FONTS.regular, fontSize: 13 },
  previewDots: { flexDirection: 'row', gap: 10, marginTop: 8 },
  previewDot: { width: 24, height: 24, borderRadius: 12 },

  section: { gap: 0 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14,
  },
  sectionTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11, letterSpacing: 1.6 },
  sectionBody: { gap: 16, paddingBottom: 8 },

  colorGroup: { gap: 12 },
  colorGroupLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, letterSpacing: 1.2 },
  colorField: { gap: 8 },
  colorFieldTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  colorCircle: { width: 36, height: 36, borderRadius: 18 },
  colorFieldLabels: { flex: 1, gap: 2 },
  colorLabel: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 14 },
  hexValue: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  hexInput: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  quickColorRow: { gap: 6, paddingVertical: 4 },
  quickColor: { width: 28, height: 28, borderRadius: 6 },

  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderLabel: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 14 },
  sliderValue: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  sliderTrack: { flexDirection: 'row', gap: 6 },
  sliderStop: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  sliderStopText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10 },

  glassPreview: { borderRadius: 16, padding: 20, borderWidth: 1, marginTop: 8 },
  glassPreviewText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, textAlign: 'center' },

  treatmentRow: { flexDirection: 'row', gap: 10 },
  treatmentCard: {
    flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 14, borderWidth: 1,
  },
  treatmentLabel: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13 },

  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  presetCard: {
    width: 100, borderRadius: 14, padding: 10, gap: 8, alignItems: 'center',
  },
  presetSwatches: { flexDirection: 'row', gap: 4 },
  presetSwatch: { width: 16, height: 16, borderRadius: 4 },
  presetCardName: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 10, textAlign: 'center' },
  presetSelectedBadge: {
    position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  resetRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  resetText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },

  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 999, paddingVertical: 16, marginTop: 8,
  },
  saveButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  modalLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, letterSpacing: 1.4 },
  modalInput: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalError: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12 },
  modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
  modalAction: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 92,
    alignItems: 'center',
  },
  modalActionText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13 },
});
