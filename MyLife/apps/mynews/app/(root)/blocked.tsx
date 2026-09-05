import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { type BlockView } from '@mylife/mynews';
import { tokens } from './theme/tokens';
import { useMyNewsAuth } from './providers/AuthProvider';
import { useMyNewsCloud } from './providers/CloudProvider';
import { ScreenHeader } from './components/ScreenHeader';
import { LoadingView, MessageView } from './components/StateViews';
import { SecondaryButton } from './components/Buttons';
import { toBlockedRow } from './lib/blocks';
import { atHandle, relativeTime } from './lib/format';

type LoadState =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'signed-out' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; blocks: BlockView[] };

export default function BlockedAccountsScreen() {
  const router = useRouter();
  const auth = useMyNewsAuth();
  const { isConfigured, port } = useMyNewsCloud();
  const hasSession = auth.status === 'anonymous' || auth.status === 'linked';
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isConfigured || !port) {
      setState({ status: 'not-configured' });
      return;
    }
    if (!hasSession) {
      setState({ status: 'signed-out' });
      return;
    }
    setState({ status: 'loading' });
    try {
      const blocks = await port.listBlocks();
      setState({ status: 'loaded', blocks });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }, [hasSession, isConfigured, port]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onUnblock = useCallback(
    async (profileId: string) => {
      if (!port) return;
      setBusyId(profileId);
      const result = await port.removeBlock(profileId);
      setBusyId(null);
      if (result.ok) await load();
    },
    [load, port],
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Blocked accounts" />
      {state.status === 'loading' ? (
        <LoadingView />
      ) : state.status === 'not-configured' ? (
        <MessageView
          title="Not connected to a MyNews server yet"
          body="Your block list lives on the MyNews server. Not connected for this build yet."
        />
      ) : state.status === 'signed-out' ? (
        <View style={styles.centered}>
          <MessageView
            title="Sign in to manage blocks"
            body="Your block list is tied to your account and stays private to you."
          />
          <View style={styles.action}>
            <SecondaryButton label="Sign in" onPress={() => router.push('/(root)/register')} />
          </View>
        </View>
      ) : state.status === 'error' ? (
        <View style={styles.centered}>
          <MessageView title="Could not load your blocks" body={state.message} />
          <View style={styles.action}>
            <SecondaryButton label="Try again" onPress={() => void load()} />
          </View>
        </View>
      ) : (
        <FlatList
          data={state.blocks}
          keyExtractor={(item) => item.blockedProfileId}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListHeaderComponent={
            <Text style={styles.intro}>
              Blocked and muted accounts stay out of your Today feed and suggestion lists. This is
              private to you; the account is never told.
            </Text>
          }
          ListEmptyComponent={
            <MessageView
              title="No blocked accounts"
              body="Block or mute an account from their profile and it will show up here."
            />
          }
          renderItem={({ item }) => {
            const row = toBlockedRow(item);
            return (
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.name}>{row.displayName || atHandle(row.handle)}</Text>
                  <Text style={styles.meta}>
                    {row.modeLabel}
                    {row.handle ? ` · ${atHandle(row.handle)}` : ''} · {relativeTime(row.createdAt)}
                  </Text>
                </View>
                <SecondaryButton
                  label="Unblock"
                  onPress={() => void onUnblock(row.profileId)}
                  loading={busyId === row.profileId}
                />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.bg,
  },
  centered: {
    flex: 1,
  },
  action: {
    paddingHorizontal: 40,
    paddingBottom: 24,
  },
  listContent: {
    flexGrow: 1,
    padding: 16,
  },
  intro: {
    color: tokens.textTertiary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  sep: {
    height: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: tokens.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  name: {
    color: tokens.text,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: tokens.textTertiary,
    fontSize: 13,
  },
});
