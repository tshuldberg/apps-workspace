// Trainer Studio profile editor. Edits the owner-controlled fields (headline,
// specialties, socials, hero image, price tier). is_verified / is_active /
// subscriber_count are never written from here (the DB protect trigger rejects
// them); the hero image reuses the trainer_thumbnail upload kind.

import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ImagePlus } from 'lucide-react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { WK_FONTS } from '@mylife/workouts';
import { uploadTrainerImage } from '../../data/cloud-media';
import {
  updateMyTrainerProfile,
  type CloudTrainerProfile,
} from '../../data/cloud-trainers';
import { DW_ACCENT, DW_BORDER, DW_SURFACES, DW_TEXT } from '../../theme/tokens';
import {
  PriceTierPicker,
  SpecialtyChipsInput,
  StudioButton,
  StudioField,
} from './studio-kit';

function imageContentType(asset: ImagePicker.ImagePickerAsset): string {
  const mime = asset.mimeType?.toLowerCase();
  if (mime === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

export function ProfileEditor({
  supabase,
  trainer,
  onSaved,
}: {
  supabase: SupabaseClient;
  trainer: CloudTrainerProfile;
  onSaved: (updated: CloudTrainerProfile) => void;
}) {
  const [headline, setHeadline] = useState(trainer.headline ?? '');
  const [specialties, setSpecialties] = useState<string[]>(trainer.specialties);
  const [instagram, setInstagram] = useState(trainer.instagram ?? '');
  const [website, setWebsite] = useState(trainer.website ?? '');
  const [heroImagePath, setHeroImagePath] = useState<string | null>(trainer.heroImagePath);
  const [priceTier, setPriceTier] = useState(trainer.priceTier);
  const [saving, setSaving] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);

  const changeHero = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    let contentLength = 0;
    try {
      const info = await FileSystem.getInfoAsync(asset.uri);
      contentLength = info.exists && info.size ? info.size : 0;
    } catch {
      contentLength = 0;
    }
    setHeroUploading(true);
    const upload = await uploadTrainerImage(supabase, {
      kind: 'trainer_thumbnail',
      fileUri: asset.uri,
      contentType: imageContentType(asset),
      contentLength,
    });
    setHeroUploading(false);
    if (!upload.ok) {
      Alert.alert('Could not upload image', upload.error);
      return;
    }
    setHeroImagePath(upload.publicUrl);
  }, [supabase]);

  const save = useCallback(async () => {
    setSaving(true);
    const result = await updateMyTrainerProfile(supabase, trainer.id, {
      headline,
      specialties,
      instagram,
      website,
      heroImagePath,
      priceTier,
    });
    setSaving(false);
    if (!result.ok) {
      Alert.alert('Could not save profile', result.error);
      return;
    }
    onSaved(result.trainer);
    Alert.alert('Profile saved', 'Your public profile is up to date.');
  }, [supabase, trainer.id, headline, specialties, instagram, website, heroImagePath, priceTier, onSaved]);

  return (
    <View style={styles.container}>
      <View style={styles.identityCard}>
        <Text style={styles.identityName}>{trainer.displayName}</Text>
        {trainer.handle ? <Text style={styles.identityHandle}>@{trainer.handle}</Text> : null}
        <Text style={styles.identityHint}>Your name and handle are set at onboarding.</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Hero image</Text>
        <Pressable
          style={styles.heroPreview}
          onPress={() => void changeHero()}
          accessibilityRole="button"
          accessibilityLabel="Change hero image"
        >
          {heroImagePath ? (
            <Image source={{ uri: heroImagePath }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroPlaceholder}>
              <ImagePlus size={22} color={DW_TEXT.tertiary} />
              <Text style={styles.heroPlaceholderText}>Add a hero image</Text>
            </View>
          )}
          {heroUploading ? (
            <View style={styles.heroOverlay}>
              <ActivityIndicator color={DW_TEXT.primary} />
            </View>
          ) : null}
        </Pressable>
        {heroImagePath ? <Text style={styles.hint}>Tap the image to replace it.</Text> : null}
      </View>

      <StudioField
        label="Headline"
        value={headline}
        onChangeText={setHeadline}
        placeholder="What you help clients achieve"
      />

      <SpecialtyChipsInput value={specialties} onChange={setSpecialties} />

      <StudioField
        label="Instagram"
        value={instagram}
        onChangeText={setInstagram}
        placeholder="@yourhandle"
        autoCapitalize="none"
      />

      <StudioField
        label="Website"
        value={website}
        onChangeText={setWebsite}
        placeholder="https://yoursite.com"
        autoCapitalize="none"
        keyboardType="url"
      />

      <PriceTierPicker value={priceTier} onChange={setPriceTier} />
      <Text style={styles.hint}>
        Subscribers pay this monthly for your premium library once subscriptions go live.
      </Text>

      <StudioButton label={saving ? 'Saving…' : 'Save profile'} onPress={() => void save()} disabled={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  identityCard: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 2,
  },
  identityName: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 20,
    color: DW_TEXT.primary,
  },
  identityHandle: {
    fontFamily: WK_FONTS.medium,
    fontSize: 14,
    color: DW_ACCENT,
  },
  identityHint: {
    marginTop: 6,
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.tertiary,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.secondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroPreview: {
    height: 170,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: DW_SURFACES.high,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroPlaceholderText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    color: DW_TEXT.tertiary,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  hint: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.tertiary,
  },
});
