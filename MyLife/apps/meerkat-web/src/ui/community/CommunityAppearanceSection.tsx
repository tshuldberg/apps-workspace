// Plan 38 Phase 1c (web): the OWNER-ONLY "Appearance & identity" section of the
// community settings surface. Description (280 cap), accent (#rrggbb), icon (avatar
// downscale gate), banner (landscape downscale -> sealed library object), and a
// theme picker (presets + "Use my current theme" via the Plan 18 codec) with a live
// preview + honest, NON-BLOCKING WCAG contrast warning. Save is ONE
// publishCommunityIdentity call wired to the engine record path. Members never see
// this section (owner-gated by the caller). Honesty: nothing here claims a member
// has received the update; the descriptor replicates on the next session.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PRESETS,
  contrastRatio,
  decodeThemeBlob,
  ratesAA,
  resolveProfile,
} from '@mylife/meerkat-theme';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useThemeLibrary } from '../theme/ThemeProvider';
import { APPEARANCE_AND_IDENTITY_LABEL } from '../../lib/community-theme-view';
import { Button } from '../shell/Button';
import { Avatar } from '../kit/Avatar';
import { prepareAvatarFromFile, type AvatarPrepResult } from '../kit/avatar-image';
import { prepareBannerFromFile, type BannerPrepResult } from './banner-image';

const DESCRIPTION_MAX = 280;
const ACCENT_RE = /^#[0-9a-f]{6}$/i;

type ThemeChoice = { kind: 'none' } | { kind: 'blob'; blob: string; label: string };

function describeAvatarFailure(reason: Exclude<AvatarPrepResult, { ok: true }>['reason']): string {
  switch (reason) {
    case 'too_large':
      return 'That icon is too large even after resizing. Try a different image.';
    case 'unavailable':
      return 'Image icons are not supported in this browser.';
    default:
      return 'Could not prepare that icon. Try a different image.';
  }
}

function describeBannerFailure(reason: Exclude<BannerPrepResult, { ok: true }>['reason']): string {
  switch (reason) {
    case 'too_large':
      return 'That banner is too large even after resizing. Try a smaller image.';
    case 'unavailable':
      return 'Banner images are not supported in this browser.';
    default:
      return 'Could not prepare that banner. Try a different image.';
  }
}

