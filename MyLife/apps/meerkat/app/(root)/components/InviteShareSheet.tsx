// InviteShareSheet (Plan 31 Phase 1, T1.5): the invite presented as a share
// sheet -- native Share, a QR, and Copy. QR SIZE BOUNDARY (honesty): an invite
// link embeds the full signed descriptor including every member, so a large
// community exceeds the in-repo QR encoder ceiling. When qrCanEncode is false we
// render Copy / native-share plus the honest line and NO broken/blank QR. A
// compact rendezvous-style short-code invite is a named follow-up (Plan 27/29),
// not this plan.

import { useMemo, useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { X } from 'lucide-react-native';
import { qrCanEncode } from '@mylife/meerkat-theme';
import { createCommunityInvite, type StoredCommunity } from '@mylife/sync';
import { buildCommunityInviteEnvelope } from '../data/invite-envelope-core';
import { INSTALL_URL } from '../data/install-url';
import { useIdentity } from '../providers/IdentityProvider';
import { Button } from './kit';
import { QrCode } from './QrCode';
import { type MkColors, MK_MONO, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

export function InviteShareSheet({
  community,
  visible,
  onClose,
}: {
  community: StoredCommunity;
  visible: boolean;
  onClose: () => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { identity } = useIdentity();
  // 'done' | 'failed' render a 1.5s result; "Copied" is claimed only after the
  // clipboard write resolves, and a rejected write says so instead of dying
  // as a silent dead tap.
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Mint a fresh 48h invite for this exact descriptor revision (owner/admin only;
  // createCommunityInvite throws otherwise, surfaced as an honest error).
  const link = useMemo(() => {
    try {
      return createCommunityInvite(identity, {
        descriptor: community.descriptor,
        signature: community.signature,
      }).link;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create an invite.');
      return null;
    }
    // Re-mint whenever the descriptor revision changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, community.communityId, community.descriptor.revision]);

  const canQr = link !== null && qrCanEncode(link);

  const copy = async () => {
    if (!link) return;
    try {
      await Clipboard.setStringAsync(link);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
    setTimeout(() => setCopied('idle'), 1500);
  };

  // Share a ready-to-text envelope (install + paste steps around the link) so
  // the invite works for someone who has never installed Meerkat. Copy keeps
  // handing over the raw link for in-app paste flows.
  const share = () => {
    if (!link) return;
    void Share.share({
      message: buildCommunityInviteEnvelope({
        communityName: community.descriptor.name,
        link,
        installUrl: INSTALL_URL,
      }),
    }).catch(() => setError('Could not open the share sheet. Copy the link instead.'));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Invite to {community.descriptor.name}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <X size={20} color={c.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {link ? (
          <>
            {canQr ? (
              <View style={styles.qrWrap}>
                <QrCode value={link} size={200} accessibilityLabel="Community invite QR" />
              </View>
            ) : (
              <Text style={styles.tooLarge}>
                This community is too large for a QR code. Share the invite link instead.
              </Text>
            )}
            <Text style={styles.link} numberOfLines={2} selectable>{link}</Text>
            <Text style={styles.hint}>This invite expires in 48 hours.</Text>
            <Text style={styles.hint}>
              Share invite sends a ready-to-text message with install and join steps for someone new to Meerkat.
            </Text>
            <Button title="Share invite" onPress={share} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy invite link"
              onPress={() => { void copy(); }}
              style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
            >
              <Text style={styles.copyBtnText}>
                {copied === 'done' ? 'Copied' : copied === 'failed' ? 'Could not copy' : 'Copy link'}
              </Text>
            </Pressable>
          </>
        ) : (
          <Button title="Close" variant="secondary" onPress={onClose} />
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, color: c.text, fontSize: 18, fontWeight: '800' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  qrWrap: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: MK_RADIUS.md,
  },
  tooLarge: { color: c.textSecondary, fontSize: 13.5, lineHeight: 20 },
  link: {
    color: c.textSecondary,
    fontSize: 12,
    fontFamily: MK_MONO,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    padding: 10,
  },
  hint: { color: c.textTertiary, fontSize: 12 },
  error: { color: c.danger, fontSize: 13.5, lineHeight: 19 },
  copyBtn: {
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'center',
  },
  copyBtnText: { color: c.accent, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
