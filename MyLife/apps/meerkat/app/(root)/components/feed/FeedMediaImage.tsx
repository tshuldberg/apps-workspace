// Plan 32 T1.1: inline first-image media on a feed card.
//
// Reuses the AttachmentCard data-URI pattern against ExpoBlobStore: the bytes are
// read from the LOCAL hash-verified blob store only. When this device does not
// hold the bytes yet, nothing renders (no fabricated placeholder, no fetch). RN
// Image renders the data: URI as a raster, so an image/svg+xml attachment is
// rasterized safely and never reaches a webview/html render path.

import { useEffect, useMemo, useState } from 'react';
import { Image as RNImage, Pressable, StyleSheet } from 'react-native';
import { type MkColors, MK_RADIUS } from '../../theme/tokens';
import { useMkStyles } from '../../providers/AppThemeProvider';
import { useMeerkatDatabase } from '../../providers/DatabaseProvider';
import { ExpoBlobStore } from '../../data/expo-blob-store';

export function FeedMediaImage({
  media,
  onPress,
  accessibilityLabel,
}: {
  media: { blobHash: string; mimeType: string };
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const styles = useMkStyles(makeStyles);
  const db = useMeerkatDatabase();
  const blobStore = useMemo(() => new ExpoBlobStore(db), [db]);
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    // previewDataUri returns null when this device does not hold the bytes, so a
    // separate presence stat would be redundant.
    void (async () => {
      const dataUri = await blobStore.previewDataUri(media.blobHash, media.mimeType);
      if (!cancelled) setUri(dataUri);
    })();
    return () => {
      cancelled = true;
    };
  }, [blobStore, media.blobHash, media.mimeType]);

  // No local bytes -> render nothing. The body + engagement row still describe the
  // post honestly; we never claim an image is present when it is not on device.
  if (!uri) return null;

  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <RNImage
        accessibilityIgnoresInvertColors
        source={{ uri }}
        style={styles.image}
        resizeMode="cover"
      />
    </Pressable>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  wrap: {
    borderRadius: MK_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: c.surfaceHigh,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: c.surfaceHigh,
  },
  pressed: { opacity: 0.85 },
});
