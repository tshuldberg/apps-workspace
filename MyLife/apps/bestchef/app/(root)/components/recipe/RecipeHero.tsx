import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DishVisual, RankBadge } from '@mylife/bestchef/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import type { DemoSubmission } from '../../data/demo';

export interface RecipeHeroProps {
  submission: DemoSubmission;
  rank?: number;
}

const HERO_HEIGHT = 380;

/**
 * Full-bleed 380pt hero: gradient + oversized emoji backdrop via DishVisual,
 * optional photo overlay, bottom dark gradient for legibility, rank crown
 * pill (gold when rank <= 100), cuisine/region/dish line, and 30pt bold title.
 */
export function RecipeHero({ submission, rank }: RecipeHeroProps) {
  const showRank = typeof rank === 'number' && rank > 0;

  return (
    <View style={styles.container}>
      <DishVisual
        dish={{
          name: submission.title,
          photoUrl: submission.photoUrl ?? null,
        }}
        size={HERO_HEIGHT}
        radius={0}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Bottom dark scrim */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.65)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.scrim]}
        pointerEvents="none"
      />

      {/* Bottom content */}
      <View style={styles.bottomContent}>
        {showRank ? (
          <RankBadge
            rank={rank!}
            variant={rank! <= 100 ? 'gold' : 'default'}
            style={styles.rankBadge}
          />
        ) : null}

        <Text style={styles.metaLine} numberOfLines={1}>
          {submission.tags.find((t) => t.startsWith('cuisine:'))?.replace('cuisine:', '') ?? ''}
          {'  ·  '}
          {submission.chefName}
        </Text>

        <Text style={styles.title} numberOfLines={2}>
          {submission.title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: HERO_HEIGHT,
    overflow: 'hidden',
  },
  scrim: {
    top: '50%',
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingBottom: 22,
    gap: 8,
  },
  rankBadge: {
    alignSelf: 'flex-start',
  },
  metaLine: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
  },
  title: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 30,
    color: '#FFFFFF',
    lineHeight: 36,
  },
});
