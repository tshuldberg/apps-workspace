// New public post composer (Plan 39 P10, screens S5/S6). The pay-to-post gate is
// the EXISTING founder-locked meerkat_app_unlock $4.99 one-time SKU (NC-P5, no new
// price); the sheet is UX, the real gate is server-side on /submit. A "posted"
// state appears ONLY after a real dual-signed acceptance receipt (NC-3); every
// rejection shows the honest machine bucket. Twin of the web PublicComposeView.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Button, HonestNotice } from '../components/kit';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useIdentity } from '../providers/IdentityProvider';
import { setSetting } from '../data/db';
import {
  APP_UNLOCK_PURCHASED_AT_KEY,
  APP_UNLOCK_RECEIPT_KEY,
  FALLBACK_UNLOCK_PRICE_LABEL,
  purchaseAppUnlock,
  restoreAppUnlock,
} from '../data/app-unlock';
import { getStoredPersona, personaServiceConfig } from '../data/persona-core';
import { getStoredHumanityTokenCount, humanityServiceConfig } from '../data/humanity-core';
import { isAppUnlocked, submitPublicPost, type SubmitFailReason } from '../data/public-post-client';
import { PUBLIC_FEED_TOPICS, MAX_PUBLIC_POST_BODY, PUBLIC_COMPOSE_PLACEHOLDER } from '../data/public-feed';
import { hasAcceptedPublicTerms } from '../data/public-safety';

// Verbatim composer copy (mockups S5/S6), parity-locked against the web twin.
export const COMPOSE_UNLOCK_TITLE = 'Unlock posting, once, forever';
export const COMPOSE_UNLOCK_BODY = 'Reading is free for every verified human. Posting anywhere on public Meerkat needs the one-time unlock. No subscription.';
export const COMPOSE_UNLOCK_PRICE_NOTE = 'one time · unlocks the full app too';
export const COMPOSE_UNLOCK_CTA = 'Unlock and post';
export const COMPOSE_RESTORE_CTA = 'Restore purchase';
export const COMPOSE_BEFORE_LIVE_TITLE = 'Before this goes live';
export const COMPOSE_BEFORE_SIGNED = 'Signed by your public name, not your device';
export const COMPOSE_BEFORE_PUBLIC = 'Public and visible to every verified member; removable by you or moderators';
export const COMPOSE_BEFORE_ADMISSION = 'Admission to this feed is checked by the Meerkat host, like any public platform';

function walletNotice(remaining: number): string {
  return `1 verification pass will be spent to post. Wallet: ${remaining} remaining.`;
}

function failMessage(reason: SubmitFailReason, detail?: string): string {
  switch (reason) {
    case 'not_configured':
      return 'The public feed is not connected in this build, so there is nowhere to post yet.';
    case 'not_wired':
      return 'This topic is not on the feed yet.';
    case 'needs_verification':
      return 'Your public session needs to be renewed. Reconnect on the Public tab, then try again.';
    case 'needs_unlock':
      return 'Posting needs the one-time unlock first.';
    case 'needs_terms':
      return 'Review and accept the Terms of Use and Community Standards before posting.';
    case 'unlock_unavailable':
      return 'This device is unlocked, but the connection server could not confirm your purchase to post. Link your purchase, then try again.';
    case 'session':
      return 'Your public session was not accepted. Reconnect on the Public tab and try again.';
    case 'humanity':
      return 'Your verification pass was not accepted. Verify again, then post.';
    case 'unlock':
      return 'The server did not accept your unlock. Restore your purchase, then try again.';
    case 'policy':
      return 'Posting to this feed is closed right now.';
    case 'caps':
      return 'You are posting too fast, or this feed is full for now. Wait a little and try again.';
    case 'unreachable':
      return 'The feed server could not be reached. Try again when you are online.';
    case 'rejected':
    default:
      return detail === 'post_too_large'
        ? 'That post is longer than the feed allows. Shorten it and try again.'
        : 'The post was not accepted. Nothing was published.';
  }
}

type Phase = 'idle' | 'purchasing' | 'restoring' | 'posting' | 'sent' | 'failed';

