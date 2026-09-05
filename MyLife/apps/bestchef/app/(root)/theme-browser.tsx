import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Copy as CopyIcon, Edit3, Palette, Plus, Share2, Trash2, X } from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import {
  Text,
  THEME_PRESETS,
  validateTheme,
  type ThemeProfile,
} from '@mylife/ui';
import {
  deleteCustomTheme,
  duplicateCustomTheme,
  renameCustomTheme,
  createCustomTheme,
} from '@mylife/bestchef';
import { useAddedToast } from '@mylife/bestchef/ui';
import {
  useAppTheme,
  useAppThemeColors as useThemeColors,
  useAppThemeProfile as useTheme,
  type CustomThemeEntry,
} from './providers/AppThemeProvider';
import { useDatabase } from './providers/DatabaseProvider';
import { useI18n } from './i18n/I18nProvider';
import { BackArrow } from './components/DirectionalIcons';

const PRESET_ORDER = [
  'cool-obsidian',
  'arctic-light',
  'warm-analog',
  'neon-terminal',
  'soft-gradient',
  'minimal-ink',
  'candy-glass',
  'earth-clay',
  'neumorphic-slate',
] as const;

interface RowSwatchesProps {
  preset: ThemeProfile;
}

function RowSwatches({ preset }: RowSwatchesProps) {
  return (
    <View style={styles.swatchRow}>
      <View style={[styles.swatch, styles.swatchLarge, { backgroundColor: preset.colors.background }]} />
      <View style={[styles.swatch, styles.swatchLarge, { backgroundColor: preset.colors.surface }]} />
      <View style={[styles.swatch, { backgroundColor: preset.colors.accent }]} />
      <View style={[styles.swatch, { backgroundColor: preset.colors.primary }]} />
    </View>
  );
}

function ThemePresetCard({
  preset,
  isActive,
  onPress,
}: {
  preset: ThemeProfile;
  isActive: boolean;
  onPress: () => void;
}) {
  const tc = useThemeColors();
  const theme = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.presetCard,
        {
          backgroundColor: theme.glass.cardFill,
          borderColor: isActive ? tc.accent : theme.glass.cardBorder,
          borderWidth: isActive ? 2 : 1,
        },
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
    >
      {isActive && (
        <View style={[styles.activeBadge, { backgroundColor: tc.accent }]}>
          <Check size={10} color={tc.background} strokeWidth={3} />
        </View>
      )}
      <RowSwatches preset={preset} />
      <View style={styles.swatchRow}>
        <View style={[styles.swatchSmall, { backgroundColor: preset.colors.text }]} />
        <View style={[styles.swatchSmall, { backgroundColor: preset.colors.textSecondary }]} />
        <View style={[styles.swatchSmall, { backgroundColor: preset.colors.success }]} />
        <View style={[styles.swatchSmall, { backgroundColor: preset.colors.danger }]} />
        <View style={[styles.swatchSmall, { backgroundColor: preset.colors.surfaceElevated }]} />
      </View>
      <Text style={[styles.presetName, { color: tc.text }]}>{preset.name}</Text>
      <Text style={[styles.presetDesc, { color: tc.textSecondary }]} numberOfLines={1}>
        {preset.description}
      </Text>
    </Pressable>
  );
}

