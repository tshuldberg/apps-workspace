import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  MYNEWS_BOUNDS,
  acceptSuggestion,
  buildBlockSet,
  filterBlockedEvents,
  isBlockedAuthor,
  rejectSuggestion,
  type ArticleView,
  type ProfileView,
  type SuggestionEventView,
  type SuggestionView,
} from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { useMyNewsAuth } from '../providers/AuthProvider';
import { useMyNewsCloud } from '../providers/CloudProvider';
import { useMyNewsIdentity } from '../providers/IdentityProvider';
import { useTermsGate } from '../providers/TermsGateProvider';
import { ScreenHeader } from '../components/ScreenHeader';
import { ReportCard } from '../components/ReportCard';
import { LoadingView, MessageView } from '../components/StateViews';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { deskErrorMessage } from '../lib/desk-errors';
import {
  TYPE_LABEL,
  buildAcceptPreview,
  eventRowText,
  resolveCounterEdit,
  type AcceptPreviewModel,
} from '../lib/desk';
import { diffPreviewRows } from '../lib/suggest';
import { relativeTime } from '../lib/format';
import { ErrorText } from '../components/ErrorText';

type LoadState =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | {
      status: 'loaded';
      suggestion: SuggestionView;
      article: ArticleView | null;
      events: SuggestionEventView[];
      myProfile: ProfileView | null;
    };

export default function SuggestionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const auth = useMyNewsAuth();
  const { isConfigured, port, reason } = useMyNewsCloud();
  const identity = useMyNewsIdentity();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const hasSession = auth.status === 'anonymous' || auth.status === 'linked';

  const load = useCallback(async () => {
    if (!isConfigured || !port) {
      setState({ status: 'not-configured' });
      return;
    }
    if (!id) {
      setState({ status: 'not-found' });
      return;
    }
    setState({ status: 'loading' });
    try {
      const suggestion = await port.getSuggestion(id);
      if (!suggestion) {
        setState({ status: 'not-found' });
        return;
      }
      // Honor the viewer's block list: a blocked editor's suggestion is hidden
      // (rendered as not-found, the honest revocation of visibility), and a
      // blocked commenter's thread events are dropped.
      const blocks = hasSession ? await port.listBlocks().catch(() => []) : [];
      const blockSet = buildBlockSet(blocks);
      if (isBlockedAuthor(blockSet, { profileId: suggestion.editorId, pubkey: suggestion.editorPubkey })) {
        setState({ status: 'not-found' });
        return;
      }
      let article = await port.getArticleBySlug(suggestion.articleSlug);
      if (!article && hasSession) {
        article = await port.getDraftArticle(suggestion.articleId);
      }
      const events = filterBlockedEvents(blockSet, await port.getSuggestionEvents(suggestion.id));
      let myProfile: ProfileView | null = null;
      if (hasSession) {
        try {
          myProfile = await port.getMyProfile();
        } catch {
          myProfile = null;
        }
      }
      setState({ status: 'loaded', suggestion, article, events, myProfile });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }, [hasSession, id, isConfigured, port]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Suggestion" />
      {state.status === 'loading' ? (
        <LoadingView />
      ) : state.status === 'not-configured' ? (
        <MessageView
          title="Not connected to a MyNews server yet"
          body={reason ?? 'Suggestions live on the server.'}
        />
      ) : state.status === 'not-found' ? (
        <MessageView title="Suggestion not found" body="This suggestion no longer exists." />
      ) : state.status === 'error' ? (
        <MessageView title="Could not load this suggestion" body={state.message} />
      ) : (
        <SuggestionBody
          suggestion={state.suggestion}
          article={state.article}
          events={state.events}
          myProfile={state.myProfile}
          identity={identity}
          onReload={() => void load()}
          onOpenCredibility={(handle) => router.push(`/(root)/credibility/${handle}`)}
        />
      )}
    </View>
  );
}

