// Public post thread (Plan 39 P10, screen S7). A post detail opened from a feed
// card: the dual-verified root post, its verified replies, and a reply composer.
// Replies are gated writes exactly like posts (parentPostId), so they ride the SAME
// submit client and the SAME three server-side gates; a reply "sent" state appears
// only off a real acceptance receipt (NC-3). Twin behavior on web PublicThreadView.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { AcceptedPublicPost } from '@mylife/sync';
import { useMeerkatDatabase } from '../../providers/DatabaseProvider';
import { Button, HonestNotice, SectionHeader } from '../../components/kit';
import { useAppThemeColors, useMkStyles } from '../../providers/AppThemeProvider';
import { getStoredPersona, personaHandle, personaServiceConfig, resolvePersonaKeys } from '../../data/persona-core';
import { commonsFeedConfig, MAX_PUBLIC_POST_BODY, PUBLIC_FEED_TOPICS } from '../../data/public-feed';
import { loadPublicThread, replyCountLabel, type PublicThread } from '../../data/public-thread';
import { isAppUnlocked, submitPublicPost, type SubmitFailReason } from '../../data/public-post-client';
import {
  PUBLIC_REPORT_CATEGORIES,
  REPORT_SHEET_SUBMIT,
  REPORT_SHEET_SUBTITLE,
  REPORT_SHEET_TITLE,
  submitPublicReport,
  type SubmitReportReason,
} from '../../data/public-report';
import type { PublicReportReason, PublicReportTargetKind } from '@mylife/sync';
import { type MkColors, MK_MONO, MK_RADIUS, shortHex } from '../../theme/tokens';
import { blockPublicPersona } from '../../data/public-safety';

