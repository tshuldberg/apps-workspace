import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ST_ACCENT, ST_ACCENT_LIGHT, ST_COSMIC_GLOW_STYLE, ST_FONTS, ST_ON_ACCENT } from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export interface CosmicFABProps {
  onPress: () => void;
  icon?: string;
  label?: string;
}

export function CosmicFAB({
  onPress,
  icon = 'add',
  label = 'New',
}: CosmicFABProps) {
  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Pressable onPress={onPress}>
        <LinearGradient
          colors={[ST_ACCENT_LIGHT, ST_ACCENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          <MaterialSymbol name={icon} size={18} color={ST_ON_ACCENT} filled />
          <Text style={styles.label}>{label}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    right: 24,
    bottom: 112,
    zIndex: 40,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: ST_COSMIC_GLOW_STYLE.shadowColor,
    shadowOpacity: ST_COSMIC_GLOW_STYLE.shadowOpacity,
    shadowRadius: ST_COSMIC_GLOW_STYLE.shadowRadius,
    shadowOffset: ST_COSMIC_GLOW_STYLE.shadowOffset,
    elevation: ST_COSMIC_GLOW_STYLE.elevation,
  },
  label: {
    fontFamily: ST_FONTS.bold,
    fontSize: 15,
    color: ST_ON_ACCENT,
  },
});
