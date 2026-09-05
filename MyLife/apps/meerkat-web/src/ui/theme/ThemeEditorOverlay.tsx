// The web twin of apps/meerkat's theme-editor.tsx. Holds an editable DRAFT
// MkThemeProfile in state and renders a LIVE preview reskinned from it,
// independent of the active app theme, so the user sees the theme they are
// building. Same axes, controls, contrast readout, and Generate/Mirror/Save
// behavior as mobile; rendered with DOM + CSS instead of React Native. The web
// has a native color picker, so each color is an <input type="color"> plus a hex
// text field (validated through parseColor) plus lightness nudges. Every contrast
// number is real WCAG math, never hardcoded. Themes are device-local.

import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
  rgbToHex,
  type MkColors,
  type MkDensity,
  type MkHeadingWeight,
  type MkThemeStyleExtras,
  type MkModeSpec,
  type MkPaletteMode,
  type MkPrimaryColors,
  type MkRadiusScale,
  type MkThemeProfile,
} from '@mylife/meerkat-theme';
import { Modal } from '../shell/Modal';
import { Button } from '../shell/Button';
import { useThemeLibrary } from './ThemeProvider';
import { themeToCssVars } from './css-vars';
import './theme-editor.css';

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

const WEIGHT_OPTIONS: ReadonlyArray<{ value: MkHeadingWeight; label: string }> = [
  { value: '600', label: '600' },
  { value: '700', label: '700' },
  { value: '800', label: '800' },
];

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

// Apply an update to the spec for `mode`. Editing dark mode when no dark spec
// exists yet forks one from light, so a single-mode theme stays valid and the
// first dark edit creates a real dark variant.
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

function withPrimary(spec: MkModeSpec, key: keyof MkPrimaryColors, value: string): MkModeSpec {
  const primary: MkPrimaryColors = { ...spec.primary };
  primary[key] = value;
  return { ...spec, primary };
}

