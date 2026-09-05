import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScreeningHoldView } from '@mylife/mynews';
import { tokens } from './theme/tokens';
import { useMyNewsAuth } from './providers/AuthProvider';
import { useMyNewsCloud } from './providers/CloudProvider';
import { relativeTime } from './lib/format';
import { ErrorText } from './components/ErrorText';

/**
 * Held submissions screen (plan 48 WP8).
 *
 * When pre-publication screening holds something, the author needs to know three
 * things: that it is not published, why in plain terms, and how to contest it.
 * That is all this screen shows. It deliberately does not show risk scores,
 * matched terms, or thresholds, because the server does not return them: an
 * appeal screen that leaked the detector's internals would be a tuning tool for
 * whoever wanted to get past it.
 *
 * Every state is honest: not connected, signed out, loading, error, empty, and
 * per-item pending / approved / rejected with the reviewer's reason.
 */

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; holds: ScreeningHoldView[] }
  | { status: 'error'; message: string };

const KIND_LABEL: Record<ScreeningHoldView['contentKind'], string> = {
  article: 'Article',
  revision: 'Article revision',
  'revision-proposal': 'Accepted edit',
  suggestion: 'Suggestion',
  comment: 'Comment',
};

const CLASS_LABEL: Record<string, string> = {
  'child-safety': 'child safety',
  'self-harm': 'suicide and self-harm',
  threats: 'threats of violence',
  hate: 'hate speech',
  'doxxing-privacy': 'private information',
  'fraud-scam': 'fraud or scams',
  spam: 'spam',
};

/** Honest per-state copy. Nothing here promises a review timeline. */
function statusCopy(hold: ScreeningHoldView): { title: string; body: string } {
  const cls = hold.topClass ? (CLASS_LABEL[hold.topClass] ?? hold.topClass) : 'our policies';
  if (hold.decision === 'approved') {
    return {
      title: 'Released',
      body:
        hold.contentKind === 'revision-proposal'
          ? `A reviewer cleared this. Submit the same edit again and it will go through.`
          : 'A reviewer cleared this, so it is published now.',
    };
  }
  if (hold.decision === 'rejected') {
    return {
      title: 'Not published',
      body: hold.reviewReason
        ? `A reviewer decided this stays unpublished. Reason: ${hold.reviewReason}`
        : 'A reviewer decided this stays unpublished.',
    };
  }
  return {
    title: 'Waiting for review',
    body: `This is not published. It was flagged for ${cls} and a person will look at it.`,
  };
}

function appealCopy(hold: ScreeningHoldView): string | null {
  switch (hold.appealState) {
    case 'requested':
      return 'Your appeal is in the queue.';
    case 'granted':
      return 'Your appeal was granted.';
    case 'denied':
      return 'Your appeal was denied.';
    default:
      return null;
  }
}

export default function HeldScreen() {
  const insets = useSafeAreaInsets();
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
    const result = await port.listScreeningHolds();
    if (result.ok) setState({ status: 'loaded', holds: result.holds });
    else setState({ status: 'error', message: result.error });
  }, [hasSession, port]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const submitAppeal = useCallback(
    async (decisionId: string) => {
      if (!port) return;
      const reasonText = appealText.trim();
      if (reasonText.length === 0) {
        setAppealError('Tell us why this should be published.');
        return;
      }
      setAppealBusy(true);
      setAppealError(null);
      const result = await port.appealScreeningHold({ decisionId, reason: reasonText });
      setAppealBusy(false);
      if (!result.ok) {
        setAppealError(
          result.error === 'already-appealed'
            ? 'You have already appealed this one.'
            : result.error === 'not-found'
              ? 'That submission could not be found.'
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
      <Text style={styles.title}>Held submissions</Text>
      <Text style={styles.body}>
        Some submissions are held for a person to read before they publish. Anything listed here is
        not public. You can appeal once per item.
      </Text>

      {!isConfigured ? (
        <Empty text={reason ?? 'Not connected to a MyNews server yet.'} />
      ) : !hasSession ? (
        <Empty text="Sign in to see whether anything of yours is held." />
      ) : state.status === 'loading' || state.status === 'idle' ? (
        <Empty text="Loading your held submissions..." />
      ) : state.status === 'error' ? (
        <Empty text="Could not load your held submissions. Pull back and try again." />
      ) : state.holds.length === 0 ? (
        <Empty text="Nothing of yours is held for review." />
      ) : (
        <View style={styles.list}>
          {state.holds.map((hold) => {
            const copy = statusCopy(hold);
            const appeal = appealCopy(hold);
            const canAppeal = hold.appealState === 'none';
            return (
              <View key={hold.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{KIND_LABEL[hold.contentKind]}</Text>
                  <Text style={styles.cardTime}>{relativeTime(hold.createdAt)}</Text>
                </View>
                <Text style={styles.cardStatus}>{copy.title}</Text>
                <Text style={styles.cardNote}>{copy.body}</Text>
                {hold.requiresHumanReview ? (
                  <Text style={styles.cardNoteMuted}>
                    This one is always read by a person, never cleared automatically.
                  </Text>
                ) : null}
                {appeal ? <Text style={styles.cardNoteMuted}>{appeal}</Text> : null}

                {canAppeal ? (
                  openAppeal === hold.id ? (
                    <View style={styles.appealBox}>
                      <TextInput
                        accessibilityLabel="Why this should be published"
                        style={styles.input}
                        value={appealText}
                        onChangeText={setAppealText}
                        placeholder="Why should this be published?"
                        placeholderTextColor={tokens.textTertiary}
                        multiline
                        editable={!appealBusy}
                      />
                      {appealError ? <ErrorText style={styles.error}>{appealError}</ErrorText> : null}
                      <View style={styles.appealActions}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={appealBusy}
                          onPress={() => void submitAppeal(hold.id)}
                        >
                          <Text style={styles.link}>{appealBusy ? 'Sending...' : 'Send appeal'}</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
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
                        setOpenAppeal(hold.id);
                        setAppealText('');
                        setAppealError(null);
                      }}
                    >
                      <Text style={styles.link}>Appeal this</Text>
                    </Pressable>
                  )
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.footer}>
        Screening looks at the words in a submission, not at who wrote it. If you think it got this
        wrong, appealing sends it to a person.
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
  cardStatus: { color: tokens.text, fontSize: 14, fontWeight: '700' },
  cardNote: { color: tokens.textSecondary, fontSize: 14, lineHeight: 20 },
  cardNoteMuted: { color: tokens.textTertiary, fontSize: 13, lineHeight: 19 },
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
  link: { color: tokens.accent, fontSize: 14, fontWeight: '700' },
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
  footer: { color: tokens.textTertiary, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
