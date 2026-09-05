import type { TrailDifficulty } from '../../types';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  TR_ACCENT,
  TR_ACCENT_LIGHT,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  TR_TYPOGRAPHY,
} from '../tokens';
import { DifficultyChip } from './DifficultyChip';
import { GlassCard } from './GlassCard';
import { MaterialSymbol } from './MaterialSymbol';

export type TrailCardVariant = 'grid' | 'row' | 'hero';

export interface TrailCardTrail {
  id?: string;
  name: string;
  difficulty?: TrailDifficulty | null;
  distanceMeters?: number | null;
  elevationGainMeters?: number | null;
  region?: string | null;
  description?: string | null;
  coverUri?: string | null;
  lastExploredLabel?: string | null;
  liveGps?: boolean;
}

export interface TrailCardProps {
  trail: TrailCardTrail;
  variant?: TrailCardVariant;
  onPress?: () => void;
}

export function formatTrailDistance(distanceMeters?: number | null): string {
  if (distanceMeters == null) {
    return '--';
  }
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

export function formatTrailElevation(elevationGainMeters?: number | null): string {
  if (elevationGainMeters == null) {
    return '--';
  }
  return `${Math.round(elevationGainMeters)} m`;
}

export function TrailCard({
  trail,
  variant = 'grid',
  onPress,
}: TrailCardProps) {
  const content = (
    <GlassCard padding={0} style={styles.shell}>
      {variant === 'hero' ? (
        <HeroContent trail={trail} />
      ) : variant === 'row' ? (
        <RowContent trail={trail} />
      ) : (
        <GridContent trail={trail} />
      )}
    </GlassCard>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

function GridContent({ trail }: { trail: TrailCardTrail }) {
  return (
    <View style={styles.gridCard}>
      <CardImage uri={trail.coverUri} height={200} />
      <LinearGradient
        colors={['rgba(14,14,19,0)', 'rgba(14,14,19,0.92)']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.gridBadge}>
        {trail.difficulty ? <DifficultyChip level={trail.difficulty} size="sm" /> : null}
      </View>
      <View style={styles.gridFooter}>
        <Text style={styles.gridTitle} numberOfLines={2}>
          {trail.name}
        </Text>
        <View style={styles.statsRow}>
          <TrailStat icon="straighten" value={formatTrailDistance(trail.distanceMeters)} />
          <TrailStat icon="terrain" value={formatTrailElevation(trail.elevationGainMeters)} />
        </View>
      </View>
    </View>
  );
}

function RowContent({ trail }: { trail: TrailCardTrail }) {
  return (
    <View style={styles.rowCard}>
      <CardImage uri={trail.coverUri} height={96} width={96} />
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {trail.name}
          </Text>
          {trail.difficulty ? <DifficultyChip level={trail.difficulty} size="sm" /> : null}
        </View>
        {trail.region ? (
          <Text style={styles.rowRegion} numberOfLines={1}>
            {trail.region}
          </Text>
        ) : null}
        <View style={styles.statsRow}>
          <TrailStat icon="straighten" value={formatTrailDistance(trail.distanceMeters)} />
          <TrailStat icon="terrain" value={formatTrailElevation(trail.elevationGainMeters)} />
        </View>
      </View>
    </View>
  );
}

function HeroContent({ trail }: { trail: TrailCardTrail }) {
  return (
    <View style={styles.heroCard}>
      <CardImage uri={trail.coverUri} height={256} />
      <LinearGradient
        colors={['rgba(14,14,19,0.04)', 'rgba(14,14,19,0.96)']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.heroTopRow}>
        {trail.liveGps ? (
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>Live GPS</Text>
          </View>
        ) : <View />}
        {trail.difficulty ? <DifficultyChip level={trail.difficulty} /> : null}
      </View>
      <View style={styles.heroFooter}>
        <Text style={styles.heroEyebrow}>
          {(trail.lastExploredLabel ?? 'Last Explored').toUpperCase()}
        </Text>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {trail.name}
        </Text>
        <View style={styles.statsRow}>
          <TrailStat icon="straighten" value={formatTrailDistance(trail.distanceMeters)} />
          <TrailStat icon="terrain" value={formatTrailElevation(trail.elevationGainMeters)} />
        </View>
      </View>
    </View>
  );
}

function CardImage({
  uri,
  height,
  width,
}: {
  uri?: string | null;
  height: number;
  width?: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        contentFit="cover"
        style={[
          styles.image,
          {
            height,
            width: width ?? '100%',
          },
        ]}
      />
    );
  }

  return (
    <LinearGradient
      colors={['rgba(132,204,22,0.32)', 'rgba(101,163,13,0.18)', 'rgba(14,14,19,0.92)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.image,
        styles.placeholder,
        {
          height,
          width: width ?? '100%',
        },
      ]}
    >
      <MaterialSymbol name="map" size={28} color={TR_ACCENT_LIGHT} />
    </LinearGradient>
  );
}

function TrailStat({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <MaterialSymbol name={icon} size={14} color={TR_ACCENT_LIGHT} />
      <Text style={styles.statText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
  },
  image: {
    overflow: 'hidden',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCard: {
    position: 'relative',
    minHeight: 200,
  },
  gridBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  gridFooter: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    gap: 10,
  },
  gridTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  rowCard: {
    flexDirection: 'row',
    minHeight: 96,
    overflow: 'hidden',
  },
  rowBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
    flex: 1,
  },
  rowRegion: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  heroCard: {
    minHeight: 256,
    position: 'relative',
  },
  heroTopRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroFooter: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    gap: 10,
  },
  heroEyebrow: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  heroTitle: {
    ...TR_TYPOGRAPHY.displayLg,
    color: TR_TEXT,
    fontSize: 28,
    lineHeight: 30,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(19, 19, 24, 0.7)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: TR_ACCENT_LIGHT,
    shadowColor: TR_ACCENT,
    shadowOpacity: 0.36,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  liveLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
  },
});
