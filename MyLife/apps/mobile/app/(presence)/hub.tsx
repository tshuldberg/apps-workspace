import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  createFocusSession,
  getDailyUsageRange,
  getSetting,
  GlassPanel,
  MaterialSymbol,
  PR_ACCENT_LIGHT,
  PR_CYAN_GLOW_STYLE,
  PR_FONTS,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TEXT_TERTIARY,
  PR_TYPOGRAPHY,
  SectionHeader,
  setSetting,
  type PresenceMaterialSymbolName,
  type SessionType,
} from '@mylife/presence';
import { useDatabase } from '../../components/DatabaseProvider';

type QuickStartTile = {
  title: string;
  subtitle: string;
  icon: PresenceMaterialSymbolName;
  minutes: number;
  type: SessionType;
  premium?: boolean;
};

const QUICK_STARTS: QuickStartTile[] = [
  {
    title: '5-Minute Reset',
    subtitle: 'Short solo reset',
    icon: 'psychology',
    minutes: 5,
    type: 'solo',
  },
  {
    title: 'Deep Work',
    subtitle: '90 minute solo block',
    icon: 'timer',
    minutes: 90,
    type: 'solo',
  },
  {
    title: 'No Phone Hour',
    subtitle: '60 minutes, zero excuses',
    icon: 'bedtime',
    minutes: 60,
    type: 'solo',
  },
  {
    title: 'Beast Mode',
    subtitle: 'High-intensity sprint',
    icon: 'local_fire_department',
    minutes: 45,
    type: 'beast',
    premium: true,
  },
];

const EDUCATION_CARDS: Array<{
  title: string;
  subtitle: string;
  icon: PresenceMaterialSymbolName;
}> = [
  { title: 'ADHD and screen time', subtitle: 'Attention-friendly boundaries', icon: 'psychology' },
  { title: 'Sleep hygiene', subtitle: 'Wind-down rhythms that stick', icon: 'bedtime' },
  { title: 'Mindfulness', subtitle: 'Presence over reaction', icon: 'lightbulb' },
  { title: 'Research', subtitle: 'What the latest evidence says', icon: 'insights' },
];

