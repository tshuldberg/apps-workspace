// Public tab (Plan 39 P10, screen S1/S4). The front door to the public tier. Verify-to-view is
// enforced server-side (Plan 39 P9); this screen is the honest client face of that gate, never a
// cosmetic overlay. It reads the real verify-to-view state and shows the locked feed until the
// user has a verified public persona + session, then the base-feed shell (The Commons).
//
// HONESTY: nothing is fabricated. With no account server configured the tab says so; verified but
// with no commons node connected shows the honest "not connected in this build" state. A post
// card renders only from a real, dual-verified public post fetched from a configured node.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import type { AcceptedPublicPost } from '@mylife/sync';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { Button, HonestNotice, SectionHeader } from '../components/kit';
import { ensurePersonaSession, getStoredPersona, personaHandle, personaServiceConfig, resolvePersonaKeys } from '../data/persona-core';
import {
  SELF_HOSTED_BOUNDARY_NOTICE,
  VERIFY_TO_VIEW_LOCKED_BODY,
  VERIFY_TO_VIEW_LOCKED_TITLE,
  VERIFY_TO_VIEW_NOT_CONFIGURED,
  VERIFY_TO_VIEW_PRICE_LINE,
  verifyToViewState,
} from '../data/verify-to-view';
import { commonsFeedConfig, isCommonsFeedConfigured, loadCommonsTopic, PUBLIC_COMPOSE_PLACEHOLDER, PUBLIC_FEED_TOPICS } from '../data/public-feed';
import { type MkColors, MK_MONO, MK_RADIUS, shortHex } from '../theme/tokens';
import { useMkStyles } from '../providers/AppThemeProvider';

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export default function PublicScreen() {
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const personaConfig = useMemo(() => personaServiceConfig(), []);
  const feedConfig = useMemo(() => commonsFeedConfig(), []);
  const [tick, setTick] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const [activeTopic, setActiveTopic] = useState('commons');
  const [reloadKey, setReloadKey] = useState(0);
  const [feed, setFeed] = useState<{ loading: boolean; posts: AcceptedPublicPost[]; error: string | null }>({ loading: false, posts: [], error: null });
  const [aliases, setAliases] = useState<Record<string, string>>({});

  // Re-read the state on each render tick (after verify / session acquisition).
  const state = verifyToViewState(db, personaConfig);
  void tick;

  const configured = isCommonsFeedConfigured(feedConfig);
  const persona = getStoredPersona(db);

  // Returning from the composer re-pages the real feed off the node (a posted item
  // appears once it propagates; nothing is optimistically injected).
  useFocusEffect(useCallback(() => { setReloadKey((k) => k + 1); }, []));

  // Load the active topic's real, dual-verified posts when verified + a feed is connected.
  useEffect(() => {
    if (state !== 'verified' || !configured) return;
    let cancelled = false;
    setFeed((f) => ({ ...f, loading: true, error: null }));
    void loadCommonsTopic(db, feedConfig, activeTopic).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setFeed({ loading: false, posts: result.posts, error: null });
        // Batch-resolve author aliases (registered only; absent => short-id fallback).
        void resolvePersonaKeys(personaConfig, result.posts.map((p) => p.post.personaPubkey)).then((map) => {
          if (!cancelled) setAliases(map);
        });
      } else {
        setFeed({ loading: false, posts: [], error: result.reason });
      }
    });
    return () => { cancelled = true; };
  }, [state, configured, activeTopic, db, feedConfig, personaConfig, reloadKey]);

  const onReconnect = useCallback(() => {
    setReconnecting(true);
    void (async () => {
      const result = await ensurePersonaSession(db, personaConfig); // acquire + cache a fresh bearer
      setReconnecting(false);
      // A failed renewal because the humanity wallet is empty means the user must verify again;
      // route them to the persona flow instead of leaving Continue stuck on the same prompt.
      if (!result.ok && (result.reason === 'needs_verification' || result.reason === 'no_persona')) {
        router.push('/persona/create');
        return;
      }
      setTick((t) => t + 1);
    })();
  }, [db, personaConfig]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>Public</Text>
        {state === 'verified' ? (
          <Text style={styles.exploreLink} onPress={() => router.push('/public/explore')}>Explore</Text>
        ) : null}
      </View>

      {state === 'not_configured' ? (
        <View style={styles.panel}>
          <View style={styles.lockRow}><Text style={styles.lockBig}>🔒</Text></View>
          <SectionHeader title="Public accounts are off in this build" hint="" />
          <HonestNotice text={VERIFY_TO_VIEW_NOT_CONFIGURED} />
        </View>
      ) : state === 'locked' ? (
        <>
          <View style={styles.emptyState}>
            <Text style={styles.lockBig}>🔒</Text>
            <Text style={styles.lockTitle}>{VERIFY_TO_VIEW_LOCKED_TITLE}</Text>
            <Text style={styles.lockBody}>{VERIFY_TO_VIEW_LOCKED_BODY}</Text>
          </View>
          <View style={styles.panel}>
            <SectionHeader title="What verification means" hint="" />
            <Text style={styles.bullet}>{'✓'} Proves a human is behind the account, not a bot</Text>
            <Text style={styles.bullet}>{'✓'} Stores no name, email, or phone number</Text>
            <Text style={styles.bullet}>{'✓'} Your private communities never need this</Text>
          </View>
          <Button title="Verify I'm human" onPress={() => router.push('/persona/create')} />
          <Text style={styles.priceLine}>{VERIFY_TO_VIEW_PRICE_LINE}</Text>
          <HonestNotice text={SELF_HOSTED_BOUNDARY_NOTICE} />
        </>
      ) : state === 'needs_session' ? (
        <View style={styles.panel}>
          <SectionHeader title="Reconnecting your public session" hint="One quick check to browse." />
          <Text style={styles.lockBody}>Your public session expired. Reconnect to browse the public feed. It uses one of your verification passes.</Text>
          <Button title={reconnecting ? 'Reconnecting...' : 'Continue'} onPress={onReconnect} disabled={reconnecting} />
        </View>
      ) : (
        <>
          <View style={styles.chipRail}>
            {PUBLIC_FEED_TOPICS.map((topic) => (
              <Text
                key={topic.channelId}
                onPress={() => setActiveTopic(topic.channelId)}
                style={[styles.chip, activeTopic === topic.channelId ? styles.chipActive : null]}
              >
                {topic.emoji} {topic.title}
              </Text>
            ))}
          </View>
          {persona ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Write a public post"
              onPress={() => router.push({ pathname: '/public/compose', params: { topic: activeTopic } })}
              style={({ pressed }) => [styles.composeBar, pressed && styles.composePressed]}
            >
              <View style={styles.composeAvatar}><Text style={styles.composeAvatarLetter}>{(persona.alias[0] ?? '?').toUpperCase()}</Text></View>
              <Text style={styles.composePrompt}>{PUBLIC_COMPOSE_PLACEHOLDER}</Text>
            </Pressable>
          ) : null}
          {!configured ? (
            <View style={styles.panel}>
              <SectionHeader title="The public feed is not connected in this build" hint="" />
              <HonestNotice text="You are verified, but this build has no first-party feed server connected yet, so there is nothing to show. Your private Meerkat works fully without it." />
              <HonestNotice text={SELF_HOSTED_BOUNDARY_NOTICE} />
            </View>
          ) : feed.loading ? (
            <View style={styles.panel}><Text style={styles.lockBody}>Loading the feed...</Text></View>
          ) : feed.error ? (
            <View style={styles.panel}>
              <SectionHeader title={feed.error === 'not_wired' ? 'This topic is not on the feed yet' : 'Could not load the feed'} hint="" />
              <Text style={styles.lockBody}>{feed.error === 'unreachable' ? 'The feed server could not be reached. Try again when you are online.' : 'Nothing to show for this topic right now.'}</Text>
            </View>
          ) : feed.posts.length === 0 ? (
            <View style={styles.panel}>
              <SectionHeader title="No posts yet" hint="" />
              <Text style={styles.lockBody}>The feed will fill in as verified people post. Only real, dual-signed posts appear here.</Text>
            </View>
          ) : (
            feed.posts.map((accepted) => (
              <Pressable
                key={accepted.post.postId}
                accessibilityRole="button"
                accessibilityLabel="Open post thread"
                onPress={() => router.push({ pathname: '/public/post/[postId]', params: { postId: accepted.post.postId, channelId: activeTopic } })}
                style={({ pressed }) => [styles.postCard, pressed && styles.composePressed]}
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
        </>
      )}

      <View style={{ height: insets.bottom + 48 }} />
    </ScrollView>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  exploreLink: { color: c.accent, fontSize: 15, fontWeight: '700' },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 10,
  },
  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  lockRow: { alignItems: 'center' },
  lockBig: { fontSize: 44 },
  lockTitle: { color: c.text, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  lockBody: { color: c.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 300 },
  bullet: { color: c.textSecondary, fontSize: 14, lineHeight: 21 },
  priceLine: { color: c.textSecondary, fontSize: 13, textAlign: 'center' },
  chipRail: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    color: c.textSecondary,
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
  },
  chipActive: { color: '#fff', backgroundColor: c.accent },
  composeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  composePressed: { opacity: 0.6 },
  composeAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  composeAvatarLetter: { color: '#fff', fontWeight: '800', fontSize: 13 },
  composePrompt: { color: c.textSecondary, fontSize: 15 },
  postCard: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 14,
    gap: 8,
  },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postAuthor: { color: c.text, fontSize: 14, fontWeight: '700', fontFamily: MK_MONO },
  humanBadge: {
    color: '#0A3F31',
    backgroundColor: c.success,
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: MK_RADIUS.pill,
    overflow: 'hidden',
  },
  postTime: { color: c.textSecondary, fontSize: 12, marginLeft: 'auto' },
  postBody: { color: c.text, fontSize: 15, lineHeight: 22 },
});
