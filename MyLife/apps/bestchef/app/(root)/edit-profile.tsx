import { useCallback, useEffect, useRef, useState } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, Check, MapPin, Pencil } from 'lucide-react-native';
import {
  AVATAR_MAX_DIMENSION,
  JAKARTA_FONTS,
  checkHandleAvailability,
  getProfilePrivacy,
  setProfilePrivacy,
  uploadAvatar,
  type HandleAvailability,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { Avatar } from './components/profile/Avatar';
import { useAppThemeColors as useThemeColors } from './providers/AppThemeProvider';
import { useBestChefCloud } from './providers/BestChefCloudProvider';
import { useDatabase } from './providers/DatabaseProvider';
import { showAvatarPicker } from './utils/media';
import { getCurrentLocation } from './utils/location';
import { useI18n } from './i18n/I18nProvider';
import { INPUT_CAPS, isValidHandle, normalizeHandle, sanitizeFreeText } from './utils/validation';
import { BackArrow } from './components/DirectionalIcons';

function loadSetting(db: ReturnType<typeof useDatabase>, key: string): string | null {
  try {
    const rows = db.query<{ value: string }>(`SELECT value FROM rc_settings WHERE key = ?`, [key]);
    return rows[0]?.value ?? null;
  } catch { return null; }
}

function saveSetting(db: ReturnType<typeof useDatabase>, key: string, value: string): void {
  try { db.execute(`INSERT OR REPLACE INTO rc_settings (key, value) VALUES (?, ?)`, [key, value]); } catch {}
}

export default function EditProfileScreen() {
  const router = useRouter();
  const tc = useThemeColors();
  const db = useDatabase();
  const cloud = useBestChefCloud();
  const { t } = useI18n();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [cuisines, setCuisines] = useState('');
  const [editing, setEditing] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [privacySaving, setPrivacySaving] = useState<boolean>(false);
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | HandleAvailability>('idle');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const handleCheckSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const profileId = cloud.profile?.id ?? null;
    if (!profileId) return;
    void getProfilePrivacy({ userId: profileId }).then((result) => {
      if (cancelled) return;
      if (result.ok) setIsPublic(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [cloud.profile?.id]);

  const handleTogglePrivacy = async (next: boolean) => {
    setIsPublic(next); // optimistic
    setPrivacySaving(true);
    const result = await setProfilePrivacy({ isPublic: next });
    setPrivacySaving(false);
    if (!result.ok) {
      setIsPublic(!next);
      Alert.alert(t('Update Failed'), result.error);
    }
  };

  useEffect(() => {
    const name = loadSetting(db, 'profile_display_name');
    const h = loadSetting(db, 'profile_handle');
    const b = loadSetting(db, 'profile_bio');
    const loc = loadSetting(db, 'profile_location');
    const c = loadSetting(db, 'profile_cuisines');
    const avatar = loadSetting(db, 'profile_avatar');
    if (name) { setDisplayName(name); setHasProfile(true); }
    if (h) setHandle(h);
    if (b) setBio(b);
    if (loc) setLocation(loc);
    if (c) setCuisines(c);
    if (avatar) setAvatarUri(avatar);
    if (!name) setEditing(true);
  }, [db]);

  // Debounced cloud handle availability check (F-025).
  useEffect(() => {
    const trimmed = handle.trim();
    if (!trimmed) {
      setHandleStatus('idle');
      return;
    }
    const supabase = cloud.supabase;
    const profileId = cloud.profile?.id ?? null;
    if (!supabase) {
      // Offline / not signed in: fall back to local validation only.
      setHandleStatus(isValidHandle(normalizeHandle(trimmed)) ? 'available' : 'invalid');
      return;
    }
    const seq = ++handleCheckSeq.current;
    setHandleStatus('checking');
    const timer = setTimeout(async () => {
      const result = await checkHandleAvailability(supabase, {
        handle: normalizeHandle(trimmed),
        currentProfileId: profileId ?? undefined,
      });
      if (seq !== handleCheckSeq.current) return;
      if (!result.ok) {
        setHandleStatus('idle');
        return;
      }
      setHandleStatus(result.data);
    }, 350);
    return () => clearTimeout(timer);
  }, [handle, cloud.supabase, cloud.profile?.id]);

  const handleAvatarPicked = useCallback(
    async (uri: string) => {
      // Optimistic local preview while we resize + upload.
      setAvatarUri(uri);
      const supabase = cloud.supabase;
      const userId = cloud.userId;
      if (!supabase || !userId) {
        // Not signed in: keep the local URI as a draft.
        return;
      }
      const previousUrl = avatarUri;
      setUploading(true);
      setUploadProgress(0);
      try {
        const resized = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: AVATAR_MAX_DIMENSION, height: AVATAR_MAX_DIMENSION } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
        );
        const result = await uploadAvatar(supabase, {
          uri: resized.uri,
          userId,
          onProgress: setUploadProgress,
        });
        if (!result.ok) {
          setAvatarUri(previousUrl);
          Alert.alert(t('edit_profile_upload_failed'), result.error, [
            { text: t('Cancel'), style: 'cancel' },
            { text: t('edit_profile_try_again'), onPress: () => void handleAvatarPicked(uri) },
          ]);
          return;
        }
        setAvatarUri(result.data.publicUrl);
        saveSetting(db, 'profile_avatar', result.data.publicUrl);
        Alert.alert(t('edit_profile_avatar_updated'));
      } catch (e) {
        setAvatarUri(previousUrl);
        Alert.alert(
          t('edit_profile_upload_failed'),
          e instanceof Error ? e.message : t('edit_profile_upload_failed'),
          [
            { text: t('Cancel'), style: 'cancel' },
            { text: t('edit_profile_try_again'), onPress: () => void handleAvatarPicked(uri) },
          ],
        );
      } finally {
        setUploading(false);
      }
    },
    [avatarUri, cloud.supabase, cloud.userId, db, t],
  );

  const handleStatusReady = handleStatus === 'available' || handleStatus === 'idle';
  const canSave = !!displayName.trim() && !!handle.trim() && handleStatusReady && !uploading;

  const handleSave = async () => {
    const normalizedHandle = normalizeHandle(handle);
    if (!isValidHandle(normalizedHandle)) {
      Alert.alert(t('Invalid handle'), t('Use 2-30 letters, numbers, or underscores.'));
      return;
    }
    const cleanDisplayName = sanitizeFreeText(displayName, INPUT_CAPS.displayName);
    const cleanBio = sanitizeFreeText(bio, INPUT_CAPS.bio);
    const cleanLocation = sanitizeFreeText(location, 120);
    const cleanCuisines = sanitizeFreeText(cuisines, 200);
    if (!cleanDisplayName) {
      Alert.alert(t('Invalid name'), t('Display name cannot be empty.'));
      return;
    }

    if (cloud.supabase && cloud.profile?.id) {
      const updates: Record<string, string | null> = {
        display_name: cleanDisplayName,
        handle: normalizedHandle,
        bio: cleanBio || null,
        cuisine: cleanCuisines || null,
        region: cleanLocation || null,
      };
      if (avatarUri && /^https?:\/\//.test(avatarUri)) {
        updates.avatar_url = avatarUri;
      }

      const { error: profileUpdateError } = await cloud.supabase
        .from('social_profiles')
        .update(updates)
        .eq('id', cloud.profile.id);

      if (profileUpdateError) {
        Alert.alert(t('Update Failed'), profileUpdateError.message);
        return;
      }

      await cloud.refreshProfile();
    }

    saveSetting(db, 'profile_display_name', cleanDisplayName);
    saveSetting(db, 'profile_handle', normalizedHandle);
    saveSetting(db, 'profile_bio', cleanBio);
    saveSetting(db, 'profile_location', cleanLocation);
    saveSetting(db, 'profile_cuisines', cleanCuisines);
    if (avatarUri) saveSetting(db, 'profile_avatar', avatarUri);
    setHandle(normalizedHandle);
    setDisplayName(cleanDisplayName);
    setBio(cleanBio);
    setLocation(cleanLocation);
    setCuisines(cleanCuisines);
    setHasProfile(true);
    setEditing(false);
    Alert.alert(t('Profile Saved'), t('Your chef profile has been updated.'));
  };

  if (!editing && hasProfile) {
    return (
      <View style={[styles.screen, { backgroundColor: tc.background }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <BackArrow size={24} color={tc.text} strokeWidth={2} />
          </Pressable>
          <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Profile')}</Text>
          <Pressable onPress={() => setEditing(true)} hitSlop={12}>
            <Pencil size={20} color={tc.accent} strokeWidth={2} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarSection}>
            <Avatar url={avatarUri} name={displayName} size={96} preferChefHat />
            <Text style={[styles.viewName, { color: tc.text }]}>{displayName}</Text>
            <Text style={[styles.viewHandle, { color: tc.textSecondary }]}>@{handle}</Text>
          </View>

          {bio ? (
            <View style={styles.viewSection}>
              <Text style={[styles.viewLabel, { color: tc.textTertiary }]}>{t('Bio')}</Text>
              <Text style={[styles.viewValue, { color: tc.text }]}>{bio}</Text>
            </View>
          ) : null}

          {location ? (
            <View style={styles.viewSection}>
              <Text style={[styles.viewLabel, { color: tc.textTertiary }]}>{t('Location')}</Text>
              <View style={styles.viewLocationRow}>
                <MapPin size={14} color={tc.textSecondary} strokeWidth={2} />
                <Text style={[styles.viewValue, { color: tc.text }]}>{location}</Text>
              </View>
            </View>
          ) : null}

          {cuisines ? (
            <View style={styles.viewSection}>
              <Text style={[styles.viewLabel, { color: tc.textTertiary }]}>{t('Cuisine Specialties')}</Text>
              <Text style={[styles.viewValue, { color: tc.text }]}>{cuisines}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.editButton, { backgroundColor: `${tc.accent}1F` }]}
            onPress={() => setEditing(true)}
          >
            <Pencil size={16} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.editButtonText, { color: tc.accent }]}>{t('Edit Profile')}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => hasProfile ? setEditing(false) : router.back()} hitSlop={12}>
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Edit Profile')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <Avatar url={avatarUri} name={displayName} size={96} preferChefHat />
          <Pressable
            style={styles.changePhotoButton}
            onPress={() => showAvatarPicker((uri) => void handleAvatarPicked(uri), t)}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size={14} color={tc.accent} />
            ) : (
              <Camera size={14} color={tc.accent} strokeWidth={2} />
            )}
            <Text style={[styles.changePhotoText, { color: tc.accent }]}>
              {uploading
                ? t('edit_profile_upload_progress').replace('{percent}', String(uploadProgress))
                : t('Change Photo')}
            </Text>
          </Pressable>
          {uploading ? (
            <Text style={[styles.uploadHint, { color: tc.textSecondary }]}>
              {t('edit_profile_uploading_avatar')}
            </Text>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Display Name')}</Text>
          <TextInput
            style={[styles.fieldInput, { color: tc.text, backgroundColor: tc.surface }]}
            placeholder={t('Your chef name')}
            placeholderTextColor={tc.textTertiary}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={INPUT_CAPS.displayName}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Handle')}</Text>
          <View style={[styles.handleContainer, { backgroundColor: tc.surface }]}>
            <Text style={[styles.handlePrefix, { color: tc.textTertiary }]}>@</Text>
            <TextInput
              style={[styles.handleInput, { color: tc.text }]}
              placeholder={t('your_handle')}
              placeholderTextColor={tc.textTertiary}
              value={handle}
              onChangeText={setHandle}
              autoCapitalize="none"
              maxLength={INPUT_CAPS.handle}
            />
          </View>
          {handle.trim().length > 0 ? (
            <HandleStatusPill status={handleStatus} t={t} />
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Bio')}</Text>
          <TextInput
            style={[styles.fieldInput, { color: tc.text, backgroundColor: tc.surface, minHeight: 80 }]}
            placeholder={t('Tell the community about your cooking style...')}
            placeholderTextColor={tc.textTertiary}
            value={bio}
            onChangeText={setBio}
            multiline
            textAlignVertical="top"
            maxLength={INPUT_CAPS.bio}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Location')}</Text>
          <TextInput
            style={[styles.fieldInput, { color: tc.text, backgroundColor: tc.surface }]}
            placeholder={t('e.g. Los Angeles, CA')}
            placeholderTextColor={tc.textTertiary}
            value={location}
            onChangeText={setLocation}
            maxLength={120}
          />
          <Pressable
            style={styles.locationButton}
            onPress={async () => {
              setLocationLoading(true);
              try {
                const loc = await getCurrentLocation(t);
                if (loc) setLocation(loc);
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

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Cuisine Specialties')}</Text>
          <TextInput
            style={[styles.fieldInput, { color: tc.text, backgroundColor: tc.surface }]}
            placeholder={t('e.g. Italian, Thai, Mexican')}
            placeholderTextColor={tc.textTertiary}
            value={cuisines}
            onChangeText={setCuisines}
            maxLength={200}
          />
        </View>

        {cloud.profile ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Privacy')}</Text>
            <View style={[styles.privacyRow, { backgroundColor: tc.surface }]}>
              <View style={styles.privacyText}>
                <Text style={[styles.privacyTitle, { color: tc.text }]}>
                  {t('Public profile')}
                </Text>
                <Text style={[styles.privacyHint, { color: tc.textSecondary }]}>
                  {t('Allow anyone with your link to view your chef page. Turn off to keep your profile private.')}
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={handleTogglePrivacy}
                disabled={privacySaving}
                trackColor={{ false: tc.surfaceElevated, true: tc.accent }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        ) : null}

        <Pressable
          style={[styles.saveButton, { backgroundColor: tc.accent }, !canSave && { opacity: 0.4 }]}
          disabled={!canSave}
          onPress={handleSave}
        >
          <Check size={18} color={tc.background} strokeWidth={2.5} />
          <Text style={[styles.saveButtonText, { color: tc.background }]}>{t('Save Profile')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function HandleStatusPill({
  status,
  t,
}: {
  status: 'idle' | 'checking' | HandleAvailability;
  t: (key: string) => string;
}) {
  const tc = useThemeColors();
  if (status === 'idle') return null;
  let label = '';
  let color = tc.textSecondary;
  switch (status) {
    case 'checking':
      label = t('edit_profile_checking');
      color = tc.textSecondary;
      break;
    case 'available':
      label = t('edit_profile_handle_available');
      color = tc.accent;
      break;
    case 'taken':
      label = t('edit_profile_handle_taken');
      color = '#FFB4AB';
      break;
    case 'cooldown':
      label = t('edit_profile_handle_cooldown');
      color = '#FFB877';
      break;
    case 'invalid':
      label = t('edit_profile_handle_invalid');
      color = '#FFB4AB';
      break;
  }
  return (
    <Text style={[styles.handleStatus, { color }]}>{label}</Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingTop: 56, paddingBottom: 12, gap: 12,
  },
  topBarTitle: { flex: 1, fontFamily: JAKARTA_FONTS.bold, fontSize: 17, textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120, gap: 16 },

  avatarSection: { alignItems: 'center', gap: 12 },
  changePhotoButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  changePhotoText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13 },
  uploadHint: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12 },
  handleStatus: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12, marginTop: 4 },

  viewName: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 24, letterSpacing: -0.5, marginTop: 4 },
  viewHandle: { fontFamily: JAKARTA_FONTS.medium, fontSize: 15 },
  viewSection: { gap: 4 },
  viewLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, letterSpacing: 1.4 },
  viewValue: { fontFamily: JAKARTA_FONTS.regular, fontSize: 15, lineHeight: 22 },
  viewLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 999, paddingVertical: 14, marginTop: 8,
  },
  editButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, letterSpacing: 1.4 },
  fieldInput: {
    fontFamily: JAKARTA_FONTS.regular, fontSize: 15,
    borderRadius: 14, padding: 14,
  },
  handleContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, overflow: 'hidden' as const },
  handlePrefix: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15, paddingLeft: 14, paddingVertical: 14 },
  handleInput: { flex: 1, fontFamily: JAKARTA_FONTS.regular, fontSize: 15, padding: 14, paddingLeft: 4 },
  locationButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' as const, paddingVertical: 4 },
  locationButtonText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13 },

  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 999, paddingVertical: 16,
  },
  saveButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },

  privacyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14,
  },
  privacyText: { flex: 1, gap: 4 },
  privacyTitle: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 15 },
  privacyHint: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12, lineHeight: 17 },
});