function SuggestionBody({
  suggestion,
  article,
  events,
  myProfile,
  identity,
  onReload,
  onOpenCredibility,
}: {
  suggestion: SuggestionView;
  article: ArticleView | null;
  events: SuggestionEventView[];
  myProfile: ProfileView | null;
  identity: { pubkeyHex: string; privateKeyHex: string } | null;
  onReload: () => void;
  onOpenCredibility: (handle: string) => void;
}) {
  const { port } = useMyNewsCloud();
  const { ensureTermsAccepted } = useTermsGate();

  const [comment, setComment] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const [busy, setBusy] = useState<'accept' | 'counter' | 'reject' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [counterOpen, setCounterOpen] = useState(false);
  const [counterBody, setCounterBody] = useState('');
  const [counterHeadline, setCounterHeadline] = useState('');
  const [counterDek, setCounterDek] = useState('');

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNoteDraft, setRejectNoteDraft] = useState('');

  const isAuthor =
    identity !== null && article !== null && identity.pubkeyHex === article.authorPubkey;
  const isOpen = suggestion.status === 'open';

  const preview: AcceptPreviewModel | null = useMemo(
    () => (article ? buildAcceptPreview({ suggestion, article }) : null),
    [article, suggestion],
  );

  const openCounter = useCallback(() => {
    if (!preview || preview.status === 'stale') return;
    if (preview.applied.kind === 'body') {
      setCounterBody(preview.applied.bodyMd);
    } else {
      setCounterHeadline(preview.applied.headline);
      setCounterDek(preview.applied.dek ?? '');
    }
    setCounterOpen(true);
    setRejectOpen(false);
    setActionError(null);
  }, [preview]);

  const runAccept = useCallback(
    async (counterEdit: boolean) => {
      if (!port || !identity || !article || !preview || preview.status === 'stale') return;
      if (!(await ensureTermsAccepted())) return;
      setBusy(counterEdit ? 'counter' : 'accept');
      setActionError(null);
      // Unchanged counter-edits downgrade to a plain accept (full editor credit).
      const fields = counterEdit
        ? resolveCounterEdit({
            preview,
            edited:
              preview.applied.kind === 'body'
                ? { bodyMd: counterBody }
                : { headline: counterHeadline, dek: counterDek.trim() ? counterDek : null },
          })
        : {};
      const result = await acceptSuggestion({
        suggestion,
        article,
        identity,
        port,
        nowIso: new Date().toISOString(),
        ...fields,
      });
      setBusy(null);
      if (result.ok) {
        setSuccess(`Published revision ${result.rev}.`);
        setCounterOpen(false);
        onReload();
      } else {
        setActionError(deskErrorMessage(result.code, result.detail).message);
      }
    },
    [
      article,
      counterBody,
      counterDek,
      counterHeadline,
      ensureTermsAccepted,
      identity,
      onReload,
      port,
      preview,
      suggestion,
    ],
  );

  const runReject = useCallback(async () => {
    // F3: reject is now author-signed, so it needs the identity and the article
    // head (for the author key + baseRev). Both are present whenever the reject
    // control shows (isAuthor gates on them).
    if (!port || !identity || !article) return;
    if (!(await ensureTermsAccepted())) return;
    setBusy('reject');
    setActionError(null);
    const note = rejectNoteDraft.trim();
    const result = await rejectSuggestion({
      suggestion,
      article,
      identity,
      ...(note.length > 0 ? { note } : {}),
      port,
    });
    setBusy(null);
    if (result.ok) {
      setSuccess('Suggestion rejected. No penalty to the editor.');
      setRejectOpen(false);
      onReload();
    } else {
      setActionError(deskErrorMessage(result.code ?? 'unknown').message);
    }
  }, [article, ensureTermsAccepted, identity, onReload, port, rejectNoteDraft, suggestion]);

  const postComment = useCallback(async () => {
    if (!port || !myProfile) return;
    const body = comment.trim();
    if (!body) return;
    if (!(await ensureTermsAccepted())) return;
    setCommentBusy(true);
    setCommentError(null);
    try {
      const result = await port.postSuggestionComment({
        suggestionId: suggestion.id,
        actorProfileId: myProfile.id,
        body,
      });
      if (result.ok) {
        setComment('');
        onReload();
      } else {
        setCommentError(deskErrorMessage(result.error ?? 'unknown').message);
      }
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : String(error));
    } finally {
      setCommentBusy(false);
    }
  }, [comment, ensureTermsAccepted, myProfile, onReload, port, suggestion.id]);

  const rows = diffPreviewRows(suggestion.diff);
  const nextRev = article ? article.rev + 1 : suggestion.baseRev + 1;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.headline} numberOfLines={2}>
          {suggestion.articleHeadline}
        </Text>
        <Text style={styles.metaLine}>
          {TYPE_LABEL[suggestion.type]} · against rev {suggestion.baseRev} · [{suggestion.status}] ·{' '}
          {relativeTime(suggestion.createdAt)}
        </Text>

        {/* Editor chip */}
        <Pressable
          onPress={() => onOpenCredibility(suggestion.editorHandle)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.editorChip, pressed && styles.pressed]}
        >
          <Text style={styles.editorChipText}>
            @{suggestion.editorHandle} · {suggestion.editorDisplayName}
          </Text>
        </Pressable>

        {suggestion.endorsements > 0 ? (
          <Text style={styles.endorseLine}>
            {suggestion.endorsements} editors endorsed this fix
          </Text>
        ) : null}

        {/* Diff card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Proposed change</Text>
          {rows.map((row, index) => (
            <Text
              key={index}
              style={[
                styles.previewRow,
                row.kind === 'ctx' && styles.previewCtx,
                row.kind === 'del' && styles.previewDel,
                row.kind === 'add' && styles.previewAdd,
              ]}
            >
              {row.kind === 'del' ? '- ' : row.kind === 'add' ? '+ ' : '  '}
              {row.text}
            </Text>
          ))}
        </View>

        {/* Evidence */}
        {suggestion.citations.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Evidence</Text>
            {suggestion.citations.map((url) => (
              <Pressable
                key={url}
                onPress={() => {
                  if (url.startsWith('https://')) void Linking.openURL(url);
                }}
                accessibilityRole="link"
              >
                <Text style={styles.link} numberOfLines={1}>
                  {url}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Rationale */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rationale</Text>
          <Text style={styles.cardBody}>{suggestion.rationale}</Text>
        </View>

        {!article ? (
          <View style={styles.card}>
            <Text style={styles.cardMeta}>
              The article for this suggestion could not be loaded, so review actions are
              unavailable here.
            </Text>
          </View>
        ) : null}

        {/* Author actions */}
        {isAuthor && isOpen && preview ? (
          preview.status === 'stale' ? (
            <View style={styles.card}>
              <Text style={styles.staleTitle}>Needs refresh</Text>
              <Text style={styles.cardBody}>
                {deskErrorMessage('stale').message} The paragraph it edits changed or moved in a
                newer revision, so it cannot be applied as written.
              </Text>
            </View>
          ) : (
            <View style={styles.actions}>
              {preview.status === 'rebased' ? (
                <Text style={styles.rebaseNote}>
                  The article moved past rev {suggestion.baseRev}. The preview below is rebased
                  onto rev {article.rev}; accepting applies the rebased change.
                </Text>
              ) : null}
              {success ? <Text style={styles.success}>{success}</Text> : null}
              {actionError ? <ErrorText style={styles.error}>{actionError}</ErrorText> : null}
              <PrimaryButton
                label={`Accept · publish rev ${nextRev}`}
                onPress={() => void runAccept(false)}
                loading={busy === 'accept'}
                disabled={busy !== null}
              />
              <SecondaryButton
                label="Edit + accept"
                onPress={() => (counterOpen ? setCounterOpen(false) : openCounter())}
                disabled={busy !== null}
              />
              {counterOpen ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Your edit of the suggestion</Text>
                  {preview.applied.kind === 'body' ? (
                    <TextInput
                      accessibilityLabel="Your edit of the article body"
                      value={counterBody}
                      onChangeText={setCounterBody}
                      style={[styles.input, styles.bodyInput]}
                      multiline
                      textAlignVertical="top"
                    />
                  ) : (
                    <>
                      <TextInput
                        accessibilityLabel="Headline"
                        value={counterHeadline}
                        onChangeText={setCounterHeadline}
                        placeholder="Headline"
                        placeholderTextColor={tokens.textTertiary}
                        style={styles.input}
                        multiline
                      />
                      <TextInput
                        accessibilityLabel="Standfirst, optional"
                        value={counterDek}
                        onChangeText={setCounterDek}
                        placeholder="Standfirst (optional)"
                        placeholderTextColor={tokens.textTertiary}
                        style={styles.input}
                        multiline
                      />
                    </>
                  )}
                  <Text style={styles.cardMeta}>
                    If you change nothing, this is sent as a plain accept.
                  </Text>
                  <PrimaryButton
                    label={`Accept with edits · publish rev ${nextRev}`}
                    onPress={() => void runAccept(true)}
                    loading={busy === 'counter'}
                    disabled={busy !== null}
                  />
                </View>
              ) : null}
              <SecondaryButton
                label="Reject"
                onPress={() => {
                  setRejectOpen((open) => !open);
                  setCounterOpen(false);
                  setActionError(null);
                }}
                disabled={busy !== null}
              />
              {rejectOpen ? (
                <View style={styles.card}>
                  <Text style={styles.cardBody}>
                    Rejection asks for an optional reason; no penalty to honest disagreement
                  </Text>
                  <TextInput
                    accessibilityLabel="Optional note to the editor"
                    value={rejectNoteDraft}
                    onChangeText={setRejectNoteDraft}
                    placeholder="Optional note to the editor"
                    placeholderTextColor={tokens.textTertiary}
                    style={styles.input}
                    multiline
                  />
                  <PrimaryButton
                    label="Reject suggestion"
                    onPress={() => void runReject()}
                    loading={busy === 'reject'}
                    disabled={busy !== null}
                  />
                </View>
              ) : null}
            </View>
          )
        ) : success ? (
          <Text style={styles.success}>{success}</Text>
        ) : null}

        {/* Thread */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Thread</Text>
          {events.length === 0 ? (
            <Text style={styles.cardMeta}>No activity yet.</Text>
          ) : (
            events.map((event) => {
              const systemText = eventRowText(event);
              if (systemText !== null) {
                return (
                  <Text key={event.id} style={styles.systemRow}>
                    {systemText} · {relativeTime(event.createdAt)}
                  </Text>
                );
              }
              const body = event.payload['body'];
              return (
                <View key={event.id} style={styles.commentRow}>
                  <Text style={styles.commentAuthor}>
                    @{event.actorHandle} · {relativeTime(event.createdAt)}
                  </Text>
                  <Text style={styles.cardBody}>{typeof body === 'string' ? body : ''}</Text>
                </View>
              );
            })
          )}
          {myProfile ? (
            <View style={styles.composer}>
              <TextInput
                accessibilityLabel="Add to the discussion"
                value={comment}
                onChangeText={(next) => {
                  setComment(next);
                  setCommentError(null);
                }}
                placeholder="Add to the discussion"
                placeholderTextColor={tokens.textTertiary}
                style={[styles.input, styles.commentInput]}
                multiline
                // Canonical comment ceiling: the same bound the server enforces,
                // so the field stops at the limit instead of failing on submit.
                maxLength={MYNEWS_BOUNDS.COMMENT_MAX_CHARS}
                editable={!commentBusy}
              />
              {commentError ? <ErrorText style={styles.error}>{commentError}</ErrorText> : null}
              <SecondaryButton
                label="Post comment"
                onPress={() => void postComment()}
                disabled={commentBusy || !comment.trim()}
              />
            </View>
          ) : (
            <Text style={styles.cardMeta}>
              Commenting needs a public profile. Register from the Me tab to join the discussion.
            </Text>
          )}
        </View>

        <ReportCard targetKind="suggestion" targetId={suggestion.id} label="Report this suggestion" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 12,
  },
  headline: {
    color: tokens.text,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  metaLine: {
    color: tokens.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  editorChip: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.accentDim,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editorChipText: {
    color: tokens.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  endorseLine: {
    color: tokens.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  card: {
    backgroundColor: tokens.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    color: tokens.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardBody: {
    color: tokens.text,
    fontSize: 14,
    lineHeight: 21,
  },
  cardMeta: {
    color: tokens.textTertiary,
    fontSize: 13,
    lineHeight: 19,
  },
  previewRow: {
    fontSize: 13,
    lineHeight: 19,
  },
  previewCtx: {
    color: tokens.textTertiary,
  },
  previewDel: {
    color: tokens.danger,
    textDecorationLine: 'line-through',
  },
  previewAdd: {
    color: tokens.success,
  },
  link: {
    color: tokens.accent,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  actions: {
    gap: 10,
  },
  rebaseNote: {
    color: tokens.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  staleTitle: {
    color: tokens.danger,
    fontSize: 15,
    fontWeight: '800',
  },
  input: {
    backgroundColor: tokens.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    color: tokens.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bodyInput: {
    minHeight: 160,
  },
  commentInput: {
    minHeight: 60,
  },
  composer: {
    gap: 8,
    marginTop: 4,
  },
  systemRow: {
    color: tokens.textTertiary,
    fontSize: 13,
    fontStyle: 'italic',
  },
  commentRow: {
    gap: 2,
  },
  commentAuthor: {
    color: tokens.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  error: {
    color: tokens.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  success: {
    color: tokens.success,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
