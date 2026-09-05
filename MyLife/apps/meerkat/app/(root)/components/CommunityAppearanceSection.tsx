// Plan 38 Phase 1c: the owner-only "Appearance & identity" editor. It composes ONE
// signed identity revision (publishCommunityIdentity) from description, accent,
// icon (in-row avatar-gated JPEG), banner (sealed library object), and a theme
// blob (a meerkat-theme preset or the owner's own exported theme). A publish writes
// a FULL new revision, so every field is sent each Save using the current value for
// anything the owner did not touch. Non-owners never see this section (the caller
// gates on isOwner). Honesty: the WCAG check WARNS but never blocks, and the save
// notice says members see the look only after their app connects.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image as RNImage, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { DatabaseAdapter } from '@mylife/db';
import {
  COMMUNITY_DESCRIPTION_MAX_CHARS,
  type CommunityIdentityBanner,
  type DeviceIdentity,
} from '@mylife/sync';
import {
  PRESETS,
  THEME_DEEP_LINK_PREFIX,
  contrastRatio,
  decodeThemeBlob,
  encodeThemeBlob,
  getPreset,
  ratesAA,
  resolveProfile,
  type MkColors,
  type MkPaletteMode,
} from '@mylife/meerkat-theme';
import { getCommunityIdentity } from '../data/community-core';
import { isAvatarPhotoSupported, pickAndResizeAvatar, type AvatarPickResult } from '../data/avatar-photo';
import { isBannerPhotoSupported, pickAndResizeBanner, type BannerPickResult } from '../data/banner-photo';
import { Avatar, avatarImageUri } from './Avatar';
import { QrCode } from './QrCode';
import { Button, SectionHeader } from './kit';
import { type MkColors as TokenColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useAppThemeMode, useMkStyles, useThemeLibrary } from '../providers/AppThemeProvider';
import { useNode } from '../providers/NodeProvider';
import { useSync } from '../providers/SyncProvider';

/** A curated set of accent swatches (all pass AA text-on-accent with white). */
const ACCENT_SWATCHES = ['#0e7c66', '#3566b0', '#8f3fb0', '#b3413e', '#8f660d', '#1f7a3f'];
const ACCENT_RE = /^#[0-9a-f]{6}$/i;

/** How the owner is choosing the community theme blob for the next revision. */
type ThemeSel =
  | { kind: 'keep' }
  | { kind: 'none' }
  | { kind: 'preset'; id: string }
  | { kind: 'mine' };

/** undefined = keep current image; null = remove; string = new base64. */
type ImageDraft = string | null | undefined;

function normalizeAccent(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  return ACCENT_RE.test(trimmed) ? trimmed : null;
}

/** The blob a theme selection resolves to (null = no full theme, accent-only/base). */
function blobForSel(sel: ThemeSel, currentBlob: string | null, exportMine: () => string | null): string | null {
  switch (sel.kind) {
    case 'keep':
      return currentBlob;
    case 'none':
      return null;
    case 'preset':
      return encodeThemeBlob(getPreset(sel.id) ?? PRESETS[0]);
    case 'mine':
      return exportMine();
  }
}

/** Resolve a theme blob to its concrete palette for the active mode (null on none/bad). */
function previewColors(blob: string | null, mode: MkPaletteMode): MkColors | null {
  if (!blob) return null;
  const decoded = decodeThemeBlob(blob);
  if (!decoded.success) return null;
  try {
    return resolveProfile(decoded.theme, mode);
  } catch {
    return null;
  }
}

