// Client-invite share sheet.
//
// Shown after a trainer generates a per-client invite code. Renders a scannable
// QR of dowork://client-invite/<CODE> (the client scans it or opens the link),
// the code in plain text as a fallback, and Share / Copy actions. The QR is a
// pure-JS render over react-native-svg (no native module).

import { useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { Copy, Share2, X } from 'lucide-react-native';
import { WK_FONTS } from '@mylife/workouts';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from '../../theme/tokens';

export function inviteDeepLink(code: string): string {
  return `dowork://client-invite/${code}`;
}

export function InviteShareSheet({
  visible,
  code,
  onClose,
}: {
  visible: boolean;
  code: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const link = code ? inviteDeepLink(code) : '';

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleShare = async () => {
    if (!code) return;
    try {
      await Share.share({
        message: `Join me on DoWork for coaching. Open this link on your phone: ${link}\n\nOr enter code ${code} in the app.`,
      });
    } catch {
      // user cancelled the share sheet; nothing to surface
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()} accessible={false}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Invite your client</Text>
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <X size={18} color={DW_TEXT.secondary} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            Have them scan this code or open the link on their phone. They tap Join and land in your
            coaching space.
          </Text>

          {code ? (
            <View style={styles.qrCard}>
              <QRCode value={link} size={196} color="#0B0B0E" backgroundColor="#FFFFFF" />
            </View>
          ) : null}

          {code ? (
            <View style={styles.codeRow}>
              <Text style={styles.codeLabel}>Code</Text>
              <Text style={styles.codeValue} accessibilityLabel={`Invite code ${code.split('').join(' ')}`}>
                {code}
              </Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.86 }]}
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="Share invite"
            >
              <Share2 size={18} color={DW_ON_ACCENT} />
              <Text style={styles.actionPrimaryText}>Share</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionGhost, pressed && { opacity: 0.8 }]}
              onPress={handleCopy}
              accessibilityRole="button"
              accessibilityLabel="Copy invite link"
            >
              <Copy size={18} color={DW_TEXT.primary} />
              <Text style={styles.actionGhostText}>{copied ? 'Copied' : 'Copy link'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: DW_SURFACES.low,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    gap: 14,
    borderWidth: 1,
    borderColor: DW_BORDER.default,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: DW_SURFACES.highest,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 22,
    color: DW_TEXT.primary,
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DW_SURFACES.mid,
  },
  subtitle: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    lineHeight: 20,
  },
  qrCard: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DW_SURFACES.mid,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DW_BORDER.subtle,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  codeLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.tertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  codeValue: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 20,
    color: DW_TEXT.primary,
    letterSpacing: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: DW_ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimaryText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    color: DW_ON_ACCENT,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  actionGhost: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DW_BORDER.default,
    backgroundColor: DW_SURFACES.mid,
  },
  actionGhostText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    color: DW_TEXT.primary,
  },
});
