// Topic channel (Plan 39 P10, screen S9). A Commons topic is a channel of the
// system publication: same protocol, same three write gates, one moderation
// domain. This shows the topic's dual-verified posts (recency order -- the only
// verifiable ranking signal for public posts; no fabricated Top/Rising, NC-P6),
// a follow toggle (cm_public_follows, topic kind), and a compose entry. Twin of
// the web PublicTopicView.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { AcceptedPublicPost } from '@mylife/sync';
import { useMeerkatDatabase } from '../../providers/DatabaseProvider';
import { SectionHeader } from '../../components/kit';
import { useAppThemeColors, useMkStyles } from '../../providers/AppThemeProvider';
import { personaHandle, personaServiceConfig, resolvePersonaKeys } from '../../data/persona-core';
import { commonsFeedConfig, loadCommonsTopic, PUBLIC_COMPOSE_PLACEHOLDER, PUBLIC_FEED_TOPICS } from '../../data/public-feed';
import { isFollowingPublic, toggleFollowPublic } from '../../data/public-follows';
import { type MkColors, MK_MONO, MK_RADIUS, shortHex } from '../../theme/tokens';

// Verbatim topic copy (mockup S9), parity-locked against the web twin.
export const TOPIC_HOSTED_LINE = 'A Commons topic · hosted by Meerkat';
export const TOPIC_POSTING_LINE = 'Open posting for unlocked members. Moderated by the Meerkat trust and safety team.';
export const TOPIC_FOLLOW = 'Follow';
export const TOPIC_FOLLOWING = 'Following';

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h` : `${Math.round(hrs / 24)}d`;
}

export default function PublicTopicScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const params = useLocalSearchParams<{ channel?: string }>();
  const personaConfig = useMemo(() => personaServiceConfig(), []);
  const feedConfig = useMemo(() => commonsFeedConfig(), []);

  const channelId = typeof params.channel === 'string' && params.channel.length > 0 ? params.channel : 'commons';
  const topic = PUBLIC_FEED_TOPICS.find((t) => t.channelId === channelId) ?? PUBLIC_FEED_TOPICS[0]!;

  const [feed, setFeed] = useState<{ loading: boolean; posts: AcceptedPublicPost[]; error: string | null }>({ loading: true, posts: [], error: null });
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [following, setFollowing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => { setFollowing(isFollowingPublic(db, 'topic', channelId)); }, [db, channelId]);
  useFocusEffect(useCallback(() => { setReloadKey((k) => k + 1); }, []));

  useEffect(() => {
    let cancelled = false;
    setFeed((f) => ({ ...f, loading: true, error: null }));
    void loadCommonsTopic(db, feedConfig, channelId).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setFeed({ loading: false, posts: r.posts, error: null });
        void resolvePersonaKeys(personaConfig, r.posts.map((p) => p.post.personaPubkey)).then((map) => { if (!cancelled) setAliases(map); });
      } else {
        setFeed({ loading: false, posts: [], error: r.reason });
      }
    });
    return () => { cancelled = true; };
  }, [db, feedConfig, personaConfig, channelId, reloadKey]);

  const onToggleFollow = useCallback(() => {
    setFollowing(toggleFollowPublic(db, 'topic', channelId, `${topic.emoji} ${topic.title}`));
  }, [db, channelId, topic]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/public'); }} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <ChevronLeft size={24} color={c.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>{topic.emoji} {topic.title}</Text>
        <Pressable accessibilityRole="button" onPress={onToggleFollow} style={({ pressed }) => [styles.followPill, following && styles.followPillOn, pressed && styles.pressed]}>
          <Text style={[styles.followText, following && styles.followTextOn]}>{following ? `${TOPIC_FOLLOWING} ✓` : TOPIC_FOLLOW}</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.hostedLine}>{TOPIC_HOSTED_LINE}</Text>
        <Text style={styles.postingLine}>{TOPIC_POSTING_LINE}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Write a public post"
        onPress={() => router.push({ pathname: '/public/compose', params: { topic: channelId } })}
        style={({ pressed }) => [styles.composeBar, pressed && styles.pressed]}
      >
        <Text style={styles.composePrompt}>{PUBLIC_COMPOSE_PLACEHOLDER}</Text>
      </Pressable>

      {feed.loading ? (
        <View style={styles.panel}><Text style={styles.muted}>Loading the feed…</Text></View>
      ) : feed.error ? (
        <View style={styles.panel}>
          <SectionHeader title={feed.error === 'not_wired' ? 'This topic is not on the feed yet' : 'Could not load the feed'} hint="" />
          <Text style={styles.muted}>{feed.error === 'unreachable' ? 'The feed server could not be reached. Try again when you are online.' : 'Nothing to show for this topic right now.'}</Text>
        </View>
      ) : feed.posts.length === 0 ? (
        <View style={styles.panel}><Text style={styles.muted}>No posts in this topic yet. Only real, dual-signed posts appear here.</Text></View>
      ) : (
        feed.posts.map((accepted) => (
          <Pressable
            key={accepted.post.postId}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/public/post/[postId]', params: { postId: accepted.post.postId, channelId } })}
            style={({ pressed }) => [styles.postCard, pressed && styles.pressed]}
          >
            <View style={styles.postHead}>
              <Text
                style={styles.postAuthor}
                onPress={() => router.push({ pathname: '/public/persona/[persona]', params: { persona: accepted.post.personaPubkey } })}
              >{personaHandle(aliases, accepted.post.personaPubkey, shortHex(accepted.post.personaPubkey, 6, 4))}</Text>
              <Text style={styles.humanBadge}>human</Text>
              <Text style={styles.postTime}>{relativeTime(accepted.post.createdAt)}</Text>
            </View>
            <Text style={styles.postBody}>{accepted.post.body}</Text>
          </Pressable>
        ))
      )}
      <View style={{ height: insets.bottom + 48 }} />
    </ScrollView>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: -8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  title: { flex: 1, color: c.text, fontSize: 20, fontWeight: '800' },
  followPill: { borderRadius: MK_RADIUS.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: c.accent, paddingHorizontal: 12, paddingVertical: 6 },
  followPillOn: { backgroundColor: c.surfaceHigh, borderColor: c.border },
  followText: { color: c.accent, fontSize: 13, fontWeight: '700' },
  followTextOn: { color: c.textSecondary },
  panel: { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: MK_RADIUS.lg, padding: 14, gap: 6 },
  hostedLine: { color: c.textSecondary, fontSize: 13 },
  postingLine: { color: c.textSecondary, fontSize: 13, lineHeight: 20 },
  muted: { color: c.textSecondary, fontSize: 14, lineHeight: 21 },
  composeBar: { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: MK_RADIUS.lg, paddingHorizontal: 14, paddingVertical: 12 },
  composePrompt: { color: c.textSecondary, fontSize: 15 },
  postCard: { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: MK_RADIUS.lg, padding: 14, gap: 8 },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postAuthor: { color: c.text, fontSize: 14, fontWeight: '700', fontFamily: MK_MONO },
  humanBadge: { color: '#0A3F31', backgroundColor: c.success, fontSize: 9, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: MK_RADIUS.pill, overflow: 'hidden' },
  postTime: { color: c.textSecondary, fontSize: 12, marginLeft: 'auto' },
  postBody: { color: c.text, fontSize: 15, lineHeight: 22 },
});