export function CommunityAppearanceSection({
  db,
  identity: _identity,
  communityId,
  communityName,
  onSaved,
  setNotice,
}: {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  communityId: string;
  communityName: string;
  onSaved: () => void;
  setNotice: (notice: string | null) => void;
}) {
  const styles = useMkStyles(makeStyles);
  const c = useAppThemeColors();
  const mode = useAppThemeMode();
  const { exportThemeBlob } = useThemeLibrary();
  const node = useNode();
  const { setCommunityAppearance, clearCommunityAppearance } = useSync();

  // Bumped after a save/reset so `current` re-reads the freshly published identity
  // (otherwise the preview would revert to the pre-save look).
  const [reloadTick, setReloadTick] = useState(0);
  const current = useMemo(() => {
    void reloadTick;
    return getCommunityIdentity(db, communityId);
  }, [db, communityId, reloadTick]);

  const [description, setDescription] = useState(current?.description ?? '');
  const [accent, setAccent] = useState(current?.accentColor ?? '');
  const [iconDraft, setIconDraft] = useState<ImageDraft>(undefined);
  const [bannerDraft, setBannerDraft] = useState<{ kind: 'keep' } | { kind: 'remove' } | { kind: 'new'; base64: string }>({ kind: 'keep' });
  const [themeSel, setThemeSel] = useState<ThemeSel>({ kind: 'keep' });
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Reinitialize when the community changes (never mid-edit for the same community).
  useEffect(() => {
    setDescription(current?.description ?? '');
    setAccent(current?.accentColor ?? '');
    setIconDraft(undefined);
    setBannerDraft({ kind: 'keep' });
    setThemeSel({ kind: 'keep' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  const iconSupported = isAvatarPhotoSupported();
  const bannerSupported = isBannerPhotoSupported();
  const effectiveIcon = iconDraft === undefined ? current?.iconImage ?? null : iconDraft;
  const bannerPreviewUri = bannerDraft.kind === 'new' ? avatarImageUri(bannerDraft.base64) : null;
  const hasCurrentBanner = Boolean(current?.banner);
  const bannerLabel = bannerDraft.kind === 'new' || (bannerDraft.kind === 'keep' && hasCurrentBanner)
    ? 'Change banner'
    : 'Choose banner';

  const selectedBlob = blobForSel(themeSel, current?.themeBlob ?? null, () => exportThemeBlob() ?? null);
  const preview = previewColors(selectedBlob, mode);
  const wcag = useMemo(() => {
    if (!preview) return null;
    const textOk = ratesAA(preview.text, preview.background);
    const accentOk = ratesAA(preview.onAccent, preview.accent);
    const worst = Math.min(
      contrastRatio(preview.text, preview.background),
      contrastRatio(preview.onAccent, preview.accent),
    );
    return { ok: textOk && accentOk, worst };
  }, [preview]);

  const describePhotoFailure = (
    reason: Exclude<AvatarPickResult | BannerPickResult, { ok: true }>['reason'],
  ): string => {
    switch (reason) {
      case 'permission':
        return 'Photo access was declined. Allow photo access to choose an image.';
      case 'too_large':
        return 'That image is too large even after resizing. Try a smaller one.';
      case 'unavailable':
        return 'Photo picking needs an app update on this device.';
      case 'canceled':
        return '';
      default:
        return 'Could not prepare that image. Try a different one.';
    }
  };

  const chooseIcon = useCallback(async () => {
    setBusy(true);
    try {
      const result = await pickAndResizeAvatar();
      if (result.ok) { setIconDraft(result.base64); setNotice(null); }
      else if (result.reason !== 'canceled') setNotice(describePhotoFailure(result.reason));
    } finally {
      setBusy(false);
    }
  }, [setNotice]);

  const chooseBanner = useCallback(async () => {
    setBusy(true);
    try {
      const result = await pickAndResizeBanner();
      if (result.ok) { setBannerDraft({ kind: 'new', base64: result.base64 }); setNotice(null); }
      else if (result.reason !== 'canceled') setNotice(describePhotoFailure(result.reason));
    } finally {
      setBusy(false);
    }
  }, [setNotice]);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      // Seal a freshly picked banner first; keep or clear otherwise. A seal failure
      // (no current epoch key) aborts the save so the prior look is untouched.
      let banner: CommunityIdentityBanner | null;
      if (bannerDraft.kind === 'new') {
        banner = await node.sealCommunityBanner(communityId, bannerDraft.base64);
        if (!banner) {
          setNotice('This community has no active key yet, so a banner cannot be sealed. Add a member first.');
          return;
        }
      } else if (bannerDraft.kind === 'remove') {
        banner = null;
      } else {
        banner = current?.banner ?? null;
      }

      const result = setCommunityAppearance(communityId, {
        description: description.trim() || null,
        accentColor: normalizeAccent(accent),
        iconImage: effectiveIcon,
        banner,
        themeBlob: selectedBlob,
      });
      if (!result.ok) { setNotice(result.error); return; }
      setBannerDraft({ kind: 'keep' });
      setIconDraft(undefined);
      setThemeSel({ kind: 'keep' });
      setReloadTick((t) => t + 1);
      onSaved();
      setNotice('Saved. Members see the new look after their app connects and receives the update.');
    } finally {
      setBusy(false);
    }
  }, [accent, bannerDraft, communityId, current, description, effectiveIcon, node, onSaved, selectedBlob, setCommunityAppearance, setNotice]);

  const resetLook = useCallback(() => {
    const result = clearCommunityAppearance(communityId);
    if (!result.ok) { setNotice(result.error); return; }
    setDescription('');
    setAccent('');
    setIconDraft(undefined);
    setBannerDraft({ kind: 'keep' });
    setThemeSel({ kind: 'keep' });
    setReloadTick((t) => t + 1);
    onSaved();
    setNotice('Reset to the default look. Members see it after their app connects.');
  }, [clearCommunityAppearance, communityId, onSaved, setNotice]);

  const accentValid = accent.trim() === '' || normalizeAccent(accent) !== null;

  return (
    <View style={styles.panel}>
      <SectionHeader title="Appearance & identity" hint="Everyone in this community sees this. Only you (the owner) can change it." />

      {/* Icon + name preview */}
      <View style={styles.previewRow}>
        <Avatar imageBase64={effectiveIcon} initial={Array.from(communityName.trim())[0]?.toUpperCase() ?? '?'} size={44} />
        <View style={styles.previewCopy}>
          <Text style={styles.previewName} numberOfLines={1}>{communityName}</Text>
          <Text style={styles.previewHint} numberOfLines={1}>Icon shows on cards and the header.</Text>
        </View>
      </View>
      {iconSupported ? (
        <View style={styles.buttonRow}>
          <Button title={effectiveIcon ? 'Change icon' : 'Choose icon'} variant="secondary" onPress={chooseIcon} disabled={busy} />
          {effectiveIcon ? <Button title="Remove icon" variant="ghost" onPress={() => setIconDraft(null)} disabled={busy} /> : null}
        </View>
      ) : (
        <Text style={styles.limitText}>Photo picking needs an app update on this device.</Text>
      )}

      {/* Description */}
      <Text style={styles.fieldLabel}>Description</Text>
      <TextInput
        style={[styles.fieldInput, styles.multiline]}
        value={description}
        onChangeText={(v) => setDescription(v.slice(0, COMMUNITY_DESCRIPTION_MAX_CHARS))}
        placeholder="What is this community about?"
        placeholderTextColor={c.textTertiary}
        multiline
        accessibilityLabel="Community description"
      />
      <Text style={styles.counter}>{description.trim().length}/{COMMUNITY_DESCRIPTION_MAX_CHARS}</Text>

      {/* Accent */}
      <Text style={styles.fieldLabel}>Accent color</Text>
      <View style={styles.swatchRow}>
        {ACCENT_SWATCHES.map((hex) => {
          const selected = normalizeAccent(accent) === hex;
          return (
            <Pressable
              key={hex}
              accessibilityRole="button"
              accessibilityLabel={`Accent ${hex}`}
              onPress={() => setAccent(hex)}
              style={[styles.swatch, { backgroundColor: hex }, selected && styles.swatchSelected]}
            />
          );
        })}
        {normalizeAccent(accent) ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear accent" onPress={() => setAccent('')} style={styles.swatchClear}>
            <Text style={styles.swatchClearText}>None</Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        style={[styles.fieldInput, !accentValid && styles.fieldInputError]}
        value={accent}
        onChangeText={setAccent}
        placeholder="#0e7c66"
        placeholderTextColor={c.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Accent color hex"
      />
      {!accentValid ? <Text style={styles.errorText}>Use a #rrggbb hex color.</Text> : null}

      {/* Banner */}
      <Text style={styles.fieldLabel}>Banner</Text>
      {bannerPreviewUri ? (
        <RNImage source={{ uri: bannerPreviewUri }} style={styles.bannerPreview} accessibilityIgnoresInvertColors />
      ) : bannerDraft.kind === 'keep' && hasCurrentBanner ? (
        <Text style={styles.limitText}>A banner is set. Choose a new one to replace it.</Text>
      ) : (
        <Text style={styles.limitText}>No banner. It shows across the top of the community screen.</Text>
      )}
      {bannerSupported ? (
        <View style={styles.buttonRow}>
          <Button title={bannerLabel} variant="secondary" onPress={chooseBanner} disabled={busy} />
          {(bannerDraft.kind === 'new' || hasCurrentBanner) ? (
            <Button title="Remove banner" variant="ghost" onPress={() => setBannerDraft({ kind: 'remove' })} disabled={busy} />
          ) : null}
        </View>
      ) : (
        <Text style={styles.limitText}>Photo picking needs an app update on this device.</Text>
      )}

      {/* Theme */}
      <Text style={styles.fieldLabel}>Community theme</Text>
      <View style={styles.themeGrid}>
        <ThemeChip label="Keep current" active={themeSel.kind === 'keep'} onPress={() => setThemeSel({ kind: 'keep' })} styles={styles} />
        <ThemeChip label="No theme" active={themeSel.kind === 'none'} onPress={() => setThemeSel({ kind: 'none' })} styles={styles} />
        <ThemeChip label="Use my current theme" active={themeSel.kind === 'mine'} onPress={() => setThemeSel({ kind: 'mine' })} styles={styles} />
        {PRESETS.map((preset) => (
          <ThemeChip
            key={preset.id}
            label={preset.name}
            active={themeSel.kind === 'preset' && themeSel.id === preset.id}
            onPress={() => setThemeSel({ kind: 'preset', id: preset.id })}
            styles={styles}
          />
        ))}
      </View>

      {preview ? (
        <View style={styles.previewSwatches}>
          <View style={[styles.previewSwatch, { backgroundColor: preview.background }]} />
          <View style={[styles.previewSwatch, { backgroundColor: preview.surface }]} />
          <View style={[styles.previewSwatch, { backgroundColor: preview.accent }]} />
          <View style={[styles.previewSwatch, { backgroundColor: preview.text }]} />
        </View>
      ) : (
        <Text style={styles.limitText}>No full theme. The accent applies over each member's own theme.</Text>
      )}
      {wcag && !wcag.ok ? (
        <Text style={styles.warnText}>Low contrast ({wcag.worst.toFixed(1)}:1). Some text may be hard to read. You can still use this theme.</Text>
      ) : null}

      <Button title={busy ? 'Working…' : 'Save appearance'} onPress={save} disabled={busy || !accentValid} />
      {current?.themeBlob ? (
        <Button title="Share theme" variant="secondary" onPress={() => setShareOpen(true)} disabled={busy} />
      ) : null}
      {current ? <Button title="Reset to default look" variant="ghost" onPress={resetLook} disabled={busy} /> : null}

      <Modal visible={shareOpen} transparent animationType="slide" onRequestClose={() => setShareOpen(false)}>
        <Pressable style={styles.shareBackdrop} onPress={() => setShareOpen(false)} accessibilityLabel="Close" />
        <View style={styles.shareSheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.shareTitle}>Share theme</Text>
            <Text style={styles.limitText}>
              A copy of this community's theme. Scan or paste it to adopt it. Nothing is uploaded.
            </Text>
            {current?.themeBlob ? (
              <>
                <View style={styles.qrCard}>
                  <QrCode value={current.themeBlob} size={196} />
                </View>
                <Text style={styles.shareBlob} selectable numberOfLines={3}>{current.themeBlob}</Text>
                <View style={styles.buttonRow}>
                  <Button
                    title={copied === 'code' ? 'Copied' : 'Copy code'}
                    onPress={() => {
                      void Clipboard.setStringAsync(current.themeBlob as string);
                      setCopied('code');
                      setTimeout(() => setCopied(null), 1500);
                    }}
                  />
                  <Button
                    title={copied === 'link' ? 'Copied' : 'Copy deep link'}
                    variant="secondary"
                    onPress={() => {
                      void Clipboard.setStringAsync(`${THEME_DEEP_LINK_PREFIX}${current.themeBlob}`);
                      setCopied('link');
                      setTimeout(() => setCopied(null), 1500);
                    }}
                  />
                </View>
              </>
            ) : null}
            <Button title="Done" variant="ghost" onPress={() => setShareOpen(false)} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function ThemeChip({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Theme ${label}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.themeChip, active && styles.themeChipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.themeChipText, active && styles.themeChipTextActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (c: TokenColors) => StyleSheet.create({
  panel: {
    backgroundColor: c.surface,
    borderColor: c.glassBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 14,
    gap: 10,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewCopy: { flex: 1, minWidth: 0, gap: 2 },
  previewName: { color: c.text, fontSize: 15, fontWeight: '800' },
  previewHint: { color: c.textTertiary, fontSize: 12 },
  buttonRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  fieldLabel: { color: c.text, fontSize: 13, fontWeight: '800', marginTop: 2 },
  fieldInput: {
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  fieldInputError: { borderWidth: StyleSheet.hairlineWidth, borderColor: c.danger },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  counter: { color: c.textTertiary, fontSize: 11, textAlign: 'right', marginTop: -6 },
  swatchRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: c.glassBorder },
  swatchSelected: { borderWidth: 3, borderColor: c.text },
  swatchClear: {
    minHeight: 30,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: MK_RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
    backgroundColor: c.surfaceElevated,
  },
  swatchClearText: { color: c.textSecondary, fontSize: 11, fontWeight: '800' },
  errorText: { color: c.danger, fontSize: 12 },
  warnText: { color: c.warning, fontSize: 12, lineHeight: 17 },
  limitText: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  bannerPreview: { width: '100%', height: 96, borderRadius: MK_RADIUS.md, backgroundColor: c.surfaceHigh },
  themeGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  themeChip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: MK_RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
    backgroundColor: c.surfaceElevated,
  },
  themeChipActive: { borderColor: c.accent, backgroundColor: c.glass },
  themeChipText: { color: c.textSecondary, fontSize: 12, fontWeight: '800' },
  themeChipTextActive: { color: c.accent },
  previewSwatches: { flexDirection: 'row', gap: 6 },
  previewSwatch: { flex: 1, height: 26, borderRadius: MK_RADIUS.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: c.glassBorder },
  shareBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  shareSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    backgroundColor: c.surface,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
    padding: 18,
    gap: 12,
  },
  shareTitle: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  qrCard: { alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: MK_RADIUS.md, padding: 14, marginVertical: 12 },
  shareBlob: {
    color: c.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.sm,
    padding: 10,
    marginBottom: 12,
  },
  pressed: { opacity: 0.72 },
});
