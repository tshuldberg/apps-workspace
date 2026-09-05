import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import {
  BookOpen,
  Check,
  Compass,
  Download,
  Globe,
  Info,
  Mail,
  MapPin,
  Palette,
  Sliders,
  ShoppingBasket,
  Trash2,
  Truck,
  UserCircle,
} from 'lucide-react-native';
import { JAKARTA_FONTS, isValidEmailShape } from '@mylife/bestchef';
import { useAddedToast } from '@mylife/bestchef/ui';
import { Text } from '@mylife/ui';
import {
  useAppThemeColors as useThemeColors,
  useAppThemeProfile as useTheme,
  type ThemeMode,
} from '../providers/AppThemeProvider';
import { useDatabase } from '../providers/DatabaseProvider';
import { useAppTheme } from '../providers/AppThemeProvider';
import { getCurrentLocation } from '../utils/location';
import { useI18n } from '../i18n/I18nProvider';
import { LanguagePicker } from '../i18n/LanguagePicker';
import { deleteBestChefAccount } from '../data/account';
import {
  getPushPermissionStatus,
  isDeviceRegistered,
  isPushProvisioned,
  registerPushToken,
  unregisterPushToken,
} from '../data/push';
import { buildBestChefDataExport, serializeBestChefDataExport } from '../data/data-export';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import { ThemePickerSection } from '../components/settings/ThemePickerSection';
import { PinwheelSettingsSection } from '../components/settings/PinwheelSettingsSection';
import { LEGAL_URLS, SUPPORT_EMAIL } from '../constants/legal';
import { ForwardChevron } from '../components/DirectionalIcons';

const APP_VERSION =
  (typeof Constants?.expoConfig?.version === 'string' && Constants.expoConfig.version) ||
  ((Constants as { nativeAppVersion?: string }).nativeAppVersion ?? 'dev');

const APP_BUILD_TAG =
  (typeof Constants?.expoConfig?.runtimeVersion === 'string' && Constants.expoConfig.runtimeVersion) ||
  ((Constants as { nativeBuildVersion?: string }).nativeBuildVersion ?? '');

function SectionHeading({ icon, label }: { icon: React.ReactNode; label: string }) {
  const tc = useThemeColors();
  return (
    <View style={styles.sectionHeading}>
      {icon}
      <Text style={[styles.sectionHeadingText, { color: tc.accent }]}>{label}</Text>
    </View>
  );
}

function loadSetting(db: ReturnType<typeof useDatabase>, key: string): string | null {
  const rows = db.query<{ value: string }>(`SELECT value FROM rc_settings WHERE key = ?`, [key]);
  return rows[0]?.value ?? null;
}

function saveSetting(db: ReturnType<typeof useDatabase>, key: string, value: string): void {
  db.execute(`INSERT OR REPLACE INTO rc_settings (key, value) VALUES (?, ?)`, [key, value]);
}

