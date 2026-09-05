import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  acceptBatch,
  type ArticleView,
  type SuggestionView,
} from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { useMyNewsAuth } from '../providers/AuthProvider';
import { useMyNewsCloud } from '../providers/CloudProvider';
import { useMyNewsIdentity } from '../providers/IdentityProvider';
import { useTermsGate } from '../providers/TermsGateProvider';
import { ScreenHeader } from '../components/ScreenHeader';
import { LoadingView, MessageView } from '../components/StateViews';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { deskErrorMessage } from '../lib/desk-errors';
import { buildBatchModel, filterBatchEligible, suggestionPreviewLine } from '../lib/desk';
import { ErrorText } from '../components/ErrorText';

type LoadState =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; article: ArticleView; eligible: SuggestionView[] };

export default function ReviewBatchScreen() {
  const { articleId, slug } = useLocalSearchParams<{ articleId: string; slug?: string }>();
  const auth = useMyNewsAuth();
  const { isConfigured, port, reason } = useMyNewsCloud();
  const identity = useMyNewsIdentity();
  const { ensureTermsAccepted } = useTermsGate();

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [includedIds, setIncludedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; refresh: boolean } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasSession = auth.status === 'anonymous' || auth.status === 'linked';

  const load = useCallback(async () => {
    if (!isConfigured || !port) {
      setState({ status: 'not-configured' });
      return;
    }
    if (!articleId) {
      setState({ status: 'not-found' });
      return;
    }
    setState({ status: 'loading' });
    try {
      let article: ArticleView | null = null;
      if (typeof slug === 'string' && slug.length > 0) {
        article = await port.getArticleBySlug(slug);
      }
      if (!article && hasSession) {
        article = await port.getDraftArticle(articleId);
      }
      if (!article) {
        setState({ status: 'not-found' });
        return;
      }
      const open = await port.getSuggestionsForArticle(articleId, { status: 'open' });
      const eligible = filterBatchEligible(article, open);
      setIncludedIds(new Set(eligible.map((s) => s.id)));
      setState({ status: 'loaded', article, eligible });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [articleId, hasSession, isConfigured, port, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const model = useMemo(
    () =>
      state.status === 'loaded'
        ? buildBatchModel({ article: state.article, eligible: state.eligible, includedIds })
        : null,
    [includedIds, state],
  );

  const toggle = useCallback((id: string) => {
    setError(null);
    setIncludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const onAccept = useCallback(async () => {
    if (state.status !== 'loaded' || !model || !port || !identity) return;
    if (!(await ensureTermsAccepted())) return;
    setBusy(true);
    setError(null);
    const result = await acceptBatch({
      suggestions: model.included,
      article: state.article,
      identity,
      port,
      nowIso: new Date().toISOString(),
    });
    setBusy(false);
    if (result.ok) {
      setSuccess(`Published revision ${result.rev}. Every included copyedit is credited.`);
      void load();
    } else {
      const copy = deskErrorMessage(result.code, result.detail);
      setError({ message: copy.message, refresh: copy.action === 'refresh' });
    }
  }, [ensureTermsAccepted, identity, load, model, port, state]);

  if (state.status === 'loading') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Batch copyedits" />
        <LoadingView />
      </View>
    );
  }
  if (state.status === 'not-configured') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Batch copyedits" />
        <MessageView
          title="Not connected to a MyNews server yet"
          body={reason ?? 'Review lives on the server.'}
        />
      </View>
    );
  }
  if (state.status === 'not-found') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Batch copyedits" />
        <MessageView
          title="Article not found"
          body="This article is not available, or the link is out of date."
        />
      </View>
    );
  }
  if (state.status === 'error') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Batch copyedits" />
        <MessageView title="Could not load the batch" body={state.message} />
      </View>
    );
  }

  const { article, eligible } = state;
  const isAuthor = identity !== null && identity.pubkeyHex === article.authorPubkey;

  if (!isAuthor) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Batch copyedits" />
        <MessageView
          title="Author-only review"
          body="Only the article's author can accept suggestions. This device does not hold that author key."
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Batch copyedits" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headline} numberOfLines={2}>
          {article.headline}
        </Text>
        <Text style={styles.metaLine}>
          Open copyedits against rev {article.rev} · current text only
        </Text>

        {success ? <Text style={styles.success}>{success}</Text> : null}

        {eligible.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardBody}>
              No open copyedits target the current revision. Suggestions written against older
              text appear on their own pages once refreshed.
            </Text>
          </View>
        ) : model ? (
          <>
            {eligible.map((s) => {
              const included = includedIds.has(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => toggle(s.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: included }}
                  style={({ pressed }) => [
                    styles.card,
                    styles.suggestionRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.checkbox, included && styles.checkboxOn]}>
                    {included ? (
                      // Decorative: the checked state is announced by the
                      // Pressable role and state, so the glyph does not scale
                      // (it would clip out of its fixed box).
                      <Text style={styles.checkboxMark} allowFontScaling={false}>
                        ✓
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowEditor}>
                      @{s.editorHandle} · {s.editorDisplayName}
                    </Text>
                    <Text style={styles.cardBody} numberOfLines={2}>
                      {suggestionPreviewLine(s)}
                    </Text>
                    <Text style={styles.cardMeta}>{included ? 'Included' : 'Excluded'}</Text>
                  </View>
                </Pressable>
              );
            })}

            {model.conflicts.length > 0 ? (
              <View style={[styles.card, styles.conflictCard]}>
                <Text style={styles.conflictTitle}>
                  These two touch the same paragraph. Keep one.
                </Text>
                {model.conflicts.map((conflict, index) => {
                  const [a, b] = conflict.suggestionIds;
                  const nameOf = (id: string) =>
                    eligible.find((s) => s.id === id)?.editorHandle ?? id;
                  return (
                    <Text key={index} style={styles.cardBody}>
                      Paragraph {conflict.baseIndex + 1}: @{nameOf(a)} and @{nameOf(b)} both edit
                      it. Exclude one to continue.
                    </Text>
                  );
                })}
              </View>
            ) : null}

            {model.previewBody !== null ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Combined preview</Text>
                <Text style={styles.previewText}>{model.previewBody}</Text>
              </View>
            ) : null}

            {error ? <ErrorText style={styles.error}>{error.message}</ErrorText> : null}
            {error?.refresh ? <SecondaryButton label="Refresh" onPress={() => void load()} /> : null}

            <PrimaryButton
              label={model.acceptLabel}
              onPress={() => void onAccept()}
              disabled={!model.canAccept}
              loading={busy}
            />
            <Text style={styles.creditsLine}>{model.creditsLine}</Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.bg,
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
  card: {
    backgroundColor: tokens.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 16,
    gap: 8,
  },
  suggestionRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  pressed: {
    opacity: 0.85,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: {
    backgroundColor: tokens.accent,
    borderColor: tokens.accent,
  },
  checkboxMark: {
    color: tokens.bg,
    fontSize: 14,
    fontWeight: '800',
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowEditor: {
    color: tokens.accent,
    fontSize: 13,
    fontWeight: '700',
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
    fontSize: 12,
  },
  conflictCard: {
    borderColor: tokens.danger,
  },
  conflictTitle: {
    color: tokens.danger,
    fontSize: 14,
    fontWeight: '800',
  },
  previewText: {
    color: tokens.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  creditsLine: {
    color: tokens.textTertiary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
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
