// Plan 32 T3.3: receiver-passive link preview card (Signal model).
//
// NC-2 (the Signal rule): this component NEVER fetches anything. It imports no
// fetch/network primitive. Its bytes come ONLY from the hash-verified attachment
// blob already on this device (blobStore.get), which it decodes with the pure
// parseLinkPreviewAttachment. The image is a data: URI built from the preview's
// OWN base64 (which rode the verified blob pipeline), never a remote Image source
// off preview.url. A malformed/oversized/unparseable blob degrades to the plain
// file chip (AttachmentCard); it never crashes and never fetches.
//
// Tapping the card opens a confirm sheet showing the FULL url before Linking
// hands off to the OS browser, so a receiver always sees where a tap will go.
//
// It renders in TWO places off the same verified blob:
//   - chat bubbles (AC-7 core: chat delivery with zero receiver fetch), which
//     pass a `fallback` (the plain file chip) for a missing/malformed blob; and
//   - feed cards (Plan 32 T5.1), which reference the blob via
//     FeedItem.linkPreview and pass NO fallback, so a missing/malformed preview
//     renders nothing extra (never a crash, never a receiver-side fetch, NC-2).
// The card takes only the blobHash; the caller owns any fallback so this file no
// longer depends on the attachment/event shape.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Image as RNImage,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link2 } from 'lucide-react-native';
import { type ChannelMessageAttachment } from '@mylife/sync';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { ExpoBlobStore } from '../data/expo-blob-store';
import { parseLinkPreviewAttachment, type LinkPreview } from '../data/link-preview';

/** True when an attachment is a link-preview payload (not a normal file). */
export function isLinkPreviewAttachment(attachment: ChannelMessageAttachment): boolean {
  return attachment.mimeType === 'application/x-meerkat-link-preview+json';
}

/** Best-effort host label for the confirm sheet + card domain line. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function LinkPreviewCard({
  blobHash,
  fallback = null,
}: {
  blobHash: string;
  /** Rendered when the blob is missing/malformed. Chat passes the file chip; the
   *  feed passes nothing (null), so a bad preview renders no extra card. */
  fallback?: ReactNode;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const db = useMeerkatDatabase();
  const blobStore = useMemo(() => new ExpoBlobStore(db), [db]);

  // null => still reading the local blob; then a parsed preview or false (bad).
  const [preview, setPreview] = useState<LinkPreview | null | false>(null);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    void (async () => {
      // Bytes come ONLY from the verified local blob, never a network call.
      const bytes = await blobStore.get(blobHash);
      if (cancelled) return;
      if (!bytes) {
        setPreview(false);
        return;
      }
      const parsed = parseLinkPreviewAttachment(bytes);
      if (!cancelled) setPreview(parsed ?? false);
    })();
    return () => {
      cancelled = true;
    };
  }, [blobHash, blobStore]);

  const confirmOpen = useCallback(() => {
    if (!preview) return;
    const url = preview.url;
    Alert.alert(
      'Open this link?',
      url,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open',
          onPress: () => {
            void Linking.openURL(url).catch(() => {
              Alert.alert('Could not open link', 'This device has no app that can open that link.');
            });
          },
        },
      ],
    );
  }, [preview]);

  // Not yet resolved: render nothing (the message body still shows the URL text).
  if (preview === null) return null;

  // Unknown / malformed / missing blob: degrade to the caller's fallback (the
  // chat file chip) or nothing (the feed). Either way it never fetches.
  if (preview === false) {
    return <>{fallback}</>;
  }

  // The image source is a data: URI built from the preview's OWN base64, which
  // arrived inside the hash-verified blob. It is NEVER a remote URL.
  const imageUri = preview.imageBase64
    ? `data:image/jpeg;base64,${preview.imageBase64}`
    : null;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open link: ${preview.title}`}
      accessibilityHint={hostOf(preview.url)}
      onPress={confirmOpen}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {imageUri ? (
        <RNImage source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      ) : null}
      <View style={styles.body}>
        <View style={styles.domainRow}>
          <Link2 size={12} color={c.textTertiary} strokeWidth={2} />
          <Text style={styles.domain} numberOfLines={1}>{hostOf(preview.url)}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{preview.title}</Text>
        {preview.description ? (
          <Text style={styles.description} numberOfLines={2}>{preview.description}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  card: {
    maxWidth: '100%',
    minWidth: 210,
    borderRadius: MK_RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 150,
    backgroundColor: c.surfaceHigh,
  },
  body: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 3,
  },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  domain: {
    flex: 1,
    minWidth: 0,
    color: c.textTertiary,
    fontSize: 11,
    fontWeight: '600',
  },
  title: { color: c.text, fontSize: 13.5, fontWeight: '700', lineHeight: 18 },
  description: { color: c.textSecondary, fontSize: 12, lineHeight: 16 },
  pressed: { opacity: 0.75 },
});