const BRIDGES: Array<{
  title: string;
  subtitle: string;
  route: '/(mood)' | '/(habits)' | '/(health)';
  icon: PresenceMaterialSymbolName;
}> = [
  {
    title: 'Pair with MyMood',
    subtitle: 'Catch the feeling behind the scroll.',
    route: '/(mood)',
    icon: 'psychology',
  },
  {
    title: 'Pair with MyHabits',
    subtitle: 'Turn focus blocks into repeatable routines.',
    route: '/(habits)',
    icon: 'check_circle',
  },
  {
    title: 'Pair with MyHealth Sleep',
    subtitle: 'Use bedtime wind-downs to protect your mornings.',
    route: '/(health)',
    icon: 'bedtime',
  },
];

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function diffInDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default function PresenceHubScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [daysTracked, setDaysTracked] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadHubState = useCallback(() => {
    try {
      const allDaily = getDailyUsageRange(db, '2020-01-01', todayString(), 4000);
      const sorted = [...allDaily].sort((left, right) => left.date.localeCompare(right.date));
      const earliestDate = sorted[0]?.date;
      setDaysTracked(earliestDate ? diffInDays(earliestDate, todayString()) + 1 : 0);
      setErrorMessage(null);

      const currentVisitCount = parseInt(getSetting(db, 'hub_visit_count') ?? '0', 10) || 0;
      setSetting(db, 'hub_visit_count', String(currentVisitCount + 1));
    } catch (error) {
      console.error('Failed to load presence hub', error);
      setErrorMessage('We could not load your discovery progress right now.');
    }
  }, [db]);

  useEffect(() => {
    loadHubState();
  }, [loadHubState]);

  const unlocks = useMemo(
    () => [
      { label: 'Day 3', title: '7-Day Trends', unlocked: daysTracked >= 3 },
      { label: 'Day 7', title: 'Peak Hours Heatmap', unlocked: daysTracked >= 7 },
      { label: 'Day 14', title: 'Monthly Patterns', unlocked: daysTracked >= 14 },
      { label: 'Day 30', title: 'Personalized Tips', unlocked: daysTracked >= 30 },
    ],
    [daysTracked],
  );

  const handleQuickStart = useCallback((tile: QuickStartTile) => {
    try {
      const session = createFocusSession(db, {
        planned_minutes: tile.minutes,
        type: tile.type,
      });

      router.push({
        pathname: '/(presence)/session-active',
        params: {
          sessionId: session.id,
          plannedMinutes: String(tile.minutes),
        },
      } as never);
    } catch (error) {
      console.error('Failed to create focus session', error);
      Alert.alert('Could not start session', 'Try again in a moment.');
    }
  }, [db, router]);

  const handleComingSoon = (title: string) => {
    Alert.alert('Coming Soon', `${title} will land in a later MyPresence phase.`);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <MaterialSymbol name="arrow_back" size={22} color={PR_TEXT} />
          </Pressable>
          <Text style={styles.topBarTitle}>Discover</Text>
          <Pressable style={styles.iconButton} onPress={() => router.push('/(presence)/settings' as never)}>
            <MaterialSymbol name="settings" size={20} color={PR_TEXT} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Discover</Text>
          <Text style={styles.heroTitle}>Build Your Practice</Text>
          <Text style={styles.heroCopy}>
            Quick starts, challenges, and unlocks that turn screen-time awareness into a repeatable ritual.
          </Text>
        </View>

        {errorMessage ? (
          <GlassPanel padding={18} style={styles.errorCard}>
            <Text style={styles.errorTitle}>Discovery progress unavailable</Text>
            <Text style={styles.errorCopy}>{errorMessage}</Text>
          </GlassPanel>
        ) : null}

        <View style={styles.sectionStack}>
          <SectionHeader title="Quick Start" accent={PR_ACCENT_LIGHT} />
          <View style={styles.quickGrid}>
            {QUICK_STARTS.map((tile) => (
              <GlassPanel
                key={tile.title}
                padding={18}
                onPress={() => handleQuickStart(tile)}
                style={styles.quickTile}
              >
                <View style={styles.quickTileHeader}>
                  <View style={styles.quickTileIcon}>
                    <MaterialSymbol name={tile.icon} size={28} color={PR_ACCENT_LIGHT} filled />
                  </View>
                  {tile.premium ? (
                    <View style={styles.premiumPill}>
                      <Text style={styles.premiumText}>Pro</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.quickTileTitle}>{tile.title}</Text>
                <Text style={styles.quickTileSubtitle}>{tile.subtitle}</Text>
              </GlassPanel>
            ))}
          </View>
        </View>

        <GlassPanel padding={18} style={styles.unlockCard}>
          <SectionHeader
            title="Unlock Insights"
            accent={PR_ACCENT_LIGHT}
            action={<Text style={styles.unlockBadge}>{`${daysTracked} days tracked`}</Text>}
          />
          <View style={styles.unlockStack}>
            {unlocks.map((unlock) => (
              <View key={unlock.title} style={styles.unlockRow}>
                <View style={styles.unlockMeta}>
                  <Text style={styles.unlockLabel}>{unlock.label}</Text>
                  <Text style={styles.unlockTitle}>{unlock.title}</Text>
                </View>
                <View style={[styles.unlockStatePill, unlock.unlocked && styles.unlockStatePillActive]}>
                  <Text style={[styles.unlockStateText, unlock.unlocked && styles.unlockStateTextActive]}>
                    {unlock.unlocked ? 'Unlocked' : 'Locked'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </GlassPanel>

        <View style={styles.sectionStack}>
          <SectionHeader title="Challenges" accent={PR_ACCENT_LIGHT} />
          <GlassPanel padding={18} style={styles.placeholderCard}>
            <Text style={styles.placeholderTitle}>Challenge system coming soon</Text>
            <Text style={styles.placeholderCopy}>
              Streak-based community challenges will live on a future `pr_challenges` table. For now, preview the themes below and use Quick Start tiles to simulate them.
            </Text>
            <View style={styles.teaserRow}>
              {['7-Day Detox', 'No Social Sunday', 'Weekend Warrior'].map((label) => (
                <View key={label} style={styles.teaserCard}>
                  <MaterialSymbol name="local_fire_department" size={18} color={PR_ACCENT_LIGHT} />
                  <Text style={styles.teaserText}>{label}</Text>
                </View>
              ))}
            </View>
          </GlassPanel>
        </View>

        <View style={styles.sectionStack}>
          <SectionHeader title="Learn" accent={PR_ACCENT_LIGHT} />
          <View style={styles.learnStack}>
            {EDUCATION_CARDS.map((card) => (
              <GlassPanel
                key={card.title}
                padding={18}
                onPress={() => handleComingSoon(card.title)}
                style={styles.learnCard}
              >
                <View style={styles.learnIcon}>
                  <MaterialSymbol name={card.icon} size={20} color={PR_ACCENT_LIGHT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.learnTitle}>{card.title}</Text>
                  <Text style={styles.learnSubtitle}>{card.subtitle}</Text>
                </View>
              </GlassPanel>
            ))}
          </View>
        </View>

        <View style={styles.sectionStack}>
          <SectionHeader title="Cross-Module Bridges" accent={PR_ACCENT_LIGHT} />
          <View style={styles.bridgeStack}>
            {BRIDGES.map((bridge) => (
              <GlassPanel
                key={bridge.title}
                padding={18}
                onPress={() => router.push(bridge.route as never)}
                style={styles.bridgeCard}
              >
                <View style={styles.bridgeIcon}>
                  <MaterialSymbol name={bridge.icon} size={22} color={PR_ACCENT_LIGHT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bridgeTitle}>{bridge.title}</Text>
                  <Text style={styles.bridgeCopy}>{bridge.subtitle}</Text>
                </View>
                <MaterialSymbol name="explore" size={18} color={PR_TEXT_TERTIARY} />
              </GlassPanel>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PR_SURFACES.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  hero: {
    gap: 8,
  },
  eyebrow: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
  heroTitle: {
    fontFamily: PR_FONTS.extraBold,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.1,
    color: PR_TEXT,
    ...PR_CYAN_GLOW_STYLE,
  },
  heroCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    maxWidth: 320,
  },
  errorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  errorTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
    marginBottom: 6,
  },
  errorCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  sectionStack: {
    gap: 12,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickTile: {
    width: '48%',
    minHeight: 152,
    justifyContent: 'space-between',
  },
  quickTileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  quickTileIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
  },
  premiumPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 145, 178, 0.18)',
  },
  premiumText: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_ACCENT_LIGHT,
  },
  quickTileTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
    marginTop: 18,
  },
  quickTileSubtitle: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
    marginTop: 6,
  },
  unlockCard: {
    gap: 14,
  },
  unlockBadge: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_ACCENT_LIGHT,
  },
  unlockStack: {
    gap: 10,
  },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  unlockMeta: {
    flex: 1,
    gap: 2,
  },
  unlockLabel: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_TERTIARY,
  },
  unlockTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  unlockStatePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  unlockStatePillActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.16)',
  },
  unlockStateText: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_TERTIARY,
  },
  unlockStateTextActive: {
    color: PR_ACCENT_LIGHT,
  },
  placeholderCard: {
    gap: 12,
  },
  placeholderTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  placeholderCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  teaserRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  teaserCard: {
    minWidth: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 8,
  },
  teaserText: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT,
  },
  learnStack: {
    gap: 10,
  },
  learnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  learnIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.10)',
  },
  learnTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  learnSubtitle: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
    marginTop: 4,
  },
  bridgeStack: {
    gap: 10,
  },
  bridgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bridgeIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.10)',
  },
  bridgeTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  bridgeCopy: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
    marginTop: 4,
  },
});
