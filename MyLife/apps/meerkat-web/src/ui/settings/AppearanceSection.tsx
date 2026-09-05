// AppearanceSection: the web theme surface. Keeps the System/Light/Dark toggle
// and adds a live preset gallery (real AA chips), the custom-theme library
// (apply/rename/share/delete), a Create/Import flow, and a share sheet
// (copyable code + QR + deep link). Mirrors the native Appearance screen. Themes
// are device-local and never replicate; copy says so.

import { useState, type CSSProperties } from 'react';
import {
  THEME_DEEP_LINK_PREFIX,
  decodeThemeBlob,
  encodeThemeBlob,
  getPreset,
  ratesAA,
  resolveProfile,
  type MkPaletteMode,
  type MkThemeAuthor,
  type MkThemeProfile,
} from '@mylife/meerkat-theme';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import { useMediaQuery } from '../shell/useMediaQuery';
import { useThemeLibrary, type ThemeMode } from '../theme/ThemeProvider';
import type { StoredTheme } from '../theme/theme-store';
import { themeToCssVars } from '../theme/css-vars';
import { authorLabel, signThemeAuthor } from '../theme/theme-author';
import { QrCodeSvg } from '../theme/QrCodeSvg';
import { ThemeEditorOverlay } from '../theme/ThemeEditorOverlay';
import './appearance.css';

const MODE_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

type View = { kind: 'gallery' } | { kind: 'share'; id: string } | { kind: 'import' };

