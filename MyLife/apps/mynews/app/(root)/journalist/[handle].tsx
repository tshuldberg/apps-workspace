import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { JournalistView } from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { useMyNewsCloud } from '../providers/CloudProvider';
import { useMyNewsDb } from '../providers/DatabaseProvider';
import { addFollow, isFollowing, removeFollow } from '../lib/follows';
import { atHandle } from '../lib/format';
import { ScreenHeader } from '../components/ScreenHeader';
import { ReportCard } from '../components/ReportCard';
import { BlockCard } from '../components/BlockCard';
import { ArticleCard } from '../components/ArticleCard';
import { TierBadge } from '../components/TierBadge';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { LoadingView, MessageView } from '../components/StateViews';
import { getMyNewsRuntimeCapabilities } from '../data/runtime-capabilities';

type LoadState =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; journalist: JournalistView };

export default function JournalistScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const { isConfigured, port } = useMyNewsCloud();
  const db = useMyNewsDb();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [following, setFollowing] = useState(false);
  const paymentsAvailable = useMemo(() => getMyNewsRuntimeCapabilities().payments, []);

  const load = useCallback(async () => {
    if (!isConfigured || !port) {
      setState({ status: 'not-configured' });
      return;
    }
    if (!handle) {
      setState({ status: 'not-found' });
      return;
    }
    setState({ status: 'loading' });
    try {
      const journalist = await port.getJournalistByHandle(handle);
      if (!journalist) {
        setState({ status: 'not-found' });
        return;
      }
      setState({ status: 'loaded', journalist });
      setFollowing(isFollowing(db, journalist.pubkey));
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }, [db, handle, isConfigured, port]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFollow = useCallback(
    (journalist: JournalistView) => {
      if (following) {
        removeFollow(db, journalist.pubkey);
        setFollowing(false);
      } else {
        addFollow(
          db,
          { journalistKey: journalist.pubkey, handle: journalist.handle },
          new Date().toISOString(),
        );
        setFollowing(true);
      }
    },
    [db, following],
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Journalist" />
      {state.status === 'loading' ? (
        <LoadingView />
      ) : state.status === 'not-configured' ? (
        <MessageView
          title="Not connected to a MyNews server yet"
          body="Journalist profiles load once a MyNews server is configured for this build."
        />
      ) : state.status === 'not-found' ? (
        <MessageView
          title="Journalist not found"
          body="No journalist matches this handle."
        />
      ) : state.status === 'error' ? (
        <MessageView title="Could not load this profile" body={state.message} />
      ) : (
        <FlatList
          data={state.journalist.articles}
          keyExtractor={(item) => item.articleId}
          renderItem={({ item }) => (
            <ArticleCard
              item={item}
              onPress={() => router.push(`/(root)/article/${item.slug}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListHeaderComponent={
            <ProfileHeader
              journalist={state.journalist}
              following={following}
              onToggleFollow={() => toggleFollow(state.journalist)}
              paymentsAvailable={paymentsAvailable}
              onSupport={() => {
                if (!state.journalist.id) return;
                router.push(
                  `/(root)/(tabs)/support?journalistId=${encodeURIComponent(state.journalist.id)}` +
                    `&journalistHandle=${encodeURIComponent(state.journalist.handle)}` as never,
                );
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.noArticles}>No published articles yet.</Text>
          }
        />
      )}
    </View>
  );
}

function ProfileHeader({
  journalist,
  following,
  onToggleFollow,
  paymentsAvailable,
  onSupport,
}: {
  journalist: JournalistView;
  following: boolean;
  onToggleFollow: () => void;
  paymentsAvailable: boolean;
  onSupport: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.nameRow}>
        <Text style={styles.name}>{journalist.displayName}</Text>
        {/* Plan 48 WP8: the profile read carries the verification state, so the
            badge follows the verification record rather than the tier column. */}
        <TierBadge
          tier={journalist.tier}
          verificationState={journalist.verificationState}
          size="md"
        />
      </View>
      <Text style={styles.handle}>{atHandle(journalist.handle)}</Text>
      {journalist.bio ? <Text style={styles.bio}>{journalist.bio}</Text> : null}
      {journalist.beats.length > 0 ? (
        <View style={styles.beats}>
          {journalist.beats.map((beat) => (
            <View key={beat} style={styles.beatChip}>
              <Text style={styles.beatText}>{beat}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {journalist.id && paymentsAvailable ? (
        <PrimaryButton label="Support journalist" onPress={onSupport} />
      ) : journalist.id ? (
        <Text style={styles.followNote}>Journalist support is not available in this build.</Text>
      ) : null}
      <View style={styles.followWrap}>
        {following ? (
          <SecondaryButton label="Following" onPress={onToggleFollow} />
        ) : (
          <PrimaryButton label="Follow" onPress={onToggleFollow} />
        )}
        <Text style={styles.followNote}>
          Follows are kept on this device; they shape your Today feed.
        </Text>
      </View>
      {journalist.id ? (
        <>
          <BlockCard profileId={journalist.id} displayName={journalist.displayName} />
          <ReportCard targetKind="profile" targetId={journalist.id} label="Report this profile" />
        </>
      ) : null}
      <Text style={styles.articlesHeading}>Articles</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.bg,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sep: {
    height: 12,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  name: {
    color: tokens.text,
    fontSize: 24,
    fontWeight: '800',
  },
  handle: {
    color: tokens.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  bio: {
    color: tokens.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  beats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  beatChip: {
    backgroundColor: tokens.elevated,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  beatText: {
    color: tokens.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  followWrap: {
    marginTop: 8,
    gap: 8,
  },
  followNote: {
    color: tokens.textTertiary,
    fontSize: 13,
    lineHeight: 18,
  },
  articlesHeading: {
    color: tokens.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
  },
  noArticles: {
    color: tokens.textTertiary,
    fontSize: 14,
    paddingHorizontal: 4,
  },
});
