import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react-native';
import {
  OPEN_BURROW,
  adjustLightness,
  contrastRatio,
  generatePalette,
  getPreset,
  mirrorMode,
  parseColor,
  ratesAA,
  resolveProfile,
  type MkColors,
  type MkDensity,
  type MkThemeStyleExtras,
  type MkHeadingWeight,
  type MkModeSpec,
  type MkPaletteMode,
  type MkPrimaryColors,
  type MkRadiusScale,
  type MkThemeProfile,
} from '@mylife/meerkat-theme';
import { Button, HonestNotice, SectionHeader } from '../components/kit';
import { MK_MONO, MK_RADIUS } from '../theme/tokens';
import {
  useAppThemeColors,
  useMkStyles,
  useThemeLibrary,
} from '../providers/AppThemeProvider';

// The custom theme editor. Holds an editable DRAFT MkThemeProfile in state and
// reskins a LIVE preview from it (independent of the global app theme) so the
// user sees the theme they are building, not the one currently applied. Color
// editing is hex-TextInput + lightness nudges only (RN has no native picker, and
// we add no dependency). Every value the readout shows is computed from real
// WCAG contrast math, never hardcoded. Themes are device-local and never synced.

// The eight primaries a user edits directly, in display order.
const PRIMARY_AXES: ReadonlyArray<{ key: keyof MkPrimaryColors; label: string }> = [
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'text', label: 'Text' },
  { key: 'danger', label: 'Danger' },
  { key: 'warning', label: 'Warning' },
  { key: 'info', label: 'Info' },
  { key: 'success', label: 'Success' },
];

// All 22 resolved tokens, for the Advanced disclosure.
const ADVANCED_TOKENS: ReadonlyArray<keyof MkColors> = [
  'background',
  'surface',
  'surfaceElevated',
  'surfaceHigh',
  'accent',
  'accentDim',
  'onAccent',
  'text',
  'textSecondary',
  'textTertiary',
  'danger',
  'warning',
  'info',
  'success',
  'dangerSoft',
  'warningSoft',
  'successSoft',
  'infoSoft',
  'border',
  'borderStrong',
  'glass',
  'glassBorder',
];

const MODE_OPTIONS: ReadonlyArray<{ value: MkPaletteMode; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const RADIUS_OPTIONS: ReadonlyArray<{ value: MkRadiusScale; label: string }> = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
];

const DENSITY_OPTIONS: ReadonlyArray<{ value: MkDensity; label: string }> = [
  { value: 'compact', label: 'Compact' },
  { value: 'cozy', label: 'Cozy' },
  { value: 'comfortable', label: 'Comfortable' },
];

const WEIGHT_OPTIONS: ReadonlyArray<{ value: MkHeadingWeight; label: string }> = [
  { value: '600', label: '600' },
  { value: '700', label: '700' },
  { value: '800', label: '800' },
];

// Plan 56 feature 1: the extended style axes (closed enums; a community theme
// carries these to members' chat bubbles and panels).
const TYPOGRAPHY_OPTIONS = [
  { value: 'compact', label: 'Compact' },
  { value: 'regular', label: 'Regular' },
  { value: 'large', label: 'Large' },
] as const;
const BUBBLE_OPTIONS = [
  { value: 'rounded', label: 'Rounded' },
  { value: 'square', label: 'Square' },
  { value: 'pill', label: 'Pill' },
] as const;
const ROLE_BUBBLE_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'square', label: 'Square' },
  { value: 'pill', label: 'Pill' },
] as const;
const BORDER_OPTIONS = [
  { value: 'hairline', label: 'Hairline' },
  { value: 'regular', label: 'Regular' },
  { value: 'bold', label: 'Bold' },
] as const;
const SHADOW_OPTIONS = [
  { value: 'flat', label: 'Flat' },
  { value: 'soft', label: 'Soft' },
  { value: 'deep', label: 'Deep' },
] as const;
const TREATMENT_OPTIONS = [
  { value: 'plain', label: 'Plain' },
  { value: 'tinted', label: 'Tinted' },
  { value: 'washed', label: 'Washed' },
] as const;

