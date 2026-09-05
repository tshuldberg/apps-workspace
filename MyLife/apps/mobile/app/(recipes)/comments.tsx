import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Camera, ThumbsUp } from 'lucide-react-native';
import {
  type BestChefResult,
  type CloudComment,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from '@mylife/bestchef';
import { GlassCard } from '@mylife/bestchef/ui';
import { EmptyState, ErrorState, LoadingState, Text, colors } from '@mylife/ui';

const MAX_BODY_LENGTH = 2000;
const GOLD = '#FFD700';

type CommentTypeValue = 'comment' | 'tried_this' | 'chefs_tip';

// ── Stubs (cloud functions not yet implemented) ──────────────────────

async function getCommentsForSubmission(
  _submissionId: string,
): Promise<BestChefResult<CloudComment[]>> {
  return { ok: true, data: [] };
}

async function addComment(
  _submissionId: string,
  _body: string,
  _commentType: CommentTypeValue,
  _photoUrl: string | null,
): Promise<BestChefResult<CloudComment>> {
  return {
    ok: true,
    data: {
      id: crypto.randomUUID(),
      submissionId: _submissionId,
      profileId: 'me',
      socialActivityId: null,
      parentId: null,
      body: _body,
      commentType: _commentType,
      photoUrl: _photoUrl,
      isPinned: false,
      helpfulCount: 0,
      moderationStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
      editedAt: null,
      deletedAt: null,
    },
  };
}

async function markHelpful(
  _commentId: string,
): Promise<BestChefResult<void>> {
  return { ok: true, data: undefined };
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function sortComments(list: CloudComment[]): CloudComment[] {
  const pinned = list.filter((c) => c.isPinned);
  const rest = list.filter((c) => !c.isPinned);
  return [...pinned, ...rest];
}

// ── Component ────────────────────────────────────────────────────────

export default function CommentsScreen() {
  const { submissionId } = useLocalSearchParams<{ submissionId: string }>();

  const [comments, setComments] = useState<CloudComment[]>([]);
  const [helpfulSet, setHelpfulSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Input state
  const [body, setBody] = useState('');
  const [commentType, setCommentType] = useState<CommentTypeValue>('comment');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!submissionId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getCommentsForSubmission(submissionId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setComments(sortComments(result.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async () => {
    if (!submissionId || body.trim().length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const result = await addComment(
        submissionId,
        body.trim(),
        commentType,
        commentType === 'tried_this' ? photoUri : null,
      );
      if (result.ok) {
        setComments((prev) => sortComments([...prev, result.data]));
        setBody('');
        setPhotoUri(null);
        setCommentType('comment');
        scrollRef.current?.scrollToEnd({ animated: true });
      }
    } catch {
      // Silently fail for now
    } finally {
      setSubmitting(false);
    }
  };

  const handleHelpful = async (commentId: string) => {
    if (helpfulSet.has(commentId)) return;
    setHelpfulSet((prev) => new Set(prev).add(commentId));
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, helpfulCount: c.helpfulCount + 1 } : c,
      ),
    );
    try {
      await markHelpful(commentId);
    } catch {
      // Revert on failure
      setHelpfulSet((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, helpfulCount: c.helpfulCount - 1 } : c,
        ),
      );
    }
  };

  const handlePickPhoto = () => {
    // Photo picker stub -- would use expo-image-picker
    setPhotoUri('https://placeholder.example/tried-this.jpg');
  };

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

  const typeBadge = (type: string) => {
    if (type === 'tried_this') {
      return (
        <View style={styles.badgeTried}>
          <Text style={styles.badgeTriedText}>I tried this</Text>
        </View>
      );
    }
    if (type === 'chefs_tip') {
      return (
        <View style={styles.badgeTip}>
          <Text style={styles.badgeTipText}>Chef's Tip</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Comments</Text>

        {comments.length === 0 ? (
          <EmptyState
            icon="message.fill"
            title="No comments yet"
            message="Be the first to share your thoughts"
          />
        ) : (
          <View style={styles.commentsList}>
            {comments.map((comment) => {
              const isPinned = comment.isPinned;
              const hasVoted = helpfulSet.has(comment.id);

              return (
                <GlassCard
                  key={comment.id}
                  level={2}
                  style={[
                    styles.commentCard,
                    isPinned && styles.commentCardPinned,
                  ]}
                >
                  {/* Author row */}
                  <View style={styles.authorRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {comment.profileId.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.authorInfo}>
                      <Text style={styles.authorName}>
                        {comment.profileId.slice(0, 8)}
                      </Text>
                      <Text style={styles.timestamp}>
                        {formatTimeAgo(comment.createdAt)}
                      </Text>
                    </View>
                    {typeBadge(comment.commentType)}
                    {isPinned && (
                      <View style={styles.pinnedBadge}>
                        <Text style={styles.pinnedText}>Pinned</Text>
                      </View>
                    )}
                  </View>

                  {/* Body */}
                  <Text style={styles.commentBody}>{comment.body}</Text>

                  {/* Photo (tried_this) */}
                  {comment.commentType === 'tried_this' &&
                    comment.photoUrl != null && (
                      <Image
                        source={{ uri: comment.photoUrl }}
                        style={styles.commentPhoto}
                        resizeMode="cover"
                      />
                    )}

                  {/* Actions row */}
                  <View style={styles.actionsRow}>
                    <Pressable
                      style={[
                        styles.helpfulButton,
                        hasVoted && styles.helpfulButtonVoted,
                      ]}
                      onPress={() => void handleHelpful(comment.id)}
                    >
                      <ThumbsUp
                        size={14}
                        color={hasVoted ? RECIPES_ACCENT : colors.textSecondary}
                        strokeWidth={hasVoted ? 2.5 : 1.5}
                        fill={hasVoted ? RECIPES_ACCENT : 'transparent'}
                      />
                      <Text
                        style={[
                          styles.helpfulText,
                          hasVoted && styles.helpfulTextVoted,
                        ]}
                      >
                        {comment.helpfulCount}
                      </Text>
                    </Pressable>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Bottom input */}
      <View style={styles.inputContainer}>
        {/* Type selector */}
        <View style={styles.typeRow}>
          {(['comment', 'tried_this', 'chefs_tip'] as const).map((t) => {
            const label =
              t === 'comment'
                ? 'Comment'
                : t === 'tried_this'
                  ? 'I tried this'
                  : "Chef's Tip";
            const isActive = commentType === t;
            return (
              <Pressable
                key={t}
                style={[styles.typeChip, isActive && styles.typeChipActive]}
                onPress={() => setCommentType(t)}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    isActive && styles.typeChipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.inputRow}>
          {commentType === 'tried_this' && (
            <Pressable style={styles.cameraButton} onPress={handlePickPhoto}>
              <Camera
                size={20}
                color={photoUri ? RECIPES_ACCENT : colors.textSecondary}
                strokeWidth={1.5}
              />
            </Pressable>
          )}

          <TextInput
            style={styles.textInput}
            value={body}
            onChangeText={(text) => {
              if (text.length <= MAX_BODY_LENGTH) setBody(text);
            }}
            placeholder="Add a comment..."
            placeholderTextColor="rgba(214, 195, 181, 0.4)"
            multiline
            maxLength={MAX_BODY_LENGTH}
          />

          <View style={styles.inputMeta}>
            <Text style={styles.charCount}>
              {body.length}/{MAX_BODY_LENGTH}
            </Text>
          </View>

          <Pressable
            style={[
              styles.sendButton,
              body.trim().length === 0 && styles.sendButtonDisabled,
            ]}
            onPress={() => void handleSubmit()}
            disabled={body.trim().length === 0 || submitting}
          >
            <Text
              style={[
                styles.sendText,
                body.trim().length === 0 && styles.sendTextDisabled,
              ]}
            >
              Post
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
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
    gap: 16,
  },
  title: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },

  // Comments list
  commentsList: {
    gap: 12,
  },
  commentCard: {
    gap: 10,
  },
  commentCardPinned: {
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
  },

  // Author
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: RECIPES_ACCENT,
  },
  authorInfo: {
    flex: 1,
    gap: 1,
  },
  authorName: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  timestamp: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    color: 'rgba(214, 195, 181, 0.5)',
  },

  // Badges
  badgeTried: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  badgeTriedText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    color: RECIPES_ACCENT,
  },
  badgeTip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
  },
  badgeTipText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    color: GOLD,
  },
  pinnedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
  },
  pinnedText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 9,
    color: GOLD,
  },

  // Body
  commentBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  commentPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: RECIPES_SURFACES.focus,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  helpfulButtonVoted: {
    borderColor: 'rgba(34, 197, 94, 0.25)',
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
  },
  helpfulText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  helpfulTextVoted: {
    color: RECIPES_ACCENT,
  },

  // Input container
  inputContainer: {
    backgroundColor: RECIPES_SURFACES.lift,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  typeChipActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
  },
  typeChipText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  typeChipTextActive: {
    color: RECIPES_ACCENT,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  cameraButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: RECIPES_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.text,
    backgroundColor: RECIPES_SURFACES.focus,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
  },
  inputMeta: {
    position: 'absolute',
    right: 60,
    bottom: 44,
  },
  charCount: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 10,
    color: 'rgba(214, 195, 181, 0.3)',
  },
  sendButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: RECIPES_ACCENT,
  },
  sendButtonDisabled: {
    backgroundColor: RECIPES_SURFACES.focus,
  },
  sendText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: '#0E0E13',
  },
  sendTextDisabled: {
    color: 'rgba(214, 195, 181, 0.3)',
  },
});
