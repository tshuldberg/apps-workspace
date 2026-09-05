import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  Dream as DreamRecord,
  DreamCreateInput,
  DreamType,
  SleepEntryRecord,
} from '@mylife/sleep';
import {
  DREAM_EMOTION_OPTIONS,
  DREAM_THEME_TAXONOMY,
  formatDurationLabel,
  formatSleepEntryDateLabel,
  formatSleepTimeLabel,
  findRecurringDreamCandidates,
  getDreamExcerpt,
  getDreamPeopleSuggestions,
  getRecurringDreamGroupId,
  getDreamTypeMeta,
  getSleepWakeFeelingMeta,
  renderSleepQualityStars,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  SLEEP_ACCENT,
  SLEEP_DREAM_TYPE_TONES,
} from './_ui';

const DREAM_TYPES: DreamType[] = [
  'normal',
  'vivid',
  'nightmare',
  'lucid',
  'recurring',
];

function todayDateValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function appendUniqueValue(values: string[], nextValue: string): string[] {
  const trimmed = nextValue.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return values;
  }
  if (
    values.some((value) => value.toLocaleLowerCase() === trimmed.toLocaleLowerCase())
  ) {
    return values;
  }
  return [...values, trimmed];
}

function removeValue(values: string[], target: string): string[] {
  return values.filter((value) => value !== target);
}

function buildEntryLabel(entry: SleepEntryRecord): string {
  return `${formatSleepEntryDateLabel(entry.date)} • ${formatDurationLabel(entry.duration_minutes)}`;
}

function buildEntrySummary(entry: SleepEntryRecord): string {
  return `${formatSleepTimeLabel(entry.bedtime)} to ${formatSleepTimeLabel(entry.wake_time)} • ${renderSleepQualityStars(entry.quality_rating)} • ${getSleepWakeFeelingMeta(entry.wake_feeling).emoji} ${getSleepWakeFeelingMeta(entry.wake_feeling).label}`;
}

interface SleepDreamFormProps {
  mode: 'create' | 'edit';
  dream?: DreamRecord | null;
  entryOptions: SleepEntryRecord[];
  archiveDreams: DreamRecord[];
  initialEntryId?: string | null;
  saveLabel: string;
  onSubmit: (input: DreamCreateInput) => Promise<void> | void;
  onClose: () => void;
}

