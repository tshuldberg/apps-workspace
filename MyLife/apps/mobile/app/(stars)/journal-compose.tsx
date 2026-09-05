import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { spacing } from '@mylife/ui';
import { uuid } from '../../lib/uuid';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  captureAstrologicalContext,
  computeRetrogradeStatuses,
  createJournalEntry,
  getActiveRetrogrades,
  getBirthProfiles,
  getJournalPrompts,
  getTransitEventsByProfile,
  isValidMood,
  validateJournalContent,
  GlassCard,
  MaterialSymbol,
  MoonPhaseGlyph,
  JOURNAL_INTENTIONS,
  JOURNAL_MOODS,
  ST_ACCENT,
  ST_ACCENT_LIGHT,
  ST_CTA_GRADIENT,
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
  withAlpha,
} from '@mylife/stars';

const MAX_CHARS = 5000;
const HEADER_HEIGHT = 88;
const FOOTER_HEIGHT = 150;
const MAX_ATTACHMENTS = 6;

const MOON_PHASE_LABELS: Record<string, string> = {
  new_moon: 'New Moon',
  waxing_crescent: 'Waxing Crescent',
  first_quarter: 'First Quarter',
  waxing_gibbous: 'Waxing Gibbous',
  full_moon: 'Full Moon',
  waning_gibbous: 'Waning Gibbous',
  last_quarter: 'Last Quarter',
  waning_crescent: 'Waning Crescent',
};

