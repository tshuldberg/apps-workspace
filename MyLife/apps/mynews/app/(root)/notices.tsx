import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ModerationNoticeView } from '@mylife/mynews';
import { tokens } from './theme/tokens';
import { ErrorText } from './components/ErrorText';
import { useMyNewsAuth } from './providers/AuthProvider';
import { useMyNewsCloud } from './providers/CloudProvider';
import { relativeTime } from './lib/format';

/**
 * DSA Art 17 statement-of-reasons screen, plus the Art 20 appeal route
 * (plan 48 WP9). Lists moderation actions taken against the signed-in user's OWN
 * content (scoped server-side by the mynews-my-notices edge function) and lets
 * them contest each one once.
 *
 * Honest states throughout: not-connected, signed-out, loading, error, an explicit
 * "no actions" empty state, and per-notice appeal state. A notice with no action
 * id predates the appeal path and says so, rather than showing a button that would
 * fail.
 */
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; notices: ModerationNoticeView[] }
  | { status: 'error'; message: string };

const REASON_LABELS: Record<string, string> = {
  hide_article: 'Article removed',
  hide_suggestion: 'Suggestion removed',
  suspend_profile: 'Account suspended',
  screening_hold: 'Held before publication',
};

function reasonLabel(machineReason: string): string {
  return REASON_LABELS[machineReason] ?? machineReason;
}

/** What the appeal, if any, currently says. Null when none was filed. */
function appealCopy(notice: ModerationNoticeView): string | null {
  switch (notice.appealState) {
    case 'requested':
      return 'Your appeal is in the review queue.';
    case 'granted':
      return notice.appealDecisionReason
        ? `Your appeal was granted. ${notice.appealDecisionReason}`
        : 'Your appeal was granted.';
    case 'denied':
      return notice.appealDecisionReason
        ? `Your appeal was denied. ${notice.appealDecisionReason}`
        : 'Your appeal was denied.';
    default:
      return null;
  }
}

/**
 * What a granted appeal actually changed. A granted appeal that could not restore
 * the content says so, because "granted" on its own would imply it came back.
 */
function reversalCopy(notice: ModerationNoticeView): string | null {
  if (notice.appealState !== 'granted') return null;
  switch (notice.appealReversalOutcome) {
    case 'article-republished':
      return 'The article is published again.';
    case 'suggestion-reopened':
      return 'The suggestion is open again.';
    case 'suspension-lifted':
      return 'The suspension has been lifted.';
    case 'article-unchanged':
    case 'suggestion-unchanged':
    case 'suspension-unchanged':
      return 'The action had already been undone, so nothing changed.';
    case 'no-automatic-reversal':
      return 'A reviewer has to undo this one by hand.';
    default:
      return null;
  }
}

