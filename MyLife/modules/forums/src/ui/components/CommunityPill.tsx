import { StyleSheet, Text, View } from 'react-native';
import type { Community } from '../../types';
import { getCommunityTone } from '../logic';
import {
  FR_COMMUNITY_TYPES,
  FR_PURPLE_GLOW_STYLE,
  FR_SURFACES,
  FR_TEXT_SECONDARY,
  FR_TYPOGRAPHY,
} from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export interface CommunityPillProps {
  community: Community;
  size?: 'sm' | 'md';
}

export function CommunityPill({
  community,
  size = 'sm',
}: CommunityPillProps) {
  const tone = getCommunityTone({
    humansOnly: community.humansOnly,
    communityType: community.communityType,
  });
  const toneColor = FR_COMMUNITY_TYPES[tone];
  const label = community.displayName || community.name;

  return (
    <View style={[styles.container, size === 'md' ? styles.medium : styles.small]}>
      {community.humansOnly ? (
        <View style={FR_PURPLE_GLOW_STYLE}>
          <MaterialSymbol name="shield" size={12} color={toneColor} filled />
        </View>
      ) : null}
      <MaterialSymbol name="groups" size={12} color={toneColor} />
      <Text numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: FR_SURFACES.high,
    maxWidth: '100%',
  },
  small: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  medium: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  label: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT_SECONDARY,
    maxWidth: 180,
  },
});
