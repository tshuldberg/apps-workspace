import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ThumbsDown, ThumbsUp } from 'lucide-react-native';
import {
  type CloudNote,
  type FlagTargetTypeValue,
  getFlagsForTarget,
  getNotesForFlag,
  createNote,
  rateNote,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SURFACES,
} from '@mylife/bestchef';
import { GlassCard } from '@mylife/bestchef/ui';
import { EmptyState, ErrorState, LoadingState, Text, colors } from '@mylife/ui';

const NOTE_CHAR_LIMIT = 1000;

export default function CommunityNotesScreen() {
  const { targetType, targetId } = useLocalSearchParams<{
    targetType: string;
    targetId: string;
  }>();

  const [notes, setNotes] = useState<CloudNote[]>([]);
  const [flagId, setFlagId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add note state
  const [showInput, setShowInput] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Track user ratings locally
  const [userRatings, setUserRatings] = useState<Record<string, 'helpful' | 'unhelpful'>>({});

  const load = useCallback(async () => {
    if (!targetType || !targetId) return;
    setLoading(true);
    setError(null);
    try {
      // Get flags for the target to find flagId
      const flagsResult = await getFlagsForTarget(
        targetType as FlagTargetTypeValue,
        targetId,
      );
      if (!flagsResult.ok) {
        setError(flagsResult.error);
        return;
      }
      if (flagsResult.data.length === 0) {
        setNotes([]);
        return;
      }

      // Use the first flag as the primary flag
      const primaryFlagId = flagsResult.data[0].id;
      setFlagId(primaryFlagId);

      // Load notes for all flags
      const allNotes: CloudNote[] = [];
      await Promise.all(
        flagsResult.data.map(async (flag) => {
          const notesResult = await getNotesForFlag(flag.id);
          if (notesResult.ok) {
            allNotes.push(...notesResult.data);
          }
        }),
      );

      // Sort by helpful count descending
      allNotes.sort((a, b) => b.helpfulCount - a.helpfulCount);
      setNotes(allNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAddNote = async () => {
    if (!flagId || !noteBody.trim()) return;

    setSubmitting(true);
    try {
      const result = await createNote(
        flagId,
        'current-user', // Placeholder until auth is wired
        noteBody.trim(),
      );

      if (result.ok) {
        setNotes((prev) => [...prev, result.data]);
        setNoteBody('');
        setShowInput(false);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRate = async (noteId: string, rating: 'helpful' | 'unhelpful') => {
    // Optimistic update
    setUserRatings((prev) => ({ ...prev, [noteId]: rating }));

    try {
      await rateNote(noteId, 'current-user', rating);
    } catch {
      // Revert on failure
      setUserRatings((prev) => {
        const next = { ...prev };
        delete next[noteId];
        return next;
      });
    }
  };

  if (!targetType || !targetId) {
    return (
      <View style={styles.screen}>
        <ErrorState message="Missing target information" />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState rows={4} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ErrorState message={error} onRetry={() => void load()} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Community Notes</Text>
          <Text style={styles.subtitle}>
            Notes from the community providing context on this content
          </Text>
        </View>

        {/* Notes list */}
        {notes.length === 0 ? (
          <EmptyState
            icon="doc.text"
            title="No notes yet"
            message="Be the first to add context about this content"
          />
        ) : (
          <View style={styles.notesList}>
            {notes.map((note) => {
              const userRating = userRatings[note.id];
              return (
                <GlassCard key={note.id} level={2} style={styles.noteCard}>
                  <Text style={styles.noteAuthor}>
                    Contributor {note.authorId.slice(0, 8)}
                  </Text>
                  <Text style={styles.noteBody}>{note.body}</Text>
                  <View style={styles.noteActions}>
                    {/* Helpful button */}
                    <Pressable
                      style={[
                        styles.rateButton,
                        userRating === 'helpful' && styles.rateButtonActive,
                      ]}
                      onPress={() => void handleRate(note.id, 'helpful')}
                    >
                      <ThumbsUp
                        size={14}
                        color={userRating === 'helpful' ? RECIPES_ACCENT : colors.textTertiary}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          styles.rateCount,
                          userRating === 'helpful' && styles.rateCountActive,
                        ]}
                      >
                        {note.helpfulCount + (userRating === 'helpful' ? 1 : 0)}
                      </Text>
                    </Pressable>

                    {/* Unhelpful button */}
                    <Pressable
                      style={[
                        styles.rateButton,
                        userRating === 'unhelpful' && styles.rateButtonUnhelpful,
                      ]}
                      onPress={() => void handleRate(note.id, 'unhelpful')}
                    >
                      <ThumbsDown
                        size={14}
                        color={userRating === 'unhelpful' ? colors.danger : colors.textTertiary}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          styles.rateCount,
                          userRating === 'unhelpful' && styles.rateCountUnhelpful,
                        ]}
                      >
                        {note.unhelpfulCount + (userRating === 'unhelpful' ? 1 : 0)}
                      </Text>
                    </Pressable>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        )}

        {/* Add note input */}
        {showInput && (
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>ADD A NOTE</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Provide context about this content..."
              placeholderTextColor={colors.textTertiary}
              value={noteBody}
              onChangeText={setNoteBody}
              multiline
              maxLength={NOTE_CHAR_LIMIT}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.inputFooter}>
              <Text style={styles.charCount}>
                {noteBody.length}/{NOTE_CHAR_LIMIT}
              </Text>
              <View style={styles.inputActions}>
                <Pressable
                  style={styles.inputCancelButton}
                  onPress={() => {
                    setShowInput(false);
                    setNoteBody('');
                  }}
                >
                  <Text style={styles.inputCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.inputSubmitButton,
                    (!noteBody.trim() || submitting) && styles.inputSubmitDisabled,
                    pressed && styles.inputSubmitPressed,
                  ]}
                  onPress={() => void handleAddNote()}
                  disabled={!noteBody.trim() || submitting}
                >
                  <Text style={styles.inputSubmitText}>
                    {submitting ? 'Adding...' : 'Add Note'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add note CTA */}
      {!showInput && flagId != null && (
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.addNoteButton,
              pressed && styles.addNoteButtonPressed,
            ]}
            onPress={() => setShowInput(true)}
          >
            <Text style={styles.addNoteButtonText}>Add a note</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 20,
  },

  // Header
  header: {
    gap: 6,
  },
  title: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: colors.text,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Notes list
  notesList: {
    gap: 10,
  },
  noteCard: {
    gap: 10,
    backgroundColor: 'rgba(139, 207, 240, 0.06)',
  },
  noteAuthor: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.6)',
  },
  noteBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  noteActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },

  // Rate buttons
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: RECIPES_SURFACES.lift,
  },
  rateButtonActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  rateButtonUnhelpful: {
    backgroundColor: 'rgba(255, 180, 171, 0.1)',
  },
  rateCount: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: colors.textTertiary,
  },
  rateCountActive: {
    color: RECIPES_ACCENT,
  },
  rateCountUnhelpful: {
    color: colors.danger,
  },

  // Input section
  inputSection: {
    gap: 8,
  },
  inputLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: 'rgba(214, 195, 181, 0.5)',
  },
  noteInput: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: colors.text,
    minHeight: 100,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: colors.textTertiary,
  },
  inputActions: {
    flexDirection: 'row',
    gap: 8,
  },
  inputCancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  inputCancelText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  inputSubmitButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: RECIPES_ACCENT,
  },
  inputSubmitPressed: {
    opacity: 0.85,
  },
  inputSubmitDisabled: {
    opacity: 0.4,
  },
  inputSubmitText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: '#0E0E13',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 36,
    backgroundColor: RECIPES_SURFACES.base,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  addNoteButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: RECIPES_ACCENT,
  },
  addNoteButtonPressed: {
    opacity: 0.85,
  },
  addNoteButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: '#0E0E13',
  },
});
