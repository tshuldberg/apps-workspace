import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  COOL_OBSIDIAN,
  DEFAULT_THEME,
  THEME_PRESETS,
  Text,
  mergeTheme,
  useTheme,
  validateTheme,
  type ColorMode,
  type DashboardStyle,
  type SurfaceTreatment,
  type TabBarStyle,
  type ThemeProfile,
  type TypeScale,
} from '@mylife/ui';
import {
  getThemeProfile,
  saveThemeProfile,
  setActiveThemeId,
} from '@mylife/db';
import { useDatabase } from '../../components/DatabaseProvider';
import { HUB_TAB_BAR_CLEARANCE } from './_layout';
import { ColorPickerSheet } from './components/ColorPickerSheet';

type TabKey = 'colors' | 'typography' | 'surfaces' | 'layout';

interface ColorTarget {
  label: string;
  path: 'colors' | 'primary' | 'semantic';
  key: keyof ThemeProfile['colors'];
}

const COLOR_SECTIONS: Array<{ title: string; chips: ColorTarget[] }> = [
  {
    title: 'Background & Surface',
    chips: [
      { label: 'Background', path: 'colors', key: 'background' },
      { label: 'Surface', path: 'colors', key: 'surface' },
      { label: 'Elevated', path: 'colors', key: 'surfaceElevated' },
    ],
  },
  {
    title: 'Text',
    chips: [
      { label: 'Primary', path: 'colors', key: 'text' },
      { label: 'Secondary', path: 'colors', key: 'textSecondary' },
      { label: 'Tertiary', path: 'colors', key: 'textTertiary' },
    ],
  },
  {
    title: 'Accent',
    chips: [
      { label: 'Primary', path: 'primary', key: 'primary' },
      { label: 'Container', path: 'primary', key: 'primaryContainer' },
    ],
  },
  {
    title: 'Semantic',
    chips: [
      { label: 'Danger', path: 'semantic', key: 'danger' },
      { label: 'Success', path: 'semantic', key: 'success' },
      { label: 'Warning', path: 'semantic', key: 'warning' },
    ],
  },
];

const FONT_OPTIONS: Array<{ name: string; bundled: boolean }> = [
  { name: 'Inter', bundled: true },
  { name: 'Plus Jakarta Sans', bundled: true },
  { name: 'DM Sans', bundled: true },
  { name: 'Outfit', bundled: true },
  { name: 'JetBrains Mono', bundled: true },
  { name: 'Newsreader', bundled: false },
  { name: 'Playfair Display', bundled: false },
  { name: 'Space Grotesk', bundled: false },
  { name: 'Nunito', bundled: false },
];

type TypeScalePreset = 'compact' | 'default' | 'large' | 'extra-large';

const TYPE_SCALE_PRESETS: Record<TypeScalePreset, TypeScale> = {
  compact: {
    heroTitle: { size: 28, weight: '700', lineHeight: 34 },
    heading: { size: 20, weight: '700', lineHeight: 26 },
    subheading: { size: 16, weight: '600', lineHeight: 22 },
    body: { size: 14, weight: '400', lineHeight: 20 },
    caption: { size: 12, weight: '400', lineHeight: 16 },
    label: { size: 11, weight: '600', lineHeight: 14, letterSpacing: 1 },
  },
  default: {
    heroTitle: { size: 34, weight: '700', lineHeight: 40 },
    heading: { size: 24, weight: '700', lineHeight: 30 },
    subheading: { size: 18, weight: '600', lineHeight: 24 },
    body: { size: 16, weight: '400', lineHeight: 22 },
    caption: { size: 13, weight: '400', lineHeight: 18 },
    label: { size: 12, weight: '600', lineHeight: 16, letterSpacing: 1.2 },
  },
  large: {
    heroTitle: { size: 40, weight: '700', lineHeight: 46 },
    heading: { size: 28, weight: '700', lineHeight: 34 },
    subheading: { size: 20, weight: '600', lineHeight: 26 },
    body: { size: 18, weight: '400', lineHeight: 24 },
    caption: { size: 14, weight: '400', lineHeight: 19 },
    label: { size: 13, weight: '600', lineHeight: 17, letterSpacing: 1.3 },
  },
  'extra-large': {
    heroTitle: { size: 46, weight: '700', lineHeight: 54 },
    heading: { size: 32, weight: '700', lineHeight: 38 },
    subheading: { size: 22, weight: '600', lineHeight: 28 },
    body: { size: 20, weight: '400', lineHeight: 26 },
    caption: { size: 15, weight: '400', lineHeight: 20 },
    label: { size: 14, weight: '600', lineHeight: 18, letterSpacing: 1.4 },
  },
};

