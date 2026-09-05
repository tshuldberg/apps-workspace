// DoWork settings / profile tab.
//
// Shows the current identity (handle + auth state), cloud environment,
// trainer status, support/compliance links (App Review 1.2), and the
// account danger zone (delete account, Guideline 5.1.1(v)).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { getSupportedPlayerCommands, WK_FONTS } from '@mylife/workouts';
import { useDoWorkCloud } from '../providers/DoWorkCloudProvider';
import { useDatabase } from '../providers/DatabaseProvider';
import { requestAccountDeletion } from '../data/account';
import { listMyClientLinks } from '../data/cloud-coaching';
import { isAnonymousSession } from '../data/auth-session';
import { friendlyError } from '../data/friendly-errors';
import { ensurePurchasesConfigured, restoreTrainerPurchases } from '../data/purchases';
import {
  deleteDownload,
  formatBytes,
  getDownloadsTotalBytes,
  listDownloads,
  wipeAllDownloads,
  type DownloadEntry,
} from '../data/downloads';
import {
  getVoiceSettings,
  setVoiceSettings,
  SEEK_SECOND_OPTIONS,
  type SeekSeconds,
} from '../../../lib/voice/voice-settings';
import { DW_ACCENT, DW_BORDER, DW_FEEDBACK, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from '../theme/tokens';
import {
  WorkoutHero,
  WorkoutSectionHeader,
  WorkoutTabScrollView,
} from './_screen-kit';

// Group the engine's command vocabulary for display. Any phrase the engine adds
// that is not matched here still shows under "More", so the list never drifts
// out of sync with getSupportedPlayerCommands().
const COMMAND_GROUPS: { label: string; match: (phrase: string) => boolean }[] = [
  {
    label: 'Play & pause',
    match: (p) =>
      ['pause', 'stop', 'hold on', 'play', 'resume', 'keep going', 'continue', 'start over', 'from the top', 'restart'].includes(
        p,
      ),
  },
  { label: 'Speed', match: (p) => p.includes('speed') || p.includes('slow') || p.includes('faster') || p.includes('slower') },
  { label: 'Skip', match: (p) => p.includes('back') || p.includes('forward') || p.includes('rewind') || p.includes('ahead') },
  { label: 'Ask', match: (p) => p.includes('exercise') || p.includes('time') },
];

const SUPPORT_EMAIL = 'support@dowork.app';
const GUIDELINES_URL = 'https://dowork.app/guidelines';
const PRIVACY_URL = 'https://dowork.app/privacy';

// OS-native subscription management. Both open the store's subscription screen,
// which works even when RevenueCat is not configured in this build.
const MANAGE_SUBSCRIPTION_URL =
  Platform.OS === 'android'
    ? 'https://play.google.com/store/account/subscriptions'
    : 'itms-apps://apps.apple.com/account/subscriptions';

interface SettingsRow {
  label: string;
  value?: string;
  onPress?: () => void;
}

export default function SettingsScreen() {
  const router = useRouter();
  const cloud = useDoWorkCloud();
  const db = useDatabase();
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [voice, setVoice] = useState(() => getVoiceSettings(db));
  const [showCommands, setShowCommands] = useState(false);
  const [hasActiveClientLink, setHasActiveClientLink] = useState(false);
  const [downloads, setDownloads] = useState<DownloadEntry[]>([]);

  const refreshDownloads = useCallback(() => {
    setDownloads(listDownloads(db));
  }, [db]);

  useFocusEffect(refreshDownloads);

  const downloadsTotalBytes = useMemo(
    () => downloads.reduce((sum, entry) => sum + (entry.bytes || 0), 0),
    [downloads],
  );

  // Whether the signed-in user is an active client of some trainer, so the
  // "My trainer" entry only shows when it leads somewhere real.
  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!cloud.supabase || !cloud.userId) {
        if (mounted) setHasActiveClientLink(false);
        return;
      }
      const result = await listMyClientLinks(cloud.supabase, cloud.userId);
      if (!mounted) return;
      setHasActiveClientLink(result.ok && result.links.some((l) => l.status === 'active'));
    })();
    return () => {
      mounted = false;
    };
  }, [cloud.supabase, cloud.userId]);

  const commandGroups = useMemo(() => {
    const phrases = getSupportedPlayerCommands();
    const claimed = new Set<string>();
    const groups = COMMAND_GROUPS.map((group) => {
      const items = phrases.filter((p) => !claimed.has(p) && group.match(p));
      items.forEach((p) => claimed.add(p));
      return { label: group.label, items };
    }).filter((group) => group.items.length > 0);
    const leftovers = phrases.filter((p) => !claimed.has(p));
    if (leftovers.length > 0) groups.push({ label: 'More', items: leftovers });
    return groups;
  }, []);

  const updateVoice = (next: Parameters<typeof setVoiceSettings>[1]) => {
    setVoice(setVoiceSettings(db, next));
  };

  // Restore replays store receipts to RevenueCat; entitlement is still the
  // server's call, so the honest result points the user at a trainer profile to
  // confirm access rather than claiming a local unlock. Unconfigured builds say
  // so instead of pretending to restore.
  const handleRestore = () => {
    if (!cloud.supabase || !cloud.userId) {
      Alert.alert('Not signed in', 'Sign in to restore your purchases.');
      return;
    }
    const cfg = ensurePurchasesConfigured();
    if (!cfg.configured) {
      Alert.alert('Not available', cfg.reason ?? 'Trainer subscriptions are not available in this build yet.');
      return;
    }
    setRestoring(true);
    void (async () => {
      try {
        const result = await restoreTrainerPurchases(cloud.userId as string);
        if (!result.ok) {
          Alert.alert('Restore failed', friendlyError(result.error));
          return;
        }
        Alert.alert(
          'Purchases restored',
          result.restoredProductIds.length > 0
            ? 'Your active subscriptions were restored. Open a trainer profile to confirm access.'
            : 'No active subscriptions were found for this account.',
        );
      } finally {
        setRestoring(false);
      }
    })();
  };

  const handleManageSubscription = () => {
    void Linking.openURL(MANAGE_SUBSCRIPTION_URL).catch(() => {
      Alert.alert(
        'Could not open subscriptions',
        'Manage your subscriptions from your device Settings app.',
      );
    });
  };

  const handleDeleteDownload = (entry: DownloadEntry) => {
    void deleteDownload(db, entry.videoId).then(refreshDownloads);
  };

  const handleWipeDownloads = () => {
    if (downloads.length === 0) return;
    Alert.alert(
      'Remove all downloads?',
      'Every offline video is deleted from this device. You can download them again anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove all',
          style: 'destructive',
          onPress: () => {
            void wipeAllDownloads(db).then(refreshDownloads);
          },
        },
      ],
    );
  };

  // Sign out first, and only wipe this device's offline downloads once the
  // sign-out is confirmed. Wiping first then failing the sign-out would leave the
  // user signed in with their downloads destroyed and no explanation.
  const performSignOut = () => {
    void (async () => {
      try {
        await cloud.signOutUser();
      } catch (err) {
        Alert.alert(
          'Sign-out failed',
          friendlyError(err instanceof Error ? err.message : String(err)),
        );
        return;
      }
      // Now that the account is signed out, drop its downloads so the next user
      // on this device cannot reach content the previous account was entitled to.
      try {
        await wipeAllDownloads(db);
      } catch {
        // Best-effort; the account is already signed out.
      }
      refreshDownloads();
    })();
  };

  const handleSignOut = () => {
    void (async () => {
      const anonymous = await isAnonymousSession(cloud.supabase);
      if (!anonymous) {
        performSignOut();
        return;
      }

      Alert.alert(
        'Sign out without email?',
        'You have no email attached. Signing out permanently loses this trainer or client identity and everything tied to it on this device because it cannot be recovered.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add email first',
            onPress: () => router.push('/(root)/account' as never),
          },
          {
            text: 'Sign out anyway',
            style: 'destructive',
            onPress: performSignOut,
          },
        ],
      );
    })();
  };

  const handleLabel = cloud.profile ? `@${cloud.profile.handle}` : null;
  const authLabel = cloud.user?.email ?? (cloud.isAnonymous ? 'Anonymous' : 'Not signed in');
  const profileLabel = handleLabel ? `${handleLabel} · ${authLabel}` : authLabel;
  const cloudLabel = cloud.isConfigured
    ? `Cloud · ${cloud.environment}`
    : 'Cloud · not configured';

  const accountRows: SettingsRow[] = [
    {
      label: 'Profile',
      value: profileLabel,
      onPress: () => router.push('/(root)/account' as never),
    },
    ...(cloud.isConfigured && !cloud.user?.email
      ? [{ label: 'Sign in', onPress: () => router.push('/(root)/account' as never) }]
      : []),
    { label: 'Cloud status', value: cloudLabel },
    ...(cloud.trainerProfile
      ? [{
          label: 'Trainer',
          value: `${cloud.trainerProfile.displayName}${cloud.trainerProfile.isVerified ? ' ✓' : ''}`,
        }]
      : []),
  ];

  const appRows: SettingsRow[] = [
    { label: 'Plate inventories', onPress: () => router.push('/(root)/plate-loader' as never) },
    {
      label: 'About DoWork',
      value: `v${Constants.expoConfig?.version ?? '1.0.0'}`,
      onPress: () =>
        Alert.alert(
          `DoWork v${Constants.expoConfig?.version ?? '1.0.0'}`,
          'Voice-controlled training with real coaches. Your workout data lives on this device; the cloud carries only what you share.',
          [
            { text: 'Community guidelines', onPress: () => void Linking.openURL(GUIDELINES_URL) },
            { text: 'Privacy policy', onPress: () => void Linking.openURL(PRIVACY_URL) },
            {
              text: 'Contact support',
              onPress: () => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`),
            },
            { text: 'Done', style: 'cancel' },
          ],
        ),
    },
  ];

  const coachingRows: SettingsRow[] = [
    ...(hasActiveClientLink
      ? [{ label: 'My trainer', onPress: () => router.push('/(root)/my-trainer' as never) }]
      : []),
    ...(cloud.trainerProfile
      ? [
          { label: 'Trainer Studio', onPress: () => router.push('/(root)/studio' as never) },
          { label: 'Clients', onPress: () => router.push('/(root)/clients' as never) },
        ]
      : [{ label: 'Are you a trainer?', onPress: () => router.push('/(root)/redeem-invite' as never) }]),
  ];

  const subscriptionRows: SettingsRow[] = [
    {
      label: restoring ? 'Restoring…' : 'Restore purchases',
      onPress: restoring ? undefined : handleRestore,
    },
    { label: 'Manage subscription', onPress: handleManageSubscription },
  ];

  const supportRows: SettingsRow[] = [
    ...(cloud.isConfigured
      ? [{ label: 'Blocked users', onPress: () => router.push('/(root)/blocked-users' as never) }]
      : []),
    {
      label: 'Help & contact',
      onPress: () => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`),
    },
    {
      label: 'Community guidelines',
      onPress: () => void Linking.openURL(GUIDELINES_URL),
    },
    {
      label: 'Privacy policy',
      onPress: () => void Linking.openURL(PRIVACY_URL),
    },
  ];

  const handleDeleteAccount = () => {
    if (!cloud.supabase) return;
    Alert.alert(
      'Delete your account?',
      'This permanently removes your cloud account, shares, comments, trainer content, and media. Local data on this device is wiped too. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (!cloud.supabase) return;
              setDeleting(true);
              try {
                const result = await requestAccountDeletion(cloud.supabase);
                if (!result.ok) {
                  Alert.alert('Deletion failed', result.error ?? 'Try again later.');
                  return;
                }
                // Server account is gone; clear the local session + db.
                try {
                  await cloud.signOutUser();
                } catch {
                  // Session may already be invalid after the server wipe.
                }
                // Offline downloads live in the FS sandbox, not the db, so wipe
                // them explicitly before the db (and its index) is deleted.
                try {
                  await wipeAllDownloads(db);
                } catch {
                  // Best-effort; account deletion continues regardless.
                }
                await FileSystem.deleteAsync(
                  `${FileSystem.documentDirectory}SQLite/dowork.db`,
                  { idempotent: true },
                );
                Alert.alert(
                  'Account deleted',
                  'Your account and data are gone. Close and reopen DoWork to start fresh.',
                );
              } finally {
                setDeleting(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <WorkoutTabScrollView>
      <WorkoutHero title="Profile" subtitle={profileLabel} />

      <WorkoutSectionHeader title="Account" />
      <View style={styles.list}>
        {accountRows.map((row) =>
          row.onPress ? (
            <Pressable
              key={row.label}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
              onPress={row.onPress}
              accessibilityRole="button"
              accessibilityLabel={row.label}
            >
              <Text style={styles.rowLabel}>{row.label}</Text>
              {row.value ? <Text style={styles.rowValue}>{row.value}</Text> : null}
            </Pressable>
          ) : (
            <View key={row.label} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              {row.value ? <Text style={styles.rowValue}>{row.value}</Text> : null}
            </View>
          ),
        )}
      </View>

      <WorkoutSectionHeader title="App" />
      <View style={styles.list}>
        {appRows.map((row) => (
          <Pressable
            key={row.label}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
            onPress={row.onPress}
          >
            <Text style={styles.rowLabel}>{row.label}</Text>
          </Pressable>
        ))}
      </View>

      {coachingRows.length > 0 ? (
        <>
          <WorkoutSectionHeader title="Coaching" />
          <View style={styles.list}>
            {coachingRows.map((row) => (
              <Pressable
                key={row.label}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
                onPress={row.onPress}
              >
                <Text style={styles.rowLabel}>{row.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {cloud.isConfigured ? (
        <>
          <WorkoutSectionHeader title="Subscriptions" />
          <View style={styles.list}>
            {subscriptionRows.map((row) => (
              <Pressable
                key={row.label}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
                onPress={row.onPress}
              >
                <Text style={styles.rowLabel}>{row.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {cloud.isConfigured ? (
        <>
          <WorkoutSectionHeader title="Notifications" />
          <View style={styles.list}>
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
              onPress={() => router.push('/(root)/notification-preferences' as never)}
              accessibilityRole="button"
              accessibilityLabel="Notification preferences"
            >
              <Text style={styles.rowLabel}>Notification preferences</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <WorkoutSectionHeader title="Voice control" />
      <View style={styles.list}>
        <View style={styles.row}>
          <View style={styles.voiceRowText}>
            <Text style={styles.rowLabel}>Voice control while watching</Text>
            <Text style={styles.voiceRowHint}>
              Say &ldquo;slow down&rdquo; or &ldquo;back up&rdquo; hands-free. Speech is recognized on
              your device.
            </Text>
          </View>
          <Switch
            value={voice.enabled}
            onValueChange={(enabled) => updateVoice({ ...voice, enabled })}
            trackColor={{ false: DW_SURFACES.high, true: DW_ACCENT }}
            thumbColor={DW_TEXT.primary}
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Skip length</Text>
          <View style={styles.seekOptions}>
            {SEEK_SECOND_OPTIONS.map((seconds) => {
              const active = voice.seekSeconds === seconds;
              return (
                <Pressable
                  key={seconds}
                  style={[styles.seekPill, active && styles.seekPillActive]}
                  onPress={() => updateVoice({ ...voice, seekSeconds: seconds as SeekSeconds })}
                  accessibilityRole="button"
                  accessibilityLabel={`Skip ${seconds} seconds`}
                >
                  <Text style={[styles.seekPillText, active && styles.seekPillTextActive]}>
                    {seconds}s
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
          onPress={() => setShowCommands((prev) => !prev)}
          accessibilityRole="button"
        >
          <Text style={styles.rowLabel}>Supported commands</Text>
          <Text style={styles.rowValue}>{showCommands ? 'Hide' : 'Show'}</Text>
        </Pressable>

        {showCommands ? (
          <View style={styles.commandsCard}>
            {commandGroups.map((group) => (
              <View key={group.label} style={styles.commandGroup}>
                <Text style={styles.commandGroupLabel}>{group.label}</Text>
                <View style={styles.commandChips}>
                  {group.items.map((phrase) => (
                    <View key={phrase} style={styles.commandChip}>
                      <Text style={styles.commandChipText}>{phrase}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <WorkoutSectionHeader title="Offline downloads" />
      <View style={styles.list}>
        {downloads.length === 0 ? (
          <View style={styles.row}>
            <View style={styles.downloadEmptyText}>
              <Text style={styles.rowLabel}>No downloads yet</Text>
              <Text style={styles.downloadMeta}>
                Save a trainer video from its player to watch it offline. Downloads use no storage
                until then.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Storage used</Text>
              <Text style={styles.rowValue}>
                {downloads.length} {downloads.length === 1 ? 'video' : 'videos'} ·{' '}
                {formatBytes(downloadsTotalBytes)}
              </Text>
            </View>

            {downloads.map((entry) => (
              <View key={entry.videoId} style={styles.row}>
                <View style={styles.downloadRowText}>
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {entry.title ?? 'Trainer video'}
                  </Text>
                  <Text style={styles.downloadMeta}>{formatBytes(entry.bytes)}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.downloadDelete, pressed && { opacity: 0.7 }]}
                  onPress={() => handleDeleteDownload(entry)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete download ${entry.title ?? 'Trainer video'}`}
                >
                  <Text style={styles.downloadDeleteText}>Delete</Text>
                </Pressable>
              </View>
            ))}

            <Pressable
              style={({ pressed }) => [styles.downloadWipe, pressed && { opacity: 0.86 }]}
              onPress={handleWipeDownloads}
              accessibilityRole="button"
              accessibilityLabel="Remove all downloads"
            >
              <Text style={styles.downloadWipeText}>Remove all downloads</Text>
            </Pressable>
          </>
        )}
      </View>

      <WorkoutSectionHeader title="Support" />
      <View style={styles.list}>
        {supportRows.map((row) => (
          <Pressable
            key={row.label}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
            onPress={row.onPress}
          >
            <Text style={styles.rowLabel}>{row.label}</Text>
          </Pressable>
        ))}
      </View>

      {cloud.isConfigured ? (
        <Pressable
          style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.86 }]}
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>
      ) : null}

      {cloud.isConfigured ? (
        <Pressable
          style={({ pressed }) => [
            styles.deleteAccount,
            pressed && { opacity: 0.86 },
            deleting && { opacity: 0.5 },
          ]}
          disabled={deleting}
          onPress={handleDeleteAccount}
        >
          <Text style={styles.deleteAccountLabel}>
            {deleting ? 'Deleting…' : 'Delete account'}
          </Text>
        </Pressable>
      ) : null}
    </WorkoutTabScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 20,
    gap: 8,
  },
  row: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    color: DW_TEXT.primary,
  },
  rowValue: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.tertiary,
    flexShrink: 1,
    textAlign: 'right',
  },
  voiceRowText: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  downloadEmptyText: {
    flex: 1,
    gap: 4,
  },
  downloadRowText: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  downloadMeta: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: DW_TEXT.tertiary,
  },
  downloadDelete: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.4)',
  },
  downloadDeleteText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_FEEDBACK.danger,
  },
  downloadWipe: {
    marginTop: 4,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.4)',
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
  },
  downloadWipeText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_FEEDBACK.danger,
  },
  voiceRowHint: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: DW_TEXT.tertiary,
  },
  seekOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  seekPill: {
    minWidth: 40,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: DW_SURFACES.high,
    borderWidth: 1,
    borderColor: DW_BORDER.subtle,
  },
  seekPillActive: {
    backgroundColor: DW_ACCENT,
    borderColor: DW_ACCENT,
  },
  seekPillText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.secondary,
  },
  seekPillTextActive: {
    color: DW_ON_ACCENT,
  },
  commandsCard: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 14,
  },
  commandGroup: {
    gap: 8,
  },
  commandGroupLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 11,
    color: DW_TEXT.secondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  commandChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  commandChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: DW_SURFACES.high,
    borderWidth: 1,
    borderColor: DW_BORDER.subtle,
  },
  commandChipText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.secondary,
  },
  signOut: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: DW_ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutLabel: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: DW_ON_ACCENT,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  deleteAccount: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.45)',
    backgroundColor: 'rgba(255, 107, 107, 0.10)',
  },
  deleteAccountLabel: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: DW_FEEDBACK.danger,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