const MOOD_META: Record<string, { emoji: string; label: string; tone: string }> = {
  hopeful: { emoji: '✦', label: 'Hopeful', tone: '#FFB877' },
  inspired: { emoji: '✧', label: 'Inspired', tone: '#FFD700' },
  calm: { emoji: '☁', label: 'Calm', tone: '#30D158' },
  anxious: { emoji: '⚡', label: 'Anxious', tone: '#FF9F0A' },
  frustrated: { emoji: '☄', label: 'Frustrated', tone: '#FF453A' },
  joyful: { emoji: '☼', label: 'Joyful', tone: '#FF5B9F' },
  contemplative: { emoji: '☾', label: 'Contemplative', tone: '#8B5CF6' },
  reflective: { emoji: '◐', label: 'Reflective', tone: '#C4B5FD' },
  energized: { emoji: '✺', label: 'Energized', tone: '#32D74B' },
  grateful: { emoji: '♡', label: 'Grateful', tone: '#F59EBD' },
  drained: { emoji: '·', label: 'Drained', tone: '#9F8E81' },
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatLongDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPhaseLabel(phase: string): string {
  return MOON_PHASE_LABELS[phase] ?? phase;
}

function appendBlock(current: string, next: string): string {
  const base = current.trimEnd();
  if (!base) {
    return next;
  }
  return `${base}\n\n${next}`;
}

function recommendIntention(moonPhase: string): string {
  if (moonPhase === 'new_moon') {
    return 'new moon intention';
  }
  if (moonPhase === 'full_moon') {
    return 'full moon release';
  }
  return 'gratitude';
}

function titleCasePhrase(value: string): string {
  return value
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function JournalComposeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ mood?: string; prompt?: string }>();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const retrogrades = useMemo(() => {
    const statuses = computeRetrogradeStatuses(today);
    return getActiveRetrogrades(statuses);
  }, [today]);
  const retrogradePlanets = useMemo(
    () => retrogrades.map((retrograde) => retrograde.body),
    [retrogrades],
  );
  const context = useMemo(
    () => captureAstrologicalContext(today, retrogradePlanets, true),
    [today, retrogradePlanets],
  );
  const profiles = useMemo(() => {
    try {
      return getBirthProfiles(db);
    } catch {
      return [];
    }
  }, [db]);

  const selectedProfile = profiles[0] ?? null;
  const activeTransits = useMemo(() => {
    if (!selectedProfile) {
      return [];
    }

    try {
      return getTransitEventsByProfile(db, selectedProfile.id, today, today);
    } catch {
      return [];
    }
  }, [db, selectedProfile, today]);

  const prompts = useMemo(
    () => getJournalPrompts({ ...context, transits: activeTransits }),
    [context, activeTransits],
  );

  const [title, setTitle] = useState('');
  const [content, setContent] = useState(() =>
    typeof params.prompt === 'string' && params.prompt.trim().length > 0
      ? `${params.prompt.trim()}\n\n`
      : '',
  );
  const [selectedMood, setSelectedMood] = useState<string | null>(() => {
    if (typeof params.mood !== 'string') {
      return null;
    }
    return isValidMood(params.mood) ? params.mood : null;
  });
  const [selectedIntention, setSelectedIntention] = useState<string | null>(
    recommendIntention(context.moonPhase),
  );
  const [photos, setPhotos] = useState<string[]>([]);
  const [promptsExpanded, setPromptsExpanded] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const charCount = content.length;
  const canSave = content.trim().length > 0 && charCount <= MAX_CHARS && !isSaving;
  const hasDraft = Boolean(
    title.trim() ||
      content.trim() ||
      selectedMood ||
      selectedIntention ||
      photos.length > 0,
  );

  const handleCancel = useCallback(() => {
    if (!hasDraft) {
      router.back();
      return;
    }

    Alert.alert(
      'Discard entry?',
      'You have unsaved reflections and attachments.',
      [
        { text: 'Keep writing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ],
    );
  }, [hasDraft, router]);

  const handleInsertPrompt = useCallback((prompt: string) => {
    setContent((current) => appendBlock(current, prompt));
  }, []);

  const handleToolbarInsert = useCallback((snippet: string) => {
    setContent((current) => appendBlock(current, snippet));
  }, []);

  const addPhotoUris = useCallback((uris: string[]) => {
    setPhotos((current) => {
      const next = [...current];
      for (const uri of uris) {
        if (!next.includes(uri)) {
          next.push(uri);
        }
      }
      return next.slice(0, MAX_ATTACHMENTS);
    });
  }, []);

  const handlePhotoLibrary = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library access is required to attach images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: MAX_ATTACHMENTS,
        quality: 0.8,
      });

      if (!result.canceled) {
        addPhotoUris(result.assets.map((asset) => asset.uri));
      }
    } catch {
      Alert.alert('Attachment error', 'Could not open your photo library.');
    }
  }, [addPhotoUris]);

  const handleCamera = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is required to capture a new attachment.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled) {
        addPhotoUris(result.assets.map((asset) => asset.uri));
      }
    } catch {
      Alert.alert('Camera error', 'Could not launch the camera.');
    }
  }, [addPhotoUris]);

  const handleSave = useCallback(() => {
    if (!canSave) {
      return;
    }

    const validation = validateJournalContent(content);
    if (!validation.valid) {
      Alert.alert('Cannot save entry', validation.error ?? 'Please add more detail.');
      return;
    }

    setIsSaving(true);
    try {
      createJournalEntry(db, uuid(), {
        profileId: selectedProfile?.id ?? null,
        date: today,
        title: title.trim() || null,
        content: content.trim(),
        intention: selectedIntention,
        mood: selectedMood && isValidMood(selectedMood) ? selectedMood : null,
        moonPhase: context.moonPhase,
        moonSign: context.moonSign,
        sunSign: context.sunSign,
        retrogradePlanets:
          retrogradePlanets.length > 0 ? JSON.stringify(retrogradePlanets) : null,
        tarotCardName: context.tarotCardName,
        photoUris: photos,
      });
      router.back();
    } catch {
      setIsSaving(false);
      Alert.alert('Save failed', 'Your entry could not be saved. Try again.');
    }
  }, [
    canSave,
    content,
    context,
    db,
    photos,
    retrogradePlanets,
    router,
    selectedIntention,
    selectedMood,
    selectedProfile,
    title,
    today,
  ]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        <View style={styles.backgroundOrbTop} />
        <View style={styles.backgroundOrbBottom} />

        <View style={styles.header}>
          <Pressable onPress={handleCancel} style={styles.headerEdge}>
            <Text style={styles.headerText}>Cancel</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>New Entry</Text>
            <Text style={styles.headerDate}>{formatLongDate(today)}</Text>
          </View>
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={[styles.savePill, !canSave && styles.savePillDisabled]}
          >
            <LinearGradient
              colors={[ST_CTA_GRADIENT.from, ST_CTA_GRADIENT.to]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.savePillGradient}
            >
              <Text style={styles.savePillText}>{isSaving ? 'Saving' : 'Save'}</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <GlassCard variant="high" style={styles.contextCard}>
              <View style={styles.contextTopRow}>
                <MoonPhaseGlyph phase={context.moonPhase} size={58} />
                <View style={styles.contextCopy}>
                  <Text style={styles.contextEyebrow}>Current Transit</Text>
                  <Text style={styles.contextHeadline}>
                    {formatPhaseLabel(context.moonPhase)} in {capitalize(context.moonSign)}
                  </Text>
                  <Text style={styles.contextSubline}>
                    Sun in {capitalize(context.sunSign)}
                    {selectedProfile ? ` · Personalized for ${selectedProfile.name}` : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.contextTags}>
                <View style={styles.contextChip}>
                  <MaterialSymbol name="auto_graph" size={14} color={ST_ACCENT_LIGHT} />
                  <Text style={styles.contextChipText}>Auto-tags this entry</Text>
                </View>
                {retrogrades.map((retrograde) => (
                  <View key={retrograde.body} style={styles.retroChip}>
                    <Text style={styles.retroChipText}>{capitalize(retrograde.body)} Rx</Text>
                  </View>
                ))}
              </View>
            </GlassCard>

            <View style={styles.linkRow}>
              <View style={styles.linkCopy}>
                <MaterialSymbol name="auto_graph" size={18} color={ST_ACCENT} />
                <Text style={styles.linkText}>
                  {selectedProfile
                    ? `Linked to ${selectedProfile.name}'s chart`
                    : 'General sky context'}
                </Text>
              </View>
            </View>

            <TextInput
              style={styles.titleInput}
              placeholder="What's on your mind..."
              placeholderTextColor={withAlpha(ST_TEXT_TERTIARY, 0.55)}
              value={title}
              onChangeText={setTitle}
            />

            <GlassCard style={styles.promptsCard}>
              <Pressable
                style={styles.sectionRow}
                onPress={() => setPromptsExpanded((expanded) => !expanded)}
              >
                <View>
                  <Text style={styles.sectionEyebrow}>Reflection Prompts</Text>
                  <Text style={styles.sectionTitle}>
                    Tap a prompt to drop it into your entry
                  </Text>
                </View>
                <MaterialSymbol
                  name={promptsExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                  size={22}
                  color={ST_TEXT_SECONDARY}
                />
              </Pressable>
              {promptsExpanded ? (
                <View style={styles.promptList}>
                  {prompts.map((prompt) => (
                    <Pressable
                      key={prompt}
                      style={styles.promptButton}
                      onPress={() => handleInsertPrompt(prompt)}
                    >
                      <Text style={styles.promptText}>{prompt}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </GlassCard>

            <View style={styles.editorWrap}>
              <Text style={styles.bodyLabel}>Entry Body</Text>
              <TextInput
                style={styles.bodyInput}
                placeholder="How do the stars feel tonight?"
                placeholderTextColor={withAlpha(ST_TEXT_TERTIARY, 0.4)}
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
                autoCorrect
                maxLength={MAX_CHARS}
              />
              <Text style={styles.charCount}>
                {charCount} / {MAX_CHARS}
              </Text>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionEyebrow}>Mood</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {JOURNAL_MOODS.map((mood) => {
                  const meta = MOOD_META[mood] ?? {
                    emoji: '•',
                    label: titleCasePhrase(mood),
                    tone: ST_ACCENT,
                  };
                  const selected = selectedMood === mood;
                  return (
                    <Pressable
                      key={mood}
                      onPress={() => setSelectedMood(selected ? null : mood)}
                      style={[
                        styles.choiceChip,
                        selected && { backgroundColor: withAlpha(meta.tone, 0.24) },
                      ]}
                    >
                      <Text style={styles.choiceEmoji}>{meta.emoji}</Text>
                      <Text style={[styles.choiceText, selected && { color: meta.tone }]}>
                        {meta.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionEyebrow}>Intention</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {JOURNAL_INTENTIONS.map((intention) => {
                  const selected = selectedIntention === intention;
                  return (
                    <Pressable
                      key={intention}
                      onPress={() => setSelectedIntention(selected ? null : intention)}
                      style={[
                        styles.choiceChip,
                        selected && styles.choiceChipSelected,
                      ]}
                    >
                      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                        {titleCasePhrase(intention)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.sectionBlock}>
              <View style={styles.sectionRow}>
                <View>
                  <Text style={styles.sectionEyebrow}>Photo Attachment</Text>
                  <Text style={styles.sectionTitle}>Keep a visual trace with this reflection</Text>
                </View>
              </View>

              <View style={styles.photoActions}>
                <Pressable style={styles.photoAction} onPress={handleCamera}>
                  <MaterialSymbol name="photo_camera" size={18} color={ST_ACCENT_LIGHT} />
                  <Text style={styles.photoActionText}>Camera</Text>
                </Pressable>
                <Pressable style={styles.photoAction} onPress={handlePhotoLibrary}>
                  <MaterialSymbol name="photo_library" size={18} color={ST_ACCENT_LIGHT} />
                  <Text style={styles.photoActionText}>Library</Text>
                </Pressable>
              </View>

              {photos.length > 0 ? (
                <View style={styles.photoGrid}>
                  {photos.map((uri) => (
                    <View key={uri} style={styles.photoTile}>
                      <Image source={uri} contentFit="cover" style={styles.photoImage} />
                      <Pressable
                        onPress={() =>
                          setPhotos((current) => current.filter((item) => item !== uri))
                        }
                        style={styles.photoRemove}
                      >
                        <MaterialSymbol name="close" size={14} color={ST_TEXT} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyAttachmentText}>
                  No images attached yet.
                </Text>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={handleSave} disabled={!canSave} style={styles.footerButtonShell}>
              <LinearGradient
                colors={[ST_CTA_GRADIENT.from, ST_CTA_GRADIENT.to]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.footerSaveButton, !canSave && styles.footerSaveButtonDisabled]}
              >
                <Text style={styles.footerSaveText}>{isSaving ? 'Saving Entry...' : 'Save Entry'}</Text>
              </LinearGradient>
            </Pressable>

            <View style={styles.toolbar}>
              <Pressable
                onPress={() => handleToolbarInsert('**Bold reflection**')}
                style={styles.toolbarButton}
              >
                <MaterialSymbol name="format_bold" size={20} color={ST_TEXT_SECONDARY} />
              </Pressable>
              <Pressable
                onPress={() => handleToolbarInsert('_Soft emphasis_')}
                style={styles.toolbarButton}
              >
                <MaterialSymbol name="format_italic" size={20} color={ST_TEXT_SECONDARY} />
              </Pressable>
              <Pressable
                onPress={() => handleToolbarInsert('• ')}
                style={styles.toolbarButton}
              >
                <MaterialSymbol
                  name="format_list_bulleted"
                  size={20}
                  color={ST_TEXT_SECONDARY}
                />
              </Pressable>
              <Pressable onPress={handlePhotoLibrary} style={styles.toolbarButton}>
                <MaterialSymbol name="image" size={20} color={ST_TEXT_SECONDARY} />
              </Pressable>
              <Pressable onPress={handleCamera} style={styles.toolbarButton}>
                <MaterialSymbol name="photo_camera" size={20} color={ST_TEXT_SECONDARY} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: ST_SURFACES.base,
  },
  backgroundOrbTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_ACCENT, 0.16),
  },
  backgroundOrbBottom: {
    position: 'absolute',
    bottom: 90,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_ACCENT_LIGHT, 0.08),
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    paddingTop: 22,
    paddingHorizontal: spacing.md,
    backgroundColor: withAlpha(ST_SURFACES.base, 0.92),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerEdge: {
    minWidth: 64,
  },
  headerCenter: {
    alignItems: 'center',
    gap: 2,
  },
  headerText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 15,
    color: ST_TEXT_SECONDARY,
  },
  headerTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    color: ST_TEXT,
  },
  headerDate: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    color: ST_TEXT_TERTIARY,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  savePill: {
    borderRadius: 999,
    overflow: 'hidden',
    minWidth: 88,
  },
  savePillDisabled: {
    opacity: 0.5,
  },
  savePillGradient: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'center',
  },
  savePillText: {
    fontFamily: ST_FONTS.bold,
    fontSize: 14,
    color: '#1A103D',
  },
  content: {
    paddingTop: HEADER_HEIGHT + spacing.md,
    paddingBottom: FOOTER_HEIGHT + spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  contextCard: {
    borderRadius: 22,
  },
  contextTopRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  contextCopy: {
    flex: 1,
    gap: 4,
  },
  contextEyebrow: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    color: ST_ACCENT_LIGHT,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  contextHeadline: {
    fontFamily: ST_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: ST_TEXT,
  },
  contextSubline: {
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    color: ST_TEXT_SECONDARY,
  },
  contextTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.md,
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_ACCENT, 0.14),
  },
  contextChipText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_SECONDARY,
  },
  retroChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha('#FFB877', 0.12),
  },
  retroChipText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: '#FFCC9F',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: withAlpha(ST_SURFACES.low, 0.86),
  },
  linkText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 14,
    color: ST_TEXT_SECONDARY,
  },
  titleInput: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 30,
    lineHeight: 36,
    color: ST_TEXT,
    paddingHorizontal: 2,
    paddingVertical: 6,
  },
  promptsCard: {
    borderRadius: 20,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionEyebrow: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    color: ST_TEXT_TERTIARY,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    marginTop: 4,
    fontFamily: ST_FONTS.medium,
    fontSize: 14,
    color: ST_TEXT_SECONDARY,
  },
  promptList: {
    gap: 10,
    marginTop: spacing.md,
  },
  promptButton: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: withAlpha(ST_SURFACES.high, 0.9),
  },
  promptText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT,
  },
  editorWrap: {
    minHeight: 300,
    paddingTop: spacing.sm,
  },
  bodyLabel: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    color: ST_TEXT_TERTIARY,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  bodyInput: {
    minHeight: 280,
    fontFamily: ST_FONTS.regular,
    fontSize: 18,
    lineHeight: 29,
    color: ST_TEXT,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  charCount: {
    marginTop: spacing.sm,
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_TERTIARY,
  },
  sectionBlock: {
    gap: 12,
  },
  chipRow: {
    gap: 10,
    paddingVertical: 2,
  },
  choiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_SURFACES.high, 0.86),
  },
  choiceChipSelected: {
    backgroundColor: withAlpha(ST_ACCENT, 0.18),
  },
  choiceEmoji: {
    fontSize: 13,
    color: ST_TEXT,
  },
  choiceText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    color: ST_TEXT_SECONDARY,
  },
  choiceTextSelected: {
    color: ST_ACCENT_LIGHT,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
  },
  photoAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: withAlpha(ST_SURFACES.high, 0.86),
  },
  photoActionText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    color: ST_TEXT_SECONDARY,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoTile: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: withAlpha(ST_SURFACES.high, 0.84),
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(ST_SURFACES.base, 0.78),
  },
  emptyAttachmentText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    color: ST_TEXT_TERTIARY,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: withAlpha(ST_SURFACES.base, 0.96),
    gap: 12,
  },
  footerButtonShell: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  footerSaveButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSaveButtonDisabled: {
    opacity: 0.5,
  },
  footerSaveText: {
    fontFamily: ST_FONTS.bold,
    fontSize: 15,
    color: '#1A103D',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: withAlpha(ST_SURFACES.low, 0.92),
  },
  toolbarButton: {
    padding: 10,
  },
});
