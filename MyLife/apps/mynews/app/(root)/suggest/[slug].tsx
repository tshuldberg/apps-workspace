import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
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
  computeDiff,
  splitBlocks,
  type ArticleView,
  type ProfileView,
  type StructuredDiff,
  type SuggestionType,
} from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { useMyNewsAuth } from '../providers/AuthProvider';
import { useMyNewsCloud } from '../providers/CloudProvider';
import { useMyNewsIdentity } from '../providers/IdentityProvider';
import { useTermsGate } from '../providers/TermsGateProvider';
import { ScreenHeader } from '../components/ScreenHeader';
import { LoadingView, MessageView } from '../components/StateViews';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { TYPE_LABEL } from '../lib/desk';
import { newSuggestionId } from '../lib/ids';
import {
  buildBodyProposal,
  buildHeadlineProposal,
  diffPreviewRows,
  requiresCitation,
  submitSuggestionFlow,
  type SuggestMode,
  type SuggestOutcome,
} from '../lib/suggest';
import { ErrorText } from '../components/ErrorText';

// C8.1 type picker order.
const TYPE_ORDER: SuggestionType[] = [
  'copyedit',
  'clarity',
  'correction',
  'context',
  'translation',
  'headline',
];

type LoadState =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; article: ArticleView; profile: ProfileView | null };

type Sent = { collapsed: boolean } | null;

export default function SuggestScreen() {
  const { slug, articleId } = useLocalSearchParams<{ slug: string; articleId?: string }>();
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
    if (!slug) {
      setState({ status: 'not-found' });
      return;
    }
    setState({ status: 'loading' });
    try {
      let article = await port.getArticleBySlug(slug);
      // Newsroom drafts miss the public read; the session-scoped read covers them.
      if (!article && typeof articleId === 'string' && articleId.length > 0 && hasSession) {
        article = await port.getDraftArticle(articleId);
      }
      if (!article) {
        setState({ status: 'not-found' });
        return;
      }
      let profile: ProfileView | null = null;
      if (hasSession) {
        try {
          profile = await port.getMyProfile();
        } catch {
          profile = null;
        }
      }
      setState({ status: 'loaded', article, profile });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }, [articleId, hasSession, isConfigured, port, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Suggest an edit" />
      {state.status === 'loading' ? (
        <LoadingView />
      ) : state.status === 'not-configured' ? (
        <MessageView
          title="Not connected to a MyNews server yet"
          body={reason ?? 'Suggesting turns on once a MyNews server is configured for this build.'}
        />
      ) : state.status === 'not-found' ? (
        <MessageView
          title="Article not found"
          body="This article is not published, or the link is out of date."
        />
      ) : state.status === 'error' ? (
        <MessageView title="Could not load this article" body={state.message} />
      ) : (
        <Composer
          article={state.article}
          profile={state.profile}
          slug={slug ?? ''}
          articleIdParam={typeof articleId === 'string' ? articleId : undefined}
          identity={identity}
          onDone={() => router.back()}
          onRegister={(returnTo) =>
            router.push(`/(root)/register?returnTo=${encodeURIComponent(returnTo)}`)
          }
        />
      )}
    </View>
  );
}

