import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MessageCircle, MoreHorizontal, ThumbsUp } from 'lucide-react-native';
import { JAKARTA_FONTS, isWithinEditWindow } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';
import { getDemoCommentsForSubmission, type DemoComment } from '../data/demo';
import { useDatabase } from '../providers/DatabaseProvider';
import { addLocalComment, getLocalComments } from '../data/local-submissions';
import { useI18n } from '../i18n/I18nProvider';
import { ReportMenu } from '../components/ReportMenu';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import {
  addCloudCommentViewModel,
  deleteCloudComment,
  editCloudComment,
  getCloudCommentViewModels,
  toggleCloudHelpful,
} from '../data/cloud-comments';
import { ensureCloudSubmissionForAppId } from '../data/cloud-submissions';
import { shouldShowDemoContent } from '../data/public-render-policy';
import { BackArrow } from '../components/DirectionalIcons';

type FilterTab = 'all' | 'tried_this' | 'chefs_tip';

interface ReplyContext {
  parentId: string;
  parentHandle: string;
}

interface EditContext {
  commentId: string;
  initialText: string;
}

export default function CommentsScreen() {
  const { submissionId } = useLocalSearchParams<{ submissionId: string }>();
  const router = useRouter();
  const tc = useThemeColors();
  const theme = useTheme();
  const db = useDatabase();
  const cloud = useBestChefCloud();
  const { t, formatNumber } = useI18n();
  const [comments, setComments] = useState<DemoComment[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyContext | null>(null);
  const [editing, setEditing] = useState<EditContext | null>(null);

  useEffect(() => {
    const id = submissionId ?? '';
    let cancelled = false;
    const demoComments = shouldShowDemoContent() ? getDemoCommentsForSubmission(id) : [];
    const localComments = [
      ...getLocalComments(db, id),
      ...demoComments,
    ];
    setComments(localComments);

    if (cloud.isReady && cloud.profile) {
      void ensureCloudSubmissionForAppId(db, cloud.profile, id)
        .then((cloudSubmissionId) => (
          cloudSubmissionId
            ? getCloudCommentViewModels(cloudSubmissionId, cloud.profile)
            : Promise.resolve([])
        ))
        .then((cloudComments) => {
          if (!cancelled) setComments([...cloudComments, ...localComments]);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [cloud.isReady, cloud.profile, db, submissionId]);

  // Build a parent->replies index for indented rendering. Top-level rows are
  // those with no parentId. Replies are nested directly under their parent.
  const threaded = useMemo(() => {
    const visible = filter === 'all'
      ? comments
      : comments.filter((c) => c.type === filter);
    const repliesByParent = new Map<string, DemoComment[]>();
    const tops: DemoComment[] = [];
    for (const c of visible) {
      if (c.parentId) {
        const list = repliesByParent.get(c.parentId) ?? [];
        list.push(c);
        repliesByParent.set(c.parentId, list);
      } else {
        tops.push(c);
      }
    }
    return { tops, repliesByParent };
  }, [comments, filter]);

  const handleSendComment = async () => {
    const text = commentText.trim();
    if (!text || !submissionId) return;

    if (editing) {
      await handleConfirmEdit(editing.commentId, text);
      return;
    }

    if (cloud.isReady && cloud.profile) {
      const cloudSubmissionId = await ensureCloudSubmissionForAppId(
        db,
        cloud.profile,
        submissionId,
      );
      const result = await addCloudCommentViewModel(
        cloudSubmissionId ?? '',
        cloud.profile,
        text,
        replyTo?.parentId,
      );
      if (result.comment) {
        setComments((prev) => [result.comment!, ...prev]);
        setCommentText('');
        setReplyTo(null);
        return;
      }
      // A cloud rejection must surface, not downgrade to a local-only
      // comment nobody else can see. Only 'not_cloud' falls through.
      if (result.error === 'rate_limited') {
        Alert.alert(t('You are doing that too quickly. Try again later.'));
        return;
      }
      if (result.error === 'submission_not_found') {
        Alert.alert(t('This recipe submission is no longer available.'));
        return;
      }
      if (result.error === 'unknown') {
        Alert.alert(t('Comment not posted. Check your connection and try again.'));
        return;
      }
    }

    const comment = addLocalComment(db, submissionId, text);
    setComments((prev) => [{
      id: comment.id,
      submissionId,
      authorName: t('You'),
      authorHandle: 'me',
      text: comment.text,
      type: 'comment',
      helpfulCount: 0,
      createdAt: comment.createdAt.split('T')[0] ?? comment.createdAt,
    }, ...prev]);
    setCommentText('');
    setReplyTo(null);
  };

  const handleStartReply = (comment: DemoComment) => {
    setEditing(null);
    setReplyTo({ parentId: comment.id, parentHandle: comment.authorHandle });
  };

  const handleStartEdit = (comment: DemoComment) => {
    setReplyTo(null);
    setEditing({ commentId: comment.id, initialText: comment.text });
    setCommentText(comment.text);
  };

  const handleCancelComposer = () => {
    setReplyTo(null);
    setEditing(null);
    setCommentText('');
  };

  const handleConfirmEdit = async (commentId: string, body: string) => {
    if (!cloud.profile) return;
    const result = await editCloudComment(commentId, body, cloud.profile);
    if (result.error === 'edit_window_expired') {
      Alert.alert(t('comments_edit_window_expired'));
      setEditing(null);
      setCommentText('');
      return;
    }
    if (result.comment) {
      setComments((prev) => prev.map((c) => (c.id === commentId ? result.comment! : c)));
      setEditing(null);
      setCommentText('');
    }
  };

  const handleDelete = async (comment: DemoComment) => {
    if (!comment.isCloud) return;
    const ok = await deleteCloudComment(comment.id);
    if (ok) {
      setComments((prev) => prev.map((c) => (
        c.id === comment.id
          ? { ...c, isDeleted: true, text: t('comments_deleted_placeholder') }
          : c
      )));
    }
  };

  const handleToggleHelpful = async (comment: DemoComment) => {
    if (!comment.isCloud || !cloud.profile) {
      // Local/demo: legacy local-only increment, kept so demo still feels alive.
      setComments((prev) => prev.map((c) => (
        c.id === comment.id
          ? { ...c, helpfulCount: c.helpfulCount + 1, isHelpful: true }
          : c
      )));
      return;
    }
    // Optimistic: flip + adjust count, reconcile with cloud truth.
    const wasHelpful = comment.isHelpful ?? false;
    const optimisticCount = Math.max(0, comment.helpfulCount + (wasHelpful ? -1 : 1));
    setComments((prev) => prev.map((c) => (
      c.id === comment.id ? { ...c, isHelpful: !wasHelpful, helpfulCount: optimisticCount } : c
    )));
    const result = await toggleCloudHelpful(comment.id, cloud.profile);
    if (!result) {
      // Roll back on failure.
      setComments((prev) => prev.map((c) => (
        c.id === comment.id ? { ...c, isHelpful: wasHelpful, helpfulCount: comment.helpfulCount } : c
      )));
    }
  };

  const renderComment = (comment: DemoComment, isReply = false) => {
    const canEdit = comment.isMine
      && comment.isCloud
      && !comment.isDeleted
      && comment.createdAtIso
      && isWithinEditWindow(new Date(comment.createdAtIso));
    const canDelete = comment.isMine && comment.isCloud && !comment.isDeleted;
    return (
      <View
        key={comment.id}
        style={[
          styles.commentCard,
          { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
          isReply && { marginLeft: 24 },
        ]}
      >
        <View style={styles.commentTop}>
          <Text style={[styles.commentAuthor, { color: tc.text }]}>{comment.authorName}</Text>
          {comment.type === 'chefs_tip' && (
            <View style={[styles.tipBadge, { backgroundColor: `${tc.primaryContainer}33` }]}><Text style={[styles.tipBadgeText, { color: tc.primaryContainer }]}>{t("CHEF'S TIP")}</Text></View>
          )}
          {comment.type === 'tried_this' && (
            <View style={[styles.triedBadge, { backgroundColor: `${tc.accent}1F` }]}><Text style={[styles.triedBadgeText, { color: tc.accent }]}>{t('TRIED THIS')}</Text></View>
          )}
          {comment.isEdited && !comment.isDeleted && (
            <Text style={[styles.editedTag, { color: tc.textTertiary }]}>{t('comments_edited')}</Text>
          )}
          <Text style={[styles.commentDate, { color: tc.textTertiary }]}>{comment.createdAt}</Text>
          <ReportMenu
            targetKind="comment"
            targetId={comment.id}
            accessibilityLabel={t('Report comment')}
            style={styles.reportBtn}
          >
            <MoreHorizontal size={16} color={tc.textTertiary} strokeWidth={2} />
          </ReportMenu>
        </View>
        <Text style={[styles.commentText, { color: tc.textSecondary }]}>
          {comment.isDeleted ? t('comments_deleted_placeholder') : comment.text}
        </Text>
        {!comment.isDeleted && (
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.helpfulRow}
              accessibilityRole="button"
              accessibilityLabel={t('comments_mark_helpful')}
              onPress={() => { void handleToggleHelpful(comment); }}
            >
              <ThumbsUp
                size={14}
                color={comment.isHelpful ? tc.accent : tc.textSecondary}
                strokeWidth={2}
              />
              <Text style={[styles.helpfulText, { color: comment.isHelpful ? tc.accent : tc.textTertiary }]}>
                {t('comments_helpful_label')} · {formatNumber(comment.helpfulCount)}
              </Text>
            </Pressable>
            {!isReply && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('comments_reply')}
                onPress={() => handleStartReply(comment)}
              >
                <Text style={[styles.actionLink, { color: tc.textSecondary }]}>{t('comments_reply')}</Text>
              </Pressable>
            )}
            {canEdit && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('comments_edit')}
                onPress={() => handleStartEdit(comment)}
              >
                <Text style={[styles.actionLink, { color: tc.textSecondary }]}>{t('comments_edit')}</Text>
              </Pressable>
            )}
            {canDelete && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('comments_delete')}
                onPress={() => { void handleDelete(comment); }}
              >
                <Text style={[styles.actionLink, { color: tc.danger ?? tc.textSecondary }]}>{t('comments_delete')}</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: tc.text }]}>
          {t('Comments')} ({formatNumber(comments.length)})
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filterRow}>
        {([['all', 'All'], ['tried_this', 'Tried This'], ['chefs_tip', "Chef's Tips"]] as const).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.filterChip, { backgroundColor: tc.surface }, filter === key && { backgroundColor: `${tc.accent}24` }]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.filterText, { color: tc.textSecondary }, filter === key && { color: tc.accent }]}>{t(label)}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {threaded.tops.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <MessageCircle size={28} color={tc.textTertiary} strokeWidth={1.5} />
            <Text style={[styles.emptyText, { color: tc.text }]}>{t('No comments yet')}</Text>
          </View>
        )}

        {threaded.tops.map((parent) => (
          <View key={parent.id}>
            {renderComment(parent, false)}
            {(threaded.repliesByParent.get(parent.id) ?? []).map((reply) => renderComment(reply, true))}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.inputBar, { backgroundColor: tc.background, borderTopColor: theme.glass.cardBorder }]}>
        {(replyTo || editing) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Cancel')}
            onPress={handleCancelComposer}
            style={styles.composerEyebrow}
          >
            <Text style={[styles.eyebrowText, { color: tc.textTertiary }]}>
              {replyTo
                ? t('comments_replying_to', { handle: replyTo.parentHandle })
                : t('comments_edit')}
            </Text>
          </Pressable>
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.commentInput, { color: tc.text, backgroundColor: tc.surface }]}
            placeholder={t('Write a comment...')}
            placeholderTextColor={tc.textTertiary}
            value={commentText}
            onChangeText={setCommentText}
            multiline
          />
          <Pressable
            style={[styles.sendButton, { backgroundColor: tc.accent }, !commentText.trim() && { opacity: 0.4 }]}
            disabled={!commentText.trim()}
            onPress={() => { void handleSendComment(); }}
          >
            <MessageCircle size={18} color={tc.background} strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingTop: 56, paddingBottom: 12, gap: 12,
  },
  topBarTitle: { flex: 1, fontFamily: JAKARTA_FONTS.bold, fontSize: 17, textAlign: 'center' },

  filterRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  filterText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 },

  content: { paddingHorizontal: 20, paddingBottom: 100, gap: 12 },

  emptyCard: {
    borderRadius: 20, padding: 40,
    alignItems: 'center', gap: 8, borderWidth: 1,
  },
  emptyText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },

  commentCard: {
    borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, marginBottom: 8,
  },
  commentTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentAuthor: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  commentDate: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, marginLeft: 'auto' },
  reportBtn: { padding: 4, marginLeft: 4 },
  tipBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  tipBadgeText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 8, letterSpacing: 0.5 },
  triedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  triedBadgeText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 8, letterSpacing: 0.5 },
  editedTag: { fontFamily: JAKARTA_FONTS.medium, fontSize: 10, fontStyle: 'italic' },
  commentText: { fontFamily: JAKARTA_FONTS.regular, fontSize: 14, lineHeight: 21 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  helpfulRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  helpfulText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  actionLink: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 },

  inputBar: {
    gap: 6,
    paddingHorizontal: 20, paddingVertical: 12, paddingBottom: 36,
    borderTopWidth: 1,
  },
  composerEyebrow: { paddingVertical: 4 },
  eyebrowText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  commentInput: {
    flex: 1, fontFamily: JAKARTA_FONTS.regular, fontSize: 14,
    borderRadius: 14, padding: 12, maxHeight: 80,
  },
  sendButton: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
});