function cloneSpec(spec: MkModeSpec): MkModeSpec {
  return {
    primary: { ...spec.primary },
    overrides: spec.overrides ? { ...spec.overrides } : undefined,
  };
}

function cloneProfile(profile: MkThemeProfile): MkThemeProfile {
  return {
    ...profile,
    shape: { radius: profile.shape.radius },
    light: cloneSpec(profile.light),
    dark: profile.dark ? cloneSpec(profile.dark) : undefined,
  };
}

// Apply an update to the spec for `mode`. Editing the dark mode when no dark
// spec exists yet forks one from light, so a single-mode theme stays valid and
// the first dark edit creates a real dark variant.
function withSpec(
  profile: MkThemeProfile,
  mode: MkPaletteMode,
  update: (spec: MkModeSpec) => MkModeSpec,
): MkThemeProfile {
  if (mode === 'dark') {
    const base = profile.dark ?? cloneSpec(profile.light);
    return { ...profile, dark: update(base) };
  }
  return { ...profile, light: update(profile.light) };
}

function withPrimary(
  spec: MkModeSpec,
  key: keyof MkPrimaryColors,
  value: string,
): MkModeSpec {
  const primary: MkPrimaryColors = { ...spec.primary };
  primary[key] = value;
  return { ...spec, primary };
}

function withOverride(
  spec: MkModeSpec,
  key: keyof MkColors,
  value: string,
): MkModeSpec {
  const overrides: Partial<MkColors> = { ...(spec.overrides ?? {}) };
  overrides[key] = value;
  return { ...spec, overrides };
}

