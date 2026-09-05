import { useCallback, useState } from 'react';
import { uuid } from '../../../lib/uuid';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  createAttachment,
  type Attachment,
} from '@mylife/mood';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const accentColor = colors.modules.mood;

interface PhotoPickerProps {
  entryId: string;
  onAttach: (attachment: Attachment) => void;
}

export function PhotoPicker({ entryId, onAttach }: PhotoPickerProps) {
  const db = useDatabase();
  const [photos, setPhotos] = useState<Attachment[]>([]);

  const pickFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const attachment = createAttachment(db, uuid(), {
        entryId,
        type: 'photo',
        filePath: asset.uri,
        fileSizeBytes: 0,
        mimeType: 'image/jpeg',
        width: asset.width ?? null,
        height: asset.height ?? null,
      });
      setPhotos((prev) => [...prev, attachment]);
      onAttach(attachment);
    }
  }, [db, entryId, onAttach]);

  const pickFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const attachment = createAttachment(db, uuid(), {
        entryId,
        type: 'photo',
        filePath: asset.uri,
        fileSizeBytes: 0,
        mimeType: 'image/jpeg',
        width: asset.width ?? null,
        height: asset.height ?? null,
      });
      setPhotos((prev) => [...prev, attachment]);
      onAttach(attachment);
    }
  }, [db, entryId, onAttach]);

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <Pressable style={[styles.chipButton, { borderColor: accentColor }]} onPress={pickFromCamera}>
          <Text variant="caption" color={accentColor}>Take Photo</Text>
        </Pressable>
        <Pressable style={[styles.chipButton, { borderColor: accentColor }]} onPress={pickFromLibrary}>
          <Text variant="caption" color={accentColor}>Choose Photo</Text>
        </Pressable>
      </View>

      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailRow}>
          {photos.map((photo) => (
            <Image
              key={photo.id}
              source={{ uri: photo.filePath }}
              style={styles.thumbnail}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  buttonRow: { flexDirection: 'row', gap: spacing.xs },
  chipButton: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: colors.glass,
  },
  thumbnailRow: { marginTop: spacing.xs },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: spacing.xs,
  },
});
