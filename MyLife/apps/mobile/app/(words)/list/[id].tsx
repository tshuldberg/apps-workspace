import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, colors, spacing, glass, LoadingState, ErrorState, EmptyState } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getWordList,
  getSavedWords,
  updateSavedWord,
  updateWordList,
  type SavedWord,
  type WordList,
} from '@mylife/words';

const WORDS_ACCENT = colors.modules.words;

function computeMastery(
  lookedUpCount: number,
  lastLookedUpAt: string,
): { level: 'new' | 'learning' | 'familiar'; color: string } {
  const daysSince = Math.floor(
    (Date.now() - new Date(lastLookedUpAt).getTime()) / 86400000,
  );
  if (lookedUpCount <= 1) return { level: 'new', color: colors.danger };
  if (lookedUpCount <= 5 || daysSince > 30)
    return { level: 'learning', color: colors.warning };
  return { level: 'familiar', color: colors.success };
}

export default function WordListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();

  const [list, setList] = useState<WordList | null>(null);
  const [words, setWords] = useState<SavedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const refresh = useCallback(() => {
    if (!id) return;
    try {
      setLoading(true);
      const listData = getWordList(db, id);
      setList(listData);
      if (listData) {
        const listWords = getSavedWords(db, { listId: id, limit: 500 });
        setWords(listWords);
      }
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRemoveFromList = useCallback(
    (wordId: string, wordText: string) => {
      Alert.alert(
        'Remove from List',
        `Remove "${wordText}" from this list?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              updateSavedWord(db, wordId, { listId: null });
              refresh();
            },
          },
        ],
      );
    },
    [db, refresh],
  );

  const handleOpenEdit = useCallback(() => {
    if (!list) return;
    setEditName(list.name);
    setEditDescription(list.description ?? '');
    setShowEditModal(true);
  }, [list]);

  const handleSaveEdit = useCallback(() => {
    if (!list || !editName.trim()) return;
    updateWordList(db, list.id, {
      name: editName.trim(),
      description: editDescription.trim() || null,
    });
    setShowEditModal(false);
    refresh();
  }, [db, list, editName, editDescription, refresh]);

  const favCount = useMemo(
    () => words.filter((w) => w.isFavorite).length,
    [words],
  );

  const renderItem = useCallback(
    ({ item }: { item: SavedWord }) => {
      const mastery = computeMastery(item.lookedUpCount, item.lastLookedUpAt);
      return (
        <Pressable
          style={styles.wordRow}
          onPress={() => router.push(`/saved/${item.id}` as never)}
          android_ripple={{ color: 'rgba(255,255,255,0.05)' }}
        >
          <View style={styles.wordRowMain}>
            <View style={styles.wordRowTop}>
              <Text variant="body" style={styles.wordText}>
                {item.word}
              </Text>
              <View style={styles.langBadge}>
                <Text variant="caption" color={colors.textSecondary}>
                  {item.languageCode.toUpperCase()}
                </Text>
              </View>
              {item.partOfSpeech ? (
                <View style={styles.posPill}>
                  <Text
                    variant="caption"
                    color={WORDS_ACCENT}
                    style={styles.posPillText}
                  >
                    {item.partOfSpeech}
                  </Text>
                </View>
              ) : null}
            </View>
            {item.definitionSummary ? (
              <Text
                variant="caption"
                color={colors.textSecondary}
                numberOfLines={1}
              >
                {item.definitionSummary}
              </Text>
            ) : null}
            <View style={styles.wordRowBottom}>
              <View
                style={[styles.masteryDot, { backgroundColor: mastery.color }]}
              />
              <Text
                variant="caption"
                style={{ fontSize: 16, opacity: item.isFavorite ? 1 : 0.4 }}
              >
                {item.isFavorite ? '\u2764\uFE0F' : '\u2661'}
              </Text>
              {item.flashCardId ? (
                <Text variant="caption" style={{ fontSize: 14, opacity: 0.6 }}>
                  {'\u26A1'}
                </Text>
              ) : null}
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={() => handleRemoveFromList(item.id, item.word)}
                hitSlop={8}
                style={styles.removeButton}
              >
                <Text variant="caption" color={colors.danger}>
                  {'\u2715'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      );
    },
    [router, handleRemoveFromList],
  );

  const listHeader = useMemo(() => {
    if (!list) return null;
    return (
      <View style={styles.headerContainer}>
        <View style={styles.headerTitleRow}>
          <View style={{ flex: 1 }}>
            <Text variant="subheading" style={styles.listName}>
              {list.name}
            </Text>
            {list.description ? (
              <Text variant="body" color={colors.textSecondary}>
                {list.description}
              </Text>
            ) : null}
            {list.languageCode ? (
              <View style={[styles.langBadge, { alignSelf: 'flex-start', marginTop: spacing.xs }]}>
                <Text variant="caption" color={colors.textSecondary}>
                  {list.languageCode.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={handleOpenEdit}
            style={styles.editButton}
            hitSlop={8}
          >
            <Text style={{ fontSize: 16 }}>{'\u270F\uFE0F'}</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <Text variant="caption" color={colors.textSecondary}>
            {words.length} word{words.length === 1 ? '' : 's'}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            {favCount} favorite{favCount === 1 ? '' : 's'}
          </Text>
        </View>
      </View>
    );
  }, [list, words.length, favCount, handleOpenEdit]);

  const emptyComponent = useMemo(
    () =>
      !loading ? (
        <View style={styles.emptyState}>
          <Text variant="subheading">This list is waiting</Text>
          <Text
            variant="body"
            color={colors.textSecondary}
            style={{ textAlign: 'center' }}
          >
            Save words and assign them here
          </Text>
          <Pressable onPress={() => router.push('/(words)/' as never)}>
            <Text variant="body" color={WORDS_ACCENT}>
              Go to Lookup
            </Text>
          </Pressable>
        </View>
      ) : null,
    [loading, router],
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

  if (!list) {
    return (
      <View style={styles.centered}>
        <Text variant="body" color={colors.textSecondary}>
          List not found
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={words}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyComponent}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshing={loading}
        onRefresh={refresh}
      />

      {/* Bottom action bar */}
      {words.length > 0 ? (
        <View style={[styles.bottomBar, glass.dock]}>
          <Pressable style={styles.bulkButton} disabled>
            <Text variant="label" color={colors.textTertiary}>
              Bulk Create Flashcards (coming soon)
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Edit List Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowEditModal(false)}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <Text variant="subheading" style={styles.modalTitle}>
              Edit List
            </Text>

            <View style={styles.modalForm}>
              <Text variant="label" color={colors.textSecondary}>
                Name
              </Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="List name"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="words"
              />

              <Text
                variant="label"
                color={colors.textSecondary}
                style={{ marginTop: spacing.sm }}
              >
                Description
              </Text>
              <TextInput
                style={[styles.modalInput, styles.modalInputMultiline]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Optional description"
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Pressable
                style={[
                  styles.saveButton,
                  !editName.trim() && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveEdit}
                disabled={!editName.trim()}
              >
                <Text
                  variant="label"
                  color={
                    editName.trim() ? colors.background : colors.textTertiary
                  }
                >
                  Save
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
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: spacing.xxl + 60,
  },
  headerContainer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  listName: {
    fontSize: 20,
    fontWeight: '700',
  },
  editButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  wordRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  wordRowMain: {
    flex: 1,
    gap: 3,
  },
  wordRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wordText: {
    fontWeight: '600',
  },
  langBadge: {
    backgroundColor: colors.glass,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  posPill: {
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.25)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  posPillText: {
    fontSize: 10,
  },
  wordRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  masteryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  removeButton: {
    minHeight: 44,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl * 2,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  bulkButton: {
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
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
  },
  modalTitle: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  modalForm: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    fontSize: 14,
  },
  modalInputMultiline: {
    minHeight: 60,
  },
  saveButton: {
    backgroundColor: WORDS_ACCENT,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.surfaceElevated,
  },
});
