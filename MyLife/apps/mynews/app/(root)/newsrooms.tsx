import { useCallback, useState } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import type { NewsroomView, ProfileView } from '@mylife/mynews';
import { tokens } from './theme/tokens';
import { useMyNewsAuth } from './providers/AuthProvider';
import { useMyNewsCloud } from './providers/CloudProvider';
import { ScreenHeader } from './components/ScreenHeader';
import { PrimaryButton } from './components/Buttons';
import { absoluteDate } from './lib/format';
import { createNewsroomFlow, loadNewsroomList } from './lib/newsrooms';
import { ErrorText } from './components/ErrorText';

type ListState =
  | { status: 'unconfigured' }
  | { status: 'signed-out' }
  | { status: 'loading' }
  | { status: 'no-profile' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; profile: ProfileView; rooms: NewsroomView[] };

export default function NewsroomsScreen() {
  const router = useRouter();
  const auth = useMyNewsAuth();
  const { isConfigured, port, reason } = useMyNewsCloud();

  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const hasSession = auth.status === 'anonymous' || auth.status === 'linked';

  const load = useCallback(async () => {
    if (!isConfigured || !port) {
      setState({ status: 'unconfigured' });
      return;
    }
    if (!hasSession) {
      setState({ status: 'signed-out' });
      return;
    }
    setState({ status: 'loading' });
    try {
      const loaded = await loadNewsroomList({ port });
      if (loaded.status === 'no-profile') {
        setState({ status: 'no-profile' });
        return;
      }
      setState({ status: 'loaded', profile: loaded.profile, rooms: loaded.rooms });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [hasSession, isConfigured, port]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleCreate = useCallback(async () => {
    if (state.status !== 'loaded' || !port) return;
    setCreating(true);
    setCreateError(null);
    const res = await createNewsroomFlow({ port, ownerId: state.profile.id, name });
    setCreating(false);
    if (res.ok) {
      setName('');
      router.push(`/(root)/newsroom/${encodeURIComponent(res.newsroom.id)}`);
      return;
    }
    setCreateError(res.message);
  }, [name, port, router, state]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Newsrooms" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {state.status === 'unconfigured' ? (
            <View style={styles.card}>
              <Text style={styles.cardBody}>
                {reason ?? 'Not connected to a MyNews server yet.'} Newsrooms live on the server;
                nothing here is simulated.
              </Text>
            </View>
          ) : null}

          {state.status === 'signed-out' || state.status === 'no-profile' ? (
            <View style={styles.card}>
              <Text style={styles.cardBody}>
                {state.status === 'signed-out'
                  ? 'You are reading anonymously. Newsrooms need an account and a public profile.'
                  : 'You need a public profile to use newsrooms. Register a handle to continue.'}
              </Text>
              <PrimaryButton
                label="Register to publish or suggest"
                onPress={() =>
                  router.push(
                    `/(root)/register?returnTo=${encodeURIComponent('/(root)/newsrooms')}`,
                  )
                }
              />
            </View>
          ) : null}

          {state.status === 'loading' ? (
            <View style={styles.card}>
              <Text style={styles.cardMeta}>Loading...</Text>
            </View>
          ) : null}

          {state.status === 'error' ? (
            <View style={styles.card}>
              <ErrorText style={styles.error}>{state.message}</ErrorText>
              <Pressable onPress={() => void load()} accessibilityRole="button">
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {state.status === 'loaded' ? (
            <>
              <Text style={styles.sectionTitle}>My newsrooms</Text>
              {state.rooms.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardBody}>
                    No newsrooms yet. Create one to share drafts with coauthors and reviewers
                    before anything goes public.
                  </Text>
                </View>
              ) : (
                state.rooms.map((room) => (
                  <Pressable
                    key={room.id}
                    onPress={() =>
                      router.push(`/(root)/newsroom/${encodeURIComponent(room.id)}`)
                    }
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                  >
                    <View style={styles.rowBetween}>
                      <Text style={styles.roomName} numberOfLines={1}>
                        {room.name}
                      </Text>
                      <ChevronRight color={tokens.textTertiary} size={18} />
                    </View>
                    <Text style={styles.cardMeta}>Created {absoluteDate(room.createdAt)}</Text>
                  </Pressable>
                ))
              )}

              <Text style={styles.sectionTitle}>Create a newsroom</Text>
              <View style={styles.card}>
                <TextInput
                  accessibilityLabel="Newsroom name"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    setCreateError(null);
                  }}
                  placeholder="Newsroom name"
                  placeholderTextColor={tokens.textTertiary}
                  style={styles.input}
                  maxLength={80}
                  editable={!creating}
                />
                <Text style={styles.hint}>1 to 80 characters. You become the owner.</Text>
                {createError ? <ErrorText style={styles.error}>{createError}</ErrorText> : null}
                <PrimaryButton
                  label="Create newsroom"
                  onPress={() => void handleCreate()}
                  disabled={name.trim().length === 0}
                  loading={creating}
                />
              </View>
            </>
          ) : null}
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
    paddingHorizontal: 16,
    paddingBottom: 48,
    gap: 10,
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
    gap: 8,
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
  roomName: {
    color: tokens.text,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
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
  hint: {
    color: tokens.textTertiary,
    fontSize: 12,
    lineHeight: 18,
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
  pressed: {
    opacity: 0.85,
  },
});
