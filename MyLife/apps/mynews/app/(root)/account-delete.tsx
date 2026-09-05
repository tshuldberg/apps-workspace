import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  ACCOUNT_DELETION_REMOVED,
  ACCOUNT_DELETION_RETAINED,
  DELETION_CONFIRMATION_PHRASE,
  accountDeletionStepLabel,
  accountErrorMessage,
  type AccountDeletionView,
} from '@mylife/mynews';
import { tokens } from './theme/tokens';
import { useMyNewsAuth } from './providers/AuthProvider';
import { useMyNewsCloud } from './providers/CloudProvider';
import { ScreenHeader } from './components/ScreenHeader';
import { LoadingView, MessageView } from './components/StateViews';
import { PrimaryButton, SecondaryButton } from './components/Buttons';
import { buildDeletionScreenModel } from './lib/account';
import { ErrorText } from './components/ErrorText';

type LoadState =
  | { status: 'loading' }
  | { status: 'not-configured'; reason: string }
  | { status: 'signed-out' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; request: AccountDeletionView | null };

export default function AccountDeleteScreen() {
  const router = useRouter();
  const auth = useMyNewsAuth();
  const { isConfigured, port, reason } = useMyNewsCloud();
  const hasSession = auth.status === 'anonymous' || auth.status === 'linked';

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  const load = useCallback(async () => {
    if (!isConfigured || !port) {
      setState({
        status: 'not-configured',
        reason: reason ?? 'Not connected to a MyNews server yet.',
      });
      return;
    }
    if (!hasSession) {
      setState({ status: 'signed-out' });
      return;
    }
    setState((prev) => (prev.status === 'loaded' ? prev : { status: 'loading' }));
    const result = await port.getAccountDeletionStatus();
    if (result.ok) {
      setState({ status: 'loaded', request: result.request });
    } else {
      setState({ status: 'error', message: accountErrorMessage(result.error) });
    }
  }, [hasSession, isConfigured, port, reason]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onConfirmDelete = useCallback(async () => {
    if (!port) return;
    setBusy(true);
    setActionError(null);
    setNeedsReauth(false);
    const result = await port.initiateAccountDeletion(typed);
    setBusy(false);
    if (result.ok) {
      setTyped('');
      setState({ status: 'loaded', request: result.request });
      return;
    }
    setActionError(accountErrorMessage(result.error));
    setNeedsReauth(result.error === 'reauth-required');
  }, [port, typed]);

  const onCancelDeletion = useCallback(async () => {
    if (!port) return;
    setBusy(true);
    setActionError(null);
    const result = await port.cancelAccountDeletion();
    setBusy(false);
    if (result.ok) {
      await load();
      return;
    }
    setActionError(accountErrorMessage(result.error));
    // The server is the source of truth about cancellability, so re-read it
    // rather than guessing which state we are actually in now.
    await load();
  }, [load, port]);

  const onSignInAgain = useCallback(async () => {
    // A fresh sign-in mints a fresh access token, which is what the server's
    // freshness guard needs. Signing out returns the user to the Me tab.
    await auth.signOut();
    router.replace('/(root)/(tabs)/me');
  }, [auth, router]);

  if (state.status === 'loading') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Delete account" />
        <LoadingView />
      </View>
    );
  }

  if (state.status === 'not-configured') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Delete account" />
        <MessageView title="Not connected to a MyNews server yet" body={state.reason} />
      </View>
    );
  }

  if (state.status === 'signed-out') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Delete account" />
        <MessageView
          title="Sign in to delete your account"
          body="Deletion needs a signed-in session so we know which account to remove."
        />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Delete account" />
        <MessageView title="Could not read your deletion status" body={state.message} />
      </View>
    );
  }

  const model = buildDeletionScreenModel(state.request, Date.now(), ACCOUNT_DELETION_GRACE_DAYS);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Delete account" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.headline}>{model.headline}</Text>
          <Text style={styles.body}>{model.detail}</Text>
          {model.countdown ? <Text style={styles.countdown}>{model.countdown}</Text> : null}
          {state.request?.failureDetail ? (
            <ErrorText style={styles.error}>{state.request.failureDetail}</ErrorText>
          ) : null}
        </View>

        {model.steps.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Deletion steps</Text>
            {model.steps.map((step) => (
              <View key={step.label} style={styles.stepRow}>
                <Text style={styles.body}>{step.label}</Text>
                <Text
                  style={[
                    styles.stepState,
                    step.state === 'done' && styles.stepDone,
                    step.state === 'failed' && styles.stepFailed,
                  ]}
                >
                  {accountDeletionStepLabel(step.state)}
                </Text>
              </View>
            ))}
            <Text style={styles.meta}>
              A step marked not configured is not wired on this server. We show it rather than
              pretend it ran.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What we keep</Text>
          {ACCOUNT_DELETION_RETAINED.map((line) => (
            <Text key={line} style={styles.body}>
              {line}
            </Text>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What we delete</Text>
          {ACCOUNT_DELETION_REMOVED.map((line) => (
            <Text key={line} style={styles.body}>
              {line}
            </Text>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Export first</Text>
          <Text style={styles.body}>
            Download everything your account owns before you delete it. Deletion cannot be undone
            once the grace period ends.
          </Text>
          <SecondaryButton
            label="Export my data"
            onPress={() => router.push('/(root)/account-export')}
          />
        </View>

        {model.showConfirmForm ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Confirm</Text>
            <Text style={styles.body}>
              Type {DELETION_CONFIRMATION_PHRASE} to start the {ACCOUNT_DELETION_GRACE_DAYS}-day
              grace period.
            </Text>
            <TextInput
              value={typed}
              onChangeText={(text) => {
                setTyped(text);
                setActionError(null);
              }}
              placeholder={DELETION_CONFIRMATION_PHRASE}
              placeholderTextColor={tokens.textTertiary}
              style={styles.input}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Deletion confirmation phrase"
            />
            {actionError ? <ErrorText style={styles.error}>{actionError}</ErrorText> : null}
            {needsReauth ? (
              <SecondaryButton label="Sign in again" onPress={() => void onSignInAgain()} />
            ) : null}
            <PrimaryButton
              label="Delete my account"
              onPress={() => void onConfirmDelete()}
              disabled={typed !== DELETION_CONFIRMATION_PHRASE}
              loading={busy}
            />
          </View>
        ) : null}

        {model.showCancel ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Changed your mind?</Text>
            <Text style={styles.body}>
              Cancelling stops the deletion completely. Nothing has been removed yet.
            </Text>
            {actionError ? <ErrorText style={styles.error}>{actionError}</ErrorText> : null}
            <PrimaryButton
              label="Cancel deletion"
              onPress={() => void onCancelDeletion()}
              loading={busy}
            />
          </View>
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
    gap: 14,
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
  headline: {
    color: tokens.text,
    fontSize: 20,
    fontWeight: '800',
  },
  body: {
    color: tokens.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    color: tokens.textTertiary,
    fontSize: 13,
    lineHeight: 19,
  },
  countdown: {
    color: tokens.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  stepState: {
    color: tokens.textTertiary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  stepDone: {
    color: tokens.success,
  },
  stepFailed: {
    color: tokens.danger,
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
  error: {
    color: tokens.danger,
    fontSize: 13,
    lineHeight: 19,
  },
});
