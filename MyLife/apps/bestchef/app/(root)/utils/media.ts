import { useEffect, useState } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { AccessibilityInfo, Alert, Linking, Platform, ActionSheetIOS } from 'react-native';
import {
  assertVideoWithinLimits,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SIZE_MB,
  type VideoLimitTranslate,
} from './media-limits';

type Translate = VideoLimitTranslate;

const defaultTranslate: Translate = (key, values) =>
  values
    ? key.replace(/\{(\w+)\}/g, (match, name) =>
        name in values ? String(values[name]) : match,
      )
    : key;

export { MAX_VIDEO_BYTES, MAX_VIDEO_SIZE_MB };

export const MEDIA_SLOT_ASPECT_RATIOS = {
  recipe: 16 / 9,
  pantryBatch: 4 / 3,
  receipt: 3 / 4,
  foodPhoto: 1,
  video: 9 / 16,
} as const;

export type MediaSlotKind = keyof typeof MEDIA_SLOT_ASPECT_RATIOS;

export function mediaSlotFallbackLabel(kind: MediaSlotKind): string {
  switch (kind) {
    case 'recipe':
      return 'Recipe media';
    case 'pantryBatch':
      return 'Batch photo';
    case 'receipt':
      return 'Receipt thumbnail';
    case 'foodPhoto':
      return 'Food photo crop';
    case 'video':
      return 'Cooking video';
  }
}

export function isRenderableMediaUri(uri: string | null | undefined): uri is string {
  if (!uri) return false;
  const normalized = uri.trim().toLowerCase();
  return normalized.length > 0 && !normalized.startsWith('manual://');
}

export function useReducedMotionPreference(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReducedMotion(value);
      })
      .catch(() => {
        if (mounted) setReducedMotion(false);
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

async function ensureCameraPermission(t: Translate = defaultTranslate): Promise<void> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      t('Camera Access Required'),
      t('BestChef needs camera access to take photos of your dishes. Please enable it in Settings.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Open Settings'), onPress: () => Linking.openSettings() },
      ],
    );
    throw new Error('Camera permission is required. Please enable it in Settings.');
  }
}

async function ensureLibraryPermission(t: Translate = defaultTranslate): Promise<void> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      t('Photo Library Access Required'),
      t('BestChef needs access to your photo library to select images. Please enable it in Settings.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Open Settings'), onPress: () => Linking.openSettings() },
      ],
    );
    throw new Error('Photos permission is required. Please enable it in Settings.');
  }
}

/**
 * Re-encode a photo to strip EXIF metadata (including GPS).
 */
async function stripExif(uri: string): Promise<string> {
  const stripped = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return stripped.uri;
}

export async function pickPhoto(
  source: 'camera' | 'library',
  options?: { aspect?: [number, number]; quality?: number },
  t: Translate = defaultTranslate,
): Promise<string | null> {
  const aspect = options?.aspect ?? [4, 3];
  const quality = options?.quality ?? 0.8;

  try {
    if (source === 'camera') {
      await ensureCameraPermission(t);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect,
        quality,
      });
      if (result.canceled || !result.assets?.[0]) return null;
      return await stripExif(result.assets[0].uri);
    }

    await ensureLibraryPermission(t);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    return await stripExif(result.assets[0].uri);
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Could not access camera/library. Please try again.');
  }
}

export interface PickedVideo {
  uri: string;
  duration?: number;
  width?: number;
  height?: number;
}

export async function pickVideo(
  source: 'camera' | 'library',
  t: Translate = defaultTranslate,
): Promise<PickedVideo | null> {
  try {
    if (source === 'camera') {
      await ensureCameraPermission(t);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: 120,
        videoQuality: 1,
      });
      if (result.canceled || !result.assets?.[0]) return null;
      const asset = result.assets[0];
      // The camera path previously skipped these checks: a long/large
      // recording sailed through to the byte gate (audit M7).
      assertVideoWithinLimits(asset, t);
      return {
        uri: asset.uri,
        duration: asset.duration ?? undefined,
        width: asset.width ?? undefined,
        height: asset.height ?? undefined,
      };
    }

    await ensureLibraryPermission(t);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];

    assertVideoWithinLimits(asset, t);

    return {
      uri: asset.uri,
      duration: asset.duration ?? undefined,
      width: asset.width ?? undefined,
      height: asset.height ?? undefined,
    };
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Could not access camera/library. Please try again.');
  }
}

export function showAvatarPicker(
  onPicked: (uri: string) => void,
  t: Translate = defaultTranslate,
): void {
  const options = [t('Take Photo'), t('Choose from Library'), t('Cancel')];
  const cancelIndex = 2;

  const handleChoice = async (index: number) => {
    if (index === cancelIndex) return;
    const source = index === 0 ? 'camera' : 'library';
    try {
      const uri = await pickPhoto(source, { aspect: [1, 1], quality: 0.7 }, t);
      if (uri) onPicked(uri);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not access camera/library. Please try again.';
      Alert.alert(t('Error'), t(message));
    }
  };

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: cancelIndex },
      handleChoice,
    );
  } else {
    Alert.alert(t('Change Photo'), t('Choose a source'), [
      { text: t('Take Photo'), onPress: () => handleChoice(0) },
      { text: t('Choose from Library'), onPress: () => handleChoice(1) },
      { text: t('Cancel'), style: 'cancel' },
    ]);
  }
}