export default function PublicComposeScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const params = useLocalSearchParams<{ topic?: string }>();
  const personaConfig = useMemo(() => personaServiceConfig(), []);

  const persona = getStoredPersona(db);
  const activeTopic = typeof params.topic === 'string' && params.topic.length > 0 ? params.topic : 'commons';
  const topicMeta = PUBLIC_FEED_TOPICS.find((t) => t.channelId === activeTopic) ?? PUBLIC_FEED_TOPICS[0]!;

  const [unlocked, setUnlocked] = useState(() => isAppUnlocked(db));
  const termsAccepted = hasAcceptedPublicTerms(db);
  const [body, setBody] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [note, setNote] = useState<string | null>(null);
  const [failReason, setFailReason] = useState<{ reason: SubmitFailReason; detail?: string } | null>(null);
  const [walletCount, setWalletCount] = useState(0);

  useEffect(() => {
    setWalletCount(getStoredHumanityTokenCount(db, humanityServiceConfig()));
  }, [db, phase]);

  // Deep-linkable screen: back must not dead-end when this is the first route.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/public');
  }, []);

  // The post-"Posted" auto-back timer: cleared on unmount so a stale timer can
  // never pop a screen the user already navigated away from.
  const backTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (backTimerRef.current !== null) clearTimeout(backTimerRef.current);
  }, []);

  const persistUnlock = useCallback((purchaseDate: string | null) => {
    setSetting(db, APP_UNLOCK_RECEIPT_KEY, 'unlocked');
    if (purchaseDate) setSetting(db, APP_UNLOCK_PURCHASED_AT_KEY, purchaseDate);
    setUnlocked(true);
  }, [db]);

  const onUnlock = useCallback(() => {
    setPhase('purchasing');
    setNote(null);
    void (async () => {
      const outcome = await purchaseAppUnlock(identity);
      if (outcome.ok && outcome.unlock.unlocked) {
        persistUnlock(outcome.unlock.purchaseDate);
        setPhase('idle');
      } else if (outcome.ok) {
        setNote('The purchase did not register an unlock. Try Restore, or contact support.');
        setPhase('idle');
      } else if (outcome.cancelled) {
        setPhase('idle');
      } else {
        setNote(outcome.error);
        setPhase('idle');
      }
    })();
  }, [identity, persistUnlock]);

  const onRestore = useCallback(() => {
    setPhase('restoring');
    setNote(null);
    void (async () => {
      const result = await restoreAppUnlock(identity);
      if (result.ok && result.unlock.unlocked) {
        persistUnlock(result.unlock.purchaseDate);
        setPhase('idle');
      } else if (result.ok) {
        setNote('No previous purchase found on this store account.');
        setPhase('idle');
      } else {
        setNote(result.error);
        setPhase('idle');
      }
    })();
  }, [identity, persistUnlock]);

  const onPost = useCallback(() => {
    const trimmed = body.trim();
    if (trimmed.length === 0) return;
    setPhase('posting');
    setFailReason(null);
    void (async () => {
      const outcome = await submitPublicPost({ db, personaConfig, channelId: activeTopic, body: trimmed });
      setWalletCount(getStoredHumanityTokenCount(db, humanityServiceConfig()));
      if (outcome.ok) {
        setPhase('sent');
        // Hand back to the Public tab so it re-pages the real feed off the node.
        backTimerRef.current = setTimeout(goBack, 700);
      } else {
        setFailReason({ reason: outcome.reason, detail: outcome.detail });
        setPhase('failed');
      }
    })();
  }, [body, db, personaConfig, activeTopic, goBack]);

  const busy = phase === 'purchasing' || phase === 'restoring' || phase === 'posting';
  const remaining = MAX_PUBLIC_POST_BODY - body.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <ChevronLeft size={24} color={c.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>New post</Text>
        {unlocked && phase !== 'sent' ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy || !termsAccepted || body.trim().length === 0}
            onPress={onPost}
            style={({ pressed }) => [styles.postBtn, (busy || !termsAccepted || body.trim().length === 0) && styles.postBtnDisabled, pressed && styles.pressed]}
          >
            <Text style={styles.postBtnText}>{phase === 'posting' ? 'Posting…' : 'Post'}</Text>
          </Pressable>
        ) : null}
      </View>

      {!persona ? (
        <View style={styles.panel}>
          <HonestNotice text="Create your public name first to post. Head to the Public tab to verify and pick an alias." />
        </View>
      ) : phase === 'sent' ? (
        <View style={styles.panel}>
          <Text style={styles.sentTitle}>Posted</Text>
          <Text style={styles.body}>Your post was accepted and signed. It will appear on the feed as it propagates.</Text>
        </View>
      ) : (
        <>
          <View style={styles.pcard}>
            <View style={styles.phead}>
              <View style={styles.avatar}><Text style={styles.avatarLetter}>{(persona.alias[0] ?? '?').toUpperCase()}</Text></View>
              <Text style={styles.pname}>@{persona.alias}</Text>
              <Text style={styles.topicChip}>{topicMeta.emoji} {topicMeta.title}</Text>
            </View>
            <TextInput
              style={styles.input}
              value={body}
              onChangeText={(t) => setBody(t.slice(0, MAX_PUBLIC_POST_BODY))}
              placeholder={PUBLIC_COMPOSE_PLACEHOLDER}
              placeholderTextColor={c.textTertiary}
              multiline
              editable={unlocked && !busy}
            />
            <Text style={styles.counter}>{remaining}</Text>
          </View>

          {unlocked ? (
            <>
              {!termsAccepted ? (
                <View style={styles.panel}>
                  <HonestNotice text="Review and accept the Terms of Use and Community Standards before posting." />
                  <Button title="Review legal and safety" variant="secondary" onPress={() => router.push('/about-status')} />
                </View>
              ) : null}
              <View style={styles.pcard}>
                <Text style={styles.sectionTitle}>{COMPOSE_BEFORE_LIVE_TITLE}</Text>
                <Text style={styles.rowsub}>✍️ {COMPOSE_BEFORE_SIGNED} (@{persona.alias})</Text>
                <Text style={styles.rowsub}>🌍 {COMPOSE_BEFORE_PUBLIC}</Text>
                <Text style={styles.rowsub}>⚖️ {COMPOSE_BEFORE_ADMISSION}</Text>
              </View>
              <HonestNotice text={walletNotice(walletCount)} />
              {phase === 'failed' && failReason ? <HonestNotice text={failMessage(failReason.reason, failReason.detail)} /> : null}
            </>
          ) : (
            <View style={styles.sheet}>
              <Text style={styles.lockGlyph}>🔒</Text>
              <Text style={styles.unlockTitle}>{COMPOSE_UNLOCK_TITLE}</Text>
              <Text style={styles.unlockBody}>{COMPOSE_UNLOCK_BODY}</Text>
              <Text style={styles.priceBig}>{FALLBACK_UNLOCK_PRICE_LABEL}</Text>
              <Text style={styles.priceNote}>{COMPOSE_UNLOCK_PRICE_NOTE}</Text>
              {busy ? (
                <View style={styles.centerRow}><ActivityIndicator color={c.accent} /><Text style={styles.muted}>{phase === 'restoring' ? 'Checking your purchases…' : 'Opening the store…'}</Text></View>
              ) : (
                <>
                  <Button title={COMPOSE_UNLOCK_CTA} onPress={onUnlock} />
                  <Button title={COMPOSE_RESTORE_CTA} variant="secondary" onPress={onRestore} />
                </>
              )}
              {note ? <HonestNotice text={note} /> : null}
            </View>
          )}
        </>
      )}
      <View style={{ height: insets.bottom + 64 }} />
    </ScrollView>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: -8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  title: { flex: 1, color: c.text, fontSize: 22, fontWeight: '800' },
  postBtn: { backgroundColor: c.accent, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 7 },
  postBtnDisabled: { opacity: 0.4 },
  postBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  panel: { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: MK_RADIUS.lg, padding: 16, gap: 10 },
  pcard: { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: MK_RADIUS.lg, padding: 14, gap: 8 },
  phead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontWeight: '800', fontSize: 14 },
  pname: { color: c.text, fontSize: 15, fontWeight: '700' },
  topicChip: { marginLeft: 'auto', color: c.textSecondary, backgroundColor: c.surfaceHigh, borderRadius: MK_RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, fontWeight: '600', overflow: 'hidden' },
  input: { minHeight: 96, color: c.text, fontSize: 16, lineHeight: 23, textAlignVertical: 'top' },
  counter: { color: c.textSecondary, fontSize: 12, textAlign: 'right' },
  sectionTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  rowsub: { color: c.textSecondary, fontSize: 13.5, lineHeight: 20 },
  sheet: { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: MK_RADIUS.lg, padding: 18, gap: 8, alignItems: 'center' },
  lockGlyph: { fontSize: 26 },
  unlockTitle: { color: c.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  unlockBody: { color: c.textSecondary, fontSize: 13.5, lineHeight: 20, textAlign: 'center', maxWidth: 260 },
  priceBig: { color: c.text, fontSize: 34, fontWeight: '900', marginTop: 4 },
  priceNote: { color: c.textSecondary, fontSize: 12.5, marginBottom: 6 },
  centerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  muted: { color: c.textSecondary, fontSize: 14 },
  sentTitle: { color: c.accent, fontSize: 20, fontWeight: '800' },
  body: { color: c.text, fontSize: 15, lineHeight: 22 },
});
