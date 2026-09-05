import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { VerificationMethodView, VerificationRecordView, VerificationStateView } from '@mylife/mynews';
import { tokens } from './theme/tokens';
import { useMyNewsAuth } from './providers/AuthProvider';
import { useMyNewsCloud } from './providers/CloudProvider';
import { relativeTime } from './lib/format';
import { ErrorText } from './components/ErrorText';

/**
 * Journalist verification screen (plan 48 WP8).
 *
 * Honest by construction: this screen requests a verification and reports its
 * state. It never says a request will be reviewed within any period, because
 * review is staffed by people and staffing is not something the app can promise.
 * Approval, denial, revocation, and expiry all happen in the operator console;
 * the badge follows the verification record, so nothing here can grant one.
 */

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; state: VerificationStateView; history: VerificationRecordView[] }
  | { status: 'error'; message: string };

const METHODS: Array<{ value: VerificationMethodView; label: string; hint: string }> = [
  {
    value: 'domain_email',
    label: 'Newsroom email',
    hint: 'An email address on the domain of the outlet you write for.',
  },
  {
    value: 'orcid',
    label: 'ORCID',
    hint: 'Your ORCID identifier, for researchers and academic authors.',
  },
  {
    value: 'byline',
    label: 'Published byline',
    hint: 'A link to published work carrying your byline.',
  },
  {
    value: 'manual',
    label: 'Something else',
    hint: 'Anything else a reviewer can check. Explain it in the evidence field.',
  },
];

const STATE_COPY: Record<VerificationStateView, { title: string; body: string }> = {
  none: {
    title: 'Not verified',
    body: 'Verification is optional. It tells readers a person checked who you are.',
  },
  pending: {
    title: 'In review',
    body: 'Your request is in the queue. You will see the decision here.',
  },
  approved: {
    title: 'Verified',
    body: 'Your profile carries a verified badge. Verification expires and can be renewed.',
  },
  rejected: {
    title: 'Not approved',
    body: 'A reviewer could not confirm your evidence. You can submit a new request.',
  },
  revoked: {
    title: 'Revoked',
    body: 'A reviewer removed your verification. The reason is below.',
  },
  expired: {
    title: 'Expired',
    body: 'Your verification lapsed. Submit a new request to renew it.',
  },
};

