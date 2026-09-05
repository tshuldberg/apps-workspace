// Plan 32 T2.4: the one place avatar precedence lives (image -> initial -> `?`).
// Feed cards, member rows, the Messages People list, and post threads render
// through this; the chat-kit bubble keeps its own inline avatar but is fed the
// same resolved image via `avatarImageUri` so precedence never forks.
import {
  Image as RNImage,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors } from '../providers/AppThemeProvider';

/** Wrap a stored base64 JPEG avatar as a renderable data URI (or null). */
export function avatarImageUri(imageBase64: string | null | undefined): string | null {
  if (!imageBase64) return null;
  return `data:image/jpeg;base64,${imageBase64}`;
}

export function Avatar({
  imageBase64,
  initial,
  size = 32,
  style,
}: {
  imageBase64?: string | null;
  initial?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useAppThemeColors();
  const uri = avatarImageUri(imageBase64);
  const dims = { width: size, height: size, borderRadius: MK_RADIUS.pill };
  // A signed avatar is size + JPEG-magic gated (see isValidCommunityAvatarImage),
  // NOT decoded, so a corrupt or huge-dimension in-cap image renders blank here by
  // design (never a crash). The initial fallback below covers the no-image case.
  if (uri) {
    return (
      <RNImage
        source={{ uri }}
        style={[dims, { backgroundColor: c.surfaceHigh }, style as unknown as StyleProp<ImageStyle>]}
        accessibilityIgnoresInvertColors
      />
    );
  }
  const label = (initial && initial.trim()) || '?';
  return (
    <View
      style={[dims, styles.fallback, { backgroundColor: c.surfaceHigh }, style]}
    >
      <Text style={{ color: c.accentDim, fontSize: Math.round(size * 0.42), fontWeight: '800' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
