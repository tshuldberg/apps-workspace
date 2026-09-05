import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { ChefHat } from 'lucide-react-native';
import { Text } from '@mylife/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';

export interface AvatarProps {
  /** Cloud avatar URL. When null/empty, falls back to initials over the accent gradient. */
  url?: string | null;
  /** Display name used to derive initials in the fallback state. */
  name?: string | null;
  /** Pixel size of the rendered circle. Defaults to 48. */
  size?: number;
  /** Optional override for the container style (margins, borders, etc.). */
  style?: ViewStyle;
  /** Render the chef hat glyph instead of initials when no URL is available. */
  preferChefHat?: boolean;
}

function deriveInitials(name: string | null | undefined): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('');
}

/**
 * Centralized avatar renderer for chef-facing surfaces. Reads the cloud
 * `avatar_url` and falls back to a tinted gradient + initials (or a chef hat
 * glyph when `preferChefHat` is set) when no URL is available.
 *
 * Used across edit profile, chef detail, comments, leaderboard rows, vote
 * feed chef row, and the notifications row so a single change to fallback
 * styling propagates everywhere.
 */
export function Avatar({ url, name, size = 48, style, preferChefHat = false }: AvatarProps) {
  const tc = useThemeColors();
  const radius = size / 2;
  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    backgroundColor: `${tc.accent}1A`,
  };

  if (url) {
    return (
      <View style={[styles.container, containerStyle, style]}>
        <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: radius }} />
      </View>
    );
  }

  const initials = deriveInitials(name);
  if (preferChefHat || !initials) {
    return (
      <View style={[styles.container, containerStyle, style]}>
        <ChefHat size={Math.round(size * 0.45)} color={tc.accent} strokeWidth={2} />
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle, style]}>
      <Text
        style={{
          fontFamily: JAKARTA_FONTS.bold,
          fontSize: Math.round(size * 0.4),
          lineHeight: Math.ceil(size * 0.52),
          includeFontPadding: false,
          textAlign: 'center',
          color: tc.accent,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden' as const,
  },
});

export default Avatar;