const THEME_MODES: ThemeMode[] = ['light', 'dark', 'auto'];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDatabase();
  const tc = useThemeColors();
  const currentTheme = useTheme();
  const cloud = useBestChefCloud();
  const { theme: appTheme, themeMode, setThemeMode } = useAppTheme();
  const { languageOption, language, t } = useI18n();
  const toast = useAddedToast();
  const [zipCode, setZipCode] = useState('');
  const [defaultLocation, setDefaultLocation] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [chefOrigin, setChefOrigin] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountEmailTouched, setAccountEmailTouched] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountExportLoading, setAccountExportLoading] = useState(false);

  // F-022: debounce save toasts so rapid keystrokes show a single confirmation.
  const lastToastAtRef = useRef(0);
  const TOAST_DEBOUNCE_MS = 600;
  const showSaveToast = () => {
    const now = Date.now();
    if (now - lastToastAtRef.current < TOAST_DEBOUNCE_MS) return;
    lastToastAtRef.current = now;
    toast.show(t('settings_saved_toast'));
  };

  useEffect(() => {
    try {
      setZipCode(loadSetting(db, 'zip_code') ?? '');
      setDefaultLocation(loadSetting(db, 'default_location') ?? '');
      setChefOrigin(loadSetting(db, 'chef_origin') ?? '');
      setNotificationsEnabled(loadSetting(db, 'notifications') !== 'false');
    } catch (err) {
      // rc_settings may not have these keys yet; intentional fallback for first read.
      if (__DEV__) console.warn('[settings] initial load', err);
    }
  }, [db]);

  // Reconcile the toggle with the device's real registration state: the local
  // pref is the user's intent, but the true "push on" state is whether this
  // device's token is registered server-side. Never prompts (isDeviceRegistered
  // only reads an already-granted token).
  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await isDeviceRegistered(cloud.supabase, cloud.userId);
      if (active && result.ok) setNotificationsEnabled(result.registered);
    })();
    return () => {
      active = false;
    };
  }, [cloud.supabase, cloud.userId]);

  const notifySaveFailed = (err: unknown, previousValue?: string | boolean) => {
    console.warn('[settings]', err);
    Alert.alert(t('settings.save_failed_title'), t('settings.save_failed_body'));
    return previousValue;
  };
  const persistZip = (v: string) => {
    const previous = zipCode;
    setZipCode(v);
    try {
      saveSetting(db, 'zip_code', v);
      showSaveToast();
    } catch (err) {
      notifySaveFailed(err);
      setZipCode(previous);
    }
  };
  const persistLocation = (v: string) => {
    const previous = defaultLocation;
    setDefaultLocation(v);
    try {
      saveSetting(db, 'default_location', v);
      showSaveToast();
    } catch (err) {
      notifySaveFailed(err);
      setDefaultLocation(previous);
    }
  };
  const persistOrigin = (v: string) => {
    const previous = chefOrigin;
    setChefOrigin(v);
    try {
      saveSetting(db, 'chef_origin', v);
      showSaveToast();
    } catch (err) {
      notifySaveFailed(err);
      setChefOrigin(previous);
    }
  };
  // Registers this device and stores the outcome. Shared by the toggle and the
  // post-rationale continuation. Reverts the toggle with an honest, reason-
  // specific message on any failure rather than pretending push is on.
  const enablePush = async (previous: boolean) => {
    setPushBusy(true);
    toast.show(t('push.enabling'));
    try {
      const result = await registerPushToken(cloud.supabase, cloud.userId, { locale: language });
      if (!result.ok) {
        setNotificationsEnabled(previous);
        if (result.reason === 'permission_denied') {
          // Distinct title + a shortcut to the OS settings, where the user must
          // re-enable a permission they previously denied.
          Alert.alert(t('push.permission_denied_title'), t('push.permission_denied_body'), [
            { text: t('OK'), style: 'cancel' },
            { text: t('push.open_settings'), onPress: () => void Linking.openSettings() },
          ]);
          return;
        }
        const message =
          result.reason === 'not_provisioned'
            ? t('push.not_provisioned_body')
            : result.reason === 'cloud_unavailable'
              ? t('push.sign_in_body')
              : t('push.enable_failed_body');
        Alert.alert(t('push.enable_failed_title'), message);
        return;
      }
      saveSetting(db, 'notifications', 'true');
      toast.show(t('push.enabled_toast'));
    } catch (err) {
      notifySaveFailed(err);
      setNotificationsEnabled(previous);
    } finally {
      setPushBusy(false);
    }
  };

  // The toggle persists the local intent AND registers/unregisters the device
  // push token server-side. Enabling is the deliberate, user-initiated moment to
  // ask for OS permission (not a cold-launch ambush). When permission is still
  // undetermined we show a rationale first so the OS prompt is not a surprise;
  // if already granted/denied we go straight to registration (which surfaces the
  // denied state honestly).
  const persistNotifications = async (v: boolean) => {
    if (pushBusy) return;
    const previous = notificationsEnabled;
    setNotificationsEnabled(v);

    if (v) {
      const status = await getPushPermissionStatus();
      if (status === 'undetermined') {
        Alert.alert(t('push.permission_prompt_title'), t('push.permission_prompt_body'), [
          {
            text: t('push.not_now'),
            style: 'cancel',
            onPress: () => setNotificationsEnabled(previous),
          },
          { text: t('OK'), onPress: () => void enablePush(previous) },
        ]);
        return;
      }
      await enablePush(previous);
      return;
    }

    setPushBusy(true);
    toast.show(t('push.disabling'));
    try {
      const result = await unregisterPushToken(cloud.supabase, cloud.userId);
      if (!result.ok) {
        setNotificationsEnabled(previous);
        Alert.alert(t('push.disable_failed_title'), t('push.disable_failed_body'));
        return;
      }
      saveSetting(db, 'notifications', 'false');
      toast.show(t('push.disabled_toast'));
    } catch (err) {
      notifySaveFailed(err);
      setNotificationsEnabled(previous);
    } finally {
      setPushBusy(false);
    }
  };

  const handleThemeMode = (mode: ThemeMode) => {
    if (mode === themeMode) return;
    setThemeMode(mode);
    showSaveToast();
  };

  const linkFallback = (url: string) => t('Open {url} in your browser to view this page.', { url });

  const openUrlSafely = async (url: string, fallbackMessage: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(t('About'), fallbackMessage);
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      console.warn('[settings] openURL', err);
      Alert.alert(t('About'), fallbackMessage);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('Delete all data?'),
      t('This requests cloud deletion, removes your BestChef profile, wipes local recipes, pantry, submissions, comments, votes, media cache files, settings, and sync secrets from this device. This cannot be undone.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteBestChefAccount(db, {
                supabase: cloud.supabase,
                reason: 'user_requested_delete_account',
              });
              const warningText = result.warnings.length > 0
                ? `\n\n${t('Warnings')}: ${result.warnings.join('; ')}`
                : '';
              Alert.alert(
                t('Account deleted'),
                `${t('Your BestChef data on this device has been wiped.')}${warningText}`,
                [{ text: t('OK'), onPress: () => router.replace('/') }],
              );
            } catch (err) {
              console.warn('[settings] wipeAccount', err);
              Alert.alert(t('Error'), String(err instanceof Error ? err.message : err));
            }
          },
        },
      ],
    );
  };

  // On-device kitchen export: the copy of BestChef data stored locally on this
  // device (recipes, grocery, pantry, device settings). Distinct from the full
  // account export below, which pulls server-side records.
  const handleExportDeviceData = async () => {
    try {
      const data = buildBestChefDataExport(db, {
        exportedAt: new Date().toISOString(),
        fullAccountExportUrl: LEGAL_URLS.dataDeletion,
      });
      const json = serializeBestChefDataExport(data);
      if (Platform.OS === 'ios') {
        const fileUri = `${FileSystem.cacheDirectory ?? ''}bestchef-device-export.json`;
        await FileSystem.writeAsStringAsync(fileUri, json);
        await Share.share({ title: t('Your BestChef device data'), url: fileUri });
      } else {
        await Share.share({ title: t('Your BestChef device data'), message: json });
      }
    } catch (err) {
      Alert.alert(t('Export failed'), String(err instanceof Error ? err.message : err));
    }
  };

  // Full account export (GDPR Art. 20): calls the bestchef-export-account Edge
  // Function, which returns the authenticated user's server-side records as
  // portable JSON. Requires cloud config + a session.
  const handleExportAccount = async () => {
    if (accountExportLoading) return;
    if (!cloud.isConfigured || !cloud.supabase) {
      Alert.alert(t('Full account export'), t('BestChef cloud is not configured.'));
      return;
    }
    setAccountExportLoading(true);
    try {
      const { data, error } = await cloud.supabase.functions.invoke('bestchef-export-account', {
        body: {},
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; export?: unknown; error?: { message?: string } } | null;
      if (!payload?.ok || !payload.export) {
        throw new Error(payload?.error?.message ?? t('Account export failed. Try again.'));
      }
      const json = JSON.stringify(payload.export, null, 2);
      if (Platform.OS === 'ios') {
        const fileUri = `${FileSystem.cacheDirectory ?? ''}bestchef-account-export.json`;
        await FileSystem.writeAsStringAsync(fileUri, json);
        await Share.share({ title: t('Your BestChef account data'), url: fileUri });
      } else {
        await Share.share({ title: t('Your BestChef account data'), message: json });
      }
    } catch (err) {
      Alert.alert(
        t('Full account export'),
        String(err instanceof Error ? err.message : t('Account export failed. Try again.')),
      );
    } finally {
      setAccountExportLoading(false);
    }
  };

  const accountEmailValid = useMemo(() => isValidEmailShape(accountEmail), [accountEmail]);

  const handleEmailLink = async () => {
    if (!accountEmailValid) {
      setAccountEmailTouched(true);
      return;
    }
    setAccountLoading(true);
    try {
      await cloud.requestEmailLink(accountEmail.trim());
      Alert.alert(
        t('Check your email'),
        cloud.isAnonymous
          ? t('We sent a link to attach this BestChef profile to your email.')
          : t('We sent a BestChef sign-in link to your email.'),
      );
    } catch (err) {
      Alert.alert(t('Error'), String(err instanceof Error ? err.message : err));
    } finally {
      setAccountLoading(false);
    }
  };

  const handlePasswordRecovery = async () => {
    if (!accountEmailValid) {
      setAccountEmailTouched(true);
      return;
    }
    setAccountLoading(true);
    try {
      await cloud.requestPasswordRecovery(accountEmail.trim());
      Alert.alert(
        t('Check your email'),
        t('We sent recovery instructions for your BestChef account.'),
      );
    } catch (err) {
      Alert.alert(t('Error'), String(err instanceof Error ? err.message : err));
    } finally {
      setAccountLoading(false);
    }
  };

  const accountStatusTitle = !cloud.isConfigured
    ? t('Local-only account')
    : cloud.isAnonymous
      ? t('Anonymous beta account')
      : t('Linked account');
  const accountStatusSubtitle = !cloud.isConfigured
    ? t('Cloud auth is not configured on this build.')
    : cloud.isAnonymous
      ? t('Link an email before public launch to keep submissions recoverable across devices.')
      : t('Your BestChef cloud profile is attached to a durable sign-in method.');

  const accountEmailInvalid = accountEmailTouched && accountEmail.length > 0 && !accountEmailValid;
  const accountSubmitDisabled = accountLoading || !accountEmailValid;

  const themeModeLabel = (mode: ThemeMode) => {
    if (mode === 'light') return t('theme_mode_light');
    if (mode === 'dark') return t('theme_mode_dark');
    return t('theme_mode_auto');
  };

  return (
    <ScrollView style={[styles.screen, { backgroundColor: tc.background }]} contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: tc.text }]}>{t('Settings')}</Text>
        <Text style={[styles.headerSubtitle, { color: tc.textSecondary }]}>{t('Configure your BestChef experience')}</Text>
      </View>

      <SectionHeading icon={<Globe size={16} color={tc.accent} strokeWidth={2} />} label={t('Language & Region')} />
      <Pressable
        style={({ pressed }) => [styles.card, { backgroundColor: currentTheme.glass.cardFill, borderColor: currentTheme.glass.cardBorder }, pressed && { opacity: 0.85 }]}
        onPress={() => setLanguagePickerVisible(true)}
      >
        <View style={styles.settingsRow}>
          <View style={[styles.settingsIconBox, { backgroundColor: tc.surface }]}>
            <Globe size={18} color={tc.accent} strokeWidth={2} />
          </View>
          <View style={styles.settingsBody}>
            <Text style={[styles.settingsTitle, { color: tc.text }]}>{languageOption.nativeName}</Text>
            <Text style={[styles.settingsSubtitle, { color: tc.textSecondary }]}>
              {t('Recipe content stays native. Interface copy uses your selected language.')}
            </Text>
          </View>
          <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
        </View>
      </Pressable>

      <SectionHeading icon={<Truck size={16} color={tc.accent} strokeWidth={2} />} label={t('Grocery Delivery')} />
      <View style={[styles.card, { backgroundColor: currentTheme.glass.cardFill, borderColor: currentTheme.glass.cardBorder }]}>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Delivery Zip Code')}</Text>
          <TextInput
            style={[styles.fieldInput, { color: tc.text }]}
            value={zipCode}
            onChangeText={persistZip}
            placeholder={t('Enter your zip code')}
            placeholderTextColor={tc.textTertiary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={10}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: tc.border }]} />
        <Text style={[styles.fieldHint, { color: tc.textTertiary }]}>{t('Used to check ingredient availability from grocery delivery providers in your area.')}</Text>
      </View>

      <SectionHeading icon={<BookOpen size={16} color={tc.accent} strokeWidth={2} />} label={t('Kitchen')} />
      <View style={[styles.card, { backgroundColor: currentTheme.glass.cardFill, borderColor: currentTheme.glass.cardBorder }]}>
        <Pressable style={styles.settingsRow} onPress={() => router.push('/(tabs)/kitchen')}>
          <View style={[styles.settingsIconBox, { backgroundColor: tc.surface }]}>
            <BookOpen size={18} color={tc.accent} strokeWidth={2} />
          </View>
          <View style={styles.settingsBody}>
            <Text style={[styles.settingsTitle, { color: tc.text }]}>{t('Saved Recipes')}</Text>
            <Text style={[styles.settingsSubtitle, { color: tc.textSecondary }]}>
              {t('Private recipes, grocery flags, and pantry inventory.')}
            </Text>
          </View>
          <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
        </Pressable>
        <View style={[styles.divider, { backgroundColor: tc.border }]} />
        <Pressable style={styles.settingsRow} onPress={() => router.push('/grocery')}>
          <View style={[styles.settingsIconBox, { backgroundColor: tc.surface }]}>
            <ShoppingBasket size={18} color={tc.accent} strokeWidth={2} />
          </View>
          <View style={styles.settingsBody}>
            <Text style={[styles.settingsTitle, { color: tc.text }]}>{t('Grocery Lists')}</Text>
            <Text style={[styles.settingsSubtitle, { color: tc.textSecondary }]}>
              {t('Manage active and archived grocery lists.')}
            </Text>
          </View>
          <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
        </Pressable>
      </View>

      <SectionHeading icon={<UserCircle size={16} color={tc.accent} strokeWidth={2} />} label={t('Chef Defaults')} />
      <View style={[styles.card, { backgroundColor: currentTheme.glass.cardFill, borderColor: currentTheme.glass.cardBorder }]}>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Default Location')}</Text>
          <TextInput
            style={[styles.fieldInput, { color: tc.text }]}
            value={defaultLocation}
            onChangeText={persistLocation}
            placeholder={t('e.g. Los Angeles, CA')}
            placeholderTextColor={tc.textTertiary}
          />
          <Pressable
            style={styles.locationButton}
            onPress={async () => {
              setLocationLoading(true);
              try {
                const loc = await getCurrentLocation(t);
                if (loc) persistLocation(loc);
              } finally {
                setLocationLoading(false);
              }
            }}
          >
            {locationLoading ? (
              <ActivityIndicator size={14} color={tc.accent} />
            ) : (
              <MapPin size={14} color={tc.accent} strokeWidth={2} />
            )}
            <Text style={[styles.locationButtonText, { color: tc.accent }]}>
              {locationLoading ? t('Detecting...') : t('Use My Location')}
            </Text>
          </Pressable>
        </View>
        <View style={[styles.divider, { backgroundColor: tc.border }]} />
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Chef Origin')}</Text>
          <TextInput
            style={[styles.fieldInput, { color: tc.text }]}
            value={chefOrigin}
            onChangeText={persistOrigin}
            placeholder={t('e.g. Italian-American, Oaxacan')}
            placeholderTextColor={tc.textTertiary}
          />
        </View>
      </View>

      <SectionHeading icon={<Sliders size={16} color={tc.accent} strokeWidth={2} />} label={t('Preferences')} />
      <View style={[styles.card, { backgroundColor: currentTheme.glass.cardFill, borderColor: currentTheme.glass.cardBorder }]}>
        <View style={styles.switchRow}>
          <View style={styles.switchBody}>
            <Text style={[styles.settingsTitle, { color: tc.text }]}>{t('push.toggle_title')}</Text>
            <Text style={[styles.settingsSubtitle, { color: tc.textSecondary }]}>{t('push.toggle_subtitle')}</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={persistNotifications}
            disabled={pushBusy}
            trackColor={{ false: tc.surfaceElevated, true: tc.accent }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={tc.surfaceElevated}
          />
        </View>
        {notificationsEnabled ? (
          <Text style={[styles.settingsSubtitle, { color: tc.textTertiary, marginTop: 6 }]}>
            {`${t('push.section_label')}: ${t('push.rank_channel_name')}, ${t('push.moderation_channel_name')}`}
          </Text>
        ) : null}
      </View>

      <SectionHeading icon={<Compass size={16} color={tc.accent} strokeWidth={2} />} label={t('Quick Actions')} />
      <PinwheelSettingsSection />
      <Pressable
        style={({ pressed }) => [styles.card, { backgroundColor: currentTheme.glass.cardFill, borderColor: currentTheme.glass.cardBorder }, pressed && { opacity: 0.85 }]}
        onPress={() => router.push('/pinwheel-mission-control')}
      >
        <View style={styles.settingsRow}>
          <View style={[styles.settingsIconBox, { backgroundColor: tc.surface }]}>
            <Compass size={18} color={tc.accent} strokeWidth={2} />
          </View>
          <View style={styles.settingsBody}>
            <Text style={[styles.settingsTitle, { color: tc.text }]}>{t('Pinwheel Mission Control')}</Text>
            <Text style={[styles.settingsSubtitle, { color: tc.textSecondary }]}>
              {t('See visual examples of the header, fan-out, and customization layout.')}
            </Text>
          </View>
          <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
        </View>
      </Pressable>

      <SectionHeading icon={<Palette size={16} color={tc.accent} strokeWidth={2} />} label={t('Appearance')} />
      <View style={[styles.card, { backgroundColor: currentTheme.glass.cardFill, borderColor: currentTheme.glass.cardBorder }]}>
        <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('theme_mode_label')}</Text>
        <View style={styles.modeRow}>
          {THEME_MODES.map((mode) => {
            const isActive = themeMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => handleThemeMode(mode)}
                style={({ pressed }) => [
                  styles.modeChip,
                  {
                    borderColor: isActive ? tc.accent : tc.border,
                    backgroundColor: isActive ? `${tc.accent}1F` : 'transparent',
                  },
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                {isActive && <Check size={12} color={tc.accent} strokeWidth={3} />}
                <Text style={[styles.modeChipText, { color: isActive ? tc.accent : tc.text }]}>
                  {themeModeLabel(mode)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <ThemePickerSection />
      <Pressable
        style={({ pressed }) => [styles.card, { backgroundColor: currentTheme.glass.cardFill, borderColor: currentTheme.glass.cardBorder }, pressed && { opacity: 0.85 }]}
        onPress={() => router.push('/theme-browser')}
      >
        <View style={styles.settingsRow}>
          <View style={[styles.settingsIconBox, { backgroundColor: tc.surface }]}>
            <Palette size={18} color={tc.accent} strokeWidth={2} />
          </View>
          <View style={styles.settingsBody}>
            <Text style={[styles.settingsTitle, { color: tc.text }]}>{t('Browse themes')}</Text>
            <Text style={[styles.settingsSubtitle, { color: tc.textSecondary }]}>{t('Choose a theme to match your kitchen')}</Text>
          </View>
          <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
        </View>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.card, { backgroundColor: currentTheme.glass.cardFill, borderColor: currentTheme.glass.cardBorder }, pressed && { opacity: 0.85 }]}
        onPress={() => router.push('/theme-editor')}
      >
        <View style={styles.settingsRow}>
          <View style={[styles.settingsIconBox, { backgroundColor: tc.surface }]}>
            <Sliders size={18} color={tc.primaryContainer} strokeWidth={2} />
          </View>
          <View style={styles.settingsBody}>
            <Text style={[styles.settingsTitle, { color: tc.text }]}>{t('Customize Colors')}</Text>
            <Text style={[styles.settingsSubtitle, { color: tc.textSecondary }]}>{t('Create a custom theme')}</Text>
          </View>
          <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
        </View>
      </Pressable>

      <SectionHeading icon={<UserCircle size={16} color={tc.accent} strokeWidth={2} />} label={t('Account')} />
      <View style={[styles.card, { backgroundColor: currentTheme.glass.cardFill, borderColor: currentTheme.glass.cardBorder }]}>
        <View style={styles.settingsRow}>
          <View style={[styles.settingsIconBox, { backgroundColor: tc.surface }]}>
            <UserCircle size={18} color={tc.accent} strokeWidth={2} />
          </View>
          <View style={styles.settingsBody}>
            <Text style={[styles.settingsTitle, { color: tc.text }]}>{accountStatusTitle}</Text>
            <Text style={[styles.settingsSubtitle, { color: tc.textSecondary }]}>{accountStatusSubtitle}</Text>
            {cloud.authLinkMessage ? (
              <Text
                style={[
                  styles.settingsSubtitle,
                  { color: cloud.authLinkStatus === 'error' ? '#FFB4AB' : tc.accent },
                ]}
              >
                {t(cloud.authLinkMessage)}
              </Text>
            ) : null}
          </View>
        </View>
        {cloud.isConfigured ? (
          <>
            <View style={[styles.divider, { backgroundColor: tc.border }]} />
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Account Email')}</Text>
              <TextInput
                style={[
                  styles.fieldInput,
                  { color: tc.text },
                  accountEmailInvalid && { borderBottomWidth: 1, borderBottomColor: '#FFB4AB' },
                ]}
                value={accountEmail}
                onChangeText={setAccountEmail}
                onBlur={() => setAccountEmailTouched(true)}
                placeholder={t('chef@example.com')}
                placeholderTextColor={tc.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              {accountEmailInvalid ? (
                <Text style={[styles.fieldHint, { color: '#FFB4AB' }]}>
                  {t('settings_email_invalid')}
                </Text>
              ) : null}
            </View>
            <View style={styles.accountActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.accountButton,
                  { borderColor: tc.accent, opacity: accountSubmitDisabled ? 0.5 : pressed ? 0.8 : 1 },
                ]}
                onPress={handleEmailLink}
                disabled={accountSubmitDisabled}
              >
                {accountLoading ? (
                  <ActivityIndicator size={14} color={tc.accent} />
                ) : (
                  <Mail size={14} color={tc.accent} strokeWidth={2} />
                )}
                <Text style={[styles.accountButtonText, { color: tc.accent }]}>
                  {cloud.isAnonymous ? t('Link Email') : t('Send Sign-in Link')}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.accountButton,
                  { borderColor: tc.border, opacity: accountSubmitDisabled ? 0.5 : pressed ? 0.8 : 1 },
                ]}
                onPress={handlePasswordRecovery}
                disabled={accountSubmitDisabled}
              >
                <Text style={[styles.accountButtonText, { color: tc.textSecondary }]}>{t('Recovery Email')}</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>

      <SectionHeading icon={<Globe size={16} color={tc.accent} strokeWidth={2} />} label={t('Creator Program')} />
      <Pressable
        style={({ pressed }) => [styles.card, { backgroundColor: currentTheme.glass.cardFill, borderColor: currentTheme.glass.cardBorder }, pressed && { opacity: 0.85 }]}
        onPress={() => router.push('/creator-program')}
      >
        <View style={styles.settingsRow}>
          <View style={[styles.settingsIconBox, { backgroundColor: tc.surface }]}>
            <Globe size={18} color={tc.primaryContainer} strokeWidth={2} />
          </View>
          <View style={styles.settingsBody}>
            <Text style={[styles.settingsTitle, { color: tc.text }]}>{t('Creator Program')}</Text>
            <Text style={[styles.settingsSubtitle, { color: tc.textSecondary }]}>{t('Apply to become a verified creator')}</Text>
          </View>
          <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
        </View>
      </Pressable>

      <SectionHeading icon={<Info size={16} color={tc.accent} strokeWidth={2} />} label={t('About')} />
      <View style={[styles.card, { backgroundColor: currentTheme.glass.cardFill, borderColor: currentTheme.glass.cardBorder }]}>
        <View style={styles.aboutRow}>
          <Text style={[styles.aboutLabel, { color: tc.text }]}>{t('Version')}</Text>
          <Text style={[styles.aboutValue, { color: tc.textSecondary }]}>{APP_VERSION}</Text>
        </View>
        {APP_BUILD_TAG ? (
          <>
            <View style={[styles.divider, { backgroundColor: tc.border }]} />
            <View style={styles.aboutRow}>
              <Text style={[styles.aboutLabel, { color: tc.text }]}>{t('Build')}</Text>
              <Text style={[styles.aboutValue, { color: tc.textSecondary }]}>{APP_BUILD_TAG}</Text>
            </View>
          </>
        ) : null}
        <View style={[styles.divider, { backgroundColor: tc.border }]} />
        <View style={styles.aboutRow}>
          <Text style={[styles.aboutLabel, { color: tc.text }]}>{t('Theme')}</Text>
          <Text style={[styles.aboutValue, { color: tc.textSecondary }]}>{appTheme.name}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: tc.border }]} />
        <Pressable
          style={styles.aboutRow}
          onPress={() => void openUrlSafely(LEGAL_URLS.privacy, linkFallback(LEGAL_URLS.privacy))}
        >
          <Text style={[styles.aboutLabel, { color: tc.text }]}>{t('Privacy Policy')}</Text>
          <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
        </Pressable>
        <View style={[styles.divider, { backgroundColor: tc.border }]} />
        <Pressable
          style={styles.aboutRow}
          onPress={() => void openUrlSafely(LEGAL_URLS.terms, linkFallback(LEGAL_URLS.terms))}
        >
          <Text style={[styles.aboutLabel, { color: tc.text }]}>{t('Terms of Service')}</Text>
          <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
        </Pressable>
        <View style={[styles.divider, { backgroundColor: tc.border }]} />
        <Pressable
          style={styles.aboutRow}
          onPress={() => void openUrlSafely(LEGAL_URLS.guidelines, linkFallback(LEGAL_URLS.guidelines))}
        >
          <Text style={[styles.aboutLabel, { color: tc.text }]}>{t('Community Guidelines')}</Text>
          <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
        </Pressable>
        <View style={[styles.divider, { backgroundColor: tc.border }]} />
        <Pressable
          style={styles.aboutRow}
          onPress={() => void openUrlSafely(LEGAL_URLS.dataDeletion, linkFallback(LEGAL_URLS.dataDeletion))}
        >
          <Text style={[styles.aboutLabel, { color: tc.text }]}>{t('Data & Deletion')}</Text>
          <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
        </Pressable>
        <View style={[styles.divider, { backgroundColor: tc.border }]} />
        <Pressable
          style={styles.aboutRow}
          onPress={() => void openUrlSafely(`mailto:${SUPPORT_EMAIL}`, t('Email us at {email}.', { email: SUPPORT_EMAIL }))}
        >
          <Text style={[styles.aboutLabel, { color: tc.text }]}>{t('Support')}</Text>
          <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
        </Pressable>
        <View style={[styles.divider, { backgroundColor: tc.border }]} />
        <Pressable style={styles.aboutRow} onPress={() => void handleExportDeviceData()}>
          <View style={styles.deleteRowBody}>
            <Download size={16} color={tc.text} strokeWidth={2} />
            <View style={styles.exportRowText}>
              <Text style={[styles.aboutLabel, { color: tc.text }]}>{t('Export device data')}</Text>
              <Text style={[styles.settingsSubtitle, { color: tc.textSecondary }]}>
                {t('The BestChef data stored on this device.')}
              </Text>
            </View>
          </View>
          <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
        </Pressable>
        <View style={[styles.divider, { backgroundColor: tc.border }]} />
        <Pressable
          style={styles.aboutRow}
          onPress={() => void handleExportAccount()}
          disabled={accountExportLoading}
        >
          <View style={styles.deleteRowBody}>
            <Download size={16} color={tc.text} strokeWidth={2} />
            <View style={styles.exportRowText}>
              <Text style={[styles.aboutLabel, { color: tc.text }]}>{t('Full account export')}</Text>
              <Text style={[styles.settingsSubtitle, { color: tc.textSecondary }]}>
                {t('A machine-readable copy of your full account, including server records.')}
              </Text>
            </View>
          </View>
          {accountExportLoading ? (
            <ActivityIndicator size="small" color={tc.textTertiary} />
          ) : (
            <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
          )}
        </Pressable>
        <View style={[styles.divider, { backgroundColor: tc.border }]} />
        <Pressable style={styles.aboutRow} onPress={handleDeleteAccount}>
          <View style={styles.deleteRowBody}>
            <Trash2 size={16} color="#FFB4AB" strokeWidth={2} />
            <Text style={[styles.aboutLabel, { color: '#FFB4AB' }]}>{t('Delete Account')}</Text>
          </View>
          <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
        </Pressable>
      </View>

      <Text style={[styles.versionText, { color: tc.textSecondary }]}>BESTCHEF v{APP_VERSION}  {'\u2022'}  {appTheme.name.toUpperCase()}</Text>
      <LanguagePicker
        visible={languagePickerVisible}
        title={t('Change Language')}
        onClose={() => setLanguagePickerVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { paddingHorizontal: 20, paddingBottom: 64, gap: 16 },
  header: { gap: 6, marginBottom: 8 },
  headerTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 30, lineHeight: 40, letterSpacing: -0.6 },
  headerSubtitle: { fontFamily: JAKARTA_FONTS.regular, fontSize: 14 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  sectionHeadingText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11, letterSpacing: 1.6 },
  card: {
    borderRadius: 18, padding: 18, borderWidth: 1,
  },
  divider: { height: 1, marginVertical: 14 },
  fieldGroup: { gap: 10 },
  fieldLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, letterSpacing: 1.4 },
  fieldInput: { fontFamily: JAKARTA_FONTS.medium, fontSize: 15, padding: 0 },
  fieldHint: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12, lineHeight: 18 },
  locationButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' as const, paddingVertical: 4 },
  locationButtonText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  switchBody: { flex: 1, gap: 4 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingsIconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  settingsBody: { flex: 1, gap: 2 },
  settingsTitle: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 15 },
  settingsSubtitle: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12 },
  colorDots: { flexDirection: 'row', gap: 4 },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deleteRowBody: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exportRowText: { flex: 1, gap: 2 },
  aboutLabel: { fontFamily: JAKARTA_FONTS.medium, fontSize: 14 },
  aboutValue: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 14 },
  accountActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  accountButton: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  accountButtonText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 },
  versionText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 10, letterSpacing: 2, textAlign: 'center', marginTop: 16 },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  modeChipText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 },
});