export default function NoticesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const auth = useMyNewsAuth();
  const { isConfigured, port, reason } = useMyNewsCloud();
  const [state, setState] = useState<State>({ status: 'idle' });
  const [openAppeal, setOpenAppeal] = useState<string | null>(null);
  const [appealText, setAppealText] = useState('');
  const [appealBusy, setAppealBusy] = useState(false);
  const [appealError, setAppealError] = useState<string | null>(null);

  const hasSession = auth.status === 'anonymous' || auth.status === 'linked';

  const load = useCallback(async () => {
    if (!port || !hasSession) {
      setState({ status: 'idle' });
      return;
    }
    setState((prev) => (prev.status === 'loaded' ? prev : { status: 'loading' }));
    try {
      setState({ status: 'loaded', notices: await port.getMyModerationNotices() });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [hasSession, port]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const submitAppeal = useCallback(
    async (actionId: string) => {
      if (!port) return;
      const reasonText = appealText.trim();
      if (reasonText.length === 0) {
        setAppealError('Tell us why you think this was a mistake.');
        return;
      }
      setAppealBusy(true);
      setAppealError(null);
      const result = await port.appealModerationNotice({ actionId, reason: reasonText });
      setAppealBusy(false);
      if (!result.ok) {
        setAppealError(
          result.error === 'already-appealed'
            ? 'You have already appealed this one.'
            : result.error === 'not-found'
              ? 'That action could not be found.'
              : result.error === 'not-appealable'
                ? 'There is nothing to appeal on that record.'
                : 'Could not send the appeal. Please try again.',
        );
        return;
      }
      setOpenAppeal(null);
      setAppealText('');
      await load();
    },
    [appealText, load, port],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.title}>Notices</Text>
      <Text style={styles.body}>
        When MyNews removes or restricts your content, the reason appears here, and you can appeal it
        once. You only ever see statements about your own content.
      </Text>

      {!isConfigured ? (
        <Empty text={reason ?? 'Not connected to a MyNews server yet.'} />
      ) : !hasSession ? (
        <Empty text="Sign in to see any notices about your content." />
      ) : state.status === 'loading' || state.status === 'idle' ? (
        <Empty text="Loading your notices..." />
      ) : state.status === 'error' ? (
        <Empty text="Could not load your notices. Pull back and try again." />
      ) : state.notices.length === 0 ? (
        <Empty text="No actions have been taken against your content." />
      ) : (
        <View style={styles.list}>
          {state.notices.map((n) => {
            const appeal = appealCopy(n);
            const reversal = reversalCopy(n);
            const actionId = n.actionId;
            const canAppeal = actionId !== null && n.appealState === 'none';
            return (
              <View
                key={actionId ?? `${n.targetKind}-${n.targetId}-${n.createdAt}`}
                style={styles.card}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{reasonLabel(n.machineReason)}</Text>
                  <Text style={styles.cardTime}>{relativeTime(n.createdAt)}</Text>
                </View>
                <Text style={styles.cardMeta}>
                  {n.targetKind} · {n.targetId}
                </Text>
                {n.note.trim().length > 0 ? (
                  <Text style={styles.cardNote}>{n.note}</Text>
                ) : (
                  <Text style={styles.cardNoteMuted}>No additional detail was recorded.</Text>
                )}

                {appeal ? <Text style={styles.cardNoteMuted}>{appeal}</Text> : null}
                {reversal ? <Text style={styles.cardNoteMuted}>{reversal}</Text> : null}

                {canAppeal && actionId !== null ? (
                  openAppeal === actionId ? (
                    <View style={styles.appealBox}>
                      <TextInput
                        accessibilityLabel="Why this action was a mistake"
                        style={styles.input}
                        value={appealText}
                        onChangeText={setAppealText}
                        placeholder="Why do you think this was a mistake?"
                        placeholderTextColor={tokens.textTertiary}
                        multiline
                        editable={!appealBusy}
                      />
                      {appealError ? (
                        <ErrorText style={styles.error}>{appealError}</ErrorText>
                      ) : null}
                      <View style={styles.appealActions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ disabled: appealBusy }}
                          disabled={appealBusy}
                          onPress={() => void submitAppeal(actionId)}
                        >
                          <Text style={styles.counterLink}>
                            {appealBusy ? 'Sending...' : 'Send appeal'}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ disabled: appealBusy }}
                          disabled={appealBusy}
                          onPress={() => {
                            setOpenAppeal(null);
                            setAppealError(null);
                          }}
                        >
                          <Text style={styles.linkMuted}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setOpenAppeal(actionId);
                        setAppealText('');
                        setAppealError(null);
                      }}
                    >
                      <Text style={styles.counterLink}>Appeal this decision</Text>
                    </Pressable>
                  )
                ) : actionId === null ? (
                  <Text style={styles.cardNoteMuted}>
                    This action predates our appeals system, so it cannot be appealed here. Contact
                    us from the Legal screen instead.
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.counterCard}>
        <Text style={styles.counterTitle}>Removed for copyright?</Text>
        <Text style={styles.emptyText}>
          If content of yours was removed after a DMCA notice and you believe that was a mistake, a
          formal counter-notice is a different and stronger route than an appeal.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(root)/legal/dmca-counter' as never)}
        >
          <Text style={styles.counterLink}>Submit a counter-notice</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>
        An appeal is read by a moderator other than the one who took the action. If you would rather
        write to us, the Legal screen has our contact route.
      </Text>
    </ScrollView>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 20, paddingBottom: 48, gap: 12 },
  title: { color: tokens.text, fontSize: 28, fontWeight: '800' },
  body: { color: tokens.textSecondary, fontSize: 14, lineHeight: 21 },
  list: { gap: 12, marginTop: 4 },
  card: {
    backgroundColor: tokens.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 16,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: tokens.text, fontSize: 16, fontWeight: '700' },
  cardTime: { color: tokens.textTertiary, fontSize: 12 },
  cardMeta: { color: tokens.textTertiary, fontSize: 12 },
  cardNote: { color: tokens.textSecondary, fontSize: 14, lineHeight: 20 },
  cardNoteMuted: { color: tokens.textTertiary, fontSize: 13, fontStyle: 'italic' },
  appealBox: { gap: 8, marginTop: 4 },
  appealActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  input: {
    backgroundColor: tokens.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    color: tokens.text,
    fontSize: 14,
    minHeight: 72,
    padding: 12,
    textAlignVertical: 'top',
  },
  error: { color: tokens.danger, fontSize: 13 },
  linkMuted: { color: tokens.textTertiary, fontSize: 14, fontWeight: '600' },
  emptyCard: {
    backgroundColor: tokens.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 20,
    marginTop: 4,
  },
  emptyText: { color: tokens.textSecondary, fontSize: 14, lineHeight: 21 },
  counterCard: {
    backgroundColor: tokens.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 16,
    marginTop: 4,
    gap: 8,
  },
  counterTitle: { color: tokens.text, fontSize: 15, fontWeight: '700' },
  counterLink: { color: tokens.accent, fontSize: 14, fontWeight: '700' },
  footer: { color: tokens.textTertiary, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