export function SleepDreamForm({
  mode,
  dream,
  entryOptions,
  archiveDreams,
  initialEntryId,
  saveLabel,
  onSubmit,
  onClose,
}: SleepDreamFormProps) {
  const [contentMd, setContentMd] = useState(dream?.content_md ?? '');
  const [type, setType] = useState<DreamType>(dream?.type ?? 'normal');
  const [themes, setThemes] = useState<string[]>(dream?.themes ?? []);
  const [themeInput, setThemeInput] = useState('');
  const [people, setPeople] = useState<string[]>(dream?.people ?? []);
  const [personInput, setPersonInput] = useState('');
  const [emotions, setEmotions] = useState<string[]>(dream?.emotions ?? []);
  const [isLucid, setIsLucid] = useState(dream?.is_lucid ?? false);
  const [isRecurring, setIsRecurring] = useState(dream?.is_recurring ?? false);
  const [recurringGroupId, setRecurringGroupId] = useState<string | null>(
    dream?.recurring_group_id ?? (dream?.is_recurring ? dream.id : null),
  );
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(
    dream?.sleep_entry_id ?? initialEntryId ?? entryOptions[0]?.id ?? null,
  );
  const [dateValue, setDateValue] = useState(
    dream?.date ?? todayDateValue(),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedEntry = useMemo(
    () => entryOptions.find((entry) => entry.id === selectedEntryId) ?? null,
    [entryOptions, selectedEntryId],
  );

  const peopleSuggestions = useMemo(() => {
    return getDreamPeopleSuggestions(archiveDreams, 8).filter(
      (value) =>
        !people.some(
          (selected) =>
            selected.toLocaleLowerCase() === value.toLocaleLowerCase(),
        ),
    );
  }, [archiveDreams, people]);

  const recurringCandidates = useMemo(() => {
    return findRecurringDreamCandidates(
      {
        content_md: contentMd,
        themes,
      },
      archiveDreams.filter((candidate) => candidate.id !== dream?.id),
      4,
    );
  }, [archiveDreams, contentMd, dream?.id, themes]);

  useEffect(() => {
    if (!isRecurring) {
      setRecurringGroupId(null);
      return;
    }

    const validGroupIds = recurringCandidates
      .map((candidate) => getRecurringDreamGroupId(candidate))
      .filter((value): value is string => Boolean(value));

    if (recurringGroupId && validGroupIds.includes(recurringGroupId)) {
      return;
    }

    if (
      dream?.recurring_group_id &&
      recurringGroupId === dream.recurring_group_id
    ) {
      return;
    }

    if (dream?.id && recurringGroupId === dream.id) {
      return;
    }

    setRecurringGroupId(validGroupIds[0] ?? null);
  }, [dream?.id, isRecurring, recurringCandidates, recurringGroupId]);

  function selectEntry(nextEntryId: string | null): void {
    setSelectedEntryId(nextEntryId);
    const nextEntry = entryOptions.find((entry) => entry.id === nextEntryId);
    if (nextEntry) {
      setDateValue(nextEntry.date);
    }
  }

  function handleThemeAdd(nextTheme?: string): void {
    const theme = nextTheme ?? themeInput;
    setThemes((current) => appendUniqueValue(current, theme));
    setThemeInput('');
  }

  function handlePersonAdd(nextPerson?: string): void {
    const person = nextPerson ?? personInput;
    setPeople((current) => appendUniqueValue(current, person));
    setPersonInput('');
  }

  async function handleSave(): Promise<void> {
    const trimmedContent = contentMd.trim();
    if (!trimmedContent) {
      setSaveError('Write the dream before saving it.');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      await onSubmit({
        sleep_entry_id: selectedEntryId ?? undefined,
        date: selectedEntry?.date ?? dateValue,
        content_md: trimmedContent,
        type,
        themes,
        people,
        emotions,
        is_lucid: isLucid,
        is_recurring: isRecurring,
        recurring_group_id: isRecurring ? recurringGroupId ?? undefined : undefined,
      });
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Could not save this dream.',
      );
      setIsSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <Pressable onPress={onClose} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Close</Text>
        </Pressable>
        <Text style={styles.stepBadge}>
          {mode === 'edit' ? 'Edit Dream' : 'Fast Dream Log'}
        </Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>
          {mode === 'edit' ? 'Dream Detail' : 'Morning Dream Capture'}
        </Text>
        <Text style={styles.title}>Write it before it fades.</Text>
        <Text style={styles.subtitle}>
          Start with the raw memory, then tag the type, themes, people, and emotions while the details are still close.
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Dream content</Text>
        <TextInput
          value={contentMd}
          onChangeText={setContentMd}
          placeholder="Write your dream before it fades..."
          placeholderTextColor={colors.textSecondary}
          multiline
          autoFocus={mode === 'create'}
          textAlignVertical="top"
          style={styles.dreamInput}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Dream type</Text>
        <View style={styles.chipWrap}>
          {DREAM_TYPES.map((option) => {
            const meta = getDreamTypeMeta(option);
            const selected = option === type;
            const tone = SLEEP_DREAM_TYPE_TONES[meta.tone];
            return (
              <Pressable
                key={option}
                onPress={() => {
                  setType(option);
                  if (option === 'lucid') {
                    setIsLucid(true);
                  }
                  if (option === 'recurring') {
                    setIsRecurring(true);
                  }
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selected
                      ? tone.backgroundColor
                      : surfaceTiers.low,
                    borderColor: selected ? tone.borderColor : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: selected ? tone.textColor : colors.textSecondary },
                  ]}
                >
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Themes</Text>
        {themes.length > 0 && (
          <View style={styles.selectedWrap}>
            {themes.map((theme) => (
              <Pressable
                key={theme}
                onPress={() => setThemes((current) => removeValue(current, theme))}
                style={styles.selectedTag}
              >
                <Text style={styles.selectedTagText}>{theme} ×</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={styles.inlineInputRow}>
          <TextInput
            value={themeInput}
            onChangeText={setThemeInput}
            placeholder="Add custom theme"
            placeholderTextColor={colors.textSecondary}
            style={styles.inlineInput}
            onSubmitEditing={() => handleThemeAdd()}
          />
          <Pressable onPress={() => handleThemeAdd()} style={styles.inlineButton}>
            <Text style={styles.inlineButtonText}>Add</Text>
          </Pressable>
        </View>
        <View style={styles.chipWrap}>
          {DREAM_THEME_TAXONOMY.map((theme) => {
            const selected = themes.includes(theme);
            return (
              <Pressable
                key={theme}
                onPress={() =>
                  setThemes((current) =>
                    selected
                      ? removeValue(current, theme)
                      : appendUniqueValue(current, theme),
                  )
                }
                style={[
                  styles.filterChip,
                  selected && styles.filterChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selected && styles.filterChipTextSelected,
                  ]}
                >
                  {theme}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>People</Text>
        {people.length > 0 && (
          <View style={styles.selectedWrap}>
            {people.map((person) => (
              <Pressable
                key={person}
                onPress={() => setPeople((current) => removeValue(current, person))}
                style={styles.selectedTag}
              >
                <Text style={styles.selectedTagText}>{person} ×</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={styles.inlineInputRow}>
          <TextInput
            value={personInput}
            onChangeText={setPersonInput}
            placeholder="Add person"
            placeholderTextColor={colors.textSecondary}
            style={styles.inlineInput}
            onSubmitEditing={() => handlePersonAdd()}
          />
          <Pressable onPress={() => handlePersonAdd()} style={styles.inlineButton}>
            <Text style={styles.inlineButtonText}>Add</Text>
          </Pressable>
        </View>
        {peopleSuggestions.length > 0 && (
          <View style={styles.chipWrap}>
            {peopleSuggestions.map((person) => (
              <Pressable
                key={person}
                onPress={() => handlePersonAdd(person)}
                style={styles.filterChip}
              >
                <Text style={styles.filterChipText}>{person}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Emotions</Text>
        <View style={styles.chipWrap}>
          {DREAM_EMOTION_OPTIONS.map((emotion) => {
            const selected = emotions.includes(emotion);
            return (
              <Pressable
                key={emotion}
                onPress={() =>
                  setEmotions((current) =>
                    selected
                      ? removeValue(current, emotion)
                      : appendUniqueValue(current, emotion),
                  )
                }
                style={[
                  styles.filterChip,
                  selected && styles.filterChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selected && styles.filterChipTextSelected,
                  ]}
                >
                  {emotion}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Flags</Text>
        <View style={styles.toggleGrid}>
          <Pressable
            onPress={() =>
              setIsLucid((value) => {
                const nextValue = !value;
                if (!nextValue && type === 'lucid') {
                  setType('normal');
                }
                return nextValue;
              })
            }
            style={[styles.toggleCard, isLucid && styles.toggleCardSelected]}
          >
            <Text style={styles.toggleTitle}>Lucid</Text>
            <Text style={styles.toggleBody}>
              Mark this if you knew you were dreaming while it happened.
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              setIsRecurring((value) => {
                const nextValue = !value;
                if (!nextValue && type === 'recurring') {
                  setType('normal');
                }
                return nextValue;
              })
            }
            style={[styles.toggleCard, isRecurring && styles.toggleCardSelected]}
          >
            <Text style={styles.toggleTitle}>Recurring</Text>
            <Text style={styles.toggleBody}>
              Turn this on if the setting, pattern, or plotline has come back before.
            </Text>
          </Pressable>
        </View>
      </View>

      {isRecurring && (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Recurring thread</Text>
          <Text style={styles.helperText}>
            Link this dream to an older recurring pattern or start a new thread.
          </Text>
          <View style={styles.toggleGrid}>
            <Pressable
              onPress={() => setRecurringGroupId(null)}
              style={[
                styles.toggleCard,
                !recurringGroupId && styles.toggleCardSelected,
              ]}
            >
              <Text style={styles.toggleTitle}>Start a new recurring thread</Text>
              <Text style={styles.toggleBody}>
                Use this if the pattern feels new even though you want it tracked as recurring.
              </Text>
            </Pressable>

            {recurringCandidates.map((candidate) => {
              const candidateGroupId = getRecurringDreamGroupId(candidate);
              if (!candidateGroupId) {
                return null;
              }

              const selected = recurringGroupId === candidateGroupId;
              return (
                <Pressable
                  key={candidateGroupId}
                  onPress={() => setRecurringGroupId(candidateGroupId)}
                  style={[
                    styles.toggleCard,
                    selected && styles.toggleCardSelected,
                  ]}
                >
                  <Text style={styles.toggleTitle}>
                    {formatSleepEntryDateLabel(candidate.date)} • {getDreamTypeMeta(candidate.type).label}
                  </Text>
                  <Text style={styles.toggleBody}>
                    {getDreamExcerpt(candidate.content_md, 92)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Sketch or photo</Text>
        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Attachment slot reserved</Text>
          <Text style={styles.noteBody}>
            The schema already has `sketch_photo_id`, but image capture is still waiting on the later media bridge.
          </Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Linked sleep entry</Text>
        {selectedEntry ? (
          <View style={styles.entryCard}>
            <Text style={styles.entryLabel}>{buildEntryLabel(selectedEntry)}</Text>
            <Text style={styles.entryBody}>{buildEntrySummary(selectedEntry)}</Text>
          </View>
        ) : (
          <Text style={styles.helperText}>
            No sleep entry linked. This dream will use {dateValue} as its date.
          </Text>
        )}

        <View style={styles.chipWrap}>
          <Pressable
            onPress={() => selectEntry(null)}
            style={[
              styles.filterChip,
              !selectedEntryId && styles.filterChipSelected,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                !selectedEntryId && styles.filterChipTextSelected,
              ]}
            >
              No linked night
            </Text>
          </Pressable>
          {entryOptions.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => selectEntry(entry.id)}
              style={[
                styles.filterChip,
                selectedEntryId === entry.id && styles.filterChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedEntryId === entry.id && styles.filterChipTextSelected,
                ]}
              >
                {buildEntryLabel(entry)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {saveError && <Text style={styles.errorText}>{saveError}</Text>}

      <Pressable
        onPress={() => void handleSave()}
        disabled={isSaving}
        style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
      >
        <Text style={styles.primaryButtonText}>
          {isSaving ? 'Saving…' : saveLabel}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stepBadge: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  hero: {
    gap: 10,
    padding: 22,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.24)',
  },
  eyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  panel: {
    gap: 12,
    padding: 18,
    borderRadius: 22,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  dreamInput: {
    minHeight: 220,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipSelected: {
    backgroundColor: 'rgba(167,139,250,0.16)',
    borderColor: 'rgba(167,139,250,0.36)',
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipTextSelected: {
    color: '#E9DDFF',
  },
  selectedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedTag: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.32)',
  },
  selectedTagText: {
    color: '#E9DDFF',
    fontSize: 13,
    fontWeight: '700',
  },
  inlineInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  inlineInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  inlineButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.34)',
  },
  inlineButtonText: {
    color: '#E9DDFF',
    fontSize: 14,
    fontWeight: '700',
  },
  toggleGrid: {
    gap: 10,
  },
  toggleCard: {
    gap: 6,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleCardSelected: {
    borderColor: 'rgba(167,139,250,0.36)',
    backgroundColor: 'rgba(167,139,250,0.14)',
  },
  toggleTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  toggleBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  noteCard: {
    gap: 6,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.24)',
  },
  noteTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  noteBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  entryCard: {
    gap: 6,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  entryBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLEEP_ACCENT,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#0E0E13',
    fontSize: 16,
    fontWeight: '800',
  },
});