function withOverride(spec: MkModeSpec, key: keyof MkColors, value: string): MkModeSpec {
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

// The native <input type="color"> needs an opaque '#rrggbb'. Translucent or
// shorthand draft values are flattened for the swatch only; the hex text field
// still shows (and can commit) the raw value.
function toPickerHex(value: string): string {
  try {
    return rgbToHex(parseColor(value));
  } catch {
    return '#000000';
  }
}

const PREVIEW_PAD: Record<MkDensity, string> = {
  compact: '8px',
  cozy: '12px',
  comfortable: '16px',
};

export function ThemeEditorOverlay({
  baseId,
  onClose,
}: {
  baseId?: string;
  onClose: () => void;
}): React.ReactElement {
  const { customThemes, saveCustomTheme } = useThemeLibrary();

  const [draft, setDraft] = useState<MkThemeProfile>(() => {
    const fromPreset = baseId ? getPreset(baseId) : undefined;
    const fromCustom = baseId
      ? customThemes.find((theme) => theme.id === baseId)?.profile
      : undefined;
    return cloneProfile(fromPreset ?? fromCustom ?? OPEN_BURROW);
  });
  const [previewMode, setPreviewMode] = useState<MkPaletteMode>('light');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [name, setName] = useState(draft.name);

  // The resolved palette of the DRAFT for the previewed mode. Drives the live
  // preview and the contrast readout. resolveProfile only parses already-valid
  // committed colors, so it never throws here.
  const preview = useMemo<MkColors>(
    () => resolveProfile(draft, previewMode),
    [draft, previewMode],
  );

  // The spec the user is editing right now (light, or dark falling back to light
  // until a dark variant exists).
  const editSpec: MkModeSpec = previewMode === 'dark' ? draft.dark ?? draft.light : draft.light;

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

  // Feature 4: per-role bubble shapes ('default' clears the role back to the
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
      return { ...generated, id: d.id, name: d.name, basePresetId: d.basePresetId };
    });
  }, [previewMode]);

  // Derive the opposite mode from the current one so the theme works in both.
  const onMirror = useCallback(() => {
    setDraft((d) => {
      const mirrored = mirrorMode(d, previewMode);
      return previewMode === 'light' ? { ...d, dark: mirrored } : { ...d, light: mirrored };
    });
  }, [previewMode]);

  const onSave = useCallback(() => {
    const trimmed = name.trim();
    const finalName = trimmed.length > 0 ? trimmed : draft.name;
    const id = saveCustomTheme(draft, { name: finalName, basePresetId: baseId ?? null });
    if (id) onClose();
  }, [name, draft, saveCustomTheme, baseId, onClose]);

  const mirrorTarget: MkPaletteMode = previewMode === 'light' ? 'dark' : 'light';

  // Inline --mk-* vars scoped to the preview wrapper: the ONE place the editor
  // applies the draft's theme colors directly. Children read them via var(--mk-*).
  const previewStyle = {
    ...themeToCssVars(preview),
    '--mk-preview-radius': `var(--mk-radius-${draft.shape.radius})`,
    '--mk-preview-pad': PREVIEW_PAD[draft.density],
  } as CSSProperties;

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
    <Modal title="Custom theme" onClose={onClose}>
      <div className="mk-theme-editor">
        <p className="mk-muted mk-theme-section-hint">
          Edit colors, shape, and feel. Saved to this device only.
        </p>

        {/* Live preview, reskinned from the DRAFT (not the active app theme). */}
        <div className="mk-editor-preview" style={previewStyle}>
          <div className="mk-editor-preview-tabbar">
            {['Home', 'Channels', 'Me'].map((tab, index) => (
              <span
                key={tab}
                className={`mk-editor-preview-tab${index === 1 ? ' is-active' : ''}`}
              >
                {tab}
              </span>
            ))}
          </div>

          <div className="mk-editor-preview-card">
            <div className="mk-editor-preview-card-top">
              <span
                className="mk-editor-preview-card-title"
                style={{ fontWeight: Number(draft.headingWeight) }}
              >
                General
              </span>
              <span className="mk-editor-preview-pill">3 new</span>
            </div>
            <p className="mk-editor-preview-body">
              A calm place to share with people you trust.
            </p>
            <div className="mk-editor-preview-btn">Open channel</div>
          </div>

          <div className="mk-editor-preview-notice">
            <span className="mk-editor-preview-notice-dot" aria-hidden>
              ●
            </span>
            <span className="mk-editor-preview-notice-text">
              Shows only what this device has actually recorded.
            </span>
          </div>

          <div className="mk-editor-preview-danger">Could not reach that peer yet.</div>
        </div>

        <Segmented options={MODE_OPTIONS} value={previewMode} onChange={setPreviewMode} ariaLabel="Preview mode" />

        <div className="mk-theme-contrast">
          {contrastRows.map((row) => (
            <div key={row.label} className="mk-theme-contrast-row">
              <span className="mk-theme-contrast-text">
                {`${row.label}: ${row.ratio.toFixed(1)}:1`}
              </span>
              <span className="mk-theme-contrast-dot" aria-hidden>
                ·
              </span>
              <span className={`mk-theme-chip${row.pass ? ' is-pass' : ''}`}>
                {row.pass ? 'AA' : 'Below AA'}
              </span>
            </div>
          ))}
        </div>

        <section className="mk-theme-section">
          <h3 className="mk-theme-section-title">Colors</h3>
          <p className="mk-theme-section-hint">
            Edit the main colors. Secondary shades update automatically.
          </p>
          {PRIMARY_AXES.map((axis) => (
            <LabeledColor
              key={axis.key}
              label={axis.label}
              value={editSpec.primary[axis.key]}
              onChange={(value) => setPrimary(axis.key, value)}
            />
          ))}
        </section>

        <section className="mk-theme-section">
          <h3 className="mk-theme-section-title">Shape and feel</h3>
          <span className="mk-theme-field-label">Corner radius</span>
          <Segmented
            options={RADIUS_OPTIONS}
            value={draft.shape.radius}
            onChange={setRadius}
            ariaLabel="Corner radius"
          />
          <span className="mk-theme-field-label">Density</span>
          <Segmented
            options={DENSITY_OPTIONS}
            value={draft.density}
            onChange={setDensity}
            ariaLabel="Density"
          />
          <span className="mk-theme-field-label">Heading weight</span>
          <Segmented
            options={WEIGHT_OPTIONS}
            value={draft.headingWeight}
            onChange={setHeadingWeight}
            ariaLabel="Heading weight"
          />
          <span className="mk-theme-field-label">Typography scale</span>
          <Segmented
            options={TYPOGRAPHY_OPTIONS}
            value={draft.styleExtras?.typographyScale ?? 'regular'}
            onChange={(v) => setStyleExtra('typographyScale', v)}
            ariaLabel="Typography scale"
          />
          <span className="mk-theme-field-label">Bubble shape</span>
          <Segmented
            options={BUBBLE_OPTIONS}
            value={draft.styleExtras?.bubbleShape ?? 'rounded'}
            onChange={(v) => setStyleExtra('bubbleShape', v)}
            ariaLabel="Bubble shape"
          />
          <span className="mk-theme-field-label">Border weight</span>
          <Segmented
            options={BORDER_OPTIONS}
            value={draft.styleExtras?.borderWeight ?? 'hairline'}
            onChange={(v) => setStyleExtra('borderWeight', v)}
            ariaLabel="Border weight"
          />
          <span className="mk-theme-field-label">Shadow depth</span>
          <Segmented
            options={SHADOW_OPTIONS}
            value={draft.styleExtras?.shadowDepth ?? 'flat'}
            onChange={(v) => setStyleExtra('shadowDepth', v)}
            ariaLabel="Shadow depth"
          />
          <span className="mk-theme-field-label">Background treatment</span>
          <Segmented
            options={TREATMENT_OPTIONS}
            value={draft.styleExtras?.backgroundTreatment ?? 'plain'}
            onChange={(v) => setStyleExtra('backgroundTreatment', v)}
            ariaLabel="Background treatment"
          />
          {(['owner', 'admin', 'member'] as const).map((role) => (
            <React.Fragment key={role}>
              <span className="mk-theme-field-label">Bubble shape: {role}s</span>
              <Segmented
                options={ROLE_BUBBLE_OPTIONS}
                value={draft.styleExtras?.bubbleShapesByRole?.[role] ?? 'default'}
                onChange={(v) => setRoleBubbleShape(role, v)}
                ariaLabel={`Bubble shape for ${role}s`}
              />
            </React.Fragment>
          ))}
        </section>

        <section className="mk-theme-section">
          <h3 className="mk-theme-section-title">Shortcuts</h3>
          <div className="mk-theme-shortcuts">
            <Button variant="ghost" small onClick={onGenerate}>
              Generate from a color
            </Button>
            <Button variant="ghost" small onClick={onMirror}>
              {`Mirror to ${mirrorTarget}`}
            </Button>
          </div>
        </section>

        <section className="mk-theme-section">
          <button
            type="button"
            className="mk-theme-advanced-toggle"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            <span className={`mk-theme-chevron${advancedOpen ? ' is-open' : ''}`} aria-hidden>
              ▸
            </span>
            Advanced colors
          </button>
          {advancedOpen ? (
            <div className="mk-theme-advanced-list">
              <p className="mk-theme-advanced-hint">
                Override any token directly. This wins over the automatic value.
              </p>
              {ADVANCED_TOKENS.map((token) => (
                <LabeledColor
                  key={token}
                  label={humanize(token)}
                  value={preview[token]}
                  onChange={(value) => setOverride(token, value)}
                />
              ))}
            </div>
          ) : null}
        </section>

        <div className="mk-theme-footer">
          <label className="mk-field" htmlFor="mk-theme-name">
            <span className="mk-label">Theme name</span>
            <input
              id="mk-theme-name"
              className="mk-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Theme name"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="mk-theme-footer-actions">
            <Button onClick={onSave}>Save theme</Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}): React.ReactElement {
  return (
    <div className="mk-theme-segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`mk-theme-segment${active ? ' is-active' : ''}`}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
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
}): React.ReactElement {
  return (
    <div className="mk-theme-field">
      <span className="mk-theme-field-label">{label}</span>
      <ColorField value={value} onChange={onChange} />
    </div>
  );
}

// A single editable color: a native picker + a live-validated hex text field +
// lightness nudges. The text field keeps its own state so a half-typed value
// never corrupts the draft; only a value that parses is committed upward. When
// `value` changes externally (the picker, a nudge, Generate, Mirror, or a mode
// switch) the text syncs back.
function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}): React.ReactElement {
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

  // The native color input always yields a valid '#rrggbb'.
  const onPick = useCallback(
    (next: string) => {
      committedRef.current = next;
      setText(next);
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
    <div className="mk-theme-color-row">
      <input
        type="color"
        className="mk-theme-color-input"
        aria-label="Pick color"
        value={toPickerHex(valid ? text : value)}
        onChange={(e) => onPick(e.target.value)}
      />
      <input
        type="text"
        className={`mk-theme-hex${valid ? '' : ' is-invalid'}`}
        value={text}
        onChange={(e) => onType(e.target.value)}
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        placeholder="#000000"
      />
      <button
        type="button"
        className="mk-theme-nudge"
        aria-label="Darken"
        onClick={() => nudge(-6)}
      >
        −
      </button>
      <button
        type="button"
        className="mk-theme-nudge"
        aria-label="Lighten"
        onClick={() => nudge(6)}
      >
        +
      </button>
    </div>
  );
}