const ERROR_COPY: Record<string, string> = {
  'not-signed-in': 'Sign in to request verification.',
  'no-profile': 'Finish setting up your profile first.',
  'no-journalist': 'Set up a journalist profile before requesting verification.',
  suspended: 'Verification is unavailable while your account is suspended.',
  'terms-not-accepted': 'Accept the current terms first.',
  'rate-limited': 'You have sent several requests recently. Try again tomorrow.',
  'already-pending': 'You already have a request in review.',
  'already-verified': 'Your profile is already verified.',
  'bad-payload': 'That request needs a method and some evidence.',
  'verification-unavailable': 'Verification is temporarily unavailable. Try again shortly.',
};

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const auth = useMyNewsAuth();
  const { isConfigured, port, reason } = useMyNewsCloud();
  const [state, setState] = useState<State>({ status: 'idle' });
  const [method, setMethod] = useState<VerificationMethodView>('domain_email');
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const hasSession = auth.status === 'anonymous' || auth.status === 'linked';

  const load = useCallback(async () => {
    if (!port || !hasSession) {
      setState({ status: 'idle' });
      return;
    }
    setState((prev) => (prev.status === 'loaded' ? prev : { status: 'loading' }));
    const result = await port.getVerificationStatus();
    if (result.ok) setState({ status: 'loaded', state: result.state, history: result.history });
    else setState({ status: 'error', message: result.error });
  }, [hasSession, port]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const canRequest = useMemo(() => {
    if (state.status !== 'loaded') return false;
    return state.state !== 'pending' && state.state !== 'approved';
  }, [state]);

  const submit = useCallback(async () => {
    if (!port) return;
    const evidenceRef = evidence.trim();
    if (evidenceRef.length === 0) {
      setError('Add a link or an identifier a reviewer can check.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await port.requestVerification({ method, evidenceRef, evidence: [] });
    setBusy(false);
    if (!result.ok) {
      setError(ERROR_COPY[result.error] ?? 'Could not send the request. Please try again.');
      return;
    }
    setSent(true);
    setEvidence('');
    await load();
  }, [evidence, load, method, port]);

  const current = state.status === 'loaded' ? STATE_COPY[state.state] : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.title}>Verification</Text>
      <Text style={styles.body}>
        A verified badge means a person checked evidence that you are who you say you are. It is not
        an endorsement of your reporting, and it does not change how your work is ranked.
      </Text>

      {!isConfigured ? (
        <Empty text={reason ?? 'Not connected to a MyNews server yet.'} />
      ) : !hasSession ? (
        <Empty text="Sign in to request verification." />
      ) : state.status === 'loading' || state.status === 'idle' ? (
        <Empty text="Loading your verification status..." />
      ) : state.status === 'error' ? (
        <Empty text="Could not load your verification status. Pull back and try again." />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{current!.title}</Text>
            <Text style={styles.cardNote}>{current!.body}</Text>
            {state.history[0]?.expiresAt && state.state === 'approved' ? (
              <Text style={styles.cardNoteMuted}>
                Expires {new Date(state.history[0].expiresAt).toLocaleDateString()}
              </Text>
            ) : null}
            {state.history[0]?.decisionReason ? (
              <Text style={styles.cardNoteMuted}>Reviewer note: {state.history[0].decisionReason}</Text>
            ) : null}
          </View>

          {canRequest ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Request verification</Text>
              {METHODS.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: method === option.value }}
                  onPress={() => setMethod(option.value)}
                  style={[styles.option, method === option.value && styles.optionSelected]}
                >
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionHint}>{option.hint}</Text>
                </Pressable>
              ))}
              <TextInput
                accessibilityLabel="Evidence link or identifier"
                style={styles.input}
                value={evidence}
                onChangeText={setEvidence}
                placeholder="Link or identifier a reviewer can check"
                placeholderTextColor={tokens.textTertiary}
                autoCapitalize="none"
                editable={!busy}
              />
              {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}
              {sent ? (
                <Text style={styles.cardNoteMuted}>
                  Request sent. It is in the review queue.
                </Text>
              ) : null}
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit()}>
                <Text style={styles.link}>{busy ? 'Sending...' : 'Send request'}</Text>
              </Pressable>
              <Text style={styles.cardNoteMuted}>
                Evidence is visible only to reviewers. Your profile shows the outcome and the expiry,
                never what you sent.
              </Text>
            </View>
          ) : null}

          {state.history.length > 0 ? (
            <View style={styles.list}>
              <Text style={styles.sectionTitle}>History</Text>
              {state.history.map((row) => (
                <View key={row.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{STATE_COPY[row.status].title}</Text>
                    <Text style={styles.cardTime}>{relativeTime(row.createdAt)}</Text>
                  </View>
                  <Text style={styles.cardNoteMuted}>
                    {METHODS.find((option) => option.value === row.method)?.label ?? row.method}
                  </Text>
                  {row.decisionReason ? (
                    <Text style={styles.cardNote}>{row.decisionReason}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
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
  sectionTitle: { color: tokens.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  list: { gap: 12 },
  card: {
    backgroundColor: tokens.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 16,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: tokens.text, fontSize: 16, fontWeight: '700' },
  cardTime: { color: tokens.textTertiary, fontSize: 12 },
  cardNote: { color: tokens.textSecondary, fontSize: 14, lineHeight: 20 },
  cardNoteMuted: { color: tokens.textTertiary, fontSize: 13, lineHeight: 19 },
  option: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    gap: 2,
  },
  optionSelected: { borderColor: tokens.accent },
  optionLabel: { color: tokens.text, fontSize: 14, fontWeight: '700' },
  optionHint: { color: tokens.textTertiary, fontSize: 12, lineHeight: 17 },
  input: {
    backgroundColor: tokens.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    color: tokens.text,
    fontSize: 14,
    padding: 12,
  },
  error: { color: tokens.danger, fontSize: 13 },
  link: { color: tokens.accent, fontSize: 14, fontWeight: '700' },
  emptyCard: {
    backgroundColor: tokens.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 20,
    marginTop: 4,
  },
  emptyText: { color: tokens.textSecondary, fontSize: 14, lineHeight: 21 },
});
