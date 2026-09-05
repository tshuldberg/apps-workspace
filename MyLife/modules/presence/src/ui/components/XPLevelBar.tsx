import { StyleSheet, Text, View } from 'react-native';
import { getLevelForXP, xpForLevel } from '../../engines/xp';
import { getXPLevelBarProgress } from '../logic';
import {
  PR_ACCENT,
  PR_ACCENT_GLOW,
  PR_ACCENT_LIGHT,
  PR_CYAN_GLOW_STYLE,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TYPOGRAPHY,
} from '../tokens';

export interface XPLevelBarProps {
  level: number;
  totalXP: number;
  currentLevelXP: number;
  nextLevelXP: number;
  title?: string;
}

export function XPLevelBar({
  level,
  totalXP,
  currentLevelXP,
  nextLevelXP,
  title,
}: XPLevelBarProps) {
  const resolvedLevel = level || getLevelForXP(totalXP);
  const resolvedCurrentLevelXP = currentLevelXP ?? xpForLevel(resolvedLevel);
  const resolvedNextLevelXP = nextLevelXP ?? xpForLevel(resolvedLevel + 1);
  const progress = getXPLevelBarProgress({
    totalXP,
    level: resolvedLevel,
    currentLevelXP: resolvedCurrentLevelXP,
    nextLevelXP: resolvedNextLevelXP,
  });

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.levelPill}>
            <Text style={styles.levelText}>{`LEVEL ${resolvedLevel}`}</Text>
          </View>
          {title != null && <Text style={styles.title}>{title}</Text>}
        </View>
        <Text style={styles.totalXP}>{`${totalXP.toLocaleString()} Total XP`}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fillGlow, { width: `${progress * 100}%` }]} />
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: PR_SURFACES.low,
    padding: 16,
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  levelPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 145, 178, 0.2)',
  },
  levelText: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
    fontFamily: PR_TYPOGRAPHY.labelUpper.fontFamily,
  },
  title: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
    flexShrink: 1,
  },
  totalXP: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_SECONDARY,
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: PR_SURFACES.highest,
    overflow: 'hidden',
  },
  fillGlow: {
    ...StyleSheet.absoluteFillObject,
    right: 'auto',
    backgroundColor: PR_ACCENT_GLOW,
    borderRadius: 999,
    opacity: 0.75,
  },
  fill: {
    height: '100%',
    backgroundColor: PR_ACCENT,
    borderRadius: 999,
    ...PR_CYAN_GLOW_STYLE,
  },
});
