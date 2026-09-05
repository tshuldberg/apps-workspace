// Post detail: one cloud workout share with its comment thread.
//
// First screen to wire the cloud-comments engine (it shipped tested but
// unconnected). Comments resolve author handles through the public
// profiles view, support optimistic posting, and carry report/block
// actions for Guideline 1.2.

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialSymbol, WK_FONTS, WK_SURFACES } from '@mylife/workouts';
import { useDoWorkCloud } from '../providers/DoWorkCloudProvider';
import { getShareById, type CloudShareRow } from '../data/cloud-shares';
import { likeShare, unlikeShare } from '../data/cloud-likes';
import { listComments, postComment, type CloudCommentRow } from '../data/cloud-comments';
import { getPublicProfiles, type CloudUserProfile } from '../data/cloud-profiles';
import { REPORT_REASONS, submitReport, type ReportTargetKind } from '../data/cloud-reports';
import { blockUser } from '../data/cloud-blocks';
import { WorkoutPhaseHeader } from '../phase2-kit';
import { SocialAvatar } from '../social-kit';
import { DW_ACCENT, DW_ACCENT_LIGHT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from '../theme/tokens';

export default function PostDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { supabase, userId } = useDoWorkCloud();

  const [share, setShare] = useState<CloudShareRow | null>(null);
  const [comments, setComments] = useState<CloudCommentRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, CloudUserProfile>>(new Map());
  const [liked, setLiked] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [status, setStatus] = useState<'loading' | 'missing' | 'offline' | 'ready'>('loading');

  const shareId = typeof params.id === 'string' ? params.id : '';

  const load = useCallback(async () => {
    if (!supabase || !shareId) {
      setStatus(supabase ? 'missing' : 'offline');
      return;
    }
    const shareResult = await getShareById(supabase, shareId);
    if (!shareResult.ok || !shareResult.share) {
      setStatus('missing');
      return;
    }
    setShare(shareResult.share);
    setLiked(shareResult.share.myLikedFlag);

    const commentsResult = await listComments(supabase, shareId, { limit: 50 });
    const rows = commentsResult.ok ? commentsResult.comments : [];
    setComments(rows);

    const authorIds = [shareResult.share.userId, ...rows.map((row) => row.userId)];
    const profileResult = await getPublicProfiles(supabase, authorIds);
    if (profileResult.ok) setProfiles(profileResult.profiles);

    setStatus('ready');
  }, [supabase, shareId]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameFor = useCallback(
    (authorUserId: string) => {
      if (authorUserId === userId) return 'You';
      const profile = profiles.get(authorUserId);
      return profile?.displayName ?? (profile ? `@${profile.handle}` : 'Lifter');
    },
    [profiles, userId],
  );

  const handleToggleLike = useCallback(async () => {
    if (!supabase || !userId || !share) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    const result = wasLiked
      ? await unlikeShare(supabase, share.id, userId)
      : await likeShare(supabase, share.id, userId);
    if (!result.ok) setLiked(wasLiked);
  }, [supabase, userId, share, liked]);

  const handlePostComment = useCallback(async () => {
    if (!supabase || !userId || !share) return;
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    try {
      const result = await postComment(supabase, share.id, userId, body);
      if (result.ok) {
        setComments((current) => [...current, result.comment]);
        setDraft('');
      } else {
        Alert.alert('Comment not posted', result.error);
      }
    } finally {
      setPosting(false);
    }
  }, [supabase, userId, share, draft]);

  const handleModerate = useCallback(
    (targetKind: ReportTargetKind, targetId: string, authorUserId: string) => {
      if (!supabase || !userId || authorUserId === userId) return;
      const handle = profiles.get(authorUserId)?.handle;
      Alert.alert('Moderate', undefined, [
        {
          text: `Report ${targetKind === 'comment' ? 'comment' : 'post'}`,
          onPress: () => {
            Alert.alert('Why are you reporting this?', undefined, [
              ...REPORT_REASONS.map((reason) => ({
                text: reason,
                onPress: () => {
                  void (async () => {
                    const result = await submitReport(supabase, {
                      reporterUserId: userId,
                      targetKind,
                      targetId,
                      reason,
                    });
                    Alert.alert(
                      result.ok ? 'Report received' : 'Report failed',
                      result.ok ? 'Reports are reviewed within 24 hours.' : result.error,
                    );
                  })();
                },
              })),
              { text: 'Cancel', style: 'cancel' as const },
            ]);
          },
        },
        {
          text: `Block ${handle ? `@${handle}` : 'user'}`,
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const result = await blockUser(supabase, userId, authorUserId);
              if (!result.ok) {
                Alert.alert('Block failed', result.error);
                return;
              }
              setComments((current) => current.filter((row) => row.userId !== authorUserId));
              Alert.alert('Blocked', 'They no longer appear in your feed or threads.');
            })();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [supabase, userId, profiles],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <WorkoutPhaseHeader title="Post" onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={24}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {status === 'loading' ? (
            <RNText style={styles.helper}>Loading…</RNText>
          ) : null}
          {status === 'offline' ? (
            <RNText style={styles.helper}>
              Cloud is not configured in this build, so community posts are unavailable.
            </RNText>
          ) : null}
          {status === 'missing' ? (
            <RNText style={styles.helper}>This post is gone or was removed.</RNText>
          ) : null}

          {share ? (
            <View style={styles.card}>
              <View style={styles.authorRow}>
                <SocialAvatar
                  accent={DW_ACCENT_LIGHT}
                  displayName={nameFor(share.userId)}
                  size={38}
                />
                <View style={{ flex: 1, gap: 1 }}>
                  <RNText style={styles.authorName}>{nameFor(share.userId)}</RNText>
                  <RNText style={styles.timestamp}>
                    {new Date(share.createdAt).toLocaleDateString()}
                  </RNText>
                </View>
                {share.userId !== userId ? (
                  <Pressable
                    onPress={() => handleModerate('share', share.id, share.userId)}
                    hitSlop={10}
                    style={styles.menuButton}
                  >
                    <MaterialSymbol name="more_horiz" size={18} color="rgba(214, 195, 181, 0.62)" />
                  </Pressable>
                ) : null}
              </View>

              <RNText style={styles.title}>{share.title}</RNText>
              {share.summary ? <RNText style={styles.summary}>{share.summary}</RNText> : null}

              <View style={styles.statRow}>
                <RNText style={styles.stat}>{Math.round(share.durationSeconds / 60)} min</RNText>
                <RNText style={styles.stat}>{share.exerciseCount} exercises</RNText>
                <RNText style={styles.stat}>{Math.round(share.totalVolumeKg)} kg</RNText>
              </View>

              <Pressable onPress={() => void handleToggleLike()} style={styles.likeButton}>
                <MaterialSymbol
                  name={liked ? 'favorite' : 'favorite_border'}
                  size={16}
                  color={liked ? DW_ACCENT_LIGHT : 'rgba(214, 195, 181, 0.62)'}
                />
                <RNText style={[styles.likeText, liked && { color: DW_ACCENT_LIGHT }]}>
                  {share.likeCount + (liked && !share.myLikedFlag ? 1 : 0) - (!liked && share.myLikedFlag ? 1 : 0)}
                </RNText>
              </Pressable>
            </View>
          ) : null}

          {status === 'ready' ? (
            <View style={styles.commentsSection}>
              <RNText style={styles.sectionTitle}>
                Comments · {comments.length}
              </RNText>
              {comments.length === 0 ? (
                <RNText style={styles.helper}>Be the first to comment.</RNText>
              ) : (
                comments.map((comment) => (
                  <Pressable
                    key={comment.id}
                    onLongPress={() => handleModerate('comment', comment.id, comment.userId)}
                    style={styles.commentRow}
                  >
                    <SocialAvatar
                      accent={DW_ACCENT_LIGHT}
                      displayName={nameFor(comment.userId)}
                      size={28}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <RNText style={styles.commentAuthor}>{nameFor(comment.userId)}</RNText>
                      <RNText style={styles.commentBody}>{comment.body}</RNText>
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          ) : null}
        </ScrollView>

        {status === 'ready' && supabase && userId ? (
          <View style={styles.composerRow}>
            <TextInput
              style={styles.composerInput}
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment…"
              placeholderTextColor={DW_TEXT.tertiary}
              maxLength={500}
              multiline
            />
            <Pressable
              onPress={() => void handlePostComment()}
              disabled={posting || !draft.trim()}
              style={[styles.sendButton, (posting || !draft.trim()) && { opacity: 0.4 }]}
            >
              <MaterialSymbol name="arrow_upward" size={18} color={DW_ON_ACCENT} />
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.lowest,
  },
  content: {
    padding: 18,
    paddingBottom: 32,
    gap: 16,
  },
  helper: {
    color: 'rgba(214, 195, 181, 0.66)',
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    gap: 10,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorName: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
  },
  timestamp: {
    color: 'rgba(214, 195, 181, 0.56)',
    fontFamily: WK_FONTS.regular,
    fontSize: 11,
  },
  menuButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  title: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.bold,
    fontSize: 19,
    lineHeight: 24,
  },
  summary: {
    color: 'rgba(214, 195, 181, 0.76)',
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stat: {
    color: 'rgba(214, 195, 181, 0.62)',
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  likeText: {
    color: 'rgba(214, 195, 181, 0.62)',
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
  },
  commentsSection: {
    gap: 12,
  },
  sectionTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  commentAuthor: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
  },
  commentBody: {
    color: 'rgba(214, 195, 181, 0.82)',
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: DW_BORDER.subtle,
    backgroundColor: DW_SURFACES.base,
  },
  composerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DW_BORDER.default,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: DW_TEXT.primary,
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DW_ACCENT,
  },
});
