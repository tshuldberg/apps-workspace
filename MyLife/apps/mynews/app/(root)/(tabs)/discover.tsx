import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import type { SearchResult } from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { useMyNewsCloud } from '../providers/CloudProvider';
import { ArticleCard } from '../components/ArticleCard';
import { MessageView } from '../components/StateViews';
import { SecondaryButton } from '../components/Buttons';
import {
  createDebouncedSearch,
  loadLatest,
  type DebouncedSearch,
  type LatestState,
  type SearchRunState,
} from '../lib/search';

export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isConfigured, port, reason } = useMyNewsCloud();

  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<SearchRunState>({ status: 'idle' });
  const [latest, setLatest] = useState<LatestState>({ status: 'loading' });
  const controllerRef = useRef<DebouncedSearch | null>(null);

  useEffect(() => {
    if (!port) {
      controllerRef.current = null;
      return;
    }
    const controller = createDebouncedSearch({
      run: (q) => port.search(q),
      onState: setSearchState,
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [port]);

  const loadLatestList = useCallback(async () => {
    setLatest(await loadLatest({ configured: isConfigured, port }));
  }, [isConfigured, port]);

  useFocusEffect(
    useCallback(() => {
      void loadLatestList();
    }, [loadLatestList]),
  );

  const onChangeQuery = useCallback((text: string) => {
    setQuery(text);
    controllerRef.current?.setQuery(text);
  }, []);

  const openResult = useCallback(
    (result: SearchResult) => {
      if (result.kind === 'article') {
        router.push(`/(root)/article/${encodeURIComponent(result.ref)}`);
      } else {
        router.push(`/(root)/journalist/${encodeURIComponent(result.ref)}`);
      }
    },
    [router],
  );

  if (!isConfigured || !port) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Discover</Text>
        <MessageView
          title="Not connected to a MyNews server yet"
          body={
            reason ??
            'Search and browsing turn on once a MyNews server is configured for this build. Nothing on this screen is simulated.'
          }
        />
      </View>
    );
  }

  const searching = query.trim().length > 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Discover</Text>
      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Search articles and journalists"
          placeholderTextColor={tokens.textTertiary}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search"
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {searching ? (
          <SearchResults state={searchState} onOpen={openResult} />
        ) : (
          <LatestSection state={latest} onRetry={() => void loadLatestList()} />
        )}
      </ScrollView>
    </View>
  );
}

function SearchResults({
  state,
  onOpen,
}: {
  state: SearchRunState;
  onOpen: (result: SearchResult) => void;
}) {
  switch (state.status) {
    case 'idle':
      return null;
    case 'pending':
    case 'searching':
      return (
        <View style={styles.centerRow}>
          <ActivityIndicator color={tokens.accent} />
          <Text style={styles.dimText}>Searching...</Text>
        </View>
      );
    case 'empty':
      return (
        <Text style={styles.dimText}>
          No results for {'"'}
          {state.query}
          {'"'}.
        </Text>
      );
    case 'error':
      return <Text style={styles.errorText}>Search failed: {state.message}</Text>;
    case 'results':
      return (
        <>
          {state.results.map((result) => (
            <Pressable
              key={`${result.kind}:${result.ref}`}
              onPress={() => onOpen(result)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.resultCard, pressed && styles.pressed]}
            >
              <Text style={styles.resultKind}>
                {result.kind === 'article' ? 'ARTICLE' : 'JOURNALIST'}
              </Text>
              <Text style={styles.resultTitle} numberOfLines={2}>
                {result.title}
              </Text>
              {result.snippet ? (
                <Text style={styles.resultSnippet} numberOfLines={2}>
                  {result.snippet}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </>
      );
  }
}

function LatestSection({ state, onRetry }: { state: LatestState; onRetry: () => void }) {
  const router = useRouter();
  return (
    <>
      <Text style={styles.sectionTitle}>Latest</Text>
      {state.status === 'loading' ? (
        <View style={styles.centerRow}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : state.status === 'not-configured' ? (
        <Text style={styles.dimText}>Not connected to a MyNews server yet.</Text>
      ) : state.status === 'error' ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>Could not load the latest stories: {state.message}</Text>
          <SecondaryButton label="Try again" onPress={onRetry} />
        </View>
      ) : state.status === 'empty' ? (
        <Text style={styles.dimText}>
          No stories to browse yet. Newly published articles land here; you can also search, or
          follow journalists from any article byline.
        </Text>
      ) : (
        state.items.map((item) => (
          <ArticleCard
            key={item.articleId}
            item={item}
            onPress={() => router.push(`/(root)/article/${encodeURIComponent(item.slug)}`)}
          />
        ))
      )}
    </>
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
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInput: {
    backgroundColor: tokens.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    color: tokens.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 10,
  },
  sectionTitle: {
    color: tokens.text,
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  dimText: {
    color: tokens.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    paddingHorizontal: 4,
  },
  errorWrap: {
    gap: 10,
  },
  errorText: {
    color: tokens.danger,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  resultCard: {
    backgroundColor: tokens.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    gap: 4,
  },
  pressed: {
    opacity: 0.85,
  },
  resultKind: {
    color: tokens.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  resultTitle: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '700',
  },
  resultSnippet: {
    color: tokens.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
});
