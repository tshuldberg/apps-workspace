import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Check, ChevronLeft, MoreHorizontal } from 'lucide-react-native';
import {
  THEME_DEEP_LINK_PREFIX,
  decodeThemeBlob,
  encodeThemeBlob,
  getPreset,
  ratesAA,
  resolveProfile,
  type MkColors as MkColorSet,
  type MkPaletteMode,
  type MkThemeAuthor,
  type MkThemeProfile,
} from '@mylife/meerkat-theme';
import { MK_MONO, MK_RADIUS, type MkColors } from '../theme/tokens';
import { useAppThemeColors, useMkStyles, useThemeLibrary } from '../providers/AppThemeProvider';
import { useIdentity } from '../providers/IdentityProvider';
import { Button, HonestNotice, SectionHeader } from '../components/kit';
import { QrCode } from '../components/QrCode';
import { QrScanner, isQrScannerAvailable } from '../components/QrScanner';
import type { ThemeMode } from '../theme/theme-store';
import { authorLabel, signThemeAuthor } from '../theme/theme-author';

const MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

type Sheet =
  | { kind: 'none' }
  | { kind: 'share'; profileId: string }
  | { kind: 'import'; initialText?: string }
  | { kind: 'rename'; profileId: string }
  | { kind: 'menu'; profileId: string };

