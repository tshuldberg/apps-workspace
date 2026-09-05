import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { getSetting, setSetting } from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_CHROME_GOLD,
  MD_CYAN_GLOW_STYLE,
  MD_FONTS,
  MD_SURFACES,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  getMedsNotificationPermissionStatusAsync,
  requestMedsNotificationPermissionAsync,
  sendMedsTestNotificationAsync,
} from '../../lib/meds-notifications';

type NotificationPermissionState = 'unknown' | 'granted' | 'denied' | 'undetermined';

const PREVIEW_TYPES = [
  {
    key: 'dose',
    icon: 'notifications',
    title: 'Dose reminders',
    body: 'Time for Rosuvastatin. Take with water after breakfast.',
  },
  {
    key: 'refill',
    icon: 'inventory_2',
    title: 'Refill alerts',
    body: 'Lisinopril is down to 6 days remaining. Queue a refill now.',
  },
  {
    key: 'appointment',
    icon: 'event',
    title: 'Appointment reminders',
    body: 'Cardiology review tomorrow at 2:30 PM. Bring your medication list.',
  },
  {
    key: 'weather',
    icon: 'cloud',
    title: 'Weather trigger alerts',
    body: 'Pressure spike expected today. Watch for migraine symptoms.',
  },
] as const;

const ROUTINE_SYNC_CARDS = [
  { label: 'Breakfast', time: '8:00 AM', icon: 'coffee', active: true },
  { label: 'Lunch', time: '12:30 PM', icon: 'restaurant', active: false },
  { label: 'Post-Gym', time: '5:00 PM', icon: 'fitness_center', active: false },
  { label: 'Sleep', time: '10:30 PM', icon: 'bedtime', active: false },
] as const;

function toPermissionState(value: string): NotificationPermissionState {
  if (value === 'granted' || value === 'denied' || value === 'undetermined') {
    return value;
  }
  return 'unknown';
}

function getPermissionMeta(permissionState: NotificationPermissionState) {
  if (permissionState === 'granted') {
    return {
      title: 'Notifications ready',
      description: 'Dose, refill, caregiver, appointment, and trigger alerts are available.',
      icon: 'check_circle',
      color: MD_ACCENT_LIGHT,
    };
  }

  if (permissionState === 'denied') {
    return {
      title: 'Notifications blocked',
      description: 'Open device settings to allow reminders and medical follow-up alerts.',
      icon: 'warning',
      color: '#FFB4AB',
    };
  }

  return {
    title: 'Permission not requested',
    description: 'Grant access once and MyMeds will keep your care schedule on time.',
    icon: 'notifications',
    color: MD_CHROME_GOLD,
  };
}

