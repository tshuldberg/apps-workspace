import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  getHabits,
  getSetting,
  isSiriSupported,
  setSetting,
  GlassCard,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_FONTS,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  MaterialSymbol,
  SectionHeader,
  StatTile,
  withAlpha,
} from '@mylife/habits';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

type ShortcutAction = 'complete_habit' | 'start_focus' | 'log_craving' | 'show_streak';

type SavedShortcut = {
  id: string;
  title: string;
  phrase: string;
  action: ShortcutAction;
  habitId: string | null;
  enabled: boolean;
  createdAt: string;
};

const SHORTCUTS_KEY = 'habits_siri_shortcuts';

const FEATURED_SHORTCUTS: Array<{
  title: string;
  phrase: string;
  action: ShortcutAction;
  habitMatcher?: (name: string) => boolean;
  summary: string;
}> = [
  {
    title: 'Log workout',
    phrase: 'Log my workout',
    action: 'complete_habit',
    habitMatcher: (name) => /walk|run|lift|stretch|workout/i.test(name),
    summary: 'Mark a movement habit complete without opening the app.',
  },
  {
    title: 'Start focus timer',
    phrase: 'Start focus timer',
    action: 'start_focus',
    summary: 'Jump straight into a focus session from Siri.',
  },
  {
    title: 'Log craving',
    phrase: 'Log craving',
    action: 'log_craving',
    summary: 'Capture triggers in the moment with your voice.',
  },
  {
    title: 'Show my streak',
    phrase: 'Show my streak',
    action: 'show_streak',
    summary: 'Ask Siri how your habit momentum is doing today.',
  },
];

const ACTION_LABELS: Record<ShortcutAction, string> = {
  complete_habit: 'Complete a habit',
  start_focus: 'Start focus timer',
  log_craving: 'Open craving log',
  show_streak: 'Show streak summary',
};

function readShortcuts(raw: string | null | undefined): SavedShortcut[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedShortcut[];
  } catch {
    return [];
  }
}

