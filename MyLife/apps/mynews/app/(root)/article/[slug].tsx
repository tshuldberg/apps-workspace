import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  authorshipBadgeLabel,
  authorshipBadgeTone,
  publishDraft,
  recoveryBranding,
  verifyRevisionAuthorship,
  type ArticleView,
  type AuthorshipVerification,
  type ChainKeyRow,
  type Draft,
  type RevisionSummary,
} from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { useMyNewsAuth } from '../providers/AuthProvider';
import { useMyNewsCloud } from '../providers/CloudProvider';
import { useMyNewsIdentity } from '../providers/IdentityProvider';
import { ScreenHeader } from '../components/ScreenHeader';
import { ReportCard } from '../components/ReportCard';
import { Byline } from '../components/Byline';
import { LoadingView, MessageView } from '../components/StateViews';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { absoluteDate, shortKey } from '../lib/format';
import { publishErrorAction } from '../lib/publish-errors';
import { draftBannerText, draftPublishErrorMessage, resolveDraftNewsroomName } from '../lib/desk';
import { ErrorText } from '../components/ErrorText';

type LoadState =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; article: ArticleView };

function paragraphs(bodyMd: string): string[] {
  return bodyMd
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

/**
 * Verify one revision against the byline's key chain. A revision that carries no
 * signature material at all cannot be checked, and saying 'does not verify' about
 * it would be a lie about a signature nobody can locate, so it reports the
 * honest 'not chain-recorded' caveat instead.
 */
function verifySummary(
  summary: RevisionSummary,
  input: { chain: ChainKeyRow[]; articleId: string; bylineProfileId: string },
): AuthorshipVerification | null {
  if (!summary.signature || !summary.signerPubkey) {
    return { verdict: 'chain-unrecorded', keyRetired: false };
  }
  return verifyRevisionAuthorship({
    revision: {
      articleId: input.articleId,
      rev: summary.rev,
      headline: summary.headline ?? '',
      dek: summary.dek,
      bodyMd: summary.bodyMd ?? '',
      changelog: summary.changelog,
      createdAt: summary.createdAt,
      signerPubkey: summary.signerPubkey,
      signature: summary.signature,
      verifiedKeyId: summary.verifiedKeyId ?? null,
    },
    bylineProfileId: input.bylineProfileId,
    chain: input.chain,
  });
}

function creditLines(summary: RevisionSummary): string[] {
  if (summary.changelog.length === 0) {
    return [summary.rev === 1 ? 'Original publication by the author' : 'Author revision'];
  }
  return summary.changelog.map(
    (entry) => `${entry.type} suggested by ${shortKey(entry.editorKey)}`,
  );
}

export default function ArticleScreen() {
  const { slug, articleId } = useLocalSearchParams<{ slug: string; articleId?: string }>();
  const router = useRouter();
  const auth = useMyNewsAuth();
  const { isConfigured, port } = useMyNewsCloud();
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
      // Newsroom drafts miss the public read; the session-scoped read covers
      // members and the author (C8.8).
      if (!article && typeof articleId === 'string' && articleId.length > 0 && hasSession) {
        article = await port.getDraftArticle(articleId);
      }
      setState(article ? { status: 'loaded', article } : { status: 'not-found' });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }, [articleId, hasSession, isConfigured, port, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Article" />
      {state.status === 'loading' ? (
        <LoadingView />
      ) : state.status === 'not-configured' ? (
        <MessageView
          title="Not connected to a MyNews server yet"
          body="This article cannot be loaded until a MyNews server is configured for this build."
        />
      ) : state.status === 'not-found' ? (
        <MessageView
          title="Article not found"
          body="This article is not published, or the link is out of date."
        />
      ) : state.status === 'error' ? (
        <View style={styles.errorWrap}>
          <MessageView title="Could not load this article" body={state.message} />
          <View style={styles.retry}>
            <SecondaryButton label="Try again" onPress={() => void load()} />
          </View>
        </View>
      ) : (
        <ArticleBody
          article={state.article}
          onReload={() => void load()}
          onPressAuthor={() =>
            router.push(`/(root)/journalist/${encodeURIComponent(state.article.authorHandle)}`)
          }
          onSuggest={() =>
            router.push(
              `/(root)/suggest/${encodeURIComponent(state.article.slug)}?articleId=${encodeURIComponent(state.article.articleId)}`,
            )
          }
        />
      )}
    </View>
  );
}

