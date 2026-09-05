import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  CircleUserRound,
  FolderOpen,
  Info,
  Library,
  Palette,
  Settings,
  Share2,
  Shield,
  SlidersVertical,
} from 'lucide-react-native';
import { useIdentity } from '../providers/IdentityProvider';
import { useNode } from '../providers/NodeProvider';
import { Button, HonestNotice, SectionHeader } from '../components/kit';
import { type MkColors, MK_MONO, MK_RADIUS, formatBytes } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

export default function MeScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { displayName, friendCode, fingerprint } = useIdentity();
  const { stats } = useNode();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  const copyFriendCode = useCallback(async () => {
    // Clipboard is a genuinely throwing seam; "Copied" is claimed only after
    // the await resolves, and a rejection renders instead of vanishing.
    try {
      await Clipboard.setStringAsync(friendCode);
      setCopyError(null);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setCopyError('The code could not be copied to the clipboard. Try again.');
    }
  }, [friendCode]);

  const openProfile = useCallback(() => {
    router.push('/identity');
  }, [router]);

  const openAppearance = useCallback(() => {
    router.push('/appearance');
  }, [router]);

  const openLocalLibrary = useCallback(() => {
    router.push('/node');
  }, [router]);

  const openMyLibrary = useCallback(() => {
    router.push('/library');
  }, [router]);

  const openAdvancedSharing = useCallback(() => {
    router.push('/share');
  }, [router]);

  const openSettings = useCallback(() => {
    router.push('/settings');
  }, [router]);

  const openAdvancedConnection = useCallback(() => {
    router.push('/sync');
  }, [router]);

  const openAboutStatus = useCallback(() => {
    router.push('/about-status');
  }, [router]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.title}>Me</Text>
      <Text style={styles.subtitle}>Profile, privacy, and app settings</Text>

      <View style={styles.profilePanel}>
        <View style={styles.profileTop}>
          <View style={styles.avatar}>
            <CircleUserRound size={28} color={c.accent} strokeWidth={1.8} />
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.profileHint}>People see this name when you share your code or join a community.</Text>
          </View>
        </View>
        <View style={styles.friendCodeBox}>
          <Text style={styles.friendCodeLabel}>Friend code</Text>
          <Text style={styles.friendCode} selectable>{friendCode}</Text>
        </View>
        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy friend code"
            onPress={() => { void copyFriendCode(); }}
            style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
          >
            <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy code'}</Text>
          </Pressable>
          <Button title="Edit profile" variant="secondary" onPress={openProfile} />
        </View>
        {copyError ? <Text style={styles.copyError}>{copyError}</Text> : null}
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Privacy identity" hint="Use this when someone wants to confirm it is really you." />
        <Text style={styles.safetyCode} selectable>{fingerprint}</Text>
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Saved on this device" />
        <View style={styles.statsRow}>
          <Stat label="Items" value={String(stats.manifestCount)} />
          <Stat label="Blocks" value={String(stats.blockCount)} />
          <Stat label="Stored" value={formatBytes(stats.totalBytes)} />
        </View>
        <ActionRow
          Icon={Library}
          title="My Library"
          detail="Your movies, music, books, and photos, sealed on this device."
          onPress={openMyLibrary}
        />
        <ActionRow
          Icon={FolderOpen}
          title="Local library"
          detail="Open content this device has actually stored."
          onPress={openLocalLibrary}
        />
        <ActionRow
          Icon={Share2}
          title="Advanced sharing"
          detail="Create or open encrypted share links."
          onPress={openAdvancedSharing}
        />
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Settings and advanced" />
        <ActionRow
          Icon={Palette}
          title="Appearance"
          detail="Themes, colors, and light or dark. Saved on this device."
          onPress={openAppearance}
        />
        <ActionRow
          Icon={Settings}
          title="Settings"
          detail="Storage, recovery key, saved files, and diagnostics."
          onPress={openSettings}
        />
        <ActionRow
          Icon={SlidersVertical}
          title="Advanced connection"
          detail="Pair devices and run manual connection checks."
          onPress={openAdvancedConnection}
        />
        <ActionRow
          Icon={Info}
          title="What works today"
          detail="An honest map of what Meerkat can and cannot do right now."
          onPress={openAboutStatus}
        />
      </View>

      <HonestNotice text="Advanced screens expose storage and connection details because those states are real. Meerkat does not claim backup, delivery, or online status unless the app records it." />

      <View style={{ height: insets.bottom + 96 }} />
    </ScrollView>
  );
}

function ActionRow({
  Icon,
  title,
  detail,
  onPress,
}: {
  Icon: typeof Shield;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
    >
      <View style={styles.actionIcon}>
        <Icon size={18} color={c.accent} strokeWidth={1.9} />
      </View>
      <View style={styles.actionText}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDetail}>{detail}</Text>
      </View>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 14 },
  title: { color: c.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: c.textSecondary, fontSize: 14, marginTop: -6 },
  profilePanel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 14,
  },
  profileTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  profileCopy: { flex: 1, minWidth: 0, gap: 3 },
  name: { color: c.text, fontSize: 22, fontWeight: '800' },
  profileHint: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  friendCodeBox: {
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    padding: 12,
    gap: 3,
  },
  friendCodeLabel: { color: c.textTertiary, fontSize: 11, fontWeight: '800' },
  friendCode: { color: c.text, fontSize: 22, fontWeight: '800', fontFamily: MK_MONO },
  buttonRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  copyBtn: {
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  copyBtnText: { color: c.accent, fontSize: 13, fontWeight: '800' },
  copyError: { color: c.danger, fontSize: 12.5, lineHeight: 18 },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
  },
  safetyCode: { color: c.text, fontSize: 15, fontWeight: '800', fontFamily: MK_MONO },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { color: c.accent, fontSize: 18, fontWeight: '800' },
  statLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '700' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    borderRadius: MK_RADIUS.md,
    backgroundColor: c.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  actionText: { flex: 1, minWidth: 0, gap: 2 },
  actionTitle: { color: c.text, fontSize: 14, fontWeight: '800' },
  actionDetail: { color: c.textSecondary, fontSize: 12.5, lineHeight: 18 },
  pressed: { opacity: 0.7 },
});