export default function SiriShortcutsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [builderVisible, setBuilderVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [phrase, setPhrase] = useState('');
  const [action, setAction] = useState<ShortcutAction>('complete_habit');
  const [habitId, setHabitId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  const habits = useMemo(
    () => getHabits(db, { isArchived: false }),
    [db, tick],
  );

  const habitsById = useMemo(
    () => new Map(habits.map((habit) => [habit.id, habit])),
    [habits],
  );

  const shortcuts = useMemo(
    () => readShortcuts(getSetting(db, SHORTCUTS_KEY)),
    [db, tick],
  );

  const platformVersion = useMemo(() => {
    if (typeof Platform.Version === 'number') return Platform.Version;
    const parsed = Number.parseFloat(String(Platform.Version));
    return Number.isFinite(parsed) ? parsed : undefined;
  }, []);

  const supported = isSiriSupported(Platform.OS, platformVersion);

  const enabledCount = shortcuts.filter((shortcut) => shortcut.enabled).length;
  const completionCount = shortcuts.filter((shortcut) => shortcut.action === 'complete_habit').length;

  const saveShortcuts = useCallback(
    (nextShortcuts: SavedShortcut[]) => {
      setSetting(db, SHORTCUTS_KEY, JSON.stringify(nextShortcuts));
      refresh();
    },
    [db, refresh],
  );

  const openBuilder = useCallback(() => {
    setTitle('');
    setPhrase('');
    setAction('complete_habit');
    setHabitId(habits[0]?.id ?? null);
    setBuilderVisible(true);
  }, [habits]);

  const closeBuilder = useCallback(() => {
    setBuilderVisible(false);
  }, []);

  const handleInstallFeatured = useCallback(
    (featured: (typeof FEATURED_SHORTCUTS)[number]) => {
      const matchedHabit = featured.habitMatcher
        ? habits.find((habit) => featured.habitMatcher?.(habit.name))
        : null;

      const nextShortcut: SavedShortcut = {
        id: uuid(),
        title: featured.title,
        phrase: featured.phrase,
        action: featured.action,
        habitId: matchedHabit?.id ?? null,
        enabled: true,
        createdAt: new Date().toISOString(),
      };

      saveShortcuts([nextShortcut, ...shortcuts]);
      Alert.alert(
        'Shortcut Saved',
        'The phrase is now saved in MyHabits. Finish the Siri side in iOS Siri & Search.',
      );
    },
    [habits, saveShortcuts, shortcuts],
  );

  const handleSaveShortcut = useCallback(() => {
    if (!title.trim() || !phrase.trim()) {
      Alert.alert('Missing Info', 'Add a title and the phrase you want to speak.');
      return;
    }
    if (action === 'complete_habit' && !habitId) {
      Alert.alert('Choose a Habit', 'Habit shortcuts need a habit target.');
      return;
    }

    const nextShortcut: SavedShortcut = {
      id: uuid(),
      title: title.trim(),
      phrase: phrase.trim(),
      action,
      habitId: action === 'complete_habit' ? habitId : null,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    saveShortcuts([nextShortcut, ...shortcuts]);
    closeBuilder();
  }, [action, closeBuilder, habitId, phrase, saveShortcuts, shortcuts, title]);

  const handleToggleShortcut = useCallback(
    (id: string, enabled: boolean) => {
      saveShortcuts(
        shortcuts.map((shortcut) =>
          shortcut.id === id ? { ...shortcut, enabled } : shortcut,
        ),
      );
    },
    [saveShortcuts, shortcuts],
  );

  const handleDeleteShortcut = useCallback(
    (shortcut: SavedShortcut) => {
      Alert.alert('Delete Shortcut', 'Remove this saved voice command?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            saveShortcuts(shortcuts.filter((item) => item.id !== shortcut.id));
          },
        },
      ]);
    },
    [saveShortcuts, shortcuts],
  );

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Voice commands</Text>
            <Text style={styles.title}>Siri Shortcuts</Text>
            <Text style={styles.subtitle}>
              Save phrases for the moments where speaking is faster than tapping.
            </Text>
          </View>
          <View style={styles.heroGlyph}>
            <MaterialSymbol name="mic" size={34} color={HB_ACCENT_LIGHT} filled />
          </View>
        </View>

        <GlassCard level={4} style={styles.heroCard} contentStyle={styles.heroCardContent}>
          <View style={styles.connectionRow}>
            <View style={styles.connectionCopy}>
              <Text style={styles.connectionLabel}>Platform Support</Text>
              <Text style={styles.connectionValue}>
                {supported ? 'Ready for Siri' : 'Unavailable'}
              </Text>
              <Text style={styles.connectionBody}>
                {supported
                  ? 'This build can save phrase templates and hand you off to Siri & Search for final setup.'
                  : 'Siri Shortcuts only work on iOS 16 and later.'}
              </Text>
            </View>
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                void Linking.openSettings();
              }}
            >
              <Text style={styles.primaryButtonText}>Open Settings</Text>
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            <StatTile
              label="Saved"
              value={shortcuts.length}
              delta="Total voice commands"
              icon="mic"
              color={HB_ACCENT_LIGHT}
            />
            <StatTile
              label="Enabled"
              value={enabledCount}
              delta="Ready to use"
              icon="bolt"
              color="#30D158"
            />
            <StatTile
              label="Habit"
              value={completionCount}
              delta="Completion shortcuts"
              icon="check_circle"
              color="#8BCFF0"
            />
          </View>
        </GlassCard>

        <GlassCard level={2} contentStyle={styles.sectionCard}>
          <SectionHeader title="Featured Shortcuts" />
          <View style={styles.featuredList}>
            {FEATURED_SHORTCUTS.map((featured) => (
              <GlassCard
                key={featured.title}
                level={1}
                style={styles.featuredCard}
                contentStyle={styles.featuredCardContent}
              >
                <View style={styles.featuredTopRow}>
                  <View style={styles.featuredPhraseBadge}>
                    <Text style={styles.featuredPhraseLabel}>“{featured.phrase}”</Text>
                  </View>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => handleInstallFeatured(featured)}
                  >
                    <Text style={styles.secondaryButtonText}>Save</Text>
                  </Pressable>
                </View>
                <Text style={styles.featuredTitle}>{featured.title}</Text>
                <Text style={styles.featuredSummary}>{featured.summary}</Text>
              </GlassCard>
            ))}
          </View>
        </GlassCard>

        <GlassCard level={2} contentStyle={styles.sectionCard}>
          <SectionHeader
            title="Your Shortcuts"
            action={{ label: 'Create', onPress: openBuilder }}
          />
          {shortcuts.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialSymbol name="mic" size={24} color={HB_ACCENT_LIGHT} filled />
              <Text style={styles.emptyTitle}>No personal phrases yet</Text>
              <Text style={styles.emptyBody}>
                Build a shortcut for one habit, your focus timer, or a quick craving log and keep it ready on the lock screen.
              </Text>
            </View>
          ) : (
            <View style={styles.shortcutList}>
              {shortcuts.map((shortcut) => {
                const habit = shortcut.habitId ? habitsById.get(shortcut.habitId) : null;
                return (
                  <GlassCard
                    key={shortcut.id}
                    level={1}
                    style={styles.shortcutCard}
                    contentStyle={styles.shortcutCardContent}
                  >
                    <View style={styles.shortcutTopRow}>
                      <View style={styles.shortcutCopy}>
                        <Text style={styles.shortcutTitle}>{shortcut.title}</Text>
                        <Text style={styles.shortcutPhrase}>“{shortcut.phrase}”</Text>
                      </View>
                      <Switch
                        trackColor={{
                          false: withAlpha(HB_TEXT_TERTIARY, 0.28),
                          true: withAlpha(HB_ACCENT, 0.6),
                        }}
                        thumbColor={shortcut.enabled ? HB_ACCENT_LIGHT : HB_TEXT}
                        value={shortcut.enabled}
                        onValueChange={(enabled) => handleToggleShortcut(shortcut.id, enabled)}
                      />
                    </View>
                    <Text style={styles.shortcutMeta}>
                      {ACTION_LABELS[shortcut.action]}
                      {habit ? ` • ${habit.icon ? `${habit.icon} ` : ''}${habit.name}` : ''}
                    </Text>
                    <View style={styles.shortcutActions}>
                      <Pressable
                        style={styles.tertiaryButton}
                        onPress={() => handleDeleteShortcut(shortcut)}
                      >
                        <Text style={styles.tertiaryButtonText}>Delete</Text>
                      </Pressable>
                    </View>
                  </GlassCard>
                );
              })}
            </View>
          )}
        </GlassCard>

        <GlassCard level={2} contentStyle={styles.sectionCard}>
          <SectionHeader title="Setup Instructions" />
          <View style={styles.instructionsList}>
            {[
              'Open iOS Settings, then Siri & Search.',
              'Choose the phrase you want to add to Siri.',
              'Keep your most-used shortcuts enabled for quicker lock-screen suggestions.',
            ].map((line) => (
              <View key={line} style={styles.instructionRow}>
                <View style={styles.instructionDot} />
                <Text style={styles.instructionText}>{line}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      </ScrollView>

      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={builderVisible}
        onRequestClose={closeBuilder}
      >
        <View style={styles.builderScreen}>
          <View style={styles.builderHeader}>
            <Pressable onPress={closeBuilder}>
              <Text style={styles.builderDismiss}>Cancel</Text>
            </Pressable>
            <Text style={styles.builderTitle}>Create Shortcut</Text>
            <Pressable onPress={handleSaveShortcut}>
              <Text style={styles.builderSave}>Save</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.builderContent}>
            <GlassCard level={2} contentStyle={styles.sectionCard}>
              <SectionHeader title="Shortcut Details" />
              <TextInput
                placeholder="Shortcut title"
                placeholderTextColor={HB_TEXT_TERTIARY}
                style={styles.input}
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                placeholder="Phrase to speak"
                placeholderTextColor={HB_TEXT_TERTIARY}
                style={styles.input}
                value={phrase}
                onChangeText={setPhrase}
              />
            </GlassCard>

            <GlassCard level={2} contentStyle={styles.sectionCard}>
              <SectionHeader title="Action" />
              <View style={styles.actionList}>
                {(Object.keys(ACTION_LABELS) as ShortcutAction[]).map((option) => {
                  const selected = option === action;
                  return (
                    <Pressable
                      key={option}
                      style={[
                        styles.actionCard,
                        selected ? styles.actionCardSelected : null,
                      ]}
                      onPress={() => setAction(option)}
                    >
                      <Text style={styles.actionTitle}>{ACTION_LABELS[option]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>

            {action === 'complete_habit' ? (
              <GlassCard level={2} contentStyle={styles.sectionCard}>
                <SectionHeader title="Pick a Habit" />
                <View style={styles.actionList}>
                  {habits.map((habit) => {
                    const selected = habitId === habit.id;
                    return (
                      <Pressable
                        key={habit.id}
                        style={[
                          styles.habitCard,
                          selected ? styles.actionCardSelected : null,
                        ]}
                        onPress={() => setHabitId(habit.id)}
                      >
                        <Text style={styles.actionTitle}>
                          {habit.icon ? `${habit.icon} ` : ''}
                          {habit.name}
                        </Text>
                        <Text style={styles.habitCardMeta}>
                          {habit.frequency} • {habit.timeOfDay}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </GlassCard>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 44,
    gap: 18,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  title: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
  },
  subtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  heroGlyph: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: withAlpha(HB_ACCENT, 0.18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: withAlpha(HB_ACCENT, 0.08),
  },
  heroCardContent: {
    gap: 18,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  connectionCopy: {
    flex: 1,
    gap: 6,
  },
  connectionLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  connectionValue: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
    color: HB_TEXT,
  },
  connectionBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: HB_ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
  },
  statsRow: {
    gap: 12,
  },
  sectionCard: {
    gap: 16,
  },
  featuredList: {
    gap: 12,
  },
  featuredCard: {
    backgroundColor: withAlpha(HB_ACCENT, 0.04),
  },
  featuredCardContent: {
    gap: 12,
  },
  featuredTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  featuredPhraseBadge: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_ACCENT, 0.18),
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  featuredPhraseLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: HB_TEXT,
  },
  secondaryButton: {
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT,
  },
  featuredTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 17,
    lineHeight: 22,
    color: HB_TEXT,
  },
  featuredSummary: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  emptyTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  emptyBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    textAlign: 'center',
  },
  shortcutList: {
    gap: 12,
  },
  shortcutCard: {
    backgroundColor: withAlpha(HB_ACCENT, 0.04),
  },
  shortcutCardContent: {
    gap: 12,
  },
  shortcutTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  shortcutCopy: {
    flex: 1,
    gap: 4,
  },
  shortcutTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: HB_TEXT,
  },
  shortcutPhrase: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_ACCENT_LIGHT,
  },
  shortcutMeta: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  shortcutActions: {
    flexDirection: 'row',
    gap: 10,
  },
  tertiaryButton: {
    borderRadius: 999,
    backgroundColor: withAlpha('#FF453A', 0.18),
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tertiaryButtonText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: '#FFB4AB',
  },
  instructionsList: {
    gap: 12,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  instructionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: HB_ACCENT_LIGHT,
    marginTop: 6,
  },
  instructionText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    flex: 1,
  },
  builderScreen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  builderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  builderDismiss: {
    fontFamily: HB_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT_SECONDARY,
  },
  builderTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  builderSave: {
    fontFamily: HB_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: HB_ACCENT_LIGHT,
  },
  builderContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  input: {
    borderRadius: 16,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: HB_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT,
  },
  actionList: {
    gap: 10,
  },
  actionCard: {
    borderRadius: 16,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  actionCardSelected: {
    backgroundColor: withAlpha(HB_ACCENT, 0.26),
  },
  actionTitle: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT,
  },
  habitCard: {
    borderRadius: 16,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  habitCardMeta: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
});