function humanize(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function isValidColor(value: string): boolean {
  try {
    parseColor(value);
    return true;
  } catch {
    return false;
  }
}

export default function ThemeEditorScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { customThemes, saveCustomTheme } = useThemeLibrary();

  const baseId = typeof params.base === 'string' ? params.base : undefined;

  const [draft, setDraft] = useState<MkThemeProfile>(() => {
    const fromPreset = baseId ? getPreset(baseId) : undefined;
    const fromCustom = baseId
      ? customThemes.find((theme) => theme.id === baseId)?.profile
      : undefined;
    return cloneProfile(fromPreset ?? fromCustom ?? OPEN_BURROW);
  });
  const [previewMode, setPreviewMode] = useState<MkPaletteMode>('light');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(draft.name);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The resolved palette of the DRAFT for the previewed mode. Drives the live
  // preview and the contrast readout. resolveProfile only parses already-valid
  // committed colors, so it never throws here.
  const preview = useMemo<MkColors>(
    () => resolveProfile(draft, previewMode),
    [draft, previewMode],
  );

  // The spec the user is editing right now (light, or dark falling back to light
  // until a dark variant exists).
  const editSpec: MkModeSpec =
    previewMode === 'dark' ? draft.dark ?? draft.light : draft.light;

  const setPrimary = useCallback(
    (key: keyof MkPrimaryColors, value: string) => {
      setDraft((d) => withSpec(d, previewMode, (s) => withPrimary(s, key, value)));
    },
    [previewMode],
  );

  const setOverride = useCallback(
    (key: keyof MkColors, value: string) => {
      setDraft((d) => withSpec(d, previewMode, (s) => withOverride(s, key, value)));
    },
    [previewMode],
  );

  const setRadius = useCallback((radius: MkRadiusScale) => {
    setDraft((d) => ({ ...d, shape: { radius } }));
  }, []);

  const setDensity = useCallback((density: MkDensity) => {
    setDraft((d) => ({ ...d, density }));
  }, []);

  const setHeadingWeight = useCallback((headingWeight: MkHeadingWeight) => {
    setDraft((d) => ({ ...d, headingWeight }));
  }, []);

  const setStyleExtra = useCallback((key: keyof MkThemeStyleExtras, value: string) => {
    setDraft((d) => ({ ...d, styleExtras: { ...d.styleExtras, [key]: value } }));
  }, []);

  // Feature 4: per-role bubble shapes ('' clears the role back to the
  // community-wide shape). Same closed catalog as the bubbleShape axis.
  const setRoleBubbleShape = useCallback((role: 'owner' | 'admin' | 'member', value: string) => {
    setDraft((d) => {
      const byRole = { ...(d.styleExtras?.bubbleShapesByRole ?? {}) };
      if (value === 'default') delete byRole[role];
      else byRole[role] = value as NonNullable<MkThemeStyleExtras['bubbleShapesByRole']>[typeof role];
      const styleExtras = { ...d.styleExtras, bubbleShapesByRole: byRole };
      if (Object.keys(byRole).length === 0) delete (styleExtras as { bubbleShapesByRole?: unknown }).bubbleShapesByRole;
      return { ...d, styleExtras };
    });
  }, []);

  // Local, deterministic generator seeded by the current accent. Keeps the
  // draft's id/name/provenance; adopts the generated palette + shape defaults.
  const onGenerate = useCallback(() => {
    setDraft((d) => {
      const spec = previewMode === 'dark' ? d.dark ?? d.light : d.light;
      const generated = generatePalette(spec.primary.accent, previewMode);
      return {
        ...generated,
        id: d.id,
        name: d.name,
        basePresetId: d.basePresetId,
      };
    });
  }, [previewMode]);

  // Derive the opposite mode from the current one so the theme works in both.
  const onMirror = useCallback(() => {
    setDraft((d) => {
      const mirrored = mirrorMode(d, previewMode);
      return previewMode === 'light'
        ? { ...d, dark: mirrored }
        : { ...d, light: mirrored };
    });
  }, [previewMode]);

  const startSave = useCallback(() => {
    setNameDraft(draft.name);
    setNaming(true);
  }, [draft.name]);

  // Deep-linkable screen: back must not dead-end when this is the first route.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/appearance');
  }, [router]);

  const commitSave = useCallback(() => {
    setSaveError(null);
    const trimmed = nameDraft.trim();
    const name = trimmed.length > 0 ? trimmed : draft.name;
    const id = saveCustomTheme(draft, { name, basePresetId: baseId ?? null });
    // A null id is a REAL failed save; silently staying open reads as a dead tap.
    if (id) goBack();
    else setSaveError('The theme could not be saved on this device. Try again.');
  }, [nameDraft, draft, saveCustomTheme, baseId, goBack]);

  const cancel = useCallback(() => {
    goBack();
  }, [goBack]);

  const radiusVal = MK_RADIUS[draft.shape.radius];
  const previewPad =
    draft.density === 'compact' ? 8 : draft.density === 'cozy' ? 12 : 16;
  const mirrorTarget: MkPaletteMode = previewMode === 'light' ? 'dark' : 'light';

  const contrastRows: ReadonlyArray<{ label: string; ratio: number; pass: boolean }> = [
    {
      label: 'Body on background',
      ratio: contrastRatio(preview.text, preview.background),
      pass: ratesAA(preview.text, preview.background),
    },
    {
      label: 'Body on surface',
      ratio: contrastRatio(preview.text, preview.surface),
      pass: ratesAA(preview.text, preview.surface),
    },
    {
      label: 'Label on accent',
      ratio: contrastRatio(preview.onAccent, preview.accent),
      pass: ratesAA(preview.onAccent, preview.accent),
    },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Custom theme</Text>
        <Text style={styles.subtitle}>
          Edit colors, shape, and feel. Saved to this device only.
        </Text>

        {/* Live preview, reskinned from the DRAFT (not the active app theme). */}
        <View
          style={[
            styles.previewPane,
            { backgroundColor: preview.background, borderColor: preview.border },
          ]}
        >
          <View
            style={[
              styles.previewTabbar,
              {
                backgroundColor: preview.surface,
                borderColor: preview.border,
                borderRadius: radiusVal,
              },
            ]}
          >
            {['Home', 'Channels', 'Me'].map((tab, index) => (
              <Text
                key={tab}
                style={{
                  color: index === 1 ? preview.accent : preview.textTertiary,
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                {tab}
              </Text>
            ))}
          </View>

          <View
            style={{
              backgroundColor: preview.surface,
              borderColor: preview.border,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: radiusVal,
              padding: previewPad,
              gap: 6,
            }}
          >
            <View style={styles.previewCardTop}>
              <Text
                style={{
                  color: preview.text,
                  fontSize: 15,
                  fontWeight: draft.headingWeight,
                }}
              >
                General
              </Text>
              <View
                style={{
                  backgroundColor: preview.accent,
                  borderRadius: MK_RADIUS.pill,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{ color: preview.onAccent, fontSize: 11, fontWeight: '800' }}
                >
                  3 new
                </Text>
              </View>
            </View>
            <Text
              style={{ color: preview.textSecondary, fontSize: 12.5, lineHeight: 18 }}
            >
              A calm place to share with people you trust.
            </Text>
            <View
              style={{
                backgroundColor: preview.accent,
                borderRadius: radiusVal,
                paddingVertical: 9,
                alignItems: 'center',
                marginTop: 2,
              }}
            >
              <Text
                style={{ color: preview.onAccent, fontSize: 13, fontWeight: '700' }}
              >
                Open channel
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: preview.surfaceHigh,
              borderColor: preview.glassBorder,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: radiusVal,
              paddingHorizontal: 10,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: preview.accentDim, fontSize: 9 }}>●</Text>
            <Text
              style={{ color: preview.textSecondary, fontSize: 11.5, flex: 1 }}
            >
              Shows only what this device has actually recorded.
            </Text>
          </View>

          <View
            style={{
              backgroundColor: preview.dangerSoft,
              borderColor: preview.danger,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: radiusVal,
              paddingHorizontal: 10,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: preview.danger, fontSize: 11.5 }}>
              Could not reach that peer yet.
            </Text>
          </View>
        </View>

        <Segmented
          options={MODE_OPTIONS}
          value={previewMode}
          onChange={setPreviewMode}
        />

        <View style={styles.contrastBlock}>
          {contrastRows.map((row) => (
            <View key={row.label} style={styles.contrastRow}>
              <Text style={styles.contrastText}>
                {`${row.label}: ${row.ratio.toFixed(1)}:1`}
              </Text>
              <Text style={styles.contrastDot}>·</Text>
              <View
                style={[
                  styles.chip,
                  { backgroundColor: row.pass ? c.successSoft : c.surfaceElevated },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: row.pass ? c.success : c.textSecondary },
                  ]}
                >
                  {row.pass ? 'AA' : 'Below AA'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.panel}>
          <SectionHeader
            title="Colors"
            hint="Edit the main colors. Secondary shades update automatically."
          />
          {PRIMARY_AXES.map((axis) => (
            <LabeledColor
              key={axis.key}
              label={axis.label}
              value={editSpec.primary[axis.key]}
              onChange={(value) => setPrimary(axis.key, value)}
            />
          ))}
        </View>

        <View style={styles.panel}>
          <SectionHeader title="Shape and feel" />
          <Text style={styles.fieldLabel}>Corner radius</Text>
          <Segmented
            options={RADIUS_OPTIONS}
            value={draft.shape.radius}
            onChange={setRadius}
          />
          <Text style={styles.fieldLabel}>Density</Text>
          <Segmented
            options={DENSITY_OPTIONS}
            value={draft.density}
            onChange={setDensity}
          />
          <Text style={styles.fieldLabel}>Heading weight</Text>
          <Segmented
            options={WEIGHT_OPTIONS}
            value={draft.headingWeight}
            onChange={setHeadingWeight}
          />
          <Text style={styles.fieldLabel}>Typography scale</Text>
          <Segmented
            options={TYPOGRAPHY_OPTIONS}
            value={draft.styleExtras?.typographyScale ?? 'regular'}
            onChange={(v) => setStyleExtra('typographyScale', v)}
          />
          <Text style={styles.fieldLabel}>Bubble shape</Text>
          <Segmented
            options={BUBBLE_OPTIONS}
            value={draft.styleExtras?.bubbleShape ?? 'rounded'}
            onChange={(v) => setStyleExtra('bubbleShape', v)}
          />
          <Text style={styles.fieldLabel}>Border weight</Text>
          <Segmented
            options={BORDER_OPTIONS}
            value={draft.styleExtras?.borderWeight ?? 'hairline'}
            onChange={(v) => setStyleExtra('borderWeight', v)}
          />
          <Text style={styles.fieldLabel}>Shadow depth</Text>
          <Segmented
            options={SHADOW_OPTIONS}
            value={draft.styleExtras?.shadowDepth ?? 'flat'}
            onChange={(v) => setStyleExtra('shadowDepth', v)}
          />
          <Text style={styles.fieldLabel}>Background treatment</Text>
          <Segmented
            options={TREATMENT_OPTIONS}
            value={draft.styleExtras?.backgroundTreatment ?? 'plain'}
            onChange={(v) => setStyleExtra('backgroundTreatment', v)}
          />
          {(['owner', 'admin', 'member'] as const).map((role) => (
            <React.Fragment key={role}>
              <Text style={styles.fieldLabel}>Bubble shape: {role}s</Text>
              <Segmented
                options={ROLE_BUBBLE_OPTIONS}
                value={draft.styleExtras?.bubbleShapesByRole?.[role] ?? 'default'}
                onChange={(v) => setRoleBubbleShape(role, v)}
              />
            </React.Fragment>
          ))}
        </View>

        <View style={styles.panel}>
          <SectionHeader title="Shortcuts" />
          <Button
            title="Generate from a color"
            variant="secondary"
            onPress={onGenerate}
          />
          <Button
            title={`Mirror to ${mirrorTarget}`}
            variant="secondary"
            onPress={onMirror}
          />
        </View>

        <View style={styles.panel}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Advanced colors"
            accessibilityState={{ expanded: advancedOpen }}
            onPress={() => setAdvancedOpen((open) => !open)}
            style={({ pressed }) => [styles.advancedHeader, pressed && styles.pressed]}
          >
            {advancedOpen ? (
              <ChevronDown size={18} color={c.textSecondary} strokeWidth={2} />
            ) : (
              <ChevronRight size={18} color={c.textSecondary} strokeWidth={2} />
            )}
            <Text style={styles.advancedTitle}>Advanced colors</Text>
          </Pressable>
          {advancedOpen ? (
            <View style={styles.advancedList}>
              <Text style={styles.advancedHint}>
                Override any token directly. This wins over the automatic value.
              </Text>
              {ADVANCED_TOKENS.map((token) => (
                <LabeledColor
                  key={token}
                  label={humanize(token)}
                  value={preview[token]}
                  onChange={(value) => setOverride(token, value)}
                />
              ))}
            </View>
          ) : null}
        </View>

        <HonestNotice text="Custom themes stay on this device. They only change how Meerkat looks for you and are never sent to anyone." />

        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {saveError ? (
          <Text style={{ color: c.danger, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
            {saveError}
          </Text>
        ) : null}
        {naming ? (
          <View style={styles.nameRow}>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Theme name"
              placeholderTextColor={c.textTertiary}
              autoFocus
              style={styles.nameInput}
            />
            <Button title="Save" onPress={commitSave} />
            <Button title="Cancel" variant="ghost" onPress={() => setNaming(false)} />
          </View>
        ) : (
          <View style={styles.actionsRow}>
            <Button title="Save theme" onPress={startSave} style={styles.footerBtn} />
            <Button
              title="Cancel"
              variant="secondary"
              onPress={cancel}
              style={styles.footerBtn}
            />
          </View>
        )}
      </View>
    </View>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              active && { backgroundColor: c.accent },
              !active && pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? c.onAccent : c.textSecondary },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LabeledColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.labeledColor}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <ColorField value={value} onChange={onChange} />
    </View>
  );
}

// A single editable color: live-validated hex input + lightness nudges. The
// input keeps its own text state so a half-typed value never corrupts the draft;
// only a value that parses is committed upward. When `value` changes externally
// (a nudge, Generate, Mirror, or a mode switch) the text syncs back.
function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const [text, setText] = useState(value);
  const committedRef = useRef(value);

  useEffect(() => {
    if (value !== committedRef.current) {
      committedRef.current = value;
      setText(value);
    }
  }, [value]);

  const onType = useCallback(
    (next: string) => {
      setText(next);
      if (!isValidColor(next)) return;
      committedRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  const nudge = useCallback(
    (delta: number) => {
      if (!isValidColor(value)) return;
      const next = adjustLightness(value, delta);
      committedRef.current = next;
      setText(next);
      onChange(next);
    },
    [value, onChange],
  );

  const valid = isValidColor(text);

  return (
    <View style={styles.fieldRow}>
      <View
        style={[
          styles.swatch,
          {
            backgroundColor: valid ? text : c.surfaceElevated,
            borderColor: c.borderStrong,
          },
        ]}
      />
      <TextInput
        value={text}
        onChangeText={onType}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholder="#000000"
        placeholderTextColor={c.textTertiary}
        style={[styles.hexInput, !valid && { borderColor: c.danger }]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Darken"
        onPress={() => nudge(-6)}
        style={({ pressed }) => [styles.nudge, pressed && styles.pressed]}
      >
        <Minus size={16} color={c.text} strokeWidth={2} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Lighten"
        onPress={() => nudge(6)}
        style={({ pressed }) => [styles.nudge, pressed && styles.pressed]}
      >
        <Plus size={16} color={c.text} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const makeStyles = (c: MkColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      backgroundColor: c.background,
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    title: { color: c.text, fontSize: 26, fontWeight: '800' },
    subtitle: { color: c.textSecondary, fontSize: 13.5, marginTop: -4 },
    previewPane: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: MK_RADIUS.lg,
      padding: 12,
      gap: 8,
    },
    previewTabbar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      borderWidth: StyleSheet.hairlineWidth,
      paddingVertical: 8,
      paddingHorizontal: 8,
    },
    previewCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    contrastBlock: { gap: 6 },
    contrastRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    contrastText: { color: c.text, fontSize: 12.5, fontWeight: '600' },
    contrastDot: { color: c.textTertiary, fontSize: 12 },
    chip: {
      borderRadius: MK_RADIUS.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    chipText: { fontSize: 11, fontWeight: '800' },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, gap: 14 },
    panel: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: MK_RADIUS.lg,
      padding: 16,
      gap: 12,
    },
    segmented: {
      flexDirection: 'row',
      backgroundColor: c.surfaceElevated,
      borderRadius: MK_RADIUS.md,
      padding: 3,
      gap: 3,
    },
    segment: {
      flex: 1,
      paddingVertical: 9,
      alignItems: 'center',
      borderRadius: MK_RADIUS.sm,
    },
    segmentText: { fontSize: 13, fontWeight: '700' },
    labeledColor: { gap: 6 },
    fieldLabel: { color: c.textSecondary, fontSize: 12.5, fontWeight: '700' },
    fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    swatch: {
      width: 34,
      height: 34,
      borderRadius: MK_RADIUS.sm,
      borderWidth: StyleSheet.hairlineWidth,
    },
    hexInput: {
      flex: 1,
      height: 40,
      borderRadius: MK_RADIUS.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surfaceElevated,
      color: c.text,
      paddingHorizontal: 12,
      fontFamily: MK_MONO,
      fontSize: 13,
    },
    nudge: {
      width: 36,
      height: 40,
      borderRadius: MK_RADIUS.sm,
      backgroundColor: c.surfaceHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    advancedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    advancedTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
    advancedList: { gap: 12 },
    advancedHint: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
    footer: {
      backgroundColor: c.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 10,
    },
    actionsRow: { flexDirection: 'row', gap: 10 },
    footerBtn: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    nameInput: {
      flex: 1,
      height: 44,
      borderRadius: MK_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surfaceElevated,
      color: c.text,
      paddingHorizontal: 12,
      fontSize: 15,
    },
    pressed: { opacity: 0.6 },
  });