export function CommunityAppearanceSection({ communityId }: { communityId: string }): React.ReactElement {
  const m = useMeerkat();
  const themeLib = useThemeLibrary();
  const current = m.communityIdentity(communityId);

  const [description, setDescription] = useState(current?.description ?? '');
  const [accent, setAccent] = useState(current?.accentColor ?? '');
  // undefined = keep current icon; null = remove; string = new base64 JPEG.
  const [iconDraft, setIconDraft] = useState<string | null | undefined>(undefined);
  // undefined = keep current banner; null = remove; Uint8Array = new banner bytes.
  const [bannerDraft, setBannerDraft] = useState<Uint8Array | null | undefined>(undefined);
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(
    current?.themeBlob ? { kind: 'blob', blob: current.themeBlob, label: 'Current' } : { kind: 'none' },
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDescription(current?.description ?? '');
    setAccent(current?.accentColor ?? '');
    setIconDraft(undefined);
    setBannerDraft(undefined);
    setThemeChoice(current?.themeBlob ? { kind: 'blob', blob: current.themeBlob, label: 'Current' } : { kind: 'none' });
    setNotice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  const effectiveIcon = iconDraft === undefined ? current?.iconImage ?? null : iconDraft;
  const trimmedDescription = description.trim().replace(/\s+/g, ' ').slice(0, DESCRIPTION_MAX);
  const accentValid = accent === '' || ACCENT_RE.test(accent.trim());

  // The theme options: no community theme, each preset, and "Use my current theme".
  const myBlob = useMemo(() => themeLib.exportThemeBlob(), [themeLib]);
  const presetOptions = useMemo(
    () => PRESETS.map((preset) => ({ id: preset.id, name: preset.name, blob: themeLib.exportThemeBlob(preset.id) })),
    [themeLib],
  );
  // A saved theme blob that matches a preset selects that preset; otherwise it is a
  // custom theme surfaced as a "Current theme" option so the select reflects reality.
  const savedPresetId = useMemo(() => {
    if (themeChoice.kind !== 'blob' || themeChoice.label !== 'Current') return null;
    return presetOptions.find((p) => p.blob === themeChoice.blob)?.id ?? null;
  }, [themeChoice, presetOptions]);
  const savedIsCustom = themeChoice.kind === 'blob' && themeChoice.label === 'Current' && savedPresetId === null;

  // Live preview + WCAG check for the chosen theme (or the accent over the base).
  const preview = useMemo(() => {
    if (themeChoice.kind === 'blob') {
      const decoded = decodeThemeBlob(themeChoice.blob);
      if (decoded.success) {
        const colors = resolveProfile(decoded.theme, themeLib.resolved);
        return { bg: colors.surface, fg: colors.text, accent: colors.accent };
      }
    }
    const base = themeLib.colors;
    const previewAccent = accentValid && accent ? accent.trim().toLowerCase() : base.accent;
    return { bg: base.surface, fg: base.text, accent: previewAccent };
  }, [themeChoice, themeLib.colors, themeLib.resolved, accent, accentValid]);

  const contrast = contrastRatio(preview.fg, preview.bg);
  const contrastOk = ratesAA(preview.fg, preview.bg);

  const onIconChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setBusy(true);
    void (async () => {
      try {
        const result = await prepareAvatarFromFile(file);
        if (result.ok) {
          setIconDraft(result.base64);
          setNotice(null);
        } else {
          setNotice(describeAvatarFailure(result.reason));
        }
      } finally {
        setBusy(false);
      }
    })();
  };

  const onBannerChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setBusy(true);
    void (async () => {
      try {
        const result = await prepareBannerFromFile(file);
        if (result.ok) {
          setBannerDraft(result.bytes);
          setNotice(null);
        } else {
          setNotice(describeBannerFailure(result.reason));
        }
      } finally {
        setBusy(false);
      }
    })();
  };

  const save = (): void => {
    if (!accentValid) {
      setNotice('Accent must be a #rrggbb hex color.');
      return;
    }
    setBusy(true);
    setNotice(null);
    void (async () => {
      try {
        // Seal a new banner into the node store first; keep or clear otherwise.
        let banner = current?.banner ?? null;
        if (bannerDraft === null) {
          banner = null;
        } else if (bannerDraft !== undefined) {
          banner = await m.sealCommunityBanner(communityId, bannerDraft);
        }
        m.publishCommunityIdentity(communityId, {
          description: trimmedDescription || null,
          accentColor: accent.trim() ? accent.trim().toLowerCase() : null,
          iconImage: effectiveIcon,
          banner,
          themeBlob: themeChoice.kind === 'blob' ? themeChoice.blob : null,
        });
        setBannerDraft(undefined);
        setIconDraft(undefined);
        setNotice('Saved. Members see this after their app connects and receives the update.');
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not save community appearance.');
      } finally {
        setBusy(false);
      }
    })();
  };

  const clearAll = (): void => {
    setBusy(true);
    setNotice(null);
    void (async () => {
      try {
        m.tombstoneCommunityIdentity(communityId);
        setDescription('');
        setAccent('');
        setIconDraft(undefined);
        setBannerDraft(undefined);
        setThemeChoice({ kind: 'none' });
        setNotice('Cleared. This community is back to the default look.');
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not clear community appearance.');
      } finally {
        setBusy(false);
      }
    })();
  };

  const themeSelectValue =
    themeChoice.kind === 'none'
      ? 'none'
      : themeChoice.label === 'mine'
        ? 'mine'
        : savedPresetId ?? (savedIsCustom ? '__current__' : themeChoice.label);

  const onThemeSelect = (value: string): void => {
    if (value === 'none') {
      setThemeChoice({ kind: 'none' });
      return;
    }
    if (value === '__current__') return; // keep the saved custom blob as-is
    if (value === 'mine') {
      if (myBlob) setThemeChoice({ kind: 'blob', blob: myBlob, label: 'mine' });
      return;
    }
    const preset = presetOptions.find((p) => p.id === value);
    if (preset?.blob) setThemeChoice({ kind: 'blob', blob: preset.blob, label: preset.id });
  };

  return (
    <section className="mk-card mk-community-appearance" aria-label={APPEARANCE_AND_IDENTITY_LABEL}>
      <h2 className="mk-h2">{APPEARANCE_AND_IDENTITY_LABEL}</h2>
      <p className="mk-muted" style={{ fontSize: 13, marginTop: 0 }}>
        Give this community an icon, banner, description, accent, and theme. Only you (the owner) can
        change it, and members see it after their app connects.
      </p>

      <label className="mk-field">
        <span className="mk-field-label">Description</span>
        <textarea
          className="mk-input"
          rows={2}
          maxLength={DESCRIPTION_MAX}
          value={description}
          placeholder="What is this community for?"
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
        <span className="mk-muted" style={{ fontSize: 12 }}>{trimmedDescription.length}/{DESCRIPTION_MAX}</span>
      </label>

      <label className="mk-field">
        <span className="mk-field-label">Accent color</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="mk-input mk-community-accent-input"
            value={accent}
            placeholder="#0e7c66"
            onChange={(event) => setAccent(event.currentTarget.value)}
          />
          <span
            aria-hidden
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: accentValid && accent ? accent : 'transparent',
              border: '1px solid var(--mk-border)',
            }}
          />
        </div>
        {!accentValid ? <span className="mk-box is-error" role="alert">Use a #rrggbb hex color.</span> : null}
      </label>

      <div className="mk-field">
        <span className="mk-field-label">Icon</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Avatar imageBase64={effectiveIcon} initial="?" size={40} />
          <input
            ref={iconInputRef}
            type="file"
            accept="image/*"
            className="mk-sr-only"
            aria-label="Choose a community icon"
            onChange={onIconChange}
          />
          <Button variant="ghost" small disabled={busy} onClick={() => iconInputRef.current?.click()}>
            {effectiveIcon ? 'Change icon' : 'Choose icon'}
          </Button>
          {effectiveIcon ? (
            <Button variant="ghost" small disabled={busy} onClick={() => setIconDraft(null)}>
              Remove icon
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mk-field">
        <span className="mk-field-label">Banner</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="mk-sr-only"
            aria-label="Choose a community banner"
            onChange={onBannerChange}
          />
          <Button variant="ghost" small disabled={busy} onClick={() => bannerInputRef.current?.click()}>
            {bannerDraft ? 'Banner ready' : current?.banner ? 'Change banner' : 'Choose banner'}
          </Button>
          {current?.banner || bannerDraft ? (
            <Button variant="ghost" small disabled={busy} onClick={() => setBannerDraft(null)}>
              Remove banner
            </Button>
          ) : null}
        </div>
        <span className="mk-muted" style={{ fontSize: 12 }}>
          Banners are sealed and only members can open them. Up to 512 KB after resizing.
        </span>
      </div>

      <label className="mk-field">
        <span className="mk-field-label">Theme</span>
        <select className="mk-input" value={themeSelectValue} onChange={(event) => onThemeSelect(event.currentTarget.value)}>
          <option value="none">No community theme</option>
          {savedIsCustom ? <option value="__current__">Current theme</option> : null}
          {myBlob ? <option value="mine">Use my current theme</option> : null}
          {presetOptions.map((preset) => (
            <option key={preset.id} value={preset.id}>{preset.name}</option>
          ))}
        </select>
      </label>

      <div className="mk-community-theme-preview" aria-label="Theme preview"
        style={{ background: preview.bg, color: preview.fg, borderRadius: 10, padding: 12, border: '1px solid var(--mk-border)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden style={{ width: 16, height: 16, borderRadius: 4, background: preview.accent }} />
          <strong>{trimmedDescription || 'Community preview'}</strong>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 13 }}>Aa Bb Cc, sample community text.</p>
      </div>
      {!contrastOk ? (
        <p className="mk-box is-warning" role="status">
          Low text contrast ({contrast.toFixed(1)}:1, below the 4.5:1 AA guideline). Members can still
          read it, and anyone using high contrast always overrides this theme.
        </p>
      ) : null}

      {notice ? <p className="mk-community-profile-notice">{notice}</p> : null}
      <div className="mk-btn-row">
        <Button variant="ghost" small disabled={busy || !accentValid} onClick={save}>
          {busy ? 'Saving…' : 'Save appearance'}
        </Button>
        {current ? (
          <Button variant="ghost" small disabled={busy} onClick={clearAll}>
            Clear appearance
          </Button>
        ) : null}
      </div>
    </section>
  );
}