export default function AppearanceScreen(): React.ReactElement {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ import?: string }>();
  const scheme = useColorScheme();
  const {
    presets,
    customThemes,
    activeId,
    activeProfile,
    themeMode,
    setMode,
    applyTheme,
    renameCustomTheme,
    deleteCustomTheme,
  } = useThemeLibrary();

  const { width, fontScale } = useWindowDimensions();
  const [collection, setCollection] = useState('All');
  const collections = ['All', ...new Set(presets.map((preset) => preset.register).filter((name): name is string => typeof name === 'string'))];
  const visiblePresets = presets.filter((preset) => collection === 'All' || preset.register === collection);
  const singleColumn = width < 360 || fontScale >= 1.3;

  const [sheet, setSheet] = useState<Sheet>({ kind: 'none' });

  // A `meerkat://theme/import#<blob>` deep link routes here with the blob as a
  // param; open the import sheet pre-filled. Handled once per distinct value.
  const importedParam = typeof params.import === 'string' ? params.import : undefined;
  const handledImport = useRef<string | null>(null);
  useEffect(() => {
    if (importedParam && importedParam !== handledImport.current) {
      handledImport.current = importedParam;
      setSheet({ kind: 'import', initialText: importedParam });
    }
  }, [importedParam]);

  // The mode each preview card renders in: the user's setting resolved against
  // the OS appearance when on System.
  const requestedMode: MkPaletteMode =
    themeMode === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : themeMode;

  const profileById = useCallback(
    (id: string): MkThemeProfile | undefined =>
      getPreset(id) ?? customThemes.find((t) => t.id === id)?.profile,
    [customThemes],
  );

  const closeSheet = useCallback(() => setSheet({ kind: 'none' }), []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => {
            // Deep-linkable (meerkat://theme/import): back must not dead-end.
            if (router.canGoBack()) router.back();
            else router.replace('/me');
          }}
          style={styles.backRow}
        >
          <ChevronLeft size={20} color={c.accent} strokeWidth={2} />
          <Text style={styles.backText}>Me</Text>
        </Pressable>

        <Text style={styles.title}>Appearance</Text>
        <Text style={styles.subtitle}>Make Meerkat feel like you.</Text>

        <View style={styles.segment}>
          {MODE_OPTIONS.map((opt) => {
            const active = themeMode === opt.value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setMode(opt.value)}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.segmentNote}>
          System follows your device. Light and Dark override it on this device.
        </Text>

        <View style={styles.section}>
          <View style={styles.currentTheme} accessibilityLiveRegion="polite">
            <Check size={18} color={c.accent} />
            <Text style={styles.currentThemeText}>{activeProfile.name} is your current theme</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collections}>
            {collections.map((name) => (
              <Pressable key={name} accessibilityRole="button" accessibilityState={{ selected: collection === name }}
                onPress={() => setCollection(name)} style={[styles.collection, collection === name && styles.collectionActive]}>
                <Text style={[styles.collectionText, collection === name && styles.collectionTextActive]}>{name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <SectionHeader title={`${visiblePresets.length} themes`} hint="Light & dark included" />
          <View style={styles.grid}>
            {visiblePresets.map((preset) => (
              <PresetCard
                key={preset.id}
                profile={preset}
                fullWidth={singleColumn}
                mode={requestedMode}
                selected={preset.id === activeId}
                onApply={() => applyTheme(preset.id)}
                onShare={() => setSheet({ kind: 'share', profileId: preset.id })}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="My themes" />
          {customThemes.length === 0 ? (
            <Text style={styles.empty}>No custom themes yet. Create one or import a friend's.</Text>
          ) : (
            customThemes.map((theme) => (
              <CustomRow
                key={theme.id}
                name={theme.name}
                selected={theme.id === activeId}
                onApply={() => applyTheme(theme.id)}
                onMenu={() => setSheet({ kind: 'menu', profileId: theme.id })}
              />
            ))
          )}
          <View style={styles.actionsRow}>
            <Button
              title="Create custom theme"
              onPress={() => router.push('/theme-editor')}
              style={styles.flexBtn}
            />
            <Button
              title="Import a theme"
              variant="secondary"
              onPress={() => setSheet({ kind: 'import' })}
              style={styles.flexBtn}
            />
          </View>
        </View>

        <HonestNotice text="Your look is saved on this device. Themes never sync between your devices on their own. To move a theme, share it as a code." />
        <View style={{ height: insets.bottom + 48 }} />
      </ScrollView>

      <Modal
        visible={sheet.kind !== 'none'}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <KeyboardAvoidingView style={styles.modalLayout} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={closeSheet} accessibilityRole="button" accessibilityLabel="Close theme sheet" />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {sheet.kind === 'share' && (
            <ShareSheet profile={profileById(sheet.profileId)} onClose={closeSheet} />
          )}
          {sheet.kind === 'import' && (
            <ImportSheet
              initialText={sheet.initialText}
              onAdded={(id) => {
                applyTheme(id);
                closeSheet();
              }}
              onClose={closeSheet}
            />
          )}
          {sheet.kind === 'menu' && (
            <MenuSheet
              onApply={() => {
                applyTheme(sheet.profileId);
                closeSheet();
              }}
              onRename={() => setSheet({ kind: 'rename', profileId: sheet.profileId })}
              onShare={() => setSheet({ kind: 'share', profileId: sheet.profileId })}
              onDelete={() => {
                deleteCustomTheme(sheet.profileId);
                closeSheet();
              }}
            />
          )}
          {sheet.kind === 'rename' && (
            <RenameSheet
              current={customThemes.find((t) => t.id === sheet.profileId)?.name ?? ''}
              onSave={(name) => {
                renameCustomTheme(sheet.profileId, name);
                closeSheet();
              }}
              onClose={closeSheet}
            />
          )}
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function PresetCard({
  profile,
  fullWidth,
  mode,
  selected,
  onApply,
  onShare,
}: {
  profile: MkThemeProfile;
  fullWidth: boolean;
  mode: MkPaletteMode;
  selected: boolean;
  onApply: () => void;
  onShare: () => void;
}): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  const p: MkColorSet = useMemo(() => resolveProfile(profile, mode), [profile, mode]);
  const passesAA =
    ratesAA(p.text, p.background) && ratesAA(p.text, p.surface) && ratesAA(p.onAccent, p.accent);

  return (
    <View style={[styles.card, fullWidth && styles.cardFull, { borderColor: selected ? p.accent : 'transparent' }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`Apply ${profile.name} theme`}
        onPress={onApply}
        style={({ pressed }) => pressed && { opacity: 0.8 }}
      >
        <View style={[styles.preview, { backgroundColor: p.background }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.previewBar, { backgroundColor: p.surface, borderColor: p.border }]}>
            <View style={[styles.previewDot, { backgroundColor: p.accent }]} />
            <Text style={[styles.previewHeading, { color: p.text }]}>Our little corner</Text>
          </View>
          <View style={[styles.previewCardInner, { backgroundColor: p.surface, borderColor: p.border }]}>
            <Text style={[styles.previewGreeting, { color: p.text }]}>Make yourself at home.</Text>
          </View>
          <View style={[styles.previewPill, { backgroundColor: p.accent }]}>
            <Text style={[styles.previewPillText, { color: p.onAccent }]}>Happy to be here</Text>
          </View>
        </View>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName}>{profile.name}</Text>
          {selected ? <Check size={16} color={styles.selectedIcon.color} strokeWidth={2.5} /> : null}
        </View>
      </Pressable>
      <View style={styles.cardMeta}>
        <View style={styles.cardTags}>
          {profile.register ? <Text style={styles.cardRegister}>{profile.register}</Text> : null}
          <Text style={styles.cardRegister} accessibilityLabel="Body and button text contrast">{passesAA ? 'AA' : 'Below AA'}</Text>
        </View>
        <Pressable onPress={onShare} accessibilityRole="button" accessibilityLabel={`Share ${profile.name} theme`} style={styles.cardShare}>
          <Text style={styles.cardShareText}>Share</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CustomRow({
  name,
  selected,
  onApply,
  onMenu,
}: {
  name: string;
  selected: boolean;
  onApply: () => void;
  onMenu: () => void;
}): React.ReactElement {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.customRow}>
      <Pressable style={styles.customRowMain} onPress={onApply} accessibilityRole="button">
        <Text style={styles.customRowName} numberOfLines={1}>
          {name}
        </Text>
        {selected ? <Check size={16} color={c.accent} strokeWidth={2.5} /> : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} options`}
        onPress={onMenu}
        style={styles.customRowMenu}
      >
        <MoreHorizontal size={20} color={c.textSecondary} />
      </Pressable>
    </View>
  );
}

function ShareSheet({
  profile,
  onClose,
}: {
  profile: MkThemeProfile | undefined;
  onClose: () => void;
}): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  const { identity, displayName } = useIdentity();
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);

  if (!profile) {
    return <Text style={styles.sheetTitle}>Theme not found.</Text>;
  }
  // Optional signed author. Returns null if the device key is unavailable, in
  // which case the export ships unsigned (never a fake signature).
  const author = signed ? signThemeAuthor(profile, identity, displayName) : null;
  // Defense in depth: stored profiles are validated on read, so encoding a
  // schema-valid profile will not throw; guard anyway so a corrupt profile shows
  // an inline message instead of crashing the sheet.
  let blob: string;
  try {
    blob = encodeThemeBlob(profile, author ?? undefined);
  } catch {
    return (
      <View style={styles.menu}>
        <Text style={styles.sheetTitle}>Could not encode this theme.</Text>
        <Button title="Done" variant="ghost" onPress={onClose} />
      </View>
    );
  }
  const deepLink = `${THEME_DEEP_LINK_PREFIX}${blob}`;

  const copy = (label: string, value: string) => {
    // "Copied" is claimed only after the clipboard write resolves; a rejection
    // renders instead of a fake success.
    void Clipboard.setStringAsync(value)
      .then(() => {
        setCopyError(null);
        setCopied(label);
        setTimeout(() => setCopied(null), 1500);
      })
      .catch(() => setCopyError('Copy failed. Nothing was copied to the clipboard; try again.'));
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.sheetTitle}>Share {profile.name}</Text>
      <View style={styles.qrCard}>
        <QrCode value={blob} size={196} />
      </View>
      <Text style={styles.blob} selectable numberOfLines={3}>
        {blob}
      </Text>
      <View style={styles.signRow}>
        <View style={styles.signTextWrap}>
          <Text style={styles.signLabel}>Include signed author name</Text>
          <Text style={styles.signHint}>
            {signed && !author
              ? 'Signing is unavailable on this device. Sharing unsigned.'
              : `Adds "${displayName}" with a signature others can verify.`}
          </Text>
        </View>
        <Switch accessibilityLabel="Include signed author name" value={signed} onValueChange={setSigned} />
      </View>
      <View style={styles.actionsRow}>
        <Button
          title={copied === 'code' ? 'Copied' : 'Copy code'}
          onPress={() => copy('code', blob)}
          style={styles.flexBtn}
        />
        <Button
          title={copied === 'link' ? 'Copied' : 'Copy deep link'}
          variant="secondary"
          onPress={() => copy('link', deepLink)}
          style={styles.flexBtn}
        />
      </View>
      {copyError ? <Text style={styles.errorText}>{copyError}</Text> : null}
      <Text style={styles.footerNote}>
        This makes a copy you can paste or scan. Nothing is sent or uploaded, and your themes never
        sync between devices on their own.
      </Text>
      <Button title="Done" variant="ghost" onPress={onClose} />
    </ScrollView>
  );
}

function ImportSheet({
  initialText,
  onAdded,
  onClose,
}: {
  initialText?: string;
  onAdded: (id: string) => void;
  onClose: () => void;
}): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  const { saveCustomTheme } = useThemeLibrary();
  const [text, setText] = useState(initialText ?? '');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MkThemeProfile | null>(null);
  const [previewAuthor, setPreviewAuthor] = useState<MkThemeAuthor | undefined>(undefined);
  const [scanning, setScanning] = useState(false);

  const tryDecode = useCallback((input: string) => {
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
  }, []);

  // A deep-link arrives with the blob pre-filled; decode it on first mount.
  useEffect(() => {
    if (initialText && initialText.trim()) tryDecode(initialText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = useCallback(() => {
    if (!preview) return;
    const id = saveCustomTheme(preview, { source: 'imported' });
    if (id) onAdded(id);
    else setError('Could not save the imported theme.');
  }, [preview, saveCustomTheme, onAdded]);

  if (scanning) {
    return (
      <View style={styles.scanContainer}>
        <QrScanner
          onScan={(value) => {
            setScanning(false);
            setText(value);
            tryDecode(value);
          }}
          onCancel={() => setScanning(false)}
        />
      </View>
    );
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.sheetTitle}>Import a theme</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={(v) => {
          setText(v);
          if (v.trim()) tryDecode(v);
          else {
            setError(null);
            setPreview(null);
          }
        }}
        accessibilityLabel="Theme code or link"
        placeholder="Paste a theme code"
        placeholderTextColor={styles.placeholder.color}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      {isQrScannerAvailable() ? (
        <Button title="Scan QR" variant="secondary" onPress={() => setScanning(true)} />
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {preview ? (
        <View style={styles.previewBox}>
          <Text style={styles.previewName}>{preview.name}</Text>
          <Text style={styles.importMeta}>{authorLabel(preview, previewAuthor)}</Text>
          <Text style={styles.previewSub}>Ready to add.</Text>
          <Button title="Add to my themes" onPress={add} />
        </View>
      ) : null}
      <Button title="Cancel" variant="ghost" onPress={onClose} />
    </ScrollView>
  );
}

function MenuSheet({
  onApply,
  onRename,
  onShare,
  onDelete,
}: {
  onApply: () => void;
  onRename: () => void;
  onShare: () => void;
  onDelete: () => void;
}): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  // Two-step in-sheet confirm: deleting a custom theme is destructive and must
  // not be a single tap. An in-sheet step avoids stacking an Alert on the Modal.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  return (
    <View style={styles.menu}>
      <Button title="Apply" variant="secondary" onPress={onApply} />
      <Button title="Rename" variant="secondary" onPress={onRename} />
      <Button title="Share" variant="secondary" onPress={onShare} />
      {confirmingDelete ? (
        <>
          <Text style={styles.footerNote}>Delete this theme? This cannot be undone.</Text>
          <Button title="Delete forever" variant="danger" onPress={onDelete} />
          <Button title="Keep it" variant="ghost" onPress={() => setConfirmingDelete(false)} />
        </>
      ) : (
        <Button title="Delete" variant="danger" onPress={() => setConfirmingDelete(true)} />
      )}
    </View>
  );
}

function RenameSheet({
  current,
  onSave,
  onClose,
}: {
  current: string;
  onSave: (name: string) => void;
  onClose: () => void;
}): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  const [name, setName] = useState(current);
  const trimmed = name.trim();
  return (
    <View style={styles.menu}>
      <Text style={styles.sheetTitle}>Rename theme</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        accessibilityLabel="Theme name"
        placeholder="Theme name"
        placeholderTextColor={styles.placeholder.color}
        autoFocus
      />
      <Button title="Save" onPress={() => trimmed && onSave(trimmed)} disabled={!trimmed} />
      <Button title="Cancel" variant="ghost" onPress={onClose} />
    </View>
  );
}

const makeStyles = (c: MkColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, gap: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
    backRow: { minHeight: 44, alignSelf: 'flex-start', paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -4 },
    backText: { color: c.accent, fontSize: 16, fontWeight: '600' },
    title: { color: c.text, fontSize: 34, fontWeight: '700', letterSpacing: -0.8 },
    subtitle: { color: c.textSecondary, fontSize: 14, marginTop: -6 },
    segment: {
      flexDirection: 'row',
      backgroundColor: c.surfaceHigh,
      borderRadius: MK_RADIUS.md,
      padding: 4,
      gap: 4,
    },
    segmentItem: {
      flex: 1,
      minHeight: 44,
      justifyContent: 'center',
      paddingVertical: 9,
      borderRadius: MK_RADIUS.sm,
      alignItems: 'center',
    },
    segmentItemActive: {
      backgroundColor: c.surface,
      shadowColor: '#000000',
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    segmentText: { color: c.textSecondary, fontSize: 14, fontWeight: '700' },
    segmentTextActive: { color: c.text },
    segmentNote: { color: c.textSecondary, fontSize: 12.5, lineHeight: 18, marginTop: -6 },
    section: { gap: 12 },
    currentTheme: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    currentThemeText: { flex: 1, color: c.textSecondary, fontSize: 15, lineHeight: 21 },
    collections: { gap: 8 },
    collection: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: MK_RADIUS.pill, backgroundColor: c.surface },
    collectionActive: { backgroundColor: c.accent },
    collectionText: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
    collectionTextActive: { color: c.onAccent },
    cardFull: { width: '100%' },
    selectedIcon: { color: c.accent },
    previewHeading: { fontSize: 11, fontWeight: '600', flex: 1 },
    previewGreeting: { fontSize: 12, lineHeight: 17 },
    cardShare: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
    cardShareText: { color: c.accent, fontSize: 13, fontWeight: '600' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    card: {
      width: '47%',
      flexGrow: 1,
      borderRadius: MK_RADIUS.lg,
      borderWidth: 2,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    preview: { padding: 10, gap: 8, minHeight: 140 },
    previewBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: MK_RADIUS.sm,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    previewDot: { width: 12, height: 12, borderRadius: 6 },
    previewLine: { height: 6, borderRadius: 3, flex: 1, opacity: 0.7 },
    previewCardInner: {
      borderRadius: MK_RADIUS.sm,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 10,
      gap: 6,
    },
    previewLineWide: { height: 7, borderRadius: 3, width: '80%' },
    previewLineThin: { height: 5, borderRadius: 3, width: '55%', opacity: 0.8 },
    previewPill: {
      alignSelf: 'flex-end',
      borderRadius: MK_RADIUS.md,
      paddingHorizontal: 10,
      paddingVertical: 3,
      marginTop: 2,
    },
    previewPillText: { fontSize: 11, fontWeight: '500', lineHeight: 18 },
    cardMeta: { paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
    cardTitleRow: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 4, gap: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardName: { color: c.text, fontSize: 15, fontWeight: '600', flex: 1 },
    cardTags: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    cardRegister: { color: c.textSecondary, fontSize: 12 },
    aaChip: {
      borderRadius: MK_RADIUS.pill,
      paddingHorizontal: 7,
      paddingVertical: 1,
    },
    aaChipPass: { backgroundColor: c.successSoft },
    aaChipNeutral: { backgroundColor: c.surfaceHigh },
    aaChipText: { fontSize: 10, fontWeight: '800' },
    aaChipTextPass: { color: c.success },
    aaChipTextNeutral: { color: c.textTertiary },
    empty: { color: c.textSecondary, fontSize: 13.5, lineHeight: 20 },
    customRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: MK_RADIUS.md,
    },
    customRowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 8,
    },
    customRowName: { color: c.text, fontSize: 15, fontWeight: '700', flex: 1 },
    customRowMenu: { paddingHorizontal: 14, paddingVertical: 14 },
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
    flexBtn: { flexGrow: 1, flexBasis: 180 },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    modalLayout: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      maxHeight: '88%',
      backgroundColor: c.surface,
      borderTopLeftRadius: MK_RADIUS.lg,
      borderTopRightRadius: MK_RADIUS.lg,
      padding: 18,
      gap: 12,
    },
    sheetTitle: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
    qrCard: {
      alignSelf: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: MK_RADIUS.md,
      padding: 14,
    },
    blob: {
      color: c.textSecondary,
      fontFamily: MK_MONO,
      fontSize: 11,
      lineHeight: 16,
      backgroundColor: c.surfaceHigh,
      borderRadius: MK_RADIUS.sm,
      padding: 10,
    },
    footerNote: { color: c.textSecondary, fontSize: 12, lineHeight: 18 },
    signRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surfaceElevated,
      borderRadius: MK_RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    signTextWrap: { flex: 1, minWidth: 0, gap: 2 },
    signLabel: { color: c.text, fontSize: 14, fontWeight: '700' },
    signHint: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
    importMeta: { color: c.textSecondary, fontSize: 12.5 },
    input: {
      color: c.text,
      fontFamily: MK_MONO,
      fontSize: 13,
      backgroundColor: c.surfaceHigh,
      borderColor: c.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: MK_RADIUS.md,
      padding: 12,
      minHeight: 48,
    },
    placeholder: { color: c.textTertiary },
    errorText: { color: c.danger, fontSize: 13, fontWeight: '600', lineHeight: 19 },
    previewBox: {
      backgroundColor: c.surfaceElevated,
      borderRadius: MK_RADIUS.md,
      padding: 14,
      gap: 8,
    },
    previewName: { color: c.text, fontSize: 16, fontWeight: '800' },
    previewSub: { color: c.textSecondary, fontSize: 13 },
    menu: { gap: 10 },
    scanContainer: { height: 460, borderRadius: MK_RADIUS.md, overflow: 'hidden' },
  });
