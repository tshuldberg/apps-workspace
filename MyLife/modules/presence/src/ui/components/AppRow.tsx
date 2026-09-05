import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatScreenTime } from '../../engines/stats';
import { formatDeltaPercent } from '../logic';
import {
  PR_DANGER,
  PR_SUCCESS,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TYPOGRAPHY,
} from '../tokens';
import {
  MaterialSymbol,
  type PresenceMaterialSymbolName,
} from './MaterialSymbol';

export interface AppRowProps {
  appName: string;
  appCategory: string;
  minutes: number;
  deltaPercent: number | null;
  iconName: PresenceMaterialSymbolName;
  gradientFrom: string;
  gradientTo: string;
}

function getCategoryLabel(category: string): string {
  return category.replace(/(^\w)|(_\w)/g, (segment) => segment.replace('_', '').toUpperCase());
}

export function AppRow({
  appName,
  appCategory,
  minutes,
  deltaPercent,
  iconName,
  gradientFrom,
  gradientTo,
}: AppRowProps) {
  const deltaColor = deltaPercent == null || deltaPercent === 0
    ? PR_TEXT_SECONDARY
    : deltaPercent > 0
      ? PR_DANGER
      : PR_SUCCESS;

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <LinearGradient
          colors={[gradientFrom, gradientTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconTile}
        >
          <MaterialSymbol name={iconName} size={20} color="white" filled />
        </LinearGradient>

        <View style={styles.meta}>
          <Text style={styles.appName}>{appName}</Text>
          <View style={styles.categoryChip}>
            <Text style={styles.categoryText}>{getCategoryLabel(appCategory)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.time}>{formatScreenTime(minutes)}</Text>
        <Text style={[styles.delta, { color: deltaColor }]}>
          {formatDeltaPercent(deltaPercent)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: PR_SURFACES.mid,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    gap: 4,
    flex: 1,
  },
  appName: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(139, 207, 240, 0.18)',
  },
  categoryText: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_SECONDARY,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  time: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  delta: {
    ...PR_TYPOGRAPHY.labelTight,
  },
});