export function AppearanceSection(): React.ReactElement {
  const {
    presets,
    customThemes,
    activeId,
    activeProfile,
    mode,
    setMode,
    applyTheme,
    renameCustomTheme,
    deleteCustomTheme,
  } = useThemeLibrary();
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const requestedMode: MkPaletteMode = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;

  const [collection, setCollection] = useState('All');
  const collections = ['All', ...new Set(presets.map((preset) => preset.register).filter((name): name is string => typeof name === 'string'))];
  const visiblePresets = presets.filter((preset) => collection === 'All' || preset.register === collection);

  const [view, setView] = useState<View>({ kind: 'gallery' });
  const [editorBase, setEditorBase] = useState<string | null | undefined>(undefined);

  const profileById = (id: string): MkThemeProfile | undefined =>
    getPreset(id) ?? customThemes.find((t) => t.id === id)?.profile;

  return (
    <section className="mk-settings-section">
      <h3 className="mk-sr-only">Theme library</h3>
      <p className="mk-muted mk-settings-note">Make Meerkat feel like you. Every theme includes a light and dark appearance.</p>

      <div className="mk-theme-mode" role="group" aria-label="Theme mode">
        {MODE_OPTIONS.map((option) => (
          <Button
            key={option.mode}
            variant={mode === option.mode ? 'primary' : 'ghost'}
            small
            aria-pressed={mode === option.mode}
            onClick={() => setMode(option.mode)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <span className="mk-muted mk-settings-note">
        System follows your device. Your choice is saved on this browser.
      </span>

      {view.kind === 'gallery' && (
        <>
          <div className="mk-theme-current" role="status" aria-live="polite">
            <span className="mk-theme-current-dot" aria-hidden="true" />
            <span><strong>{activeProfile.name}</strong> is your current theme</span>
          </div>
          <div className="mk-theme-collections" role="group" aria-label="Theme collections">
            {collections.map((name) => (
              <button type="button" key={name} aria-pressed={collection === name}
                onClick={() => setCollection(name)}>{name}</button>
            ))}
          </div>
          <p className="mk-theme-count">{visiblePresets.length} themes · Light &amp; dark included</p>
          <div className="mk-theme-grid">
            {visiblePresets.map((preset) => (
              <PresetCard
                key={preset.id}
                profile={preset}
                mode={requestedMode}
                selected={preset.id === activeId}
                onApply={() => applyTheme(preset.id)}
                onShare={() => setView({ kind: 'share', id: preset.id })}
              />
            ))}
          </div>

          <h4 className="mk-theme-subhead">My themes</h4>
          {customThemes.length === 0 ? (
            <p className="mk-muted mk-theme-empty">
              No custom themes yet. Create one or import a friend's.
            </p>
          ) : (
            <ul className="mk-theme-list">
              {customThemes.map((theme) => (
                <CustomRow
                  key={theme.id}
                  theme={theme}
                  selected={theme.id === activeId}
                  onApply={() => applyTheme(theme.id)}
                  onShare={() => setView({ kind: 'share', id: theme.id })}
                  onRename={(name) => renameCustomTheme(theme.id, name)}
                  onDelete={() => deleteCustomTheme(theme.id)}
                />
              ))}
            </ul>
          )}

          <div className="mk-btn-row">
            <Button onClick={() => setEditorBase(null)}>Create custom theme</Button>
            <Button variant="ghost" onClick={() => setView({ kind: 'import' })}>
              Import a theme
            </Button>
          </div>

          <HonestNotice>
            Your look is saved on this browser. Themes never sync between your devices on their own.
            To move a theme, share it as a code.
          </HonestNotice>
        </>
      )}

      {view.kind === 'share' && (
        <SharePanel profile={profileById(view.id)} onClose={() => setView({ kind: 'gallery' })} />
      )}

      {view.kind === 'import' && (
        <ImportPanel
          onAdded={(id) => {
            applyTheme(id);
            setView({ kind: 'gallery' });
          }}
          onClose={() => setView({ kind: 'gallery' })}
        />
      )}

      {editorBase !== undefined && (
        <ThemeEditorOverlay
          baseId={editorBase ?? undefined}
          onClose={() => setEditorBase(undefined)}
        />
      )}
    </section>
  );
}

function PresetCard({
  profile,
  mode,
  selected,
  onApply,
  onShare,
}: {
  profile: MkThemeProfile;
  mode: MkPaletteMode;
  selected: boolean;
  onApply: () => void;
  onShare: () => void;
}): React.ReactElement {
  const c = resolveProfile(profile, mode);
  const passesAA =
    ratesAA(c.text, c.background) && ratesAA(c.text, c.surface) && ratesAA(c.onAccent, c.accent);
  const vars = themeToCssVars(c) as CSSProperties;

  return (
    <div className={`mk-theme-card${selected ? ' is-selected' : ''}`}>
      <button
        type="button"
        className="mk-theme-card-apply"
        aria-pressed={selected}
        aria-label={`Apply ${profile.name} theme`}
        onClick={onApply}
      >
        <div className="mk-theme-preview" style={vars} aria-hidden="true">
          <div className="mk-theme-preview-bar">
            <span className="mk-theme-preview-dot" />
            <span className="mk-theme-preview-heading">Our little corner</span>
          </div>
          <div className="mk-theme-preview-card">
            <span className="mk-theme-preview-greeting">Make yourself at home.</span>
          </div>
          <span className="mk-theme-preview-pill">Happy to be here</span>
        </div>
        <span className="mk-theme-card-name">
          {profile.name}<span aria-hidden="true">{selected ? ' ✓' : ''}</span>
        </span>
      </button>
      <div className="mk-theme-card-meta">
        <span className="mk-theme-card-tags">
          {profile.register ? <span className="mk-theme-register">{profile.register}</span> : null}
          <span className={`mk-aa-chip${passesAA ? ' is-pass' : ''}`}
            title="Contrast check for body text and primary button labels">
            {passesAA ? 'AA' : 'Below AA'}
          </span>
          <button
            type="button"
            className="mk-theme-share-link"
            aria-label={`Share ${profile.name} theme`}
            onClick={onShare}
          >
            Share
          </button>
        </span>
      </div>
    </div>
  );
}

function CustomRow({
  theme,
  selected,
  onApply,
  onShare,
  onRename,
  onDelete,
}: {
  theme: StoredTheme;
  selected: boolean;
  onApply: () => void;
  onShare: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}): React.ReactElement {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(theme.name);
  // Two-step in-row confirm: deleting a custom theme is destructive and must
  // not be a single click. Mirrors the mobile MenuSheet confirm.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (renaming) {
    return (
      <li className="mk-theme-row">
        <input
          className="mk-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Theme name"
          autoFocus
        />
        <Button
          small
          disabled={!name.trim()}
          onClick={() => {
            if (name.trim()) onRename(name.trim());
            setRenaming(false);
          }}
        >
          Save
        </Button>
        <Button small variant="ghost" onClick={() => setRenaming(false)}>
          Cancel
        </Button>
      </li>
    );
  }

  return (
    <li className="mk-theme-row">
      <button
        type="button"
        className="mk-theme-row-name"
        aria-pressed={selected}
        onClick={onApply}
      >
        {theme.name}
        {selected ? ' ✓' : ''}
      </button>
      <div className="mk-theme-row-actions">
        <Button small variant="ghost" onClick={onShare}>
          Share
        </Button>
        <Button small variant="ghost" onClick={() => setRenaming(true)}>
          Rename
        </Button>
        {confirmingDelete ? (
          <>
            <Button small variant="danger" onClick={onDelete}>
              Delete forever
            </Button>
            <Button small variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <Button small variant="danger" onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
        )}
      </div>
    </li>
  );
}

function SharePanel({
  profile,
  onClose,
}: {
  profile: MkThemeProfile | undefined;
  onClose: () => void;
}): React.ReactElement {
  const { identity, displayName } = useMeerkat();
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);

  if (!profile) {
    return (
      <div className="mk-theme-panel">
        <p className="mk-muted">Theme not found.</p>
        <Button variant="ghost" small onClick={onClose}>
          Back
        </Button>
      </div>
    );
  }

  // Optional signed author; null if the device key is unavailable (ships unsigned).
  const author = signed ? signThemeAuthor(profile, identity, displayName) : null;
  let blob = '';
  try {
    blob = encodeThemeBlob(profile, author ?? undefined);
  } catch {
    return (
      <div className="mk-theme-panel">
        <p className="mk-muted">Could not encode this theme.</p>
        <Button variant="ghost" small onClick={onClose}>
          Back
        </Button>
      </div>
    );
  }
  const deepLink = `${THEME_DEEP_LINK_PREFIX}${blob}`;

  const copy = (label: string, value: string): void => {
    // "Copied" is claimed only after the clipboard write resolves; a rejection
    // or a missing clipboard API renders instead of a silent dead click.
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setCopyError('This browser does not allow copying to the clipboard here. Select the code text and copy it manually.');
      return;
    }
    void navigator.clipboard.writeText(value)
      .then(() => {
        setCopyError(null);
        setCopied(label);
        setTimeout(() => setCopied(null), 1500);
      })
      .catch(() => setCopyError('Copy failed. Nothing was copied to the clipboard; try again.'));
  };

  return (
    <div className="mk-theme-panel">
      <h4 className="mk-theme-subhead">Share {profile.name}</h4>
      <div className="mk-theme-qr">
        <QrCodeSvg value={blob} />
      </div>
      <code className="mk-theme-blob">{blob}</code>
      <label className="mk-theme-sign">
        <input type="checkbox" checked={signed} onChange={(e) => setSigned(e.target.checked)} />
        <span>
          {signed && !author
            ? 'Signing is unavailable on this device. Sharing unsigned.'
            : `Include signed author name (adds "${displayName}", others can verify)`}
        </span>
      </label>
      <div className="mk-btn-row">
        <Button small onClick={() => copy('code', blob)}>
          {copied === 'code' ? 'Copied' : 'Copy code'}
        </Button>
        <Button small variant="ghost" onClick={() => copy('link', deepLink)}>
          {copied === 'link' ? 'Copied' : 'Copy deep link'}
        </Button>
        <Button small variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
      {copyError ? <p className="mk-theme-error">{copyError}</p> : null}
      <span className="mk-muted mk-settings-note">
        This makes a copy you can paste or scan. Nothing is sent or uploaded, and your themes never
        sync between devices on their own.
      </span>
    </div>
  );
}

function ImportPanel({
  onAdded,
  onClose,
}: {
  onAdded: (id: string) => void;
  onClose: () => void;
}): React.ReactElement {
  const { saveCustomTheme } = useThemeLibrary();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MkThemeProfile | null>(null);
  const [previewAuthor, setPreviewAuthor] = useState<MkThemeAuthor | undefined>(undefined);

  const tryDecode = (input: string): void => {
    if (!input.trim()) {
      setError(null);
      setPreview(null);
      setPreviewAuthor(undefined);
      return;
    }
    const result = decodeThemeBlob(input);
    if (result.success) {
      setPreview(result.theme);
      setPreviewAuthor(result.author);
      setError(null);
    } else {
      setPreview(null);
      setPreviewAuthor(undefined);
      setError(result.error.message);
    }
  };

  return (
    <div className="mk-theme-panel">
      <h4 className="mk-theme-subhead">Import a theme</h4>
      <textarea
        className="mk-input mk-theme-import-input"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          tryDecode(e.target.value);
        }}
        aria-label="Theme code or link"
        placeholder="Paste a theme code or deep link"
        spellCheck={false}
        rows={3}
      />
      {error ? <p className="mk-theme-error">{error}</p> : null}
      {preview ? (
        <div className="mk-theme-import-preview">
          <span className="mk-theme-card-name">{preview.name}</span>
          <span className="mk-muted">{authorLabel(preview, previewAuthor)}</span>
          <span className="mk-muted">Ready to add.</span>
          <Button
            small
            onClick={() => {
              const id = saveCustomTheme(preview, { source: 'imported' });
              if (id) onAdded(id);
              else setError('Could not save the imported theme.');
            }}
          >
            Add to my themes
          </Button>
        </div>
      ) : null}
      <Button variant="ghost" small onClick={onClose}>
        Cancel
      </Button>
    </div>
  );
}