// Verbatim thread copy (mockup S7), parity-locked against the web twin.
export const THREAD_SIGNED_PREFIX = 'Signed by';
export const THREAD_HOST_SUFFIX = 'accepted by the Meerkat host';
export const THREAD_REPLY_PLACEHOLDER = 'Reply as your public name…';
export const THREAD_REPLY_LOCKED = 'Replies need the one-time unlock, like every public post.';

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h` : `${Math.round(hrs / 24)}d`;
}

function reportFailMessage(reason: SubmitReportReason): string {
  switch (reason) {
    case 'not_configured': return 'Reporting needs a connection to a Meerkat account server, and this build has none configured.';
    case 'no_persona': return 'Verify your public account first, then you can report.';
    case 'topic_not_wired': return 'This feed is not connected in this build, so the report could not be sent.';
    case 'key_unavailable': return 'Your public key is unavailable on this device, so the report could not be signed.';
    case 'unreachable': return 'The feed server could not be reached. Try again when you are online.';
    default: return 'The report was not accepted. Nothing was sent.';
  }
}

function replyFailMessage(reason: SubmitFailReason): string {
  switch (reason) {
    case 'needs_verification': return 'Your public session needs to reconnect before replying. Open the Public tab and try again.';
    case 'needs_unlock': case 'unlock': case 'unlock_unavailable': return 'Replying needs the one-time unlock confirmed with the connection server.';
    case 'needs_terms': return 'Review and accept the Terms of Use and Community Standards before replying.';
    case 'session': return 'Your public session was not accepted. Reconnect and try again.';
    case 'humanity': return 'Your verification pass was not accepted. Verify again, then reply.';
    case 'caps': return 'You are replying too fast, or this feed is full for now. Wait a little and try again.';
    case 'policy': return 'Replying to this feed is closed right now.';
    case 'unreachable': return 'The feed server could not be reached. Try again when you are online.';
    default: return 'The reply was not accepted. Nothing was posted.';
  }
}

export default function PublicThreadScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const params = useLocalSearchParams<{ postId?: string; channelId?: string }>();
  const personaConfig = useMemo(() => personaServiceConfig(), []);
  const feedConfig = useMemo(() => commonsFeedConfig(), []);

  const rootPostId = typeof params.postId === 'string' ? params.postId : '';
  const channelId = typeof params.channelId === 'string' && params.channelId.length > 0 ? params.channelId : 'commons';
  const topicMeta = PUBLIC_FEED_TOPICS.find((t) => t.channelId === channelId) ?? PUBLIC_FEED_TOPICS[0]!;
  const persona = getStoredPersona(db);
  const unlocked = isAppUnlocked(db);

  const [state, setState] = useState<{ loading: boolean; thread: PublicThread | null; error: string | null }>({ loading: true, thread: null, error: null });
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [replyBody, setReplyBody] = useState('');
  const [replyPhase, setReplyPhase] = useState<'idle' | 'posting' | 'sent' | 'failed'>('idle');
  const [replyFail, setReplyFail] = useState<SubmitFailReason | null>(null);
  const [reportTarget, setReportTarget] = useState<{ targetId: string; targetKind: PublicReportTargetKind } | null>(null);
  const [reportPhase, setReportPhase] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [reportFail, setReportFail] = useState<SubmitReportReason | null>(null);

  // Deep-linkable screen: back must not dead-end when this is the first route.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/public');
  }, []);

  const onReport = useCallback((reason: PublicReportReason) => {
    if (!reportTarget) return;
    const target = reportTarget;
    setReportPhase('sending');
    setReportFail(null);
    void submitPublicReport({ db, feedConfig }, { channelId, targetKind: target.targetKind, targetId: target.targetId, reason }).then((r) => {
      if (r.ok) {
        setReportPhase('sent');
        // Close only THIS report's sheet; a report opened for another card in the
        // meantime must not be stomped by a stale timer.
        setTimeout(() => {
          setReportTarget((cur) => (cur === target ? null : cur));
          setReportPhase((p) => (p === 'sent' ? 'idle' : p));
        }, 1400);
      } else {
        setReportFail(r.reason);
        setReportPhase('failed');
      }
    });
  }, [reportTarget, db, feedConfig, channelId]);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    void loadPublicThread(db, feedConfig, channelId, rootPostId).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setState({ loading: false, thread: r.thread, error: null });
        const keys = [r.thread.root, ...r.thread.replies].map((x) => x.post.personaPubkey);
        void resolvePersonaKeys(personaConfig, keys).then((map) => { if (!cancelled) setAliases(map); });
      } else {
        setState({ loading: false, thread: null, error: r.reason });
      }
    });
    return () => { cancelled = true; };
  }, [db, feedConfig, channelId, rootPostId, personaConfig, reloadKey]);

  const onReply = useCallback(() => {
    const trimmed = replyBody.trim();
    if (trimmed.length === 0) return;
    setReplyPhase('posting');
    setReplyFail(null);
    void submitPublicPost({ db, personaConfig, feedConfig, channelId, body: trimmed, parentPostId: rootPostId }).then((outcome) => {
      if (outcome.ok) {
        setReplyBody('');
        setReplyPhase('sent');
        setReloadKey((k) => k + 1); // re-page the thread off the node (real reply appears once propagated)
        setTimeout(() => setReplyPhase('idle'), 1200);
      } else {
        setReplyFail(outcome.reason);
        setReplyPhase('failed');
      }
    });
  }, [replyBody, db, personaConfig, feedConfig, channelId, rootPostId]);

  const renderCard = (accepted: AcceptedPublicPost, isReply: boolean) => {
    const mine = persona?.personaPubkey === accepted.post.personaPubkey;
    return (
      <View key={accepted.post.postId} style={[styles.postCard, isReply && styles.replyCard]}>
        <View style={styles.postHead}>
          <Text
            style={styles.postAuthor}
            onPress={() => router.push({ pathname: '/public/persona/[persona]', params: { persona: accepted.post.personaPubkey } })}
          >{personaHandle(aliases, accepted.post.personaPubkey, shortHex(accepted.post.personaPubkey, 6, 4))}</Text>
          {mine ? <Text style={styles.youPill}>you</Text> : <Text style={styles.humanBadge}>human</Text>}
          <Text style={styles.postTime}>{relativeTime(accepted.post.createdAt)}</Text>
        </View>
        {!mine ? (
          <View style={styles.safetyActions}>
            {persona ? (
              <Text
                accessibilityRole="button"
                style={styles.reportLink}
                onPress={() => { setReportTarget({ targetId: accepted.post.postId, targetKind: isReply ? 'reply' : 'post' }); setReportPhase('idle'); setReportFail(null); }}
              >Report</Text>
            ) : null}
            <Text
              accessibilityRole="button"
              style={styles.reportLink}
              onPress={() => {
                // A block is a real device-local write; confirm before hiding the
                // author everywhere and leaving the thread.
                Alert.alert(
                  'Block this public name?',
                  'Their public posts stop appearing on this device. Nothing is sent to them.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Block',
                      style: 'destructive',
                      onPress: () => { blockPublicPersona(db, accepted.post.personaPubkey); goBack(); },
                    },
                  ],
                );
              }}
            >Block author</Text>
          </View>
        ) : null}
        <Text style={styles.postBody}>{accepted.post.body}</Text>
        {!isReply ? (
          <>
            <Text
              style={styles.topicLine}
              onPress={() => router.push({ pathname: '/public/topic/[channel]', params: { channel: channelId } })}
            >in {topicMeta.emoji} {topicMeta.title}</Text>
            <View style={styles.divider} />
            <Text style={styles.trustLine}>🛡️ {THREAD_SIGNED_PREFIX} {personaHandle(aliases, accepted.post.personaPubkey, shortHex(accepted.post.personaPubkey, 6, 4))} · {THREAD_HOST_SUFFIX}</Text>
          </>
        ) : null}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <ChevronLeft size={24} color={c.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Post</Text>
      </View>

      {state.loading ? (
        <View style={styles.panel}><Text style={styles.muted}>Loading the thread…</Text></View>
      ) : state.error || !state.thread ? (
        <View style={styles.panel}>
          <SectionHeader title={state.error === 'not_found' ? 'This post is not on the feed' : 'Could not load the thread'} hint="" />
          <Text style={styles.muted}>{state.error === 'unreachable' ? 'The feed server could not be reached. Try again when you are online.' : 'Nothing to show here right now.'}</Text>
        </View>
      ) : (
        <>
          {renderCard(state.thread.root, false)}
          <SectionHeader title={`${replyCountLabel(state.thread.replies.length)} · newest`} hint="" />
          {state.thread.replies.map((r) => renderCard(r, true))}

          {persona ? (
            unlocked ? (
              <View style={styles.replyComposer}>
                <TextInput
                  style={styles.replyInput}
                  value={replyBody}
                  onChangeText={(t) => setReplyBody(t.slice(0, MAX_PUBLIC_POST_BODY))}
                  placeholder={THREAD_REPLY_PLACEHOLDER}
                  placeholderTextColor={c.textTertiary}
                  multiline
                  editable={replyPhase !== 'posting'}
                />
                {replyPhase === 'sent' ? <HonestNotice text="Reply posted and signed. It will appear as it propagates." /> : null}
                {replyPhase === 'failed' && replyFail ? <HonestNotice text={replyFailMessage(replyFail)} /> : null}
                <Button title={replyPhase === 'posting' ? 'Posting…' : 'Reply'} onPress={onReply} disabled={replyPhase === 'posting' || replyBody.trim().length === 0} />
              </View>
            ) : (
              <View style={styles.panel}>
                <HonestNotice text={THREAD_REPLY_LOCKED} />
                <Button title="Unlock to reply" variant="secondary" onPress={() => router.push('/upgrade')} />
              </View>
            )
          ) : null}
        </>
      )}
      <View style={{ height: insets.bottom + 48 }} />

      <Modal visible={reportTarget !== null} transparent animationType="fade" onRequestClose={() => setReportTarget(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setReportTarget(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{REPORT_SHEET_TITLE}</Text>
            <Text style={styles.sheetSubtitle}>{REPORT_SHEET_SUBTITLE}</Text>
            {reportPhase === 'sent' ? (
              <HonestNotice text="Report sent to Meerkat trust & safety." />
            ) : (
              <>
                {reportPhase === 'failed' && reportFail ? <HonestNotice text={reportFailMessage(reportFail)} /> : null}
                {PUBLIC_REPORT_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.id}
                    accessibilityRole="button"
                    disabled={reportPhase === 'sending'}
                    style={({ pressed }) => [styles.reasonRow, pressed && styles.pressed]}
                    onPress={() => onReport(cat.id)}
                  >
                    <Text style={styles.reasonLabel}>{cat.label}</Text>
                    {cat.hint ? <Text style={styles.reasonHint}>{cat.hint}</Text> : null}
                  </Pressable>
                ))}
                <Text style={styles.sheetSubmitHint}>{reportPhase === 'sending' ? 'Sending…' : REPORT_SHEET_SUBMIT}</Text>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  panel: { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: MK_RADIUS.lg, padding: 16, gap: 10 },
  muted: { color: c.textSecondary, fontSize: 14, lineHeight: 21 },
  postCard: { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: MK_RADIUS.lg, padding: 14, gap: 8 },
  replyCard: { marginLeft: 14 },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postAuthor: { color: c.text, fontSize: 14, fontWeight: '700', fontFamily: MK_MONO },
  humanBadge: { color: '#0A3F31', backgroundColor: c.success, fontSize: 9, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: MK_RADIUS.pill, overflow: 'hidden' },
  youPill: { color: c.text, backgroundColor: c.surfaceHigh, fontSize: 9, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: MK_RADIUS.pill, overflow: 'hidden' },
  postTime: { color: c.textSecondary, fontSize: 12, marginLeft: 'auto' },
  postBody: { color: c.text, fontSize: 15, lineHeight: 22 },
  topicLine: { color: c.textSecondary, fontSize: 12.5 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: 4 },
  trustLine: { color: c.textSecondary, fontSize: 12, lineHeight: 18 },
  replyComposer: { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: MK_RADIUS.lg, padding: 14, gap: 10 },
  replyInput: { minHeight: 64, color: c.text, fontSize: 15, lineHeight: 22, textAlignVertical: 'top' },
  reportLink: { color: c.textSecondary, fontSize: 12.5, fontWeight: '600' },
  safetyActions: { flexDirection: 'row', gap: 16 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: MK_RADIUS.lg, borderTopRightRadius: MK_RADIUS.lg, padding: 20, gap: 10 },
  sheetTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  sheetSubtitle: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  reasonRow: { backgroundColor: c.surfaceHigh, borderRadius: MK_RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, gap: 3 },
  reasonLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
  reasonHint: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  sheetSubmitHint: { color: c.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 2 },
});
