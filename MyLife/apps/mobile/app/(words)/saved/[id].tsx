import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, colors, spacing, glass } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import {
  getSavedWord,
  updateSavedWord,
  unsaveWord,
  getWordLists,
  createWordList,
  type SavedWord,
  type WordList,
} from '@mylife/words';

const WORDS_ACCENT = colors.modules.words;

function computeMastery(
  lookedUpCount: number,
  lastLookedUpAt: string,
): { level: 'new' | 'learning' | 'familiar'; color: string; label: string } {
  const daysSince = Math.floor(
    (Date.now() - new Date(lastLookedUpAt).getTime()) / 86400000,
  );
  if (lookedUpCount <= 1)
    return { level: 'new', color: colors.danger, label: 'New' };
  if (lookedUpCount <= 5 || daysSince > 30)
    return { level: 'learning', color: colors.warning, label: 'Learning' };
  return { level: 'familiar', color: colors.success, label: 'Familiar' };
}

function formatDaysAgo(isoDate: string): string {
  const days = Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / 86400000,
  );
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SavedWordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();

  const [word, setWord] = useState<SavedWord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [showListModal, setShowListModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [lists, setLists] = useState<WordList[]>([]);
  const [newListName, setNewListName] = useState('');

  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (!id) return;
    try {
      setLoading(true);
      const result = getSavedWord(db, id);
      setWord(result);
      if (result) {
        setNotes(result.notes ?? '');
      }
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const refreshLists = useCallback(() => {
    setLists(getWordLists(db));
  }, [db]);

  useEffect(() => {
    refreshLists();
  }, [refreshLists]);

  const mastery = useMemo(() => {
    if (!word) return null;
    return computeMastery(word.lookedUpCount, word.lastLookedUpAt);
  }, [word]);

  const handleToggleFavorite = useCallback(() => {
    if (!word) return;
    updateSavedWord(db, word.id, { isFavorite: !word.isFavorite });
    refresh();
  }, [db, word, refresh]);

  const handleNotesBlur = useCallback(() => {
    if (!word) return;
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => {
      updateSavedWord(db, word.id, { notes: notes || null });
    }, 300);
  }, [db, word, notes]);

  const handleDelete = useCallback(() => {
    if (!word) return;
    Alert.alert(
      'Remove Word',
      `Remove "${word.word}" from your saved words?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            unsaveWord(db, word.id);
            router.back();
          },
        },
      ],
    );
  }, [db, word, router]);

  const handleAssignList = useCallback(
    (listId: string | null) => {
      if (!word) return;
      updateSavedWord(db, word.id, { listId });
      setShowListModal(false);
      refresh();
    },
    [db, word, refresh],
  );

  const handleCreateList = useCallback(() => {
    const name = newListName.trim();
    if (!name) return;
    const newList = createWordList(db, uuid(), { name });
    setNewListName('');
    refreshLists();
    handleAssignList(newList.id);
  }, [db, newListName, refreshLists, handleAssignList]);

  const currentList = useMemo(
    () => (word?.listId ? lists.find((l) => l.id === word.listId) : null),
    [word?.listId, lists],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text variant="body" color={colors.textSecondary}>
          Loading...
        </Text>
      </View>
    );
  }

  if (!word) {
    return (
      <View style={styles.centered}>
        <Text variant="body" color={colors.textSecondary}>
          Word not found
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Word Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text variant="heading" style={styles.wordTitle}>
              {word.word}
            </Text>
            {word.pronunciationText ? (
              <Text variant="body" color={colors.textSecondary}>
                {word.pronunciationText}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <Text variant="caption" color={colors.textSecondary}>
                {word.languageName}
              </Text>
              <View style={styles.langBadge}>
                <Text variant="caption" color={colors.textSecondary}>
                  {word.languageCode.toUpperCase()}
                </Text>
              </View>
              {word.partOfSpeech ? (
                <View style={styles.posPill}>
                  <Text variant="caption" color={WORDS_ACCENT}>
                    {word.partOfSpeech}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={handleToggleFavorite}
              style={styles.headerIconBtn}
              hitSlop={8}
            >
              <Text style={{ fontSize: 24 }}>
                {word.isFavorite ? '\u2764\uFE0F' : '\u2661'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowMoreMenu(!showMoreMenu)}
              style={styles.headerIconBtn}
              hitSlop={8}
            >
              <Text style={{ fontSize: 20, color: colors.textSecondary }}>
                {'\u22EF'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* More Menu */}
        {showMoreMenu ? (
          <View style={[styles.moreMenu, glass.card]}>
            <Pressable
              style={styles.moreMenuItem}
              onPress={() => {
                setShowMoreMenu(false);
                setShowListModal(true);
              }}
            >
              <Text variant="body">Move to List</Text>
            </Pressable>
            <Pressable
              style={styles.moreMenuItem}
              onPress={() => {
                setShowMoreMenu(false);
                handleDelete();
              }}
            >
              <Text variant="body" color={colors.danger}>
                Delete
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Definition Card */}
        {word.definitionSummary ? (
          <View style={[styles.card, glass.card]}>
            <Text variant="body">{word.definitionSummary}</Text>
            {word.lookupData ? (
              <Pressable
                onPress={() =>
                  router.push(
                    `/(words)/word/${encodeURIComponent(`${word.word}::${word.languageCode}`)}` as never,
                  )
                }
                style={styles.linkButton}
              >
                <Text variant="caption" color={WORDS_ACCENT}>
                  View Full Entry
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Auto-Mastery Indicator */}
        {mastery ? (
          <View style={[styles.card, glass.card]}>
            <Text variant="label" color={colors.textSecondary}>
              Mastery
            </Text>
            <View style={styles.masteryRow}>
              <View
                style={[
                  styles.masteryCircle,
                  { backgroundColor: mastery.color },
                ]}
              />
              <Text variant="body" style={{ fontWeight: '600' }}>
                {mastery.label}
              </Text>
            </View>
            <Text variant="caption" color={colors.textSecondary}>
              Looked up {word.lookedUpCount} time
              {word.lookedUpCount === 1 ? '' : 's'}, last{' '}
              {formatDaysAgo(word.lastLookedUpAt)}
            </Text>
          </View>
        ) : null}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Text variant="caption" color={colors.textSecondary}>
            Looked up {word.lookedUpCount} time
            {word.lookedUpCount === 1 ? '' : 's'}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            Last: {formatDaysAgo(word.lastLookedUpAt)}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            Saved: {formatDate(word.createdAt)}
          </Text>
        </View>

        {/* Notes Section */}
        <View style={[styles.card, glass.card]}>
          <View style={styles.sectionHeader}>
            <Text variant="label" color={colors.textSecondary}>
              Notes
            </Text>
            <Text style={{ fontSize: 14 }}>{'\u270F\uFE0F'}</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            onBlur={handleNotesBlur}
            placeholder="Add notes about this word..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Word List Assignment */}
        <View style={[styles.card, glass.card]}>
          <Text variant="label" color={colors.textSecondary}>
            List
          </Text>
          <Pressable
            style={styles.listPickerButton}
            onPress={() => setShowListModal(true)}
          >
            {currentList ? (
              <View style={styles.listPill}>
                <Text variant="caption">{currentList.name}</Text>
              </View>
            ) : (
              <Text variant="caption" color={colors.textTertiary}>
                No list
              </Text>
            )}
            <Text variant="caption" color={colors.textSecondary}>
              {'\u203A'}
            </Text>
          </Pressable>
        </View>

        {/* Flash Status */}
        <View style={[styles.card, glass.card]}>
          <View style={styles.flashRow}>
            <Text style={{ fontSize: 14 }}>{'\u26A1'}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Flash module coming soon
            </Text>
          </View>
        </View>

        {/* Delete Button */}
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text variant="label" color={colors.danger}>
            Remove from Saved
          </Text>
        </Pressable>
      </ScrollView>

      {/* List Assignment Modal */}
      <Modal
        visible={showListModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowListModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowListModal(false)}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <Text variant="subheading" style={styles.modalTitle}>
              Assign to List
            </Text>

            <FlatList
              data={[{ id: '__none__', name: 'No list' } as WordList, ...lists]}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected =
                  item.id === '__none__'
                    ? !word.listId
                    : word.listId === item.id;
                return (
                  <Pressable
                    style={[
                      styles.listItem,
                      isSelected && styles.listItemActive,
                    ]}
                    onPress={() =>
                      handleAssignList(
                        item.id === '__none__' ? null : item.id,
                      )
                    }
                  >
                    <Text
                      variant="body"
                      color={isSelected ? WORDS_ACCENT : colors.text}
                    >
                      {item.name}
                    </Text>
                    {isSelected ? (
                      <Text variant="caption" color={WORDS_ACCENT}>
                        {'\u2713'}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              }}
              style={styles.listItems}
            />

            <View style={styles.createListRow}>
              <TextInput
                style={styles.createListInput}
                value={newListName}
                onChangeText={setNewListName}
                placeholder="Create new list..."
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="words"
              />
              <Pressable
                style={[
                  styles.createListButton,
                  !newListName.trim() && styles.createListButtonDisabled,
                ]}
                onPress={handleCreateList}
                disabled={!newListName.trim()}
              >
                <Text
                  variant="caption"
                  color={
                    newListName.trim() ? colors.background : colors.textTertiary
                  }
                >
                  Add
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  wordTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  langBadge: {
    backgroundColor: colors.glass,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  posPill: {
    borderWidth: 1,
    borderColor: `${WORDS_ACCENT}40`,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerIconBtn: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreMenu: {
    padding: spacing.xs,
    gap: 2,
  },
  moreMenuItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  linkButton: {
    marginTop: spacing.xs,
  },
  masteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  masteryCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notesInput: {
    color: colors.text,
    fontSize: 14,
    minHeight: 60,
    padding: 0,
  },
  listPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  listPill: {
    backgroundColor: colors.glassStrong,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  flashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    maxHeight: '60%',
  },
  modalTitle: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  listItems: {
    maxHeight: 300,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  listItemActive: {
    backgroundColor: `${WORDS_ACCENT}1A`,
  },
  createListRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  createListInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    fontSize: 14,
  },
  createListButton: {
    backgroundColor: WORDS_ACCENT,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  createListButtonDisabled: {
    backgroundColor: colors.surfaceElevated,
  },
});