export default function NotificationSetupScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [permissionState, setPermissionState] = useState<NotificationPermissionState>('unknown');
  const [requesting, setRequesting] = useState(false);
  const [testing, setTesting] = useState(false);

  const refreshPermissions = useCallback(async () => {
    try {
      const status = toPermissionState(await getMedsNotificationPermissionStatusAsync());
      setPermissionState(status);
      setSetting(db, 'notifications.permission_status', status);
      setSetting(db, 'notifications.master_enabled', status === 'granted' ? 'true' : 'false');
    } catch {
      setPermissionState('unknown');
    }
  }, [db]);

  useEffect(() => {
    const stored = getSetting(db, 'notifications.permission_status');
    if (stored) {
      setPermissionState(toPermissionState(stored));
    }
    void refreshPermissions();
  }, [db, refreshPermissions]);

  const permissionMeta = useMemo(
    () => getPermissionMeta(permissionState),
    [permissionState],
  );

  const handleRequestPermissions = useCallback(async () => {
    setRequesting(true);
    try {
      const status = toPermissionState(await requestMedsNotificationPermissionAsync());
      setPermissionState(status);
      setSetting(db, 'notifications.permission_status', status);
      setSetting(db, 'notifications.master_enabled', status === 'granted' ? 'true' : 'false');
      if (status === 'granted') {
        Alert.alert('Notifications enabled', 'MyMeds can now deliver medication and appointment alerts.');
      } else {
        Alert.alert('Notifications still off', 'You can retry here later after adjusting device permissions.');
      }
    } catch {
      Alert.alert('Permission request failed', 'MyMeds could not request notification access.');
    } finally {
      setRequesting(false);
    }
  }, [db]);

  const handleTestNotification = useCallback(async () => {
    if (permissionState !== 'granted') {
      Alert.alert('Enable notifications first', 'Grant notification access before sending a test alert.');
      return;
    }

    setTesting(true);
    try {
      await sendMedsTestNotificationAsync(
        'MyMeds test notification',
        'Your reminder channel is active and ready for medication alerts.',
      );
      Alert.alert('Test scheduled', 'A MyMeds notification should arrive in a few seconds.');
    } catch {
      Alert.alert('Test failed', 'MyMeds could not schedule the test notification.');
    } finally {
      setTesting(false);
    }
  }, [permissionState]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <View>
          <Text style={styles.kicker}>Step 2 of 3</Text>
          <View style={styles.progressTrack}>
            <View style={styles.progressBar} />
          </View>
        </View>
        <View style={styles.topBarActions}>
          <Pressable onPress={() => void refreshPermissions()} style={styles.iconButton}>
            <MaterialSymbol color="#9F8E81" name="history" size={18} />
          </Pressable>
          <Pressable onPress={() => router.push('/(meds)/notification-settings')} style={styles.iconButton}>
            <MaterialSymbol color={MD_CHROME_GOLD} name="settings" size={18} />
          </Pressable>
        </View>
      </View>

      <View style={styles.heroCopy}>
        <Text style={styles.heroTitle}>
          Sync Your <Text style={styles.heroAccent}>Rhythm</Text>
        </Text>
        <Text style={styles.heroBody}>
          Coordinate medication reminders with your real day, then verify the channel with a live alert before you leave setup.
        </Text>
      </View>

      <GlassCard style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <View style={styles.heroHeader}>
          <View style={styles.heroBadge}>
            <MaterialSymbol color={MD_ACCENT_LIGHT} name="notifications" size={20} />
          </View>
          <View style={styles.heroHeaderCopy}>
            <Text style={styles.sectionEyebrow}>Live Preview</Text>
            <Text style={styles.sectionBody}>This is the style of alert MyMeds will send when a reminder becomes due.</Text>
          </View>
        </View>

        <View style={styles.systemNotificationCard}>
          <View style={styles.systemNotificationHeader}>
            <View style={styles.systemAppIcon}>
              <MaterialSymbol color="#001F2A" name="medication" size={12} />
            </View>
            <Text style={styles.systemMeta}>MyMeds • Now</Text>
          </View>
          <Text style={styles.systemTitle}>Time for Rosuvastatin</Text>
          <Text style={styles.systemBody}>10mg tablet • Take with water after breakfast.</Text>
        </View>

        <View style={styles.permissionStatusCard}>
          <View
            style={[
              styles.permissionIconShell,
              { backgroundColor: withAlpha(permissionMeta.color, 0.18) },
            ]}
          >
            <MaterialSymbol color={permissionMeta.color} name={permissionMeta.icon} size={20} />
          </View>
          <View style={styles.permissionCopy}>
            <Text style={styles.sectionEyebrow}>Permission Status</Text>
            <Text style={styles.sectionTitle}>{permissionMeta.title}</Text>
            <Text style={styles.sectionBody}>{permissionMeta.description}</Text>
          </View>
        </View>
      </GlassCard>

      <View style={styles.previewStack}>
        {PREVIEW_TYPES.map((item) => (
          <GlassCard key={item.key} style={styles.previewCard}>
            <View style={styles.previewIconShell}>
              <MaterialSymbol color={MD_ACCENT_LIGHT} name={item.icon} size={18} />
            </View>
            <View style={styles.previewCopy}>
              <Text style={styles.previewTitle}>{item.title}</Text>
              <Text style={styles.previewBody}>{item.body}</Text>
            </View>
          </GlassCard>
        ))}
      </View>

      <GlassCard style={styles.syncShell}>
        <View style={styles.rowBetween}>
          <View style={styles.syncHeaderCopy}>
            <Text style={styles.sectionTitle}>Routine Sync Suggestions</Text>
            <Text style={styles.sectionBody}>Anchor dose reminders to habits you already keep.</Text>
          </View>
          <Pressable onPress={() => router.push('/(meds)/notification-settings')}>
            <View style={styles.inlineAction}>
              <MaterialSymbol color={MD_CHROME_GOLD} name="edit" size={14} />
              <Text style={styles.inlineActionText}>Edit all</Text>
            </View>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          contentContainerStyle={styles.syncCards}
          showsHorizontalScrollIndicator={false}
        >
          {ROUTINE_SYNC_CARDS.map((card) => (
            <View
              key={card.label}
              style={[
                styles.syncCard,
                card.active ? styles.syncCardActive : null,
              ]}
            >
              <MaterialSymbol
                color={card.active ? MD_CHROME_GOLD : '#9F8E81'}
                name={card.icon}
                size={18}
              />
              <Text style={styles.syncCardTitle}>{card.label}</Text>
              <Text style={styles.syncCardTime}>{card.time}</Text>
            </View>
          ))}
        </ScrollView>
      </GlassCard>

      <GlassCard style={styles.privacyCard}>
        <View style={styles.previewIconShell}>
          <MaterialSymbol color={MD_CHROME_GOLD} name="verified_user" size={18} />
        </View>
        <View style={styles.previewCopy}>
          <Text style={styles.sectionTitle}>Why MyMeds asks for this</Text>
          <Text style={styles.sectionBody}>
            Notification data stays device-local. MyMeds uses it only for medication reminders, refill nudges, appointments, and symptom-trigger alerts.
          </Text>
        </View>
      </GlassCard>

      <View style={styles.buttonStack}>
        <Pressable disabled={requesting} onPress={() => void handleRequestPermissions()} style={requesting ? styles.disabled : null}>
          <LinearGradient
            colors={['#FFB877', MD_CHROME_GOLD]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.primaryButton}
          >
            <MaterialSymbol
              color="#4B2700"
              name={permissionState === 'granted' ? 'check_circle' : 'notifications'}
              size={18}
            />
            <Text style={styles.primaryButtonText}>
              {requesting
                ? 'Requesting permission...'
                : permissionState === 'granted'
                  ? 'Notifications Enabled'
                  : 'Enable Notifications'}
            </Text>
          </LinearGradient>
        </Pressable>

        <View style={styles.secondaryButtons}>
          <Pressable disabled={testing} onPress={() => void handleTestNotification()} style={[styles.secondaryButton, testing ? styles.disabled : null]}>
            <MaterialSymbol color="#D6C3B5" name="alarm" size={16} />
            <Text style={styles.secondaryButtonText}>{testing ? 'Scheduling...' : 'Send Test Alert'}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(meds)/notification-settings')} style={styles.secondaryButton}>
            <MaterialSymbol color="#D6C3B5" name="settings" size={16} />
            <Text style={styles.secondaryButtonText}>Advanced Settings</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  content: {
    gap: 16,
    paddingBottom: 160,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  kicker: {
    color: MD_CHROME_GOLD,
    fontFamily: MD_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  progressTrack: {
    backgroundColor: MD_SURFACES.highest,
    borderRadius: 999,
    height: 6,
    overflow: 'hidden',
    width: 108,
  },
  progressBar: {
    backgroundColor: MD_CHROME_GOLD,
    borderRadius: 999,
    height: '100%',
    width: '68%',
  },
  heroCopy: {
    gap: 8,
    marginTop: 8,
  },
  heroTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.extraBold,
    fontSize: 36,
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  heroAccent: {
    color: MD_ACCENT_LIGHT,
  },
  heroBody: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  heroCard: {
    overflow: 'hidden',
    padding: 20,
  },
  heroGlow: {
    ...MD_CYAN_GLOW_STYLE,
    backgroundColor: withAlpha(MD_ACCENT, 0.08),
    borderRadius: 180,
    height: 180,
    position: 'absolute',
    right: -40,
    top: -30,
    width: 180,
  },
  heroHeader: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
  },
  heroBadge: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT, 0.16),
    borderRadius: 18,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  heroHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  sectionEyebrow: {
    color: '#8BCFF0',
    fontFamily: MD_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  sectionBody: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  systemNotificationCard: {
    backgroundColor: withAlpha('#FFFFFF', 0.08),
    borderRadius: 24,
    marginBottom: 16,
    padding: 16,
  },
  systemNotificationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  systemAppIcon: {
    alignItems: 'center',
    backgroundColor: MD_CHROME_GOLD,
    borderRadius: 8,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  systemMeta: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
  },
  systemTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 2,
  },
  systemBody: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  permissionStatusCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  permissionIconShell: {
    alignItems: 'center',
    borderRadius: 18,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  permissionCopy: {
    flex: 1,
    gap: 2,
  },
  previewStack: {
    gap: 12,
  },
  previewCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  previewIconShell: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.06),
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  previewCopy: {
    flex: 1,
    gap: 2,
  },
  previewTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  previewBody: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  syncShell: {
    padding: 18,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  syncHeaderCopy: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  inlineAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  inlineActionText: {
    color: MD_CHROME_GOLD,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
  },
  syncCards: {
    gap: 12,
    paddingTop: 16,
  },
  syncCard: {
    backgroundColor: withAlpha('#FFFFFF', 0.04),
    borderRadius: 22,
    gap: 10,
    minHeight: 108,
    padding: 16,
    width: 112,
  },
  syncCardActive: {
    backgroundColor: withAlpha(MD_CHROME_GOLD, 0.16),
  },
  syncCardTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 13,
  },
  syncCardTime: {
    color: '#9F8E81',
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
  },
  privacyCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    padding: 18,
  },
  buttonStack: {
    gap: 12,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    color: '#4B2700',
    fontFamily: MD_FONTS.bold,
    fontSize: 15,
  },
  secondaryButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 13,
  },
  disabled: {
    opacity: 0.55,
  },
});
