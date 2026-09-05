import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClipboardPaste, Link as LinkIcon, FileText } from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useDatabase } from './providers/DatabaseProvider';
import {
  useAppThemeColors as useThemeColors,
  useAppThemeProfile as useTheme,
} from './providers/AppThemeProvider';
import { useI18n } from './i18n/I18nProvider';
import { createSavedRecipe } from './data/kitchen';
import {
  detectClipboardKind,
  importFromClipboardText,
  type RecipeDraft,
} from './utils/recipe-import';
import { BackArrow } from './components/DirectionalIcons';

/**
 * Kitchen paste-recipe screen (P14-C / F-018).
 *
 * Accepts a pasted URL or block of recipe text. URLs are fetched and
 * parsed via JSON-LD (`@type=Recipe`); plain text passes through the
 * heuristic recipe parser. The resulting draft is shown for review and
 * saved on confirmation. expo-clipboard is intentionally not a hard
 * dependency: users paste into the textarea explicitly.
 */
export default function KitchenPasteRecipeScreen() {
  const router = useRouter();
  const db = useDatabase();
  const insets = useSafeAreaInsets();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();

  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kind = useMemo(() => detectClipboardKind(pasted), [pasted]);

  const onParse = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await importFromClipboardText(pasted);
      if (!result) {
        setError(t('We could not extract a recipe from that input.'));
        setDraft(null);
        return;
      }
      setDraft(result);
    } finally {
      setBusy(false);
    }
  };

  const onSave = () => {
    if (!draft) return;
    if (draft.ingredients.length === 0 || draft.steps.length === 0) {
      Alert.alert(
        t('Missing details'),
        t('Add at least one ingredient and one step before saving.'),
      );
      return;
    }
    createSavedRecipe(db, {
      title: draft.title,
      description: draft.description ?? undefined,
      servings: draft.servings,
      prepTimeMins: draft.prepTimeMins,
      cookTimeMins: draft.cookTimeMins,
      ingredientsText: draft.ingredients.join('\n'),
      stepsText: draft.steps.join('\n'),
    });
    Alert.alert(t('Recipe saved'), draft.title);
    router.replace('/(tabs)/kitchen');
  };

  const updateDraftField = <K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('Back')}
        >
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.title, { color: tc.text }]}>{t('kitchen_paste_recipe')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${tc.accent}1F` }]}>
            <ClipboardPaste size={28} color={tc.accent} strokeWidth={2} />
          </View>
          <Text style={[styles.cardTitle, { color: tc.text }]}>
            {t('Paste a URL or recipe text')}
          </Text>
          <Text style={[styles.cardBody, { color: tc.textSecondary }]}>
            {t('Paste a recipe URL or copy the recipe text from another app. We extract a draft you can review.')}
          </Text>
          <TextInput
            style={[styles.textarea, { color: tc.text, backgroundColor: tc.surface }]}
            value={pasted}
            onChangeText={setPasted}
            placeholder="https://example.com/recipe..."
            placeholderTextColor={tc.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            textAlignVertical="top"
          />
          {kind !== 'empty' && (
            <View style={[styles.kindRow, { backgroundColor: tc.surface }]}>
              {kind === 'url' ? (
                <LinkIcon size={14} color={tc.accent} strokeWidth={2} />
              ) : (
                <FileText size={14} color={tc.accent} strokeWidth={2} />
              )}
              <Text style={[styles.kindText, { color: tc.textSecondary }]}>
                {kind === 'url' ? t('kitchen_detected_url') : t('kitchen_detected_text')}
              </Text>
            </View>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: tc.accent },
              (kind === 'empty' || busy) && { opacity: 0.45 },
              pressed && kind !== 'empty' && !busy && { opacity: 0.82 },
            ]}
            disabled={kind === 'empty' || busy}
            onPress={onParse}
          >
            {busy && <ActivityIndicator color={tc.background} />}
            <Text style={[styles.primaryButtonText, { color: tc.background }]}>
              {busy ? t('Parsing...') : t('Parse recipe')}
            </Text>
          </Pressable>
          {error && (
            <Text style={[styles.errorText, { color: tc.danger ?? tc.accent }]}>{error}</Text>
          )}
        </View>

        {draft && (
          <View style={[styles.card, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: tc.text }]}>{t('Review draft')}</Text>
            <TextInput
              style={[styles.input, { color: tc.text, backgroundColor: tc.surface }]}
              value={draft.title}
              onChangeText={(value) => updateDraftField('title', value)}
              placeholder={t('Title')}
              placeholderTextColor={tc.textTertiary}
            />
            {draft.sourceUrl && (
              <Text style={[styles.sourceLine, { color: tc.textTertiary }]} numberOfLines={1}>
                {draft.sourceUrl}
              </Text>
            )}
            <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>
              {t('Ingredients')}
            </Text>
            <TextInput
              style={[styles.textarea, { color: tc.text, backgroundColor: tc.surface }]}
              value={draft.ingredients.join('\n')}
              onChangeText={(value) => updateDraftField('ingredients', value.split('\n'))}
              multiline
              textAlignVertical="top"
            />
            <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>
              {t('Instructions')}
            </Text>
            <TextInput
              style={[styles.textarea, { color: tc.text, backgroundColor: tc.surface }]}
              value={draft.steps.join('\n')}
              onChangeText={(value) => updateDraftField('steps', value.split('\n'))}
              multiline
              textAlignVertical="top"
            />
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: tc.accent },
                pressed && { opacity: 0.82 },
              ]}
              onPress={onSave}
            >
              <Text style={[styles.primaryButtonText, { color: tc.background }]}>
                {t('Save Recipe')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: JAKARTA_FONTS.bold, fontSize: 17 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  card: { borderRadius: 18, borderWidth: 1, padding: 20, gap: 12 },
  iconWrap: { alignSelf: 'flex-start', width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 18 },
  cardBody: { fontFamily: JAKARTA_FONTS.medium, fontSize: 14, lineHeight: 20 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: JAKARTA_FONTS.regular, fontSize: 15 },
  textarea: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 140, fontFamily: JAKARTA_FONTS.regular, fontSize: 14, lineHeight: 20 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14 },
  primaryButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start' },
  kindText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  errorText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  fieldLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  sourceLine: { fontFamily: JAKARTA_FONTS.regular, fontSize: 11 },
});