function ArticleBody({
  article,
  onReload,
  onPressAuthor,
  onSuggest,
}: {
  article: ArticleView;
  onReload: () => void;
  onPressAuthor: () => void;
  onSuggest: () => void;
}) {
  const router = useRouter();
  const { port } = useMyNewsCloud();
  const identity = useMyNewsIdentity();

  const isDraft = article.status === 'draft';
  const isAuthor = identity !== null && identity.pubkeyHex === article.authorPubkey;

  // The byline's public key chain, for reader-side verification. Null while
  // loading; [] when the byline has no chain, which the verifier reports as
  // 'not chain-recorded' rather than as a pass or a failure.
  const [chain, setChain] = useState<ChainKeyRow[] | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);

  const [newsroomName, setNewsroomName] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishAction, setPublishAction] = useState<'register' | 'keys' | null>(null);

  useEffect(() => {
    const bylineProfileId = article.authorProfileId;
    if (!port || !bylineProfileId) {
      // No chain to fetch. Empty rather than null so the badges resolve to the
      // honest caveat instead of spinning forever.
      setChain([]);
      return;
    }
    let mounted = true;
    void (async () => {
      try {
        const rows = await port.getProfileKeyChain(bylineProfileId);
        if (!mounted) return;
        setChain(rows);
        // Only COMPLETED recoveries brand a byline: a request or a cancellation
        // brands nothing, or filing requests would be a way to smear a profile.
        // The chain read does not carry events, so the completed-recovery rows on
        // the chain itself are the signal.
        setRecoveryNotice(
          recoveryBranding(
            rows
              .filter((row) => row.addedVia === 'recovery')
              .map((row) => ({ kind: 'recovery_completed' as const, createdAt: row.validFrom })),
            (iso) => absoluteDate(iso),
          ),
        );
      } catch {
        // Verification is best-effort on the reader side: a failed chain read
        // must not hide the article. Badges fall back to the honest caveat.
        if (mounted) setChain([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [article.authorProfileId, port]);

  useEffect(() => {
    if (!isDraft || !port) return;
    let mounted = true;
    void (async () => {
      try {
        const mine = await port.getMyProfile();
        if (!mine) return;
        const name = await resolveDraftNewsroomName({
          port,
          profileId: mine.id,
          articleId: article.articleId,
        });
        if (mounted) setNewsroomName(name);
      } catch {
        // The banner falls back to plain "Draft"; never fabricated.
      }
    })();
    return () => {
      mounted = false;
    };
  }, [article.articleId, isDraft, port]);

  const onPublish = useCallback(async () => {
    if (!port || !identity) return;
    setPublishing(true);
    setPublishError(null);
    setPublishAction(null);
    // C8.8: publishing the draft ships a fresh signed revision through the
    // C4 draft-to-published path (head content, rev + 1, no draft flag).
    const draft: Draft = {
      id: article.articleId,
      headline: article.headline,
      dek: article.dek ?? null,
      bodyMd: article.bodyMd,
      kind: article.kind,
      updatedAt: new Date().toISOString(),
    };
    const result = await publishDraft({
      draft,
      articleId: article.articleId,
      rev: article.rev + 1,
      changelog: [],
      identity,
      port,
      nowIso: new Date().toISOString(),
      slug: article.slug,
    });
    setPublishing(false);
    if (result.ok) {
      onReload();
    } else {
      setPublishError(draftPublishErrorMessage(result.code, result.detail));
      setPublishAction(publishErrorAction(result.code) ?? null);
    }
  }, [article, identity, onReload, port]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {isDraft ? (
        <View style={styles.draftBanner}>
          <Text style={styles.draftBannerText}>{draftBannerText(newsroomName)}</Text>
        </View>
      ) : null}
      {article.kind === 'preprint' ? <Text style={styles.kindTag}>PREPRINT</Text> : null}
      <Text style={styles.headline}>{article.headline}</Text>
      {article.dek ? <Text style={styles.dek}>{article.dek}</Text> : null}

      <Byline article={article} onPressAuthor={onPressAuthor} />

      <View style={styles.body}>
        {paragraphs(article.bodyMd).map((block, index) => (
          <Text key={index} style={styles.paragraph}>
            {block}
          </Text>
        ))}
      </View>

      {isDraft && isAuthor ? (
        <View style={styles.publishWrap}>
          {publishError ? <ErrorText style={styles.error}>{publishError}</ErrorText> : null}
          {publishError && publishAction === 'register' ? (
            <SecondaryButton
              label="Register to publish"
              onPress={() =>
                router.push(
                  `/(root)/register?returnTo=${encodeURIComponent(
                    `/(root)/article/${article.slug}?articleId=${article.articleId}`,
                  )}`,
                )
              }
            />
          ) : null}
          {publishError && publishAction === 'keys' ? (
            <SecondaryButton
              label="Open Keys and Recovery"
              onPress={() => router.push('/(root)/keys')}
            />
          ) : null}
          <PrimaryButton
            label="Publish"
            onPress={() => void onPublish()}
            loading={publishing}
          />
          <Text style={styles.suggestNote}>
            Publishing signs revision {article.rev + 1} with your device key and takes this draft
            live.
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Revision history</Text>
        <Text style={styles.sectionCaption}>
          Every published version is signed by the author. Editor credits below are recorded on the
          public record.
        </Text>
        {/* Reader-side verification (plan 48 WP6). The corpus claim is that
            MyNews cannot forge authorship, and that claim is only as strong as a
            verifier a reader can actually run. This re-checks each revision's
            signature and binds it to the byline's public key chain, so a caveat
            or a failure is visible rather than taken on trust. */}
        {chain === null ? (
          <Text style={styles.sectionCaption}>Checking signatures...</Text>
        ) : null}
        {recoveryNotice ? <Text style={styles.recoveryNotice}>{recoveryNotice}</Text> : null}
        {[...article.revisionSummaries]
          .sort((a, b) => b.rev - a.rev)
          .map((summary) => {
            const verdict =
              chain === null
                ? null
                : verifySummary(summary, {
                    chain,
                    articleId: article.articleId,
                    bylineProfileId: article.authorProfileId ?? '',
                  });
            return (
              <View key={summary.rev} style={styles.revRow}>
                <Text style={styles.revHead}>
                  Revision {summary.rev}
                  {summary.createdAt ? ` · ${absoluteDate(summary.createdAt)}` : ''}
                </Text>
                {verdict ? (
                  <Text
                    style={[
                      styles.verifyBadge,
                      authorshipBadgeTone(verdict) === 'pass' && styles.verifyPass,
                      authorshipBadgeTone(verdict) === 'caveat' && styles.verifyCaveat,
                      authorshipBadgeTone(verdict) === 'fail' && styles.verifyFail,
                    ]}
                  >
                    {authorshipBadgeLabel(verdict)}
                  </Text>
                ) : null}
                {creditLines(summary).map((line, index) => (
                  <Text key={index} style={styles.revCredit}>
                    {line}
                  </Text>
                ))}
              </View>
            );
          })}
      </View>

      <View style={styles.suggestWrap}>
        <SecondaryButton label="Suggest edit" onPress={onSuggest} />
        <Text style={styles.suggestNote}>
          Suggestions are typed and cited; only {article.authorDisplayName} can apply them.
        </Text>
      </View>

      <ReportCard targetKind="article" targetId={article.articleId} label="Report this article" />
    </ScrollView>
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
  draftBanner: {
    backgroundColor: tokens.accentDim,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  draftBannerText: {
    color: tokens.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  kindTag: {
    color: tokens.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  headline: {
    color: tokens.text,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  dek: {
    color: tokens.textSecondary,
    fontSize: 16,
    lineHeight: 23,
  },
  body: {
    gap: 16,
    marginTop: 4,
  },
  paragraph: {
    color: tokens.text,
    fontSize: 16,
    lineHeight: 25,
  },
  section: {
    marginTop: 12,
    paddingTop: 16,
    borderTopColor: tokens.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  sectionTitle: {
    color: tokens.text,
    fontSize: 17,
    fontWeight: '700',
  },
  sectionCaption: {
    color: tokens.textTertiary,
    fontSize: 13,
    lineHeight: 19,
  },
  revRow: {
    backgroundColor: tokens.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    gap: 3,
  },
  revHead: {
    color: tokens.text,
    fontSize: 14,
    fontWeight: '700',
  },
  revCredit: {
    color: tokens.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  publishWrap: {
    marginTop: 4,
    gap: 8,
  },
  suggestWrap: {
    marginTop: 16,
    gap: 8,
  },
  suggestNote: {
    color: tokens.textTertiary,
    fontSize: 13,
    textAlign: 'center',
  },
  error: {
    color: tokens.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  errorWrap: {
    flex: 1,
  },
  verifyBadge: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  verifyPass: {
    color: tokens.success,
  },
  verifyCaveat: {
    color: tokens.textTertiary,
  },
  verifyFail: {
    color: tokens.danger,
  },
  recoveryNotice: {
    color: tokens.textTertiary,
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  retry: {
    paddingHorizontal: 40,
    paddingBottom: 24,
  },
});
