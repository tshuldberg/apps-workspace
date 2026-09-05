// Trainer profile share poster.
//
// A poster-style sheet a trainer can put on the gym wall or send to a prospect:
// name, handle, headline, and a scannable QR of dowork://trainer/<handle>. Owner
// and visitors can both share. The QR is a pure-JS render over react-native-svg
// (mirrors InviteShareSheet). Honest about the link: it opens in the DoWork app;
// web/universal links arrive with store provisioning.

import { useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { Copy, Share2, X } from 'lucide-react-native';
import { WK_FONTS } from '@mylife/workouts';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from '../theme/tokens';

export function trainerDeepLink(handle: string): string {
  return `dowork://trainer/${handle}`;
}

export function TrainerSharePoster({
  visible,
  handle,
  displayName,
  headline,
  onClose,
}: {
  visible: boolean;
  handle: string | null;
  displayName: string;
  headline: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const link = handle ? trainerDeepLink(handle) : '';

  const handleCopy = async () => {
    if (!handle) return;
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleShare = async () => {
    if (!handle) return;
    try {
      await Share.share({
        message:
          `Train with ${displayName} on DoWork.\n\nOpen this link on your phone: ${link}\n\n` +
          `Or search @${handle} in the app.`,
      });
    } catch {
      // user cancelled the native share sheet; nothing to surface
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Share your profile</Text>
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityLabel="Close">
              <X size={18} color={DW_TEXT.secondary} />
            </Pressable>
          </View>

          {handle ? (
            <View style={styles.poster}>
              <Text style={styles.posterName}>{displayName}</Text>
              <Text style={styles.posterHandle}>@{handle}</Text>
              {headline ? (
                <Text style={styles.posterHeadline} numberOfLines={2}>
                  {headline}
                </Text>
              ) : null}
              <View style={styles.qrCard}>
                <QRCode value={link} size={188} color="#0B0B0E" backgroundColor="#FFFFFF" />
              </View>
              <Text style={styles.posterScan}>Scan to open in DoWork</Text>
            </View>
          ) : (
            <View style={styles.noHandle}>
              <Text style={styles.noHandleText}>
                This profile needs a handle before it can be shared. Set one in your Studio profile editor.
              </Text>
            </View>
          )}

          <Text style={styles.honestNote}>
            The link opens the profile in the DoWork app. Web links arrive once the app is published.
          </Text>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.86 }, !handle && styles.disabled]}
              onPress={handleShare}
              disabled={!handle}
              accessibilityRole="button"
              accessibilityLabel="Share profile"
            >
              <Share2 size={18} color={DW_ON_ACCENT} />
              <Text style={styles.actionPrimaryText}>Share</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionGhost, pressed && { opacity: 0.8 }, !handle && styles.disabled]}
              onPress={handleCopy}
              disabled={!handle}
              accessibilityRole="button"
              accessibilityLabel="Copy profile link"
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
  poster: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: DW_SURFACES.mid,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 16,
  },
  posterName: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 24,
    color: DW_TEXT.primary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  posterHandle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    color: DW_ACCENT,
  },
  posterHeadline: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 2,
    marginBottom: 6,
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    marginTop: 4,
  },
  posterScan: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.tertiary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  noHandle: {
    backgroundColor: DW_SURFACES.mid,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  noHandleText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
    lineHeight: 19,
  },
  honestNote: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.tertiary,
    lineHeight: 17,
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
  disabled: {
    opacity: 0.5,
  },
});
