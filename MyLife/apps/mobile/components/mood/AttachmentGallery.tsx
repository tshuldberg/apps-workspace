import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  getAttachmentsForEntry,
  deleteAttachment,
  type Attachment,
} from '@mylife/mood';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../DatabaseProvider';

const accentColor = colors.modules.mood;

interface AttachmentGalleryProps {
  entryId: string;
  editable: boolean;
}

export function AttachmentGallery({ entryId, editable }: AttachmentGalleryProps) {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const attachments = useMemo(
    () => getAttachmentsForEntry(db, entryId),
    [db, entryId, tick],
  );

  const handleDelete = useCallback((attachment: Attachment) => {
    Alert.alert(
      'Delete Attachment',
      'Remove this attachment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteAttachment(db, attachment.id);
            setTick((t) => t + 1);
          },
        },
      ],
    );
  }, [db]);

  const togglePlayback = useCallback((id: string) => {
    setPlayingId((prev) => (prev === id ? null : id));
  }, []);

  if (attachments.length === 0) return null;

  const photos = attachments.filter((a) => a.type === 'photo');
  const voiceClips = attachments.filter((a) => a.type === 'voice');

  return (
    <View style={styles.container}>
      <Text variant="caption" color={colors.textSecondary}>
        {attachments.length} attachment{attachments.length !== 1 ? 's' : ''}
      </Text>

      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {photos.map((photo) => (
            <View key={photo.id} style={styles.thumbnailWrapper}>
              <Image source={{ uri: photo.filePath }} style={styles.thumbnail} />
              {editable && (
                <Pressable
                  style={styles.deleteOverlay}
                  onPress={() => handleDelete(photo)}
                >
                  <Text variant="caption" color="#FFFFFF" style={styles.deleteX}>X</Text>
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {voiceClips.length > 0 && (
        <View style={styles.voiceRow}>
          {voiceClips.map((clip) => (
            <View key={clip.id} style={styles.voiceCard}>
              <Pressable onPress={() => togglePlayback(clip.id)}>
                <Text variant="caption" color={playingId === clip.id ? accentColor : colors.text}>
                  {playingId === clip.id ? '\u{23F8}' : '\u{25B6}'}{' '}
                  {clip.durationSeconds ? `${Math.floor(clip.durationSeconds / 60)}:${String(clip.durationSeconds % 60).padStart(2, '0')}` : '0:00'}
                </Text>
              </Pressable>
              {editable && (
                <Pressable onPress={() => handleDelete(clip)}>
                  <Text variant="caption" color={colors.danger}>X</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.sm, gap: spacing.xs },
  thumbnailWrapper: { position: 'relative', marginRight: spacing.xs },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  deleteOverlay: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteX: { fontSize: 10, fontWeight: '700' },
  voiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  voiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
});
