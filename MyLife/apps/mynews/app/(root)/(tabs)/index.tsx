import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import type { BlockView, FeedItem } from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { useMyNewsCloud } from '../providers/CloudProvider';
import { useMyNewsDb } from '../providers/DatabaseProvider';
import { listFollowedPubkeys } from '../lib/follows';
import { loadFeed, type FeedState } from '../lib/feed';
import { ArticleCard } from '../components/ArticleCard';
import { LoadingView, MessageView } from '../components/StateViews';
import { SecondaryButton } from '../components/Buttons';

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isConfigured, port } = useMyNewsCloud();
  const db = useMyNewsDb();
  const [state, setState] = useState<FeedState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const followedPubkeys = listFollowedPubkeys(db);
    // Blocks are server-side + signed-in; a signed-out or unconfigured viewer
    // resolves an empty list (listBlocks returns [] with no session), so the
    // feed is simply unfiltered rather than erroring.
    let blocks: BlockView[] = [];
    if (port) {
      try {
        blocks = await port.listBlocks();
      } catch {
        blocks = [];
      }
    }
    const next = await loadFeed({ configured: isConfigured, port, followedPubkeys, blocks });
    setState(next);
  }, [db, isConfigured, port]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const openArticle = useCallback(
    (item: FeedItem) => router.push(`/(root)/article/${item.slug}`),
    [router],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Today</Text>
      {state.status === 'loading' ? (
        <LoadingView />
      ) : (
        <FlatList
          data={state.status === 'loaded' ? state.items : []}
          keyExtractor={(item) => item.articleId}
          renderItem={({ item }) => (
            <ArticleCard item={item} onPress={() => openArticle(item)} />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tokens.accent}
            />
          }
          ListEmptyComponent={<TodayEmpty state={state} onRetry={() => void load()} />}
        />
      )}
    </View>
  );
}

function TodayEmpty({ state, onRetry }: { state: FeedState; onRetry: () => void }) {
  if (state.status === 'not-configured') {
    return (
      <MessageView
        title="Not connected to a MyNews server yet"
        body="Reading turns on here once a MyNews server is configured for this build. Nothing on this screen is simulated."
      />
    );
  }
  if (state.status === 'no-follows') {
    return (
      <MessageView
        title="Your feed is empty"
        body="Follow journalists from Discover or an article byline to shape your Today feed. MyNews does not insert unrelated stories into it."
      />
    );
  }
  if (state.status === 'error') {
    return (
      <View style={styles.errorWrap}>
        <MessageView title="Could not load your feed" body={state.message} />
        <View style={styles.retry}>
          <SecondaryButton label="Try again" onPress={onRetry} />
        </View>
      </View>
    );
  }
  return (
    <MessageView
      title="No stories yet"
      body="The journalists you follow have not published anything new. Pull to refresh."
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.bg,
  },
  title: {
    color: tokens.text,
    fontSize: 30,
    fontWeight: '800',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sep: {
    height: 12,
  },
  errorWrap: {
    flex: 1,
  },
  retry: {
    paddingHorizontal: 40,
    paddingBottom: 24,
  },
});
