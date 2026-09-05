import { saveInvitationIntent, clearInvitationIntent } from '../data/invitation-intent-core';
// InvitePreviewSheet (Plan 31 Phase 1, T1.2): the ONE preview every join door
// renders before any join runs. Shows the community name, member + channel
// counts, an expiry countdown, and the inviter-role line, with a single primary
// Join button. A malformed / failed-verification link renders ONLY the existing
// reason text and no Join button (NC-1: nothing joins without an explicit tap).
// On success it navigates to the community's first channel.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Href, useRouter } from 'expo-router';
import { Users, X } from 'lucide-react-native';
import { joinCommunityFromLink } from '@mylife/sync';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { getIdentityRow } from '../data/db';
import { useIdentity } from '../providers/IdentityProvider';
import { useSync } from '../providers/SyncProvider';
import {
  executeJoin,
  formatInviteExpiry,
  inviterRoleLine,
  joinReasonText,
  previewInvite,
  type ExecuteJoinResult,
} from '../data/join-flow';
import { Button, HonestNotice } from './kit';
// Plan 52 P3: the join-time name copy is parity-locked with the web sheet.
export const JOIN_NAME_LABEL = 'Your name in this community';
export const JOIN_NAME_HINT =
  'Only this community sees this name. Your other devices use it here too. You can change it later in community settings.';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

export function InvitePreviewSheet({
  link,
  visible,
  onClose,
  onJoined,
  onNavigate,
}: {
  /** The raw invite link to preview; null renders nothing. */
  link: string | null;
  visible: boolean;
  onClose: () => void;
  /** Called with the successful join result so a host can surface the notice. */
  onJoined?: (result: Extract<ExecuteJoinResult, { ok: true }>) => void;
  /**
   * Overrides the built-in flush-after-dismissal navigation queue. A host that
   * renders this sheet INSIDE its own Modal (OnboardingGate) MUST own the
   * queue: when that Modal hides in the join commit, this wrapper unmounts
   * with it (Android unmounts Modal children the moment visible flips false),
   * so a queue held here would be lost with the joined channel never opened.
   */
  onNavigate?: (target: Href) => void;
}) {
  const router = useRouter();
  // The post-join navigation is queued here and flushed only after this Modal's
  // native teardown completes (onDismiss on iOS, a Platform-gated visibility
  // effect on Android). Navigating in the same commit that hides the Modal is
  // the freeze class from PROMPT-002.
  const [pendingNav, setPendingNav] = useState<Href | null>(null);
  const flushPendingNav = useCallback(() => {
    if (!pendingNav) return;
    setPendingNav(null);
    router.push(pendingNav);
  }, [pendingNav, router]);
  useEffect(() => {
    if (Platform.OS === 'ios') return;
    if (!visible || link === null) flushPendingNav();
  }, [visible, link, flushPendingNav]);
  return (
    <Modal visible={visible && link !== null} transparent animationType="slide" onRequestClose={onClose} onDismiss={flushPendingNav}>
      <Pressable style={styles0.backdrop} onPress={onClose} accessibilityLabel="Close" />
      {link !== null ? <InvitePreviewBody key={link} link={link} onClose={onClose} onJoined={onJoined} onNavigate={onNavigate ?? setPendingNav} /> : null}
    </Modal>
  );
}

function InvitePreviewBody({
  link,
  onClose,
  onJoined,
  onNavigate,
}: {
  link: string;
  onClose: () => void;
  onJoined?: (result: Extract<ExecuteJoinResult, { ok: true }>) => void;
  /** Queues the post-join destination; the wrapper navigates after dismissal. */
  onNavigate: (target: Href) => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { queueJoinRequest, runForegroundDrain, applyJoinDisplayName } = useSync();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    saveInvitationIntent(db, link);

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [link, db]);
  const verifiedPreview = useMemo(() => previewInvite(link), [link]);
  const preview = verifiedPreview.ok && Date.parse(verifiedPreview.expiresAt) <= now
    ? { ok: false as const, reason: 'expired' as const, message: joinReasonText('expired') }
    : verifiedPreview;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Plan 52 P3: the name to present in THIS community, prefilled with the
  // person's global name. It applies across every linked device.
  const [joinName, setJoinName] = useState(() => getIdentityRow(db)?.display_name ?? '');

  const onJoin = useCallback(() => {
    setBusy(true);
    setError(null);
    void executeJoin({
      link,
      joinFromLink: (l) => joinCommunityFromLink(db, identity, l),
      queueJoinRequest,
      runPostJoinDrain: runForegroundDrain,
      joinDisplayName: joinName,
      applyJoinDisplayName,
    })
      .then((result) => {
        if (!result.ok) {
          setError(result.message);
          return;
        }
        clearInvitationIntent(db, link);
        onJoined?.(result);
        onNavigate(result.firstChannelId
          ? {
              pathname: '/channel/[communityId]/[channelId]',
              params: { communityId: result.communityId, channelId: result.firstChannelId },
            }
          : { pathname: '/community/[communityId]', params: { communityId: result.communityId } });
        onClose();
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not join.'))
      .finally(() => setBusy(false));
  }, [db, identity, link, joinName, queueJoinRequest, runForegroundDrain, applyJoinDisplayName, onJoined, onClose, onNavigate]);

  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.handleRow}><View style={styles.handle} /></View>

      <View style={styles.header}>
        <View style={styles.mark}>
          <Users size={22} color={c.accent} strokeWidth={1.9} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
        >
          <X size={20} color={c.textSecondary} strokeWidth={2} />
        </Pressable>
      </View>

      {preview.ok ? (
        <>
          <Text style={styles.title}>{preview.name}</Text>
          <Text style={styles.meta}>
            {preview.memberCount} member{preview.memberCount === 1 ? '' : 's'} · {preview.channelCount} channel{preview.channelCount === 1 ? '' : 's'}
          </Text>
          <Text style={styles.subMeta}>{inviterRoleLine(preview.inviterRole)}</Text>
          <Text style={styles.subMeta}>{formatInviteExpiry(preview.expiresAt, new Date(now))}</Text>
          <Text style={styles.fieldLabel}>{JOIN_NAME_LABEL}</Text>
          <TextInput
            style={styles.input}
            value={joinName}
            onChangeText={setJoinName}
            placeholder="Your name in this community"
            placeholderTextColor={c.textSecondary}
            maxLength={48}
            autoCapitalize="words"
            accessibilityLabel={JOIN_NAME_LABEL}
          />
          <HonestNotice text={JOIN_NAME_HINT} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title={busy ? 'Joining...' : 'Join community'} onPress={onJoin} disabled={busy} />
          <Button title="Cancel" variant="ghost" onPress={onClose} disabled={busy} />
        </>
      ) : (
        <>
          <Text style={styles.title}>Invite unavailable</Text>
          <Text style={styles.error}>{preview.message}</Text>
          <Button title="Close" variant="secondary" onPress={onClose} />
        </>
      )}
    </View>
  );
}

const styles0 = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
});

const makeStyles = (c: MkColors) => StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 10,
  },
  handleRow: { alignItems: 'center', marginTop: -6, marginBottom: 2 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  title: { color: c.text, fontSize: 22, fontWeight: '800' },
  meta: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
  subMeta: { color: c.textTertiary, fontSize: 13 },
  fieldLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '600' as const, marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: MK_RADIUS.md,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 8,
  },
  error: { color: c.danger, fontSize: 13.5, lineHeight: 19 },
  pressed: { opacity: 0.7 },
});
