import { StyleSheet, Text, View } from 'react-native';
import {
  getHumanVerifiedBadgeCopy,
} from '../logic';
import {
  FR_PURPLE_GLOW_STYLE,
  FR_SURFACES,
  FR_TEXT,
  FR_TYPOGRAPHY,
  type ForumTrustTier,
} from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export interface HumanVerifiedBadgeProps {
  tier: ForumTrustTier;
  showLabel?: boolean;
}

export function HumanVerifiedBadge({
  tier,
  showLabel = true,
}: HumanVerifiedBadgeProps) {
  const badge = getHumanVerifiedBadgeCopy(tier);

  return (
    <View style={[styles.container, badge.glow ? FR_PURPLE_GLOW_STYLE : null]}>
      <MaterialSymbol name="verified_user" size={14} color={badge.color} filled />
      {showLabel ? <Text style={[styles.label, { color: showLabel ? FR_TEXT : badge.color }]}>{badge.label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: FR_SURFACES.low,
  },
  label: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT,
  },
});
