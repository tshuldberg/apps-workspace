import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { tokens } from './theme/tokens';
import { useMyNewsAuth } from './providers/AuthProvider';
import { useMyNewsCloud } from './providers/CloudProvider';
import { useMyNewsIdentity } from './providers/IdentityProvider';
import { ScreenHeader } from './components/ScreenHeader';
import { PrimaryButton } from './components/Buttons';
import { HANDLE_RULE, HANDLE_RULE_COPY, submitRegistration } from './lib/registration';
import { shortKey } from './lib/format';
import { ErrorText } from './components/ErrorText';

const AVAILABILITY_DEBOUNCE_MS = 400;

type Availability = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'unknown';

export default function RegisterScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const auth = useMyNewsAuth();
  const { isConfigured, port, reason } = useMyNewsCloud();
  const identity = useMyNewsIdentity();

  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [availability, setAvailability] = useState<Availability>('idle');
  const [handleError, setHandleError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestHandle = useRef('');

  useEffect(() => {
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, []);

  const onHandleChange = useCallback(
    (raw: string) => {
      const next = raw.trim().toLowerCase();
      setHandle(next);
      setHandleError(null);
      setFormError(null);
      latestHandle.current = next;
      if (checkTimer.current) clearTimeout(checkTimer.current);
      if (!next) {
        setAvailability('idle');
        return;
      }
      if (!HANDLE_RULE.test(next)) {
        setAvailability('invalid');
        return;
      }
      if (!port) {
        setAvailability('unknown');
        return;
      }
      setAvailability('checking');
      checkTimer.current = setTimeout(() => {
        void port
          .isHandleAvailable(next)
          .then((free) => {
            if (latestHandle.current !== next) return;
            setAvailability(free ? 'available' : 'taken');
          })
          .catch(() => {
            if (latestHandle.current !== next) return;
            setAvailability('unknown');
          });
      }, AVAILABILITY_DEBOUNCE_MS);
    },
    [port],
  );

  const onSubmit = useCallback(async () => {
    if (!port || !identity) return;
    setSubmitting(true);
    setFormError(null);
    setHandleError(null);
    const outcome = await submitRegistration({ auth, port, identity, handle, displayName });
    setSubmitting(false);
    if (outcome.ok) {
      if (typeof returnTo === 'string' && returnTo.length > 0) {
        router.replace(returnTo as Parameters<typeof router.replace>[0]);
      } else {
        router.back();
      }
      return;
    }
    if (outcome.field === 'handle') {
      setHandleError(outcome.message);
      setAvailability('taken');
    } else {
      setFormError(outcome.message);
    }
  }, [auth, displayName, handle, identity, port, returnTo, router]);

  const disabledReason = ((): string | null => {
    if (!isConfigured) {
      return reason ?? 'Registration turns on once a MyNews server is configured for this build.';
    }
    if (!identity) return 'Preparing your signing key on this device...';
    if (!HANDLE_RULE.test(handle)) return `Handles are ${HANDLE_RULE_COPY}`;
    if (!displayName.trim()) return 'Add a display name.';
    return null;
  })();

  const availabilityLine = ((): { text: string; tone: 'ok' | 'bad' | 'dim' } | null => {
    switch (availability) {
      case 'available':
        return { text: `@${handle} is available`, tone: 'ok' };
      case 'taken':
        return { text: handleError ?? 'That handle is taken. Try another.', tone: 'bad' };
      case 'checking':
        return { text: 'Checking availability...', tone: 'dim' };
      case 'invalid':
        return { text: HANDLE_RULE_COPY, tone: 'bad' };
      case 'unknown':
        return { text: 'Could not check availability. You can still try to register.', tone: 'dim' };
      default:
        return null;
    }
  })();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Create your profile" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.explainer}>
            Your identity is an on-device key. A handle makes it public.
          </Text>
          {identity ? (
            <Text style={styles.keyLine}>
              This profile will be bound to your device key {shortKey(identity.pubkeyHex)}.
            </Text>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Handle</Text>
            <TextInput
              accessibilityLabel="Handle"
              value={handle}
              onChangeText={onHandleChange}
              placeholder="e.g. jane_doe"
              placeholderTextColor={tokens.textTertiary}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              editable={isConfigured && !submitting}
            />
            <Text style={styles.rule}>{HANDLE_RULE_COPY}</Text>
            {availabilityLine ? (
              <Text
                style={[
                  styles.availability,
                  availabilityLine.tone === 'ok' && styles.availabilityOk,
                  availabilityLine.tone === 'bad' && styles.availabilityBad,
                ]}
              >
                {availabilityLine.text}
              </Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Display name</Text>
            <TextInput
              accessibilityLabel="Display name"
              value={displayName}
              onChangeText={(text) => {
                setDisplayName(text);
                setFormError(null);
              }}
              placeholder="Shown next to your handle"
              placeholderTextColor={tokens.textTertiary}
              style={styles.input}
              editable={isConfigured && !submitting}
            />
          </View>

          {formError ? <ErrorText style={styles.error}>{formError}</ErrorText> : null}

          <View style={styles.submitWrap}>
            <PrimaryButton
              label="Create profile"
              onPress={() => void onSubmit()}
              disabled={disabledReason !== null}
              loading={submitting}
            />
            <Text style={styles.hint}>
              {disabledReason ??
                'Registering binds your handle to this device key. Your kind starts as reader; publishing and suggesting unlock from your profile.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
    gap: 18,
  },
  explainer: {
    color: tokens.text,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
  },
  keyLine: {
    color: tokens.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  field: {
    gap: 6,
  },
  label: {
    color: tokens.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: tokens.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    color: tokens.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rule: {
    color: tokens.textTertiary,
    fontSize: 12,
  },
  availability: {
    fontSize: 13,
    color: tokens.textSecondary,
  },
  availabilityOk: {
    color: tokens.success,
  },
  availabilityBad: {
    color: tokens.danger,
  },
  error: {
    color: tokens.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  submitWrap: {
    marginTop: 4,
    gap: 8,
  },
  hint: {
    color: tokens.textTertiary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
