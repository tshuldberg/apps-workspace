import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import {
  MD_PAIN_LEVELS,
  MD_TEXT_SECONDARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '../tokens';

export type BodyRegionId =
  | 'head'
  | 'chest'
  | 'abdomen'
  | 'left_arm'
  | 'right_arm'
  | 'left_leg'
  | 'right_leg'
  | 'back';

export interface BodyDiagramRegion {
  id: BodyRegionId;
  side?: 'front' | 'back';
  tone?: keyof typeof MD_PAIN_LEVELS | string;
}

export interface BodyDiagramProps {
  regions?: BodyDiagramRegion[];
  selected?: string[];
  onPress?: (regionId: BodyRegionId) => void;
  mode?: 'dual' | 'front' | 'back';
}

const FRONT_REGIONS: Array<{
  id: BodyRegionId;
  type: 'circle' | 'rect';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
}> = [
  { id: 'head', type: 'circle', x: 40, y: 18, radius: 12 },
  { id: 'chest', type: 'rect', x: 24, y: 36, width: 32, height: 26 },
  { id: 'abdomen', type: 'rect', x: 28, y: 66, width: 24, height: 24 },
  { id: 'left_arm', type: 'rect', x: 8, y: 40, width: 12, height: 48 },
  { id: 'right_arm', type: 'rect', x: 60, y: 40, width: 12, height: 48 },
  { id: 'left_leg', type: 'rect', x: 28, y: 94, width: 12, height: 54 },
  { id: 'right_leg', type: 'rect', x: 40, y: 94, width: 12, height: 54 },
];

const BACK_REGIONS: Array<{
  id: BodyRegionId;
  type: 'circle' | 'rect';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
}> = [
  { id: 'head', type: 'circle', x: 40, y: 18, radius: 12 },
  { id: 'back', type: 'rect', x: 24, y: 36, width: 32, height: 56 },
  { id: 'left_arm', type: 'rect', x: 8, y: 40, width: 12, height: 48 },
  { id: 'right_arm', type: 'rect', x: 60, y: 40, width: 12, height: 48 },
  { id: 'left_leg', type: 'rect', x: 28, y: 94, width: 12, height: 54 },
  { id: 'right_leg', type: 'rect', x: 40, y: 94, width: 12, height: 54 },
];

function getToneColor(
  regionId: BodyRegionId,
  selected: string[],
  regionMap: Map<string, BodyDiagramRegion>,
) {
  const region = regionMap.get(regionId);
  const tone = region?.tone;

  if (typeof tone === 'string' && tone.startsWith('#')) {
    return tone;
  }

  if (tone && tone in MD_PAIN_LEVELS) {
    return MD_PAIN_LEVELS[tone as keyof typeof MD_PAIN_LEVELS];
  }

  return selected.includes(regionId)
    ? MD_PAIN_LEVELS.severe
    : withAlpha(MD_TEXT_SECONDARY, 0.14);
}

export function BodyDiagram({
  regions = [],
  selected = [],
  onPress,
  mode = 'dual',
}: BodyDiagramProps) {
  const regionMap = new Map(regions.map((region) => [region.id, region]));

  const renderSilhouette = (
    shapes: typeof FRONT_REGIONS,
    side: 'front' | 'back',
  ) => (
    <Svg height={156} width={80}>
      {shapes.map((shape) => {
        const region = regionMap.get(shape.id);
        const targetSide = region?.side ?? side;
        const active = targetSide === side;
        const fill = active
          ? getToneColor(shape.id, selected, regionMap)
          : withAlpha(MD_TEXT_SECONDARY, 0.08);

        if (shape.type === 'circle') {
          return (
            <Circle
              key={`${side}-${shape.id}`}
              cx={shape.x}
              cy={shape.y}
              fill={fill}
              onPress={() => onPress?.(shape.id)}
              r={shape.radius ?? 0}
            />
          );
        }

        return (
          <Rect
            key={`${side}-${shape.id}`}
            fill={fill}
            height={shape.height ?? 0}
            onPress={() => onPress?.(shape.id)}
            rx={10}
            width={shape.width ?? 0}
            x={shape.x}
            y={shape.y}
          />
        );
      })}
    </Svg>
  );

  return (
    <View style={styles.container}>
      {mode !== 'back' ? (
        <View style={styles.side}>
          {renderSilhouette(FRONT_REGIONS, 'front')}
          <Text style={styles.sideLabel}>Front</Text>
        </View>
      ) : null}
      {mode !== 'front' ? (
        <View style={styles.side}>
          {renderSilhouette(BACK_REGIONS, 'back')}
          <Text style={styles.sideLabel}>Back</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'space-between',
  },
  side: {
    alignItems: 'center',
    gap: 8,
  },
  sideLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
  },
});