const SPACING_PRESETS = {
  compact: { xs: 2, sm: 4, md: 10, lg: 16, xl: 24 },
  default: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  spacious: { xs: 6, sm: 12, md: 20, lg: 32, xl: 40 },
} as const;

const SURFACE_TREATMENTS: SurfaceTreatment[] = [
  'glass',
  'solid',
  'gradient',
  'neumorphic',
  'flat',
];

const DASHBOARD_STYLES: Array<{ key: DashboardStyle; label: string }> = [
  { key: 'bento-grid', label: 'Bento' },
  { key: 'list', label: 'List' },
  { key: 'cards-horizontal', label: 'Cards' },
];

const TAB_BAR_STYLES: Array<{ key: TabBarStyle; label: string }> = [
  { key: 'floating-pill', label: 'Floating' },
  { key: 'bottom-attached', label: 'Attached' },
  { key: 'minimal-dots', label: 'Dots' },
];

const SHADOW_INTENSITIES: Array<{ key: string; label: string; card: string; elevated: string }> = [
  { key: 'none', label: 'None', card: 'none', elevated: 'none' },
  { key: 'subtle', label: 'Subtle', card: '0 1px 2px rgba(0,0,0,0.1)', elevated: '0 2px 4px rgba(0,0,0,0.12)' },
  { key: 'medium', label: 'Medium', card: '0 4px 8px rgba(0,0,0,0.2)', elevated: '0 8px 16px rgba(0,0,0,0.25)' },
  { key: 'strong', label: 'Strong', card: '0 8px 16px rgba(0,0,0,0.35)', elevated: '0 16px 32px rgba(0,0,0,0.4)' },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// --------------------------------------------------------------------------
// Main screen
// --------------------------------------------------------------------------

export default function ThemeEditorScreen() {
  const router = useRouter();
  const db = useDatabase();
  const chromeTheme = useTheme();
  const params = useLocalSearchParams<{ themeId?: string; mode?: 'fork' | 'edit' }>();

  const initialState = useMemo(() => resolveInitialState(db, params.themeId, params.mode), [db, params.themeId, params.mode]);
  const [baseTheme] = useState<ThemeProfile>(initialState.baseTheme);
  const [edits, setEdits] = useState<Partial<ThemeProfile>>({});
  const [isNewTheme] = useState(initialState.isNew);
  const [existingId] = useState(initialState.existingId);
  const [existingName] = useState(initialState.existingName);

  const currentTheme = useMemo(
    () => mergeTheme(baseTheme, edits),
    [baseTheme, edits],
  );
  const hasChanges = Object.keys(edits).length > 0;

  const [activeTab, setActiveTab] = useState<TabKey>('colors');
  const [pickerTarget, setPickerTarget] = useState<keyof ThemeProfile['colors'] | null>(null);
  const [savePromptVisible, setSavePromptVisible] = useState(false);
  const [saveName, setSaveName] = useState(initialState.isNew
    ? `${baseTheme.name} Custom`
    : existingName ?? 'My Theme');
  const [fontTarget, setFontTarget] = useState<'display' | 'body'>('display');

  const updateColor = useCallback(
    (key: keyof ThemeProfile['colors'], hex: string) => {
      setEdits((prev) => ({
        ...prev,
        colors: { ...prev.colors, [key]: hex } as ThemeProfile['colors'],
      }));
    },
    [],
  );

  const resetColors = useCallback(() => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next.colors;
      return next;
    });
  }, []);

  const setColorMode = useCallback((mode: ColorMode) => {
    setEdits((prev) => ({ ...prev, colorMode: mode }));
  }, []);

  const setFontFamily = useCallback(
    (slot: 'display' | 'body', family: string) => {
      setEdits((prev) => ({
        ...prev,
        fonts: { ...(prev.fonts ?? currentTheme.fonts), [slot]: family } as ThemeProfile['fonts'],
      }));
    },
    [currentTheme.fonts],
  );

  const setTypeScalePreset = useCallback((preset: TypeScalePreset) => {
    setEdits((prev) => ({ ...prev, typeScale: TYPE_SCALE_PRESETS[preset] }));
  }, []);

  const setTreatment = useCallback((treatment: SurfaceTreatment) => {
    setEdits((prev) => ({
      ...prev,
      surfaces: { ...(prev.surfaces ?? currentTheme.surfaces), treatment },
    }));
  }, [currentTheme.surfaces]);

  const setCornerRadius = useCallback((radius: number) => {
    setEdits((prev) => ({
      ...prev,
      surfaces: {
        ...(prev.surfaces ?? currentTheme.surfaces),
        cornerRadius: {
          card: radius,
          button: Math.max(0, radius - 4),
          icon: Math.max(0, Math.min(12, radius - 4)),
          tabBar: radius + 4,
        },
      },
    }));
  }, [currentTheme.surfaces]);

  const setShadowIntensity = useCallback((key: string) => {
    const preset = SHADOW_INTENSITIES.find((s) => s.key === key);
    if (!preset) return;
    setEdits((prev) => ({
      ...prev,
      surfaces: {
        ...(prev.surfaces ?? currentTheme.surfaces),
        shadows: { card: preset.card, elevated: preset.elevated },
      },
    }));
  }, [currentTheme.surfaces]);

  const setDashboardStyle = useCallback((style: DashboardStyle) => {
    setEdits((prev) => ({
      ...prev,
      layout: { ...(prev.layout ?? currentTheme.layout), dashboardStyle: style },
    }));
  }, [currentTheme.layout]);

  const setGridColumns = useCallback((cols: number) => {
    setEdits((prev) => ({
      ...prev,
      layout: { ...(prev.layout ?? currentTheme.layout), moduleGridColumns: cols },
    }));
  }, [currentTheme.layout]);

  const setTabBarStyle = useCallback((style: TabBarStyle) => {
    setEdits((prev) => ({
      ...prev,
      layout: { ...(prev.layout ?? currentTheme.layout), tabBarStyle: style },
    }));
  }, [currentTheme.layout]);

  const setSpacingPreset = useCallback((key: keyof typeof SPACING_PRESETS) => {
    setEdits((prev) => ({
      ...prev,
      layout: { ...(prev.layout ?? currentTheme.layout), spacing: SPACING_PRESETS[key] },
    }));
  }, [currentTheme.layout]);

  const handleSave = useCallback(() => {
    if (isNewTheme) {
      setSavePromptVisible(true);
      return;
    }
    if (!existingId) return;
    const finalTheme: ThemeProfile = { ...currentTheme, id: existingId };
    const validation = validateTheme(finalTheme);
    if (!validation.success) {
      Alert.alert('Invalid Theme', validation.errors.slice(0, 3).join('\n'));
      return;
    }
    saveThemeProfile(db, {
      id: existingId,
      name: existingName ?? existingId,
      json: JSON.stringify(validation.theme),
      source: 'user',
    });
    router.back();
  }, [currentTheme, db, existingId, existingName, isNewTheme, router]);

  const commitNewTheme = useCallback(() => {
    const trimmed = saveName.trim();
    if (trimmed.length === 0) {
      Alert.alert('Name required', 'Please enter a theme name.');
      return;
    }
    const id = `${slugify(trimmed)}-${Date.now().toString(36)}`;
    const finalTheme: ThemeProfile = { ...currentTheme, id, name: trimmed };
    const validation = validateTheme(finalTheme);
    if (!validation.success) {
      Alert.alert('Invalid Theme', validation.errors.slice(0, 3).join('\n'));
      return;
    }
    saveThemeProfile(db, {
      id,
      name: trimmed,
      json: JSON.stringify(validation.theme),
      source: 'user',
    });
    setActiveThemeId(db, id);
    setSavePromptVisible(false);
    router.back();
  }, [currentTheme, db, router, saveName]);

  const handleSaveAsCopy = useCallback(() => {
    // Force the "new theme" naming flow regardless of edit/fork mode.
    setSavePromptVisible(true);
  }, []);

  const handleDiscard = useCallback(() => {
    if (!hasChanges) {
      router.back();
      return;
    }
    Alert.alert(
      'Discard changes?',
      'Your edits will be lost.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ],
    );
  }, [hasChanges, router]);

  const cc = chromeTheme.colors;
  const cs = chromeTheme.surfaces;
  const cl = chromeTheme.layout;

  return (
    <View style={{ flex: 1, backgroundColor: cc.background }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: cc.surface,
            borderBottomColor: cc.border,
            paddingHorizontal: cl.spacing.md,
            paddingVertical: cl.spacing.sm,
          },
        ]}
      >
        <Pressable onPress={handleDiscard} hitSlop={8}>
          <Text style={{ color: cc.textSecondary, fontSize: 16 }}>Back</Text>
        </Pressable>
        <Text style={{ color: cc.text, fontSize: 17, fontWeight: '700' }}>
          {isNewTheme ? 'New Theme' : 'Edit Theme'}
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={!hasChanges}
          hitSlop={8}
        >
          <Text
            style={{
              color: hasChanges ? cc.primary : cc.textTertiary,
              fontSize: 16,
              fontWeight: '600',
            }}
          >
            Save
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: HUB_TAB_BAR_CLEARANCE }}
        stickyHeaderIndices={[0]}
      >
        {/* Preview + Tab selector (sticky) */}
        <View style={{ backgroundColor: cc.background }}>
          <PreviewStrip theme={currentTheme} />
          <View
            style={[
              styles.tabRow,
              { backgroundColor: cc.surface, borderBottomColor: cc.border },
            ]}
          >
            {(['colors', 'typography', 'surfaces', 'layout'] as const).map((tab) => {
              const active = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[
                    styles.tabPill,
                    {
                      backgroundColor: active ? cc.primary : 'transparent',
                      borderColor: active ? cc.primary : cc.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? cc.background : cc.text,
                      fontSize: 13,
                      fontWeight: '600',
                      textTransform: 'capitalize',
                    }}
                  >
                    {tab}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Tab content */}
        <View style={{ padding: cl.spacing.md, gap: cl.spacing.md }}>
          {activeTab === 'colors' && (
            <ColorsTab
              theme={currentTheme}
              chrome={chromeTheme}
              onPickColor={setPickerTarget}
              onSetColorMode={setColorMode}
              onReset={resetColors}
            />
          )}
          {activeTab === 'typography' && (
            <TypographyTab
              theme={currentTheme}
              chrome={chromeTheme}
              fontTarget={fontTarget}
              onSetFontTarget={setFontTarget}
              onSetFontFamily={setFontFamily}
              onSetTypeScalePreset={setTypeScalePreset}
            />
          )}
          {activeTab === 'surfaces' && (
            <SurfacesTab
              theme={currentTheme}
              chrome={chromeTheme}
              onSetTreatment={setTreatment}
              onSetCornerRadius={setCornerRadius}
              onSetShadowIntensity={setShadowIntensity}
            />
          )}
          {activeTab === 'layout' && (
            <LayoutTab
              theme={currentTheme}
              chrome={chromeTheme}
              onSetDashboardStyle={setDashboardStyle}
              onSetGridColumns={setGridColumns}
              onSetTabBarStyle={setTabBarStyle}
              onSetSpacingPreset={setSpacingPreset}
            />
          )}
        </View>

        {/* Bottom actions */}
        <View style={{ padding: cl.spacing.md, gap: cl.spacing.sm }}>
          <Pressable
            onPress={handleSave}
            disabled={!hasChanges}
            style={{
              backgroundColor: hasChanges ? cc.primary : cc.surfaceElevated,
              paddingVertical: 14,
              borderRadius: cs.cornerRadius.button,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: hasChanges ? cc.background : cc.textTertiary,
                fontWeight: '700',
                fontSize: 16,
              }}
            >
              Save Theme
            </Text>
          </Pressable>
          <Pressable
            onPress={handleSaveAsCopy}
            style={{ alignItems: 'center', paddingVertical: 8 }}
          >
            <Text style={{ color: cc.primary, fontSize: 14 }}>Save as copy</Text>
          </Pressable>
          <Pressable
            onPress={handleDiscard}
            style={{ alignItems: 'center', paddingVertical: 8 }}
          >
            <Text style={{ color: cc.danger, fontSize: 14 }}>Discard changes</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Color picker sheet */}
      <ColorPickerSheet
        visible={pickerTarget !== null}
        initialColor={
          pickerTarget ? currentTheme.colors[pickerTarget] : '#FFFFFF'
        }
        onColorChange={(hex) => {
          if (pickerTarget) updateColor(pickerTarget, hex);
        }}
        onDismiss={() => setPickerTarget(null)}
      />

      {/* Save-as-new naming modal */}
      <Modal
        visible={savePromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSavePromptVisible(false)}
      >
        <View style={styles.namingBackdrop}>
          <View
            style={[
              styles.namingSheet,
              {
                backgroundColor: cc.surface,
                borderColor: cc.border,
                borderRadius: cs.cornerRadius.card,
              },
            ]}
          >
            <Text style={{ color: cc.text, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
              Name your theme
            </Text>
            <TextInput
              value={saveName}
              onChangeText={setSaveName}
              maxLength={30}
              autoFocus
              style={[
                styles.nameInput,
                {
                  backgroundColor: cc.surfaceElevated,
                  color: cc.text,
                  borderColor: cc.border,
                  borderRadius: cs.cornerRadius.button,
                },
              ]}
              placeholder="My Custom Theme"
              placeholderTextColor={cc.textTertiary}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
              <Pressable onPress={() => setSavePromptVisible(false)}>
                <Text style={{ color: cc.textSecondary, fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={commitNewTheme}>
                <Text style={{ color: cc.primary, fontSize: 15, fontWeight: '700' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --------------------------------------------------------------------------
// Init resolution
// --------------------------------------------------------------------------

function resolveInitialState(
  db: ReturnType<typeof useDatabase>,
  themeIdParam: string | undefined,
  mode: 'fork' | 'edit' | undefined,
): {
  baseTheme: ThemeProfile;
  isNew: boolean;
  existingId: string | null;
  existingName: string | null;
} {
  const presetIds = Object.keys(THEME_PRESETS);

  // Edit mode: try to load a custom theme row.
  if (mode === 'edit' && themeIdParam && !presetIds.includes(themeIdParam)) {
    try {
      const row = getThemeProfile(db, themeIdParam);
      if (row) {
        const parsed = JSON.parse(row.json);
        const result = validateTheme(parsed);
        if (result.success) {
          return {
            baseTheme: result.theme,
            isNew: false,
            existingId: row.id,
            existingName: row.name,
          };
        }
      }
    } catch {
      // fall through
    }
  }

  // Fork (or preset id, or missing): start from preset.
  if (themeIdParam && themeIdParam in THEME_PRESETS) {
    return {
      baseTheme: THEME_PRESETS[themeIdParam] ?? DEFAULT_THEME,
      isNew: true,
      existingId: null,
      existingName: null,
    };
  }

  return {
    baseTheme: COOL_OBSIDIAN,
    isNew: true,
    existingId: null,
    existingName: null,
  };
}

// --------------------------------------------------------------------------
// Preview strip
// --------------------------------------------------------------------------

function PreviewStrip({ theme }: { theme: ThemeProfile }) {
  const { colors, surfaces, fonts, typeScale } = theme;
  return (
    <View
      style={{
        height: 100,
        backgroundColor: colors.background,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: colors.primary,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: Math.min(20, typeScale.heading.size),
            fontWeight: typeScale.heading.weight,
            color: colors.text,
            fontFamily: fonts.display,
          }}
          numberOfLines={1}
        >
          {theme.name}
        </Text>
        <Text
          style={{
            fontSize: typeScale.caption.size,
            color: colors.textSecondary,
            fontFamily: fonts.body,
          }}
          numberOfLines={1}
        >
          Live preview · {theme.colorMode}
        </Text>
      </View>
      <View
        style={{
          width: 60,
          height: 60,
          backgroundColor: colors.surface,
          borderRadius: surfaces.cornerRadius.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />
      <View
        style={{
          width: 60,
          height: 60,
          backgroundColor: colors.surfaceElevated,
          borderRadius: surfaces.cornerRadius.card,
        }}
      />
    </View>
  );
}

// --------------------------------------------------------------------------
// Colors tab
// --------------------------------------------------------------------------

interface ColorsTabProps {
  theme: ThemeProfile;
  chrome: ThemeProfile;
  onPickColor: (key: keyof ThemeProfile['colors']) => void;
  onSetColorMode: (mode: ColorMode) => void;
  onReset: () => void;
}

function ColorsTab({ theme, chrome, onPickColor, onSetColorMode, onReset }: ColorsTabProps) {
  const cc = chrome.colors;
  return (
    <View style={{ gap: chrome.layout.spacing.md }}>
      {/* Color mode */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['dark', 'light'] as ColorMode[]).map((m) => {
          const active = theme.colorMode === m;
          return (
            <Pressable
              key={m}
              onPress={() => onSetColorMode(m)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: chrome.surfaces.cornerRadius.button,
                backgroundColor: active ? cc.primary : cc.surface,
                borderWidth: 1,
                borderColor: active ? cc.primary : cc.border,
              }}
            >
              <Text
                style={{
                  color: active ? cc.background : cc.text,
                  fontWeight: '600',
                  textTransform: 'capitalize',
                }}
              >
                {m}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {COLOR_SECTIONS.map((section) => (
        <View key={section.title} style={{ gap: 8 }}>
          <Text style={{ color: cc.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
            {section.title.toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {section.chips.map((chip) => (
              <ColorChip
                key={chip.key}
                label={chip.label}
                color={theme.colors[chip.key]}
                onPress={() => onPickColor(chip.key)}
                chromeColors={cc}
              />
            ))}
          </View>
        </View>
      ))}

      <Pressable
        onPress={onReset}
        style={{
          alignSelf: 'flex-start',
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: chrome.surfaces.cornerRadius.button,
          borderWidth: 1,
          borderColor: cc.border,
          backgroundColor: cc.surface,
        }}
      >
        <Text style={{ color: cc.textSecondary, fontSize: 13 }}>Reset colors to preset</Text>
      </Pressable>
    </View>
  );
}

interface ColorChipProps {
  label: string;
  color: string;
  onPress: () => void;
  chromeColors: ThemeProfile['colors'];
}

function ColorChip({ label, color, onPress, chromeColors }: ColorChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 100,
        padding: 8,
        gap: 6,
        borderRadius: 10,
        backgroundColor: chromeColors.surface,
        borderWidth: 1,
        borderColor: chromeColors.border,
      }}
    >
      <View
        style={{
          height: 44,
          borderRadius: 6,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: chromeColors.border,
        }}
      />
      <Text style={{ color: chromeColors.text, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color: chromeColors.textTertiary, fontSize: 10, fontFamily: 'monospace' }} numberOfLines={1}>
        {color}
      </Text>
    </Pressable>
  );
}

// --------------------------------------------------------------------------
// Typography tab
// --------------------------------------------------------------------------

interface TypographyTabProps {
  theme: ThemeProfile;
  chrome: ThemeProfile;
  fontTarget: 'display' | 'body';
  onSetFontTarget: (slot: 'display' | 'body') => void;
  onSetFontFamily: (slot: 'display' | 'body', family: string) => void;
  onSetTypeScalePreset: (preset: TypeScalePreset) => void;
}

function TypographyTab({
  theme,
  chrome,
  fontTarget,
  onSetFontTarget,
  onSetFontFamily,
  onSetTypeScalePreset,
}: TypographyTabProps) {
  const cc = chrome.colors;
  const currentFamily = theme.fonts[fontTarget];

  return (
    <View style={{ gap: chrome.layout.spacing.md }}>
      {/* Target toggle */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['display', 'body'] as const).map((slot) => {
          const active = fontTarget === slot;
          return (
            <Pressable
              key={slot}
              onPress={() => onSetFontTarget(slot)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: chrome.surfaces.cornerRadius.button,
                backgroundColor: active ? cc.primary : cc.surface,
                borderColor: active ? cc.primary : cc.border,
                borderWidth: 1,
              }}
            >
              <Text
                style={{
                  color: active ? cc.background : cc.text,
                  fontWeight: '600',
                  textTransform: 'capitalize',
                }}
              >
                {slot} font
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ color: cc.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
        FONT FAMILY
      </Text>
      <View style={{ gap: 8 }}>
        {FONT_OPTIONS.map((font) => {
          const isActive = currentFamily === font.name;
          return (
            <Pressable
              key={font.name}
              onPress={() => onSetFontFamily(fontTarget, font.name)}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: chrome.surfaces.cornerRadius.button,
                backgroundColor: isActive ? cc.surfaceElevated : cc.surface,
                borderWidth: 1,
                borderColor: isActive ? cc.primary : cc.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: cc.text,
                    fontSize: 18,
                    fontFamily: font.name,
                  }}
                >
                  {font.name}
                </Text>
                <Text
                  style={{
                    color: cc.textTertiary,
                    fontSize: 11,
                    marginTop: 2,
                  }}
                >
                  {font.bundled ? 'Bundled' : 'Download required'}
                </Text>
              </View>
              {isActive && (
                <Text style={{ color: cc.primary, fontSize: 13, fontWeight: '700' }}>Selected</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={{ color: cc.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
        TYPE SCALE
      </Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(['compact', 'default', 'large', 'extra-large'] as TypeScalePreset[]).map((preset) => {
          // Determine active by hero title size match.
          const active = theme.typeScale.heroTitle.size === TYPE_SCALE_PRESETS[preset].heroTitle.size;
          return (
            <Pressable
              key={preset}
              onPress={() => onSetTypeScalePreset(preset)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: chrome.surfaces.cornerRadius.button,
                backgroundColor: active ? cc.primary : cc.surface,
                borderColor: active ? cc.primary : cc.border,
                borderWidth: 1,
              }}
            >
              <Text
                style={{
                  color: active ? cc.background : cc.text,
                  fontSize: 11,
                  fontWeight: '600',
                  textTransform: 'capitalize',
                }}
                numberOfLines={1}
              >
                {preset.replace('-', ' ')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// --------------------------------------------------------------------------
// Surfaces tab
// --------------------------------------------------------------------------

interface SurfacesTabProps {
  theme: ThemeProfile;
  chrome: ThemeProfile;
  onSetTreatment: (treatment: SurfaceTreatment) => void;
  onSetCornerRadius: (radius: number) => void;
  onSetShadowIntensity: (key: string) => void;
}

function SurfacesTab({
  theme,
  chrome,
  onSetTreatment,
  onSetCornerRadius,
  onSetShadowIntensity,
}: SurfacesTabProps) {
  const cc = chrome.colors;
  const radius = theme.surfaces.cornerRadius.card;

  // Identify current shadow preset by matching card string.
  const currentShadowKey = SHADOW_INTENSITIES.find(
    (s) => s.card === theme.surfaces.shadows.card,
  )?.key ?? 'subtle';

  return (
    <View style={{ gap: chrome.layout.spacing.md }}>
      <Text style={{ color: cc.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
        TREATMENT
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SURFACE_TREATMENTS.map((treatment) => {
          const active = theme.surfaces.treatment === treatment;
          return (
            <Pressable
              key={treatment}
              onPress={() => onSetTreatment(treatment)}
              style={{
                width: '48%',
                padding: 12,
                borderRadius: chrome.surfaces.cornerRadius.card,
                backgroundColor: cc.surface,
                borderWidth: active ? 2 : 1,
                borderColor: active ? cc.primary : cc.border,
                alignItems: 'center',
                gap: 8,
              }}
            >
              <TreatmentPreview treatment={treatment} chrome={chrome} />
              <Text style={{ color: cc.text, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>
                {treatment}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ color: cc.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
        CORNER RADIUS
      </Text>
      <View
        style={{
          padding: 14,
          backgroundColor: cc.surface,
          borderRadius: chrome.surfaces.cornerRadius.card,
          borderWidth: 1,
          borderColor: cc.border,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: cc.text, fontSize: 14 }}>Radius</Text>
          <Text style={{ color: cc.textSecondary, fontFamily: 'monospace' }}>{radius}px</Text>
        </View>
        <RadiusSlider value={radius} onChange={onSetCornerRadius} chromeColors={cc} />
        <View
          style={{
            alignSelf: 'center',
            width: 120,
            height: 50,
            backgroundColor: cc.primary,
            borderRadius: radius,
            marginTop: 4,
          }}
        />
      </View>

      <Text style={{ color: cc.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
        SHADOW INTENSITY
      </Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {SHADOW_INTENSITIES.map((s) => {
          const active = currentShadowKey === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => onSetShadowIntensity(s.key)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: chrome.surfaces.cornerRadius.button,
                backgroundColor: active ? cc.primary : cc.surface,
                borderColor: active ? cc.primary : cc.border,
                borderWidth: 1,
              }}
            >
              <Text
                style={{
                  color: active ? cc.background : cc.text,
                  fontSize: 12,
                  fontWeight: '600',
                }}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TreatmentPreview({ treatment, chrome }: { treatment: SurfaceTreatment; chrome: ThemeProfile }) {
  const cc = chrome.colors;
  const base = {
    width: 80,
    height: 48,
    borderRadius: 10,
  };
  switch (treatment) {
    case 'glass':
      return (
        <View
          style={{
            ...base,
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
          }}
        />
      );
    case 'solid':
      return (
        <View
          style={{
            ...base,
            backgroundColor: cc.surfaceElevated,
            borderWidth: 1,
            borderColor: cc.border,
          }}
        />
      );
    case 'gradient':
      return (
        <View
          style={{
            ...base,
            backgroundColor: cc.primary,
            opacity: 0.75,
          }}
        />
      );
    case 'neumorphic':
      return (
        <View
          style={{
            ...base,
            backgroundColor: cc.surface,
            shadowColor: '#000',
            shadowOffset: { width: 2, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 4,
          }}
        />
      );
    case 'flat':
    default:
      return (
        <View
          style={{
            ...base,
            backgroundColor: cc.surface,
            borderWidth: 1,
            borderColor: cc.border,
          }}
        />
      );
  }
}

interface RadiusSliderProps {
  value: number;
  onChange: (v: number) => void;
  chromeColors: ThemeProfile['colors'];
}

function RadiusSlider({ value, onChange, chromeColors }: RadiusSliderProps) {
  const steps = [0, 4, 8, 12, 16, 20, 24, 28];
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {steps.map((step) => {
        const active = value === step;
        return (
          <Pressable
            key={step}
            onPress={() => onChange(step)}
            style={{
              flex: 1,
              paddingVertical: 6,
              alignItems: 'center',
              backgroundColor: active ? chromeColors.primary : chromeColors.surfaceElevated,
              borderRadius: 6,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: active ? chromeColors.background : chromeColors.textSecondary,
              }}
            >
              {step}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// --------------------------------------------------------------------------
// Layout tab
// --------------------------------------------------------------------------

interface LayoutTabProps {
  theme: ThemeProfile;
  chrome: ThemeProfile;
  onSetDashboardStyle: (style: DashboardStyle) => void;
  onSetGridColumns: (cols: number) => void;
  onSetTabBarStyle: (style: TabBarStyle) => void;
  onSetSpacingPreset: (key: keyof typeof SPACING_PRESETS) => void;
}

function LayoutTab({
  theme,
  chrome,
  onSetDashboardStyle,
  onSetGridColumns,
  onSetTabBarStyle,
  onSetSpacingPreset,
}: LayoutTabProps) {
  const cc = chrome.colors;
  return (
    <View style={{ gap: chrome.layout.spacing.md }}>
      <Text style={{ color: cc.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
        DASHBOARD STYLE
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {DASHBOARD_STYLES.map((s) => {
          const active = theme.layout.dashboardStyle === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => onSetDashboardStyle(s.key)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: chrome.surfaces.cornerRadius.card,
                backgroundColor: cc.surface,
                borderWidth: active ? 2 : 1,
                borderColor: active ? cc.primary : cc.border,
                alignItems: 'center',
                gap: 8,
              }}
            >
              <DashboardMiniMock style={s.key} chromeColors={cc} />
              <Text style={{ color: cc.text, fontSize: 12, fontWeight: '600' }}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ color: cc.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
        GRID COLUMNS
      </Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[3, 4, 5].map((cols) => {
          const active = theme.layout.moduleGridColumns === cols;
          return (
            <Pressable
              key={cols}
              onPress={() => onSetGridColumns(cols)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: chrome.surfaces.cornerRadius.button,
                backgroundColor: active ? cc.primary : cc.surface,
                borderColor: active ? cc.primary : cc.border,
                borderWidth: 1,
              }}
            >
              <Text
                style={{
                  color: active ? cc.background : cc.text,
                  fontWeight: '600',
                }}
              >
                {cols}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ color: cc.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
        TAB BAR STYLE
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {TAB_BAR_STYLES.map((s) => {
          const active = theme.layout.tabBarStyle === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => onSetTabBarStyle(s.key)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: chrome.surfaces.cornerRadius.card,
                backgroundColor: cc.surface,
                borderWidth: active ? 2 : 1,
                borderColor: active ? cc.primary : cc.border,
                alignItems: 'center',
                gap: 6,
              }}
            >
              <TabBarMiniMock style={s.key} chromeColors={cc} />
              <Text style={{ color: cc.text, fontSize: 12, fontWeight: '600' }}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ color: cc.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
        SPACING DENSITY
      </Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(['compact', 'default', 'spacious'] as const).map((key) => {
          const active = theme.layout.spacing.md === SPACING_PRESETS[key].md;
          return (
            <Pressable
              key={key}
              onPress={() => onSetSpacingPreset(key)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: chrome.surfaces.cornerRadius.button,
                backgroundColor: active ? cc.primary : cc.surface,
                borderColor: active ? cc.primary : cc.border,
                borderWidth: 1,
              }}
            >
              <Text
                style={{
                  color: active ? cc.background : cc.text,
                  fontSize: 12,
                  fontWeight: '600',
                  textTransform: 'capitalize',
                }}
              >
                {key}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DashboardMiniMock({ style, chromeColors }: { style: DashboardStyle; chromeColors: ThemeProfile['colors'] }) {
  const dot = chromeColors.primary;
  const bg = chromeColors.surfaceElevated;
  if (style === 'bento-grid') {
    return (
      <View style={{ width: 72, height: 48, gap: 3 }}>
        <View style={{ flexDirection: 'row', gap: 3, flex: 1 }}>
          <View style={{ flex: 2, backgroundColor: dot, borderRadius: 3 }} />
          <View style={{ flex: 1, backgroundColor: bg, borderRadius: 3 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 3, flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: bg, borderRadius: 3 }} />
          <View style={{ flex: 1, backgroundColor: bg, borderRadius: 3 }} />
          <View style={{ flex: 1, backgroundColor: dot, borderRadius: 3 }} />
        </View>
      </View>
    );
  }
  if (style === 'list') {
    return (
      <View style={{ width: 72, height: 48, gap: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              height: 8,
              backgroundColor: i === 0 ? dot : bg,
              borderRadius: 2,
            }}
          />
        ))}
      </View>
    );
  }
  // cards-horizontal
  return (
    <View style={{ width: 72, height: 48, flexDirection: 'row', gap: 3 }}>
      <View style={{ flex: 1, backgroundColor: dot, borderRadius: 4 }} />
      <View style={{ flex: 1, backgroundColor: bg, borderRadius: 4 }} />
      <View style={{ flex: 1, backgroundColor: bg, borderRadius: 4 }} />
    </View>
  );
}

function TabBarMiniMock({ style, chromeColors }: { style: TabBarStyle; chromeColors: ThemeProfile['colors'] }) {
  const dot = chromeColors.primary;
  const bg = chromeColors.surfaceElevated;
  if (style === 'floating-pill') {
    return (
      <View
        style={{
          width: 72,
          height: 20,
          backgroundColor: bg,
          borderRadius: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 4,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === 0 ? dot : chromeColors.textTertiary,
            }}
          />
        ))}
      </View>
    );
  }
  if (style === 'bottom-attached') {
    return (
      <View
        style={{
          width: 72,
          height: 20,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 4,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === 0 ? dot : chromeColors.textTertiary,
            }}
          />
        ))}
      </View>
    );
  }
  // minimal-dots
  return (
    <View
      style={{
        width: 72,
        height: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: i === 0 ? dot : chromeColors.textTertiary,
          }}
        />
      ))}
    </View>
  );
}

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  namingBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  namingSheet: {
    padding: 20,
    borderWidth: 1,
  },
  nameInput: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});