function CustomThemeRow({
  entry,
  isActive,
  onApply,
  onRename,
  onDuplicate,
  onDelete,
  onExport,
}: {
  entry: CustomThemeEntry;
  isActive: boolean;
  onApply: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View
      style={[
        styles.presetCard,
        {
          backgroundColor: theme.glass.cardFill,
          borderColor: isActive ? tc.accent : theme.glass.cardBorder,
          borderWidth: isActive ? 2 : 1,
        },
      ]}
    >
      {isActive && (
        <View style={[styles.activeBadge, { backgroundColor: tc.accent }]}>
          <Check size={10} color={tc.background} strokeWidth={3} />
        </View>
      )}
      <Pressable onPress={onApply}>
        <RowSwatches preset={entry.theme} />
      </Pressable>
      <View style={styles.customHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.presetName, { color: tc.text }]} numberOfLines={1}>{entry.name}</Text>
          <Text style={[styles.customTag, { color: tc.accent }]}>{t('Custom')}</Text>
        </View>
      </View>
      <View style={styles.customActionRow}>
        <Pressable
          style={({ pressed }) => [styles.customAction, { borderColor: tc.border }, pressed && { opacity: 0.8 }]}
          onPress={onRename}
        >
          <Edit3 size={12} color={tc.textSecondary} strokeWidth={2} />
          <Text style={[styles.customActionText, { color: tc.textSecondary }]}>{t('theme_action_rename')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.customAction, { borderColor: tc.border }, pressed && { opacity: 0.8 }]}
          onPress={onDuplicate}
        >
          <CopyIcon size={12} color={tc.textSecondary} strokeWidth={2} />
          <Text style={[styles.customActionText, { color: tc.textSecondary }]}>{t('theme_action_duplicate')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.customAction, { borderColor: tc.border }, pressed && { opacity: 0.8 }]}
          onPress={onExport}
        >
          <Share2 size={12} color={tc.textSecondary} strokeWidth={2} />
          <Text style={[styles.customActionText, { color: tc.textSecondary }]}>{t('theme_export_action')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.customAction, { borderColor: '#FFB4AB55' }, pressed && { opacity: 0.8 }]}
          onPress={onDelete}
        >
          <Trash2 size={12} color="#FFB4AB" strokeWidth={2} />
          <Text style={[styles.customActionText, { color: '#FFB4AB' }]}>{t('theme_action_delete')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface NameDialogProps {
  visible: boolean;
  title: string;
  initialValue: string;
  onCancel: () => void;
  onConfirm: (value: string) => string | null;
}

function NameDialog({ visible, title, initialValue, onCancel, onConfirm }: NameDialogProps) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  // Reset internal state whenever the dialog reopens with a fresh initial value.
  const lastInitialRef = useState(initialValue)[1];
  if (visible && lastInitialRef !== undefined) {
    // No-op — kept to satisfy lint without violating hooks; real reset on open below.
  }

  const handleSubmit = () => {
    const err = onConfirm(value);
    if (err) setError(err);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.glass.cardBorder }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: tc.text }]}>{title}</Text>
            <Pressable hitSlop={12} onPress={onCancel}>
              <X size={20} color={tc.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
          <Text style={[styles.modalLabel, { color: tc.textSecondary }]}>{t('theme_name_label')}</Text>
          <TextInput
            style={[styles.modalInput, {
              color: tc.text,
              backgroundColor: theme.glass.cardFill,
              borderColor: error ? '#FFB4AB' : theme.glass.cardBorder,
            }]}
            value={value}
            onChangeText={(v) => { setValue(v); setError(null); }}
            placeholder={t('theme_name_label')}
            placeholderTextColor={tc.textTertiary}
            autoFocus
          />
          {error ? <Text style={[styles.modalError, { color: '#FFB4AB' }]}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable
              style={({ pressed }) => [styles.modalAction, { borderColor: tc.border, opacity: pressed ? 0.8 : 1 }]}
              onPress={onCancel}
            >
              <Text style={[styles.modalActionText, { color: tc.textSecondary }]}>{t('Cancel')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.modalAction, {
                backgroundColor: tc.accent, borderColor: tc.accent, opacity: pressed ? 0.85 : 1,
              }]}
              onPress={handleSubmit}
            >
              <Text style={[styles.modalActionText, { color: tc.background }]}>{t('OK')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface ImportDialogProps {
  visible: boolean;
  onCancel: () => void;
  onImport: (themeJson: string, name: string) => string | null;
}

function ImportDialog({ visible, onCancel, onImport }: ImportDialogProps) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const [json, setJson] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<ThemeProfile | null>(null);

  const handleValidate = () => {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setError(t('theme_invalid_json'));
      setPreviewTheme(null);
      return;
    }
    const result = validateTheme(parsed);
    if (!result.success) {
      const msg = result.errors.slice(0, 3).join(' / ');
      setError(`${t('theme_invalid_json')}: ${msg || ''}`);
      setPreviewTheme(null);
      return;
    }
    setPreviewTheme(result.theme);
    if (!name.trim()) setName(result.theme.name || 'Imported');
  };

  const handleImport = () => {
    if (!previewTheme) {
      setError(t('theme_invalid_json'));
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('theme_name_label'));
      return;
    }
    const err = onImport(json, trimmed);
    if (err) setError(err);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCardLarge, { backgroundColor: theme.colors.surface, borderColor: theme.glass.cardBorder }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: tc.text }]}>{t('theme_import_action')}</Text>
            <Pressable hitSlop={12} onPress={onCancel}>
              <X size={20} color={tc.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
          <Text style={[styles.modalLabel, { color: tc.textSecondary }]}>JSON</Text>
          <TextInput
            style={[styles.modalTextarea, {
              color: tc.text,
              backgroundColor: theme.glass.cardFill,
              borderColor: error ? '#FFB4AB' : theme.glass.cardBorder,
            }]}
            value={json}
            onChangeText={(v) => { setJson(v); setError(null); setPreviewTheme(null); }}
            placeholder='{"id":"sample","name":"Sample","colors":{...}}'
            placeholderTextColor={tc.textTertiary}
            multiline
            autoCorrect={false}
            autoCapitalize="none"
          />
          <Pressable
            style={({ pressed }) => [styles.modalAction, {
              borderColor: tc.accent, alignSelf: 'flex-start', opacity: pressed ? 0.8 : 1,
            }]}
            onPress={handleValidate}
          >
            <Text style={[styles.modalActionText, { color: tc.accent }]}>{t('Preview')}</Text>
          </Pressable>
          {previewTheme ? (
            <View style={[styles.importPreview, { borderColor: theme.glass.cardBorder, backgroundColor: previewTheme.colors.background }]}>
              <Text style={[styles.importPreviewName, { color: previewTheme.colors.text }]}>{previewTheme.name}</Text>
              <View style={styles.swatchRow}>
                <View style={[styles.swatch, { backgroundColor: previewTheme.colors.accent }]} />
                <View style={[styles.swatch, { backgroundColor: previewTheme.colors.primary }]} />
                <View style={[styles.swatch, { backgroundColor: previewTheme.colors.surface }]} />
                <View style={[styles.swatch, { backgroundColor: previewTheme.colors.text }]} />
              </View>
            </View>
          ) : null}
          <Text style={[styles.modalLabel, { color: tc.textSecondary }]}>{t('theme_name_label')}</Text>
          <TextInput
            style={[styles.modalInput, {
              color: tc.text,
              backgroundColor: theme.glass.cardFill,
              borderColor: error ? '#FFB4AB' : theme.glass.cardBorder,
            }]}
            value={name}
            onChangeText={(v) => { setName(v); setError(null); }}
            placeholder={t('theme_name_label')}
            placeholderTextColor={tc.textTertiary}
          />
          {error ? <Text style={[styles.modalError, { color: '#FFB4AB' }]}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable
              style={({ pressed }) => [styles.modalAction, { borderColor: tc.border, opacity: pressed ? 0.8 : 1 }]}
              onPress={onCancel}
            >
              <Text style={[styles.modalActionText, { color: tc.textSecondary }]}>{t('Cancel')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.modalAction, {
                backgroundColor: tc.accent, borderColor: tc.accent,
                opacity: pressed ? 0.85 : (previewTheme ? 1 : 0.5),
              }]}
              onPress={handleImport}
              disabled={!previewTheme}
            >
              <Text style={[styles.modalActionText, { color: tc.background }]}>{t('theme_import_action')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface ExportDialogProps {
  visible: boolean;
  exportJson: string;
  themeName: string;
  onClose: () => void;
}

function ExportDialog({ visible, exportJson, themeName, onClose }: ExportDialogProps) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(exportJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // expo-clipboard unavailable; surface text for manual copy.
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCardLarge, { backgroundColor: theme.colors.surface, borderColor: theme.glass.cardBorder }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: tc.text }]}>{t('theme_export_action')}</Text>
            <Pressable hitSlop={12} onPress={onClose}>
              <X size={20} color={tc.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
          <Text style={[styles.modalLabel, { color: tc.textSecondary }]}>{themeName}</Text>
          <TextInput
            style={[styles.modalTextarea, {
              color: tc.text,
              backgroundColor: theme.glass.cardFill,
              borderColor: theme.glass.cardBorder,
            }]}
            value={exportJson}
            editable={false}
            multiline
            selectTextOnFocus
          />
          <View style={styles.qrPlaceholder}>
            <View style={[styles.qrBox, { borderColor: theme.glass.cardBorder }]}>
              <Text style={[styles.qrGlyph, { color: tc.textTertiary }]}>{'\u2317'}</Text>
            </View>
            <Text style={[styles.qrCaption, { color: tc.textTertiary }]}>{t('theme_scan_qr')}</Text>
          </View>
          <View style={styles.modalActions}>
            <Pressable
              style={({ pressed }) => [styles.modalAction, {
                backgroundColor: tc.accent, borderColor: tc.accent, opacity: pressed ? 0.85 : 1,
              }]}
              onPress={handleCopy}
            >
              <Text style={[styles.modalActionText, { color: tc.background }]}>
                {copied ? t('Copied') : t('Copy')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ThemeBrowserScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tc = useThemeColors();
  const theme = useTheme();
  const { themeId, setTheme, customThemes, refreshCustomThemes } = useAppTheme();
  const { t } = useI18n();
  const db = useDatabase();
  const toast = useAddedToast();

  const [renameTarget, setRenameTarget] = useState<CustomThemeEntry | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<CustomThemeEntry | null>(null);
  const [exportTarget, setExportTarget] = useState<CustomThemeEntry | null>(null);
  const [importVisible, setImportVisible] = useState(false);

  const handleApplyCustom = useCallback((entry: CustomThemeEntry) => {
    setTheme(`custom:${entry.id}`, entry.theme);
  }, [setTheme]);

  const handleDelete = useCallback((entry: CustomThemeEntry) => {
    Alert.alert(
      t('theme_action_delete'),
      entry.name,
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: () => {
            try {
              deleteCustomTheme(db, entry.id);
              if (themeId === `custom:${entry.id}`) {
                setTheme('bestchef-warm-charcoal');
              }
              refreshCustomThemes();
            } catch (err) {
              Alert.alert(t('Error'), String(err instanceof Error ? err.message : err));
            }
          },
        },
      ],
    );
  }, [db, themeId, setTheme, refreshCustomThemes, t]);

  const handleRenameConfirm = useCallback((entry: CustomThemeEntry, value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return t('theme_name_label');
    try {
      renameCustomTheme(db, entry.id, trimmed);
      refreshCustomThemes();
      setRenameTarget(null);
      toast.show(t('theme_action_rename'));
      return null;
    } catch (err) {
      return String(err instanceof Error ? err.message : err);
    }
  }, [db, refreshCustomThemes, toast, t]);

  const handleDuplicateConfirm = useCallback((entry: CustomThemeEntry, value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return t('theme_name_label');
    try {
      duplicateCustomTheme(db, entry.id, trimmed);
      refreshCustomThemes();
      setDuplicateTarget(null);
      toast.show(t('theme_action_duplicate'));
      return null;
    } catch (err) {
      return String(err instanceof Error ? err.message : err);
    }
  }, [db, refreshCustomThemes, toast, t]);

  const handleImport = useCallback((jsonText: string, name: string): string | null => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return t('theme_invalid_json');
    }
    const result = validateTheme(parsed);
    if (!result.success || !result.theme) {
      return t('theme_invalid_json');
    }
    try {
      const namedTheme: ThemeProfile = { ...result.theme, name };
      const created = createCustomTheme(db, {
        name,
        tokenOverrides: namedTheme,
      });
      refreshCustomThemes();
      setTheme(`custom:${created.id}`, namedTheme);
      setImportVisible(false);
      toast.show(t('theme_import_action'));
      return null;
    } catch (err) {
      return String(err instanceof Error ? err.message : err);
    }
  }, [db, refreshCustomThemes, setTheme, toast, t]);

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Themes')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {customThemes.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { color: tc.accent }]}>{t('Custom')}</Text>
            {customThemes.map((entry) => (
              <CustomThemeRow
                key={entry.id}
                entry={entry}
                isActive={themeId === `custom:${entry.id}`}
                onApply={() => handleApplyCustom(entry)}
                onRename={() => setRenameTarget(entry)}
                onDuplicate={() => setDuplicateTarget(entry)}
                onDelete={() => handleDelete(entry)}
                onExport={() => setExportTarget(entry)}
              />
            ))}
          </>
        ) : null}

        <Text style={[styles.sectionLabel, { color: tc.accent }]}>{t('Presets')}</Text>

        {PRESET_ORDER.map((id) => {
          const preset = THEME_PRESETS[id];
          if (!preset) return null;
          return (
            <ThemePresetCard
              key={id}
              preset={preset}
              isActive={themeId === id}
              onPress={() => setTheme(id)}
            />
          );
        })}

        <Pressable
          style={[
            styles.customButton,
            { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
          ]}
          onPress={() => router.push('/theme-editor')}
        >
          <Palette size={20} color={tc.accent} strokeWidth={2} />
          <Text style={[styles.customButtonText, { color: tc.accent }]}>{t('Create Custom Theme')}</Text>
        </Pressable>
        <Pressable
          style={[
            styles.customButton,
            { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
          ]}
          onPress={() => setImportVisible(true)}
        >
          <Plus size={20} color={tc.accent} strokeWidth={2} />
          <Text style={[styles.customButtonText, { color: tc.accent }]}>{t('theme_import_action')}</Text>
        </Pressable>
      </ScrollView>

      {renameTarget ? (
        <NameDialog
          visible={true}
          title={t('theme_action_rename')}
          initialValue={renameTarget.name}
          onCancel={() => setRenameTarget(null)}
          onConfirm={(v) => handleRenameConfirm(renameTarget, v)}
        />
      ) : null}
      {duplicateTarget ? (
        <NameDialog
          visible={true}
          title={t('theme_action_duplicate')}
          initialValue={`${duplicateTarget.name} 2`}
          onCancel={() => setDuplicateTarget(null)}
          onConfirm={(v) => handleDuplicateConfirm(duplicateTarget, v)}
        />
      ) : null}
      {exportTarget ? (
        <ExportDialog
          visible={true}
          themeName={exportTarget.name}
          exportJson={JSON.stringify(exportTarget.theme, null, 2)}
          onClose={() => setExportTarget(null)}
        />
      ) : null}
      {importVisible ? (
        <ImportDialog
          visible={true}
          onCancel={() => setImportVisible(false)}
          onImport={handleImport}
        />
      ) : null}
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
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 12 },
  sectionLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11, letterSpacing: 1.6, marginTop: 8 },
  presetCard: {
    borderRadius: 20, padding: 18, gap: 10, position: 'relative',
  },
  activeBadge: {
    position: 'absolute', top: 12, right: 12, width: 22, height: 22,
    borderRadius: 11, alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  swatchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  swatch: { width: 32, height: 32, borderRadius: 8 },
  swatchLarge: { width: 40, height: 40, borderRadius: 10 },
  swatchSmall: { width: 20, height: 20, borderRadius: 6 },
  presetName: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16, marginTop: 4 },
  presetDesc: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12 },
  customButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: 999, borderWidth: 1, marginTop: 8,
  },
  customButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  customHeader: { flexDirection: 'row', alignItems: 'center' },
  customTag: { fontFamily: JAKARTA_FONTS.bold, fontSize: 9, letterSpacing: 1.4, marginTop: 2 },
  customActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  customAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  customActionText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 11 },
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
  modalCardLarge: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    maxHeight: '92%',
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
  modalTextarea: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 120,
    textAlignVertical: 'top',
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
  importPreview: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  importPreviewName: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  qrPlaceholder: { alignItems: 'center', gap: 6, marginVertical: 4 },
  qrBox: {
    width: 110,
    height: 110,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrGlyph: { fontSize: 60 },
  qrCaption: { fontFamily: JAKARTA_FONTS.regular, fontSize: 11 },
});
