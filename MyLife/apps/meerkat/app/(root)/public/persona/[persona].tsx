// Public persona profile (Plan 39 P10, screen S8). An alias is a real social
// identity: follow it and read its public posts. The profile is assembled PURELY
// from persona-signed public events -- by architecture there is nothing else to
// show, and the honest privacy line says so. Follow writes the device-local
// cm_public_follows row (track-a's follows foundation). Twin: web PublicProfileView.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMeerkatDatabase } from '../../providers/DatabaseProvider';
import { Button, HonestNotice, SectionHeader } from '../../components/kit';
import { useAppThemeColors, useMkStyles } from '../../providers/AppThemeProvider';
import { personaHandle, personaServiceConfig, resolvePersonaKeys } from '../../data/persona-core';
import { commonsFeedConfig, PUBLIC_FEED_TOPICS } from '../../data/public-feed';
import { loadPersonaProfile, publicPostCountLabel, type PersonaProfile } from '../../data/public-profile';
import { isFollowingPublic, toggleFollowPublic } from '../../data/public-follows';
import { type MkColors, MK_MONO, MK_RADIUS, shortHex } from '../../theme/tokens';

// Verbatim profile copy (mockup S8), parity-locked against the web twin.
export const PROFILE_PRIVACY_NOTE = 'Public personas show only what their owner posts publicly. No device, location, or private-community information exists here.';
export const PROFILE_FOLLOW = 'Follow';
export const PROFILE_FOLLOWING = 'Following';

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h` : `${Math.round(hrs / 24)}d`;
}

export default function PublicPersonaScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const params = useLocalSearchParams<{ persona?: string }>();
  const personaConfig = useMemo(() => personaServiceConfig(), []);
  const feedConfig = useMemo(() => commonsFeedConfig(), []);

  const personaPubkey = typeof params.persona === 'string' ? params.persona.toLowerCase() : '';
  const shortId = personaPubkey ? shortHex(personaPubkey, 6, 4) : '';

  const [state, setState] = useState<{ loading: boolean; profile: PersonaProfile | null; error: string | null }>({ loading: true, profile: null, error: null });
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    setFollowing(isFollowingPublic(db, 'persona', personaPubkey));
  }, [db, personaPubkey]);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    void resolvePersonaKeys(personaConfig, [personaPubkey]).then((map) => { if (!cancelled) setAliases(map); });
    void loadPersonaProfile(db, feedConfig, personaPubkey).then((r) => {
      if (cancelled) return;
      if (r.ok) setState({ loading: false, profile: r.profile, error: null });
      else setState({ loading: false, profile: null, error: r.reason });
    });
    return () => { cancelled = true; };
  }, [db, feedConfig, personaConfig, personaPubkey]);

  const handle = personaHandle(aliases, personaPubkey, shortId);

  const onToggleFollow = useCallback(() => {
    const now = toggleFollowPublic(db, 'persona', personaPubkey, handle);
    setFollowing(now);
  }, [db, personaPubkey, handle]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/public'); }} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <ChevronLeft size={24} color={c.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{handle}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.avatar}><Text style={styles.avatarLetter}>{(handle.replace(/^@/, '')[0] ?? '?').toUpperCase()}</Text></View>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{handle}</Text>
          <Text style={styles.humanBadge}>human</Text>
        </View>
        {state.profile ? <Text style={styles.countLine}>{publicPostCountLabel(state.profile.posts.length)}</Text> : null}
        <Button title={following ? PROFILE_FOLLOWING : PROFILE_FOLLOW} variant={following ? 'secondary' : 'primary'} onPress={onToggleFollow} />
      </View>

      <HonestNotice text={PROFILE_PRIVACY_NOTE} />

      <SectionHeader title="Posts" hint="" />
      {state.loading ? (
        <View style={styles.panel}><Text style={styles.muted}>Loading posts…</Text></View>
      ) : state.error ? (
        <View style={styles.panel}>
          <Text style={styles.muted}>{state.error === 'not_configured' ? 'The public feed is not connected in this build.' : 'Could not reach the feed to load this profile. Try again when you are online.'}</Text>
        </View>
      ) : !state.profile || state.profile.posts.length === 0 ? (
        <View style={styles.panel}><Text style={styles.muted}>No public posts from this persona yet.</Text></View>
      ) : (
        state.profile.posts.map((accepted) => {
          const channelId = state.profile!.channelByPostId[accepted.post.postId] ?? 'commons';
          const topic = PUBLIC_FEED_TOPICS.find((t) => t.channelId === channelId) ?? PUBLIC_FEED_TOPICS[0]!;
          return (
            <Pressable
              key={accepted.post.postId}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/public/post/[postId]', params: { postId: accepted.post.postId, channelId } })}
              style={({ pressed }) => [styles.postCard, pressed && styles.pressed]}
            >
              <Text style={styles.postMeta}>in {topic.emoji} {topic.title} · {relativeTime(accepted.post.createdAt)}</Text>
              <Text style={styles.postBody}>{accepted.post.body}</Text>
            </Pressable>
          );
        })
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
  title: { flex: 1, color: c.text, fontSize: 20, fontWeight: '800', fontFamily: MK_MONO },
  card: { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: MK_RADIUS.lg, padding: 16, gap: 8, alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontWeight: '800', fontSize: 22 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: c.text, fontSize: 17, fontWeight: '800' },
  humanBadge: { color: '#0A3F31', backgroundColor: c.success, fontSize: 9, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: MK_RADIUS.pill, overflow: 'hidden' },
  countLine: { color: c.textSecondary, fontSize: 13 },
  panel: { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: MK_RADIUS.lg, padding: 16 },
  muted: { color: c.textSecondary, fontSize: 14, lineHeight: 21 },
  postCard: { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: MK_RADIUS.lg, padding: 14, gap: 6 },
  postMeta: { color: c.textSecondary, fontSize: 12.5 },
  postBody: { color: c.text, fontSize: 15, lineHeight: 22 },
});
