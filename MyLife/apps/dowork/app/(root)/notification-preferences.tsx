// Notification preferences.
//
// Master toggle really registers/unregisters this device's Expo push token, and
// the per-type switches persist to dw_notification_prefs, which dowork-notify
// enforces server-side (Expo pushes cannot be filtered on-device after
// delivery, so the toggles would be a lie if they only lived here). Every
// unavailable path is honest: no cloud session, not provisioned for the store
// yet, or the OS has notifications turned off.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Bell, BellOff, Info, ShieldCheck } from 'lucide-react-native';
import { WK_FONTS } from '@mylife/workouts';
import { WorkoutRouteHeader } from './phase3-kit';
import { useDoWorkCloud } from './providers/DoWorkCloudProvider';
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs,
  getPushPermissionStatus,
  hasPushTokens,
  isPushProvisioned,
  registerPushToken,
  removePushTokens,
  saveNotificationPrefs,
  type NotificationPrefs,
  type NotificationTypeKey,
} from './data/push';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from './theme/tokens';

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

interface TypeRow {
  key: NotificationTypeKey;
  title: string;
  detail: string;
}

const TYPE_ROWS: TypeRow[] = [
  { key: 'new_video', title: 'New videos', detail: 'When a trainer you follow publishes a new video.' },
  { key: 'form_check', title: 'Form checks', detail: 'When your client sends a form check to review.' },
  { key: 'form_feedback', title: 'Coaching feedback', detail: 'When your trainer leaves feedback on your form.' },
  { key: 'marketing', title: 'News and offers', detail: 'Occasional product news. Off unless you opt in.' },
];

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const { supabase, userId, isReady, isConfigured } = useDoWorkCloud();
  const [loading, setLoading] = useState(true);
  const [provisioned, setProvisioned] = useState(false);
  const [permission, setPermission] = useState<PermissionStatus>('undetermined');
  const [masterOn, setMasterOn] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);

  const cloudReady = isConfigured && Boolean(supabase) && Boolean(userId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const isProvisioned = isPushProvisioned();
    setProvisioned(isProvisioned);

    const status = await getPushPermissionStatus();
    setPermission(status);

    const prefsResult = await getNotificationPrefs(supabase, userId);
    if (prefsResult.ok) setPrefs(prefsResult.prefs);

    if (isProvisioned && status === 'granted' && cloudReady) {
      const tokens = await hasPushTokens(supabase, userId);
      setMasterOn(tokens.ok ? tokens.exists : false);
    } else {
      setMasterOn(false);
    }
    setLoading(false);
  }, [supabase, userId, cloudReady]);

  useEffect(() => {
    if (!isReady) return;
    void load();
  }, [isReady, load]);

  const doRegister = useCallback(async () => {
    setShowExplainer(false);
    setBusy(true);
    setError(null);
    const result = await registerPushToken(supabase, userId, { promptIfNeeded: true });
    const status = await getPushPermissionStatus();
    setPermission(status);
    if (result.ok) {
      setMasterOn(true);
    } else {
      setMasterOn(false);
      if (result.reason !== 'permission_denied') setError(result.error);
    }
    setBusy(false);
  }, [supabase, userId]);

  const disableMaster = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await removePushTokens(supabase, userId);
    if (!result.ok) setError(result.error);
    setMasterOn(false);
    setBusy(false);
  }, [supabase, userId]);

  const onToggleMaster = useCallback(
    (next: boolean) => {
      if (busy) return;
      if (next) {
        if (permission === 'granted') {
          void doRegister();
        } else {
          setShowExplainer(true);
        }
      } else {
        void disableMaster();
      }
    },
    [busy, permission, doRegister, disableMaster],
  );

  const onToggleType = useCallback(
    (key: NotificationTypeKey, value: boolean) => {
      const previous = prefs;
      const next = { ...prefs, [key]: value };
      setPrefs(next);
      void (async () => {
        const result = await saveNotificationPrefs(supabase, userId, next);
        if (!result.ok) {
          setPrefs(previous);
          setError(result.error);
        }
      })();
    },
    [prefs, supabase, userId],
  );

  const blockedReason = useMemo<string | null>(() => {
    if (!cloudReady) return 'Notifications need a cloud connection. Sign in to manage them.';
    if (!provisioned) {
      return 'Push notifications become available once DoWork is provisioned for the App Store.';
    }
    if (permission === 'denied') {
      return 'Notifications are turned off for DoWork in your device Settings.';
    }
    return null;
  }, [cloudReady, provisioned, permission]);

  const typesEnabled = masterOn && cloudReady;

  if (loading) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <WorkoutRouteHeader title="Notifications" overline="Settings" onBack={() => router.back()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={DW_ACCENT} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <WorkoutRouteHeader title="Notifications" overline="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.masterCard}>
          <View style={styles.masterIcon}>
            {masterOn ? <Bell size={22} color={DW_ACCENT} /> : <BellOff size={22} color={DW_TEXT.tertiary} />}
          </View>
          <View style={styles.masterCopy}>
            <Text style={styles.masterTitle}>Push notifications</Text>
            <Text style={styles.masterDetail}>
              {masterOn
                ? 'This device receives DoWork notifications.'
                : 'Turn on to receive coaching and video alerts on this device.'}
            </Text>
          </View>
          {busy ? (
            <ActivityIndicator color={DW_ACCENT} />
          ) : (
            <Switch
              value={masterOn}
              onValueChange={onToggleMaster}
              disabled={Boolean(blockedReason)}
              trackColor={{ false: DW_SURFACES.high, true: DW_ACCENT }}
              thumbColor={DW_TEXT.primary}
              accessibilityLabel="Push notifications"
            />
          )}
        </View>

        {blockedReason ? (
          <View style={styles.noticeCard}>
            <Info size={16} color={DW_TEXT.tertiary} />
            <Text style={styles.noticeText}>{blockedReason}</Text>
          </View>
        ) : null}

        {permission === 'denied' && provisioned && cloudReady ? (
          <Pressable
            style={({ pressed }) => [styles.settingsButton, pressed && { opacity: 0.86 }]}
            onPress={() => void Linking.openSettings()}
            accessibilityRole="button"
          >
            <Text style={styles.settingsButtonText}>Open device Settings</Text>
          </Pressable>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>What you get notified about</Text>
        <View style={styles.typeList}>
          {TYPE_ROWS.map((row) => (
            <View key={row.key} style={styles.typeRow}>
              <View style={styles.typeCopy}>
                <Text style={styles.typeTitle}>{row.title}</Text>
                <Text style={styles.typeDetail}>{row.detail}</Text>
              </View>
              <Switch
                value={prefs[row.key]}
                onValueChange={(value) => onToggleType(row.key, value)}
                disabled={!typesEnabled}
                trackColor={{ false: DW_SURFACES.high, true: DW_ACCENT }}
                thumbColor={DW_TEXT.primary}
                accessibilityLabel={row.title}
              />
            </View>
          ))}
        </View>
        {!typesEnabled ? (
          <Text style={styles.typesHint}>
            Turn on push notifications to choose which alerts reach this device. Your choices are saved and
            enforced on our servers, so an off switch really stops those pushes.
          </Text>
        ) : (
          <Text style={styles.typesHint}>
            These choices are enforced on our servers, so turning one off really stops that push.
          </Text>
        )}
      </ScrollView>

      <Modal visible={showExplainer} transparent animationType="fade" onRequestClose={() => setShowExplainer(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowExplainer(false)}>
          <Pressable style={styles.explainerCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.explainerIcon}>
              <ShieldCheck size={26} color={DW_ACCENT} />
            </View>
            <Text style={styles.explainerTitle}>Stay in the loop</Text>
            <Text style={styles.explainerBody}>
              DoWork sends a notification when your trainer replies to a form check, when a client sends
              you one, and when a trainer you follow posts a new video. You choose the exact types on the
              next screen. We only ask your device for permission once.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.explainerPrimary, pressed && { opacity: 0.86 }]}
              onPress={() => void doRegister()}
              accessibilityRole="button"
            >
              <Text style={styles.explainerPrimaryText}>Turn on notifications</Text>
            </Pressable>
            <Pressable style={styles.explainerGhost} onPress={() => setShowExplainer(false)} accessibilityRole="button">
              <Text style={styles.explainerGhostText}>Not now</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DW_SURFACES.base,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 48,
    gap: 16,
  },
  masterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
  },
  masterIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DW_ACCENT}18`,
  },
  masterCopy: {
    flex: 1,
    gap: 4,
  },
  masterTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 17,
    color: DW_TEXT.primary,
  },
  masterDetail: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
    lineHeight: 19,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  noticeText: {
    flex: 1,
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
    lineHeight: 19,
  },
  settingsButton: {
    alignSelf: 'flex-start',
    backgroundColor: DW_SURFACES.mid,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  settingsButtonText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.primary,
  },
  errorCard: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderColor: 'rgba(255, 107, 107, 0.32)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  errorText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 14,
    color: '#FF8B7A',
    lineHeight: 20,
  },
  sectionTitle: {
    marginTop: 4,
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.secondary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  typeList: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DW_BORDER.subtle,
  },
  typeCopy: {
    flex: 1,
    gap: 3,
  },
  typeTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    color: DW_TEXT.primary,
  },
  typeDetail: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12.5,
    color: DW_TEXT.secondary,
    lineHeight: 18,
  },
  typesHint: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12.5,
    color: DW_TEXT.tertiary,
    lineHeight: 18,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  explainerCard: {
    width: '100%',
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 22,
    padding: 22,
    gap: 12,
    alignItems: 'center',
  },
  explainerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DW_ACCENT}18`,
  },
  explainerTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 22,
    color: DW_TEXT.primary,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  explainerBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  explainerPrimary: {
    marginTop: 6,
    alignSelf: 'stretch',
    backgroundColor: DW_ACCENT,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  explainerPrimaryText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    color: DW_ON_ACCENT,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  explainerGhost: {
    paddingVertical: 6,
  },
  explainerGhostText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.tertiary,
  },
});
