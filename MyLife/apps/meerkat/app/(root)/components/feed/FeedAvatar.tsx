// Plan 32 T1.1: the feed card avatar.
//
// Initial-only for now (single-letter fallback, exactly like the rest of the app
// today). The `imageUri` slot is wired but defaults to null so Plan 32 Phase 2
// swaps in the signed community-profile avatar resolver with a one-line change,
// keeping the render precedence image -> initial -> `?`. RN Image renders a
// data: URI as a raster; no webview/html render of untrusted bytes.

import { Image as RNImage, StyleSheet, Text, View } from 'react-native';
import { type MkColors } from '../../theme/tokens';
import { useMkStyles } from '../../providers/AppThemeProvider';

export function FeedAvatar({
  initial,
  imageUri = null,
  size = 40,
}: {
  initial: string;
  imageUri?: string | null;
  size?: number;
}) {
  const styles = useMkStyles(makeStyles);
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (imageUri) {
    return (
      <RNImage
        accessibilityIgnoresInvertColors
        source={{ uri: imageUri }}
        style={[styles.avatar, dim]}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={[styles.avatar, styles.initialFill, dim]}>
      <Text style={[styles.initialText, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  avatar: {
    backgroundColor: c.surfaceHigh,
    overflow: 'hidden',
  },
  initialFill: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  initialText: {
    color: c.accentDim,
    fontWeight: '800',
  },
});
