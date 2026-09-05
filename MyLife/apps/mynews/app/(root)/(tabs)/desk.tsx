import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import {
  listDrafts,
  type Draft,
  type ProfileView,
  type SuggestionView,
} from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { useMyNewsAuth } from '../providers/AuthProvider';
import { useMyNewsCloud } from '../providers/CloudProvider';
import { useMyNewsDb } from '../providers/DatabaseProvider';
import { PrimaryButton } from '../components/Buttons';
import { relativeTime } from '../lib/format';
import {
  TYPE_LABEL,
  getDeskRole,
  levelProgress,
  loadEditorDesk,
  loadJournalistQueue,
  setDeskRole,
  suggestionPreviewLine,
  type DeskRole,
  type EditorDeskModel,
  type JournalistQueueModel,
} from '../lib/desk';
import { ErrorText } from '../components/ErrorText';

type CloudSectionState<T> =
  | { status: 'unconfigured' }
  | { status: 'signed-out' }
  | { status: 'loading' }
  | { status: 'no-profile' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; profile: ProfileView; model: T };

export default function DeskScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useMyNewsDb();
  const auth = useMyNewsAuth();
  const { isConfigured, port, reason } = useMyNewsCloud();

  const [role, setRole] = useState<DeskRole>(() => getDeskRole(db));
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editorState, setEditorState] = useState<CloudSectionState<EditorDeskModel>>({
    status: 'loading',
  });
  const [queueState, setQueueState] = useState<CloudSectionState<JournalistQueueModel>>({
    status: 'loading',
  });

  const hasSession = auth.status === 'anonymous' || auth.status === 'linked';

  const loadCloud = useCallback(
    async (activeRole: DeskRole) => {
      const set = activeRole === 'editor' ? setEditorState : setQueueState;
      if (!isConfigured || !port) {
        set({ status: 'unconfigured' });
        return;
      }
      if (!hasSession) {
        set({ status: 'signed-out' });
        return;
      }
      set({ status: 'loading' });
      try {
        const profile = await port.getMyProfile();
        if (!profile) {
          set({ status: 'no-profile' });
          return;
        }
        if (activeRole === 'editor') {
          const model = await loadEditorDesk({ port, profile, nowMs: Date.now() });
          setEditorState({ status: 'loaded', profile, model });
        } else {
          const blocks = await port.listBlocks().catch(() => []);
          const model = await loadJournalistQueue({
            port,
            profileId: profile.id,
            nowMs: Date.now(),
            blocks,
          });
          setQueueState({ status: 'loaded', profile, model });
        }
      } catch (error) {
        set({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [hasSession, isConfigured, port],
  );

  useFocusEffect(
    useCallback(() => {
      setDrafts(listDrafts(db));
      void loadCloud(role);
    }, [db, loadCloud, role]),
  );

  // The focus effect below re-runs when `role` changes, reloading the view.
  const switchRole = useCallback(
    (next: DeskRole) => {
      if (next === role) return;
      setRole(next);
      setDeskRole(db, next);
    },
    [db, role],
  );

  const openSuggestion = useCallback(
    (s: SuggestionView) => router.push(`/(root)/suggestion/${encodeURIComponent(s.id)}`),
    [router],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Desk</Text>
        {role === 'journalist' ? (
          <Pressable
            onPress={() => router.push('/(root)/compose?id=new')}
            style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="New draft"
          >
            <Plus color={tokens.bg} size={18} />
            <Text style={styles.newLabel}>New draft</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Role segmented control */}
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {(
            [
              ['editor', 'As editor'],
              ['journalist', 'As journalist'],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => switchRole(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: role === value }}
              style={[styles.segmentOption, role === value && styles.segmentOptionActive]}
            >
              <Text style={[styles.segmentText, role === value && styles.segmentTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {role === 'editor' ? (
          <EditorView
            state={editorState}
            reason={reason}
            onRetry={() => void loadCloud('editor')}
            onRegister={() => router.push('/(root)/register')}
            onOpenSuggestion={openSuggestion}
            onOpenCredibility={(handle) => router.push(`/(root)/credibility/${handle}`)}
          />
        ) : (
          <JournalistView
            drafts={drafts}
            state={queueState}
            reason={reason}
            onRetry={() => void loadCloud('journalist')}
            onRegister={() => router.push('/(root)/register')}
            onOpenDraft={(id) => router.push(`/(root)/compose?id=${encodeURIComponent(id)}`)}
            onOpenSuggestion={openSuggestion}
            onOpenBatch={(articleId, slug) =>
              router.push(
                `/(root)/review-batch/${encodeURIComponent(articleId)}?slug=${encodeURIComponent(slug)}`,
              )
            }
            onOpenNewsrooms={() => router.push('/(root)/newsrooms')}
          />
        )}
      </ScrollView>
    </View>
  );
}

function SectionNotice({
  status,
  reason,
  message,
  onRetry,
  onRegister,
}: {
  status: Exclude<CloudSectionState<unknown>['status'], 'loaded'>;
  reason: string | null;
  message?: string;
  onRetry: () => void;
  onRegister: () => void;
}) {
  switch (status) {
    case 'unconfigured':
      return (
        <View style={styles.card}>
          <Text style={styles.cardBody}>
            {reason ?? 'Not connected to a MyNews server yet.'} Suggestions and review live on the
            server; nothing here is simulated.
          </Text>
        </View>
      );
    case 'signed-out':
      return (
        <View style={styles.card}>
          <Text style={styles.cardBody}>
            You are reading anonymously. Create an account from the Me tab to see your suggestions
            and review queue.
          </Text>
        </View>
      );
    case 'loading':
      return (
        <View style={styles.card}>
          <Text style={styles.cardMeta}>Loading...</Text>
        </View>
      );
    case 'no-profile':
      return (
        <View style={styles.card}>
          <Text style={styles.cardBody}>
            You need a public profile to do this. Register a handle to continue.
          </Text>
          <PrimaryButton label="Register to publish or suggest" onPress={onRegister} />
        </View>
      );
    case 'error':
      return (
        <View style={styles.card}>
          <ErrorText style={styles.error}>{message ?? 'Something went wrong.'}</ErrorText>
          <Pressable onPress={onRetry} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      );
  }
}

function EditorView({
  state,
  reason,
  onRetry,
  onRegister,
  onOpenSuggestion,
  onOpenCredibility,
}: {
  state: CloudSectionState<EditorDeskModel>;
  reason: string | null;
  onRetry: () => void;
  onRegister: () => void;
  onOpenSuggestion: (s: SuggestionView) => void;
  onOpenCredibility: (handle: string) => void;
}) {
  if (state.status !== 'loaded') {
    return (
      <SectionNotice
        status={state.status}
        reason={reason}
        message={state.status === 'error' ? state.message : undefined}
        onRetry={onRetry}
        onRegister={onRegister}
      />
    );
  }
  const { model, profile } = state;
  const progress = model.credibility ? levelProgress(model.credibility) : null;
  return (
    <>
      <Text style={styles.subtitle}>{model.subtitle}</Text>

      {model.credibility ? (
        <Pressable
          onPress={() => onOpenCredibility(profile.handle)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <View style={styles.rowBetween}>
            <Text style={styles.levelName}>{model.credibility.levelName}</Text>
            <ChevronRight color={tokens.textTertiary} size={18} />
          </View>
          <Text style={styles.levelPts}>{model.credibility.total.toFixed(1)} weighted pts</Text>
          {progress ? (
            <>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress.ratio * 100)}%` }]} />
              </View>
              <Text style={styles.cardMeta}>{progress.label}</Text>
            </>
          ) : null}
        </Pressable>
      ) : null}

      {model.rows.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No suggestions yet</Text>
          <Text style={styles.cardBody}>
            Open any article and tap Suggest edit to propose a fix. Your suggestions and their
            outcomes land here.
          </Text>
        </View>
      ) : (
        model.rows.map((row) => (
          <Pressable
            key={row.suggestion.id}
            onPress={() => onOpenSuggestion(row.suggestion)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Text style={styles.rowHeadline} numberOfLines={1}>
              {row.suggestion.articleHeadline}
            </Text>
            <Text style={styles.rowMeta}>
              {TYPE_LABEL[row.suggestion.type]} · {relativeTime(row.suggestion.createdAt)}
            </Text>
            <Text
              style={[
                styles.chip,
                row.suggestion.status === 'open' && styles.chipOpen,
                (row.suggestion.status === 'accepted' || row.suggestion.status === 'partial') &&
                  styles.chipAccepted,
                row.suggestion.status === 'rejected' && styles.chipRejected,
              ]}
            >
              {row.chip}
            </Text>
            {row.detail ? <Text style={styles.cardMeta}>{row.detail}</Text> : null}
          </Pressable>
        ))
      )}
    </>
  );
}

function JournalistView({
  drafts,
  state,
  reason,
  onRetry,
  onRegister,
  onOpenDraft,
  onOpenSuggestion,
  onOpenBatch,
  onOpenNewsrooms,
}: {
  drafts: Draft[];
  state: CloudSectionState<JournalistQueueModel>;
  reason: string | null;
  onRetry: () => void;
  onRegister: () => void;
  onOpenDraft: (id: string) => void;
  onOpenSuggestion: (s: SuggestionView) => void;
  onOpenBatch: (articleId: string, slug: string) => void;
  onOpenNewsrooms: () => void;
}) {
  return (
    <>
      {/* Drafts (local, works offline) */}
      <Text style={styles.sectionTitle}>Drafts</Text>
      {drafts.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardBody}>
            No drafts yet. Start a draft to write, sign, and publish an article under your own
            byline. Drafts stay on this device until you publish.
          </Text>
        </View>
      ) : (
        drafts.map((draft) => (
          <Pressable
            key={draft.id}
            onPress={() => onOpenDraft(draft.id)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Text style={styles.rowHeadline} numberOfLines={1}>
              {draft.headline?.trim() || 'Untitled draft'}
            </Text>
            <Text style={styles.rowMeta}>
              {draft.kind === 'preprint' ? 'Preprint' : 'News'} · Edited{' '}
              {relativeTime(draft.updatedAt)}
            </Text>
          </Pressable>
        ))
      )}

      {/* Newsrooms entry (C8.8) */}
      <Pressable
        onPress={onOpenNewsrooms}
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.rowBetween}>
          <Text style={styles.rowHeadline}>Newsrooms</Text>
          <ChevronRight color={tokens.textTertiary} size={18} />
        </View>
        <Text style={styles.cardMeta}>
          Shared draft rooms with coauthors, reviewers, and embargo labels.
        </Text>
      </Pressable>

      {/* Review queue */}
      <Text style={styles.sectionTitle}>Review queue</Text>
      {state.status !== 'loaded' ? (
        <SectionNotice
          status={state.status}
          reason={reason}
          message={state.status === 'error' ? state.message : undefined}
          onRetry={onRetry}
          onRegister={onRegister}
        />
      ) : (
        <>
          <Text style={styles.subtitle}>{state.model.queue.subtitle}</Text>
          {state.model.queue.openCount === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardBody}>No open suggestions on your articles.</Text>
            </View>
          ) : (
            <>
              {state.model.queue.singles.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => onOpenSuggestion(s)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.rowType}>
                      {TYPE_LABEL[s.type]} · rev {s.baseRev}
                    </Text>
                    <Text style={styles.editorChip}>
                      @{s.editorHandle} ·{' '}
                      {state.model.editorLevels.get(s.editorHandle) ?? 'Reader'}
                    </Text>
                  </View>
                  <Text style={styles.rowHeadline} numberOfLines={1}>
                    {s.articleHeadline}
                  </Text>
                  <Text style={styles.cardBody} numberOfLines={1}>
                    {suggestionPreviewLine(s)}
                  </Text>
                </Pressable>
              ))}
              {state.model.queue.batches.map((batch) => (
                <Pressable
                  key={batch.articleId}
                  onPress={() => onOpenBatch(batch.articleId, batch.articleSlug)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.rowType}>
                      Copyedits × {batch.suggestions.length}{' '}
                      <Text style={styles.batchTag}>[batch]</Text>
                    </Text>
                    <ChevronRight color={tokens.textTertiary} size={18} />
                  </View>
                  <Text style={styles.rowHeadline} numberOfLines={1}>
                    {batch.articleHeadline}
                  </Text>
                  <Text style={styles.cardMeta}>Tap to review all.</Text>
                </Pressable>
              ))}
            </>
          )}
          <View style={styles.card}>
            <Text style={styles.cardBody}>
              Nothing merges without you. Every acceptance creates a new revision signed with your
              key.
            </Text>
          </View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.bg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    color: tokens.text,
    fontSize: 30,
    fontWeight: '800',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.accent,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  newLabel: {
    color: tokens.bg,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  segmentWrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: tokens.surface,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segmentOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentOptionActive: {
    backgroundColor: tokens.elevated,
  },
  segmentText: {
    color: tokens.textTertiary,
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: tokens.text,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 10,
  },
  subtitle: {
    color: tokens.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: tokens.text,
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 4,
    marginTop: 6,
  },
  card: {
    backgroundColor: tokens.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    gap: 5,
  },
  cardTitle: {
    color: tokens.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cardBody: {
    color: tokens.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  cardMeta: {
    color: tokens.textTertiary,
    fontSize: 13,
    lineHeight: 19,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowHeadline: {
    color: tokens.text,
    fontSize: 15,
    fontWeight: '700',
  },
  rowMeta: {
    color: tokens.textTertiary,
    fontSize: 13,
  },
  rowType: {
    color: tokens.text,
    fontSize: 14,
    fontWeight: '700',
  },
  batchTag: {
    color: tokens.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  editorChip: {
    color: tokens.accent,
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  chip: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.textSecondary,
  },
  chipOpen: {
    color: tokens.accent,
  },
  chipAccepted: {
    color: tokens.success,
  },
  chipRejected: {
    color: tokens.danger,
  },
  levelName: {
    color: tokens.text,
    fontSize: 17,
    fontWeight: '800',
  },
  levelPts: {
    color: tokens.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: tokens.surface,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: tokens.accent,
  },
  error: {
    color: tokens.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  retryText: {
    color: tokens.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