function Composer({
  article,
  profile,
  slug,
  articleIdParam,
  identity,
  onDone,
  onRegister,
}: {
  article: ArticleView;
  profile: ProfileView | null;
  slug: string;
  articleIdParam?: string;
  identity: { pubkeyHex: string; privateKeyHex: string } | null;
  onDone: () => void;
  onRegister: (returnTo: string) => void;
}) {
  const { port } = useMyNewsCloud();
  const { ensureTermsAccepted } = useTermsGate();
  const blocks = useMemo(() => splitBlocks(article.bodyMd), [article.bodyMd]);

  const [type, setType] = useState<SuggestionType>('copyedit');
  const [blockIndex, setBlockIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<SuggestMode>('edit');
  const [text, setText] = useState('');
  const [editedHeadline, setEditedHeadline] = useState(article.headline);
  const [editedDek, setEditedDek] = useState(article.dek ?? '');
  const [citations, setCitations] = useState<string[]>([]);
  const [rationale, setRationale] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string; action?: string } | null>(
    null,
  );
  const [sent, setSent] = useState<Sent>(null);
  const suggestionIdRef = useRef(newSuggestionId());

  const isHeadline = type === 'headline';

  const pickBlock = useCallback(
    (index: number, nextMode: SuggestMode) => {
      setBlockIndex(index);
      setMode(nextMode);
      setText(nextMode === 'edit' ? blocks[index] ?? '' : '');
      setError(null);
    },
    [blocks],
  );

  const diff: StructuredDiff | null = useMemo(() => {
    try {
      if (isHeadline) {
        const { baseDoc, proposedDoc } = buildHeadlineProposal({
          headline: article.headline,
          dek: article.dek,
          editedHeadline,
          editedDek,
        });
        return computeDiff(baseDoc, proposedDoc);
      }
      if (blockIndex === null) return null;
      const proposal = buildBodyProposal({ bodyMd: article.bodyMd, blockIndex, mode, text });
      return computeDiff(article.bodyMd, proposal);
    } catch {
      return null;
    }
  }, [article, blockIndex, editedDek, editedHeadline, isHeadline, mode, text]);

  const previewRows = useMemo(() => (diff ? diffPreviewRows(diff) : []), [diff]);

  const onSubmit = useCallback(async () => {
    if (!port || !identity) return;
    if (!(await ensureTermsAccepted())) return;
    setSubmitting(true);
    setError(null);
    const outcome: SuggestOutcome = await submitSuggestionFlow({
      article: { articleId: article.articleId, rev: article.rev },
      type,
      diff,
      citations,
      rationale,
      suggestionId: suggestionIdRef.current,
      identity,
      port,
      nowIso: new Date().toISOString(),
    });
    setSubmitting(false);
    if (outcome.ok) {
      setSent({ collapsed: outcome.collapsed });
    } else {
      setError(outcome);
    }
  }, [article, citations, diff, identity, port, rationale, type, ensureTermsAccepted]);

  const registerReturnTo = `/(root)/suggest/${slug}${
    articleIdParam ? `?articleId=${articleIdParam}` : ''
  }`;

  if (sent) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.successTitle}>Suggestion sent</Text>
          <Text style={styles.cardBody}>
            {sent.collapsed
              ? 'Your fix matches one already in the queue. Recorded as an endorsement of the earlier suggestion.'
              : `${article.authorDisplayName} reviews it in her queue. If accepted, the article becomes revision ${article.rev + 1} and you are credited in the public changelog.`}
          </Text>
        </View>
        <SecondaryButton label="Done" onPress={onDone} />
      </ScrollView>
    );
  }

  const anchorLine =
    !isHeadline && blockIndex !== null
      ? `Against rev ${article.rev} · anchored to paragraph ${blockIndex + 1}`
      : `Against rev ${article.rev}`;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.anchorLine}>{anchorLine}</Text>

        {/* Type picker */}
        <View style={styles.typeRow}>
          {TYPE_ORDER.map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                setType(option);
                setError(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: type === option }}
              style={[styles.typeChip, type === option && styles.typeChipActive]}
            >
              <Text style={[styles.typeChipText, type === option && styles.typeChipTextActive]}>
                {TYPE_LABEL[option]}
              </Text>
              {requiresCitation(option) ? (
                <Text style={styles.citationTag}>[citation required]</Text>
              ) : null}
            </Pressable>
          ))}
        </View>

        {isHeadline ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Headline and standfirst</Text>
            <TextInput
              accessibilityLabel="Headline"
              value={editedHeadline}
              onChangeText={(next) => {
                setEditedHeadline(next);
                setError(null);
              }}
              placeholder="Headline"
              placeholderTextColor={tokens.textTertiary}
              style={styles.input}
              multiline
            />
            <TextInput
              accessibilityLabel="Standfirst, optional"
              value={editedDek}
              onChangeText={(next) => {
                setEditedDek(next);
                setError(null);
              }}
              placeholder="Standfirst (optional)"
              placeholderTextColor={tokens.textTertiary}
              style={styles.input}
              multiline
            />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pick a paragraph</Text>
            {blocks.map((block, index) => (
              <Pressable
                key={index}
                onPress={() => pickBlock(index, blockIndex === index ? mode : 'edit')}
                accessibilityRole="button"
                accessibilityState={{ selected: blockIndex === index }}
                style={[styles.blockRow, blockIndex === index && styles.blockRowActive]}
              >
                <Text style={styles.blockIndex}>{index + 1}</Text>
                <Text style={styles.blockText} numberOfLines={blockIndex === index ? 0 : 2}>
                  {block}
                </Text>
              </Pressable>
            ))}
            {blockIndex !== null ? (
              <View style={styles.editArea}>
                <View style={styles.modeRow}>
                  {(
                    [
                      ['edit', 'Edit paragraph'],
                      ['insert-after', 'Insert after'],
                    ] as const
                  ).map(([value, label]) => (
                    <Pressable
                      key={value}
                      onPress={() => pickBlock(blockIndex, value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: mode === value }}
                      style={[styles.modeOption, mode === value && styles.modeOptionActive]}
                    >
                      <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  accessibilityLabel="Suggested text"
                  value={text}
                  onChangeText={(next) => {
                    setText(next);
                    setError(null);
                  }}
                  placeholder={
                    mode === 'edit' ? 'Edit the paragraph text' : 'New paragraph to insert'
                  }
                  placeholderTextColor={tokens.textTertiary}
                  style={[styles.input, styles.blockInput]}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            ) : (
              <Text style={styles.hint}>Tap a paragraph to edit it or insert after it.</Text>
            )}
          </View>
        )}

        {/* Live diff preview */}
        {previewRows.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Change preview</Text>
            {previewRows.map((row, index) => (
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
        ) : null}

        {/* Citations */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Citations{requiresCitation(type) ? ' (at least one https link required)' : ' (https links)'}
          </Text>
          {citations.map((citation, index) => (
            <View key={index} style={styles.citationRow}>
              <TextInput
                accessibilityLabel={`Citation ${index + 1}, https link`}
                value={citation}
                onChangeText={(next) => {
                  setCitations((prev) => prev.map((c, i) => (i === index ? next : c)));
                  setError(null);
                }}
                placeholder="https://..."
                placeholderTextColor={tokens.textTertiary}
                style={[styles.input, styles.citationInput]}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Pressable
                onPress={() => setCitations((prev) => prev.filter((_, i) => i !== index))}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Remove citation"
              >
                <Text style={styles.removeCitation}>Remove</Text>
              </Pressable>
            </View>
          ))}
          <SecondaryButton
            label="Add citation"
            onPress={() => setCitations((prev) => [...prev, ''])}
          />
          {error?.field === 'citations' ? <ErrorText style={styles.error}>{error.message}</ErrorText> : null}
        </View>

        {/* Rationale */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rationale</Text>
          <TextInput
            accessibilityLabel="Rationale"
            value={rationale}
            onChangeText={(next) => {
              setRationale(next);
              setError(null);
            }}
            placeholder="Why this change improves the article"
            placeholderTextColor={tokens.textTertiary}
            style={[styles.input, styles.rationaleInput]}
            multiline
            textAlignVertical="top"
          />
          {error?.field === 'rationale' ? <ErrorText style={styles.error}>{error.message}</ErrorText> : null}
        </View>

        {error && error.field !== 'citations' && error.field !== 'rationale' ? (
          <ErrorText style={styles.error}>{error.message}</ErrorText>
        ) : null}

        <View style={styles.submitWrap}>
          {profile ? (
            <PrimaryButton
              label="Submit suggestion"
              onPress={() => void onSubmit()}
              disabled={!identity || !diff || diff.ops.length === 0}
              loading={submitting}
            />
          ) : (
            <>
              <Text style={styles.hint}>
                You need a public profile to do this. Register a handle to continue.
              </Text>
              <PrimaryButton
                label="Register to publish or suggest"
                onPress={() => onRegister(registerReturnTo)}
              />
            </>
          )}
          {profile && error?.action === 'register' ? (
            <SecondaryButton
              label="Register to publish or suggest"
              onPress={() => onRegister(registerReturnTo)}
            />
          ) : null}
          <Text style={styles.footerLine}>
            Signed with your editor key · only {article.authorDisplayName} can apply it
          </Text>
        </View>
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
    gap: 14,
  },
  anchorLine: {
    color: tokens.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.card,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
    gap: 2,
  },
  typeChipActive: {
    backgroundColor: tokens.accentDim,
    borderColor: tokens.accent,
  },
  typeChipText: {
    color: tokens.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  typeChipTextActive: {
    color: tokens.accent,
  },
  citationTag: {
    color: tokens.textTertiary,
    fontSize: 10,
    fontWeight: '600',
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
    color: tokens.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  blockRow: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 8,
  },
  blockRowActive: {
    borderColor: tokens.accent,
    backgroundColor: tokens.accentDim,
  },
  blockIndex: {
    color: tokens.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    width: 18,
    textAlign: 'right',
  },
  blockText: {
    color: tokens.text,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  editArea: {
    gap: 8,
    marginTop: 4,
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: tokens.surface,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  modeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  modeOptionActive: {
    backgroundColor: tokens.elevated,
  },
  modeText: {
    color: tokens.textTertiary,
    fontSize: 13,
    fontWeight: '600',
  },
  modeTextActive: {
    color: tokens.text,
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
  blockInput: {
    minHeight: 100,
  },
  rationaleInput: {
    minHeight: 70,
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
  citationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  citationInput: {
    flex: 1,
  },
  removeCitation: {
    color: tokens.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    color: tokens.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  hint: {
    color: tokens.textTertiary,
    fontSize: 13,
    lineHeight: 19,
  },
  submitWrap: {
    gap: 10,
  },
  footerLine: {
    color: tokens.textTertiary,
    fontSize: 13,
    textAlign: 'center',
  },
  successTitle: {
    color: tokens.success,
    fontSize: 18,
    fontWeight: '800',
  },
});
