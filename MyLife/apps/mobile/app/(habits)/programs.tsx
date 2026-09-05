import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BUILT_IN_PROGRAMS,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_FONTS,
  HB_STREAK,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  GlassCard,
  MaterialSymbol,
  getEnrolledPrograms,
  getProgramProgress,
  withAlpha,
} from '@mylife/habits';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  buildProgramCoverUri,
  formatProgramDifficulty,
  formatProgramDuration,
  getProgramDifficultyColor,
} from './programs-ui';

type ProgramTab = 'active' | 'browse' | 'completed';
type DurationFilter = 'all' | 'short' | 'medium' | 'long';
type DifficultyFilter = 'all' | 'beginner' | 'intermediate' | 'advanced';
type FocusFilter = 'all' | 'mind' | 'body' | 'health' | 'learning' | 'social';

export default function ProgramsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<ProgramTab>('active');
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [focusFilter, setFocusFilter] = useState<FocusFilter>('all');

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, []),
  );

  const enrollmentSummaries = useMemo(
    () => getEnrolledPrograms(db),
    [db, refreshKey],
  );

  const progressMap = useMemo(() => {
    const entries = enrollmentSummaries.map((summary) => [
      summary.programId,
      getProgramProgress(db, summary.programId),
    ] as const);
    return new Map(entries);
  }, [db, enrollmentSummaries]);

  const activePrograms = BUILT_IN_PROGRAMS
    .map((program) => ({
      program,
      progress: progressMap.get(program.id),
    }))
    .filter((entry) => entry.progress?.status === 'active');

  const completedPrograms = BUILT_IN_PROGRAMS
    .map((program) => ({
      program,
      progress: progressMap.get(program.id),
    }))
    .filter((entry) => entry.progress?.status === 'completed');

  const browsePrograms = BUILT_IN_PROGRAMS.filter((program) => {
    if (durationFilter === 'short' && program.durationDays > 14) return false;
    if (durationFilter === 'medium' && (program.durationDays < 15 || program.durationDays > 30)) return false;
    if (durationFilter === 'long' && program.durationDays <= 30) return false;
    if (difficultyFilter !== 'all' && program.difficulty !== difficultyFilter) return false;
    if (focusFilter !== 'all' && program.focusArea !== focusFilter) return false;
    return true;
  });

  const featuredProgram = activePrograms[0]?.program ?? BUILT_IN_PROGRAMS[0];
  const featuredProgress = activePrograms[0]?.progress ?? null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <RNText style={styles.eyebrow}>CHALLENGES</RNText>
          <RNText style={styles.title}>Structured Programs</RNText>
          <RNText style={styles.subtitle}>
            Active journeys, guided browse flows, and completed runs all in one mission-control surface.
          </RNText>
        </View>

        <GlassCard level={2} contentStyle={styles.heroCard}>
          <Image
            source={{ uri: buildProgramCoverUri(featuredProgram) }}
            contentFit="cover"
            style={styles.heroImage}
          />
          <LinearGradient
            colors={['rgba(14,14,19,0)', 'rgba(14,14,19,0.95)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.heroGradient}
          />
          <View style={styles.heroContent}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <RNText style={styles.heroBadgeText}>
                  {featuredProgress?.status === 'active' ? 'Ongoing' : 'Featured'}
                </RNText>
              </View>
              <RNText style={styles.heroMeta}>
                {featuredProgress
                  ? `Day ${Math.min(featuredProgress.currentDay, featuredProgram.durationDays)}`
                  : formatProgramDuration(featuredProgram.durationDays)}
              </RNText>
            </View>

            <RNText style={styles.heroTitle}>{featuredProgram.name}</RNText>
            <RNText style={styles.heroBody}>{featuredProgram.description}</RNText>

            <View style={styles.heroProgressTrack}>
              <View
                style={[
                  styles.heroProgressFill,
                  { width: `${featuredProgress?.elapsedPercent ?? 0}%` },
                ]}
              />
            </View>

            <View style={styles.heroFooter}>
              <View style={styles.heroUsers}>
                <MaterialSymbol name="groups" size={16} color={HB_TEXT_SECONDARY} />
                <RNText style={styles.heroUsersText}>
                  {featuredProgram.enrolledCount.toLocaleString()} enrolled
                </RNText>
              </View>

              <Pressable
                onPress={() => router.push({
                  pathname: '/(habits)/program-detail',
                  params: { programId: featuredProgram.id },
                })}
                style={styles.heroAction}
              >
                <RNText style={styles.heroActionText}>
                  {featuredProgress?.status === 'active' ? 'Continue' : 'View details'}
                </RNText>
              </Pressable>
            </View>
          </View>
        </GlassCard>

        <View style={styles.segmentedControl}>
          {([
            ['active', 'Active'],
            ['browse', 'Browse'],
            ['completed', 'Completed'],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setActiveTab(value)}
              style={[
                styles.segment,
                activeTab === value ? styles.segmentActive : null,
              ]}
            >
              <RNText
                style={[
                  styles.segmentText,
                  activeTab === value ? styles.segmentTextActive : null,
                ]}
              >
                {label}
              </RNText>
            </Pressable>
          ))}
        </View>

        {activeTab === 'active' ? (
          <View style={styles.section}>
            {activePrograms.length === 0 ? (
              <EmptyProgramsState
                title="No active programs yet"
                body="Pick a guided challenge to get a daily schedule, built-in pacing, and visible progress."
                actionLabel="Browse programs"
                onAction={() => setActiveTab('browse')}
              />
            ) : (
              activePrograms.map(({ program, progress }) => (
                <GlassCard key={program.id} level={1} contentStyle={styles.activeCard}>
                  <Image
                    source={{ uri: buildProgramCoverUri(program) }}
                    contentFit="cover"
                    style={styles.activeImage}
                  />
                  <View style={styles.activeBody}>
                    <View style={styles.activeHeader}>
                      <View style={styles.activeCopy}>
                        <RNText style={styles.activeTitle}>{program.name}</RNText>
                        <RNText style={styles.activeMeta}>
                          Day {Math.min(progress!.currentDay, program.durationDays)} of {program.durationDays}
                        </RNText>
                      </View>
                      <RNText style={styles.activeRate}>
                        {progress?.completionRate ?? 0}%
                      </RNText>
                    </View>

                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${progress?.elapsedPercent ?? 0}%` },
                        ]}
                      />
                    </View>

                    <View style={styles.activeFooter}>
                      <View style={styles.activeChips}>
                        <InfoChip label={formatProgramDifficulty(program.difficulty)} />
                        <InfoChip label={`${progress?.completedDays ?? 0} days done`} />
                      </View>
                      <Pressable
                        onPress={() => router.push({
                          pathname: '/(habits)/program-detail',
                          params: { programId: program.id },
                        })}
                        style={styles.continueButton}
                      >
                        <RNText style={styles.continueButtonText}>Continue</RNText>
                      </Pressable>
                    </View>
                  </View>
                </GlassCard>
              ))
            )}
          </View>
        ) : null}

        {activeTab === 'browse' ? (
          <View style={styles.section}>
            <FilterRow
              label="Duration"
              value={durationFilter}
              options={[
                ['all', 'All'],
                ['short', 'Short'],
                ['medium', 'Medium'],
                ['long', 'Long'],
              ]}
              onChange={(value) => setDurationFilter(value as DurationFilter)}
            />
            <FilterRow
              label="Difficulty"
              value={difficultyFilter}
              options={[
                ['all', 'All'],
                ['beginner', 'Beginner'],
                ['intermediate', 'Intermediate'],
                ['advanced', 'Advanced'],
              ]}
              onChange={(value) => setDifficultyFilter(value as DifficultyFilter)}
            />
            <FilterRow
              label="Focus area"
              value={focusFilter}
              options={[
                ['all', 'All'],
                ['mind', 'Mind'],
                ['body', 'Body'],
                ['health', 'Health'],
                ['learning', 'Learning'],
                ['social', 'Social'],
              ]}
              onChange={(value) => setFocusFilter(value as FocusFilter)}
            />

            <View style={styles.browseGrid}>
              {browsePrograms.map((program) => {
                const progress = progressMap.get(program.id);

                return (
                  <Pressable
                    key={program.id}
                    onPress={() => router.push({
                      pathname: '/(habits)/program-detail',
                      params: { programId: program.id },
                    })}
                  >
                    <GlassCard level={1} contentStyle={styles.browseCard}>
                      <Image
                        source={{ uri: buildProgramCoverUri(program) }}
                        contentFit="cover"
                        style={styles.browseImage}
                      />
                      <RNText style={styles.browseTitle}>{program.name}</RNText>
                      <RNText style={styles.browseBody} numberOfLines={3}>
                        {program.description}
                      </RNText>
                      <View style={styles.browseMetaRow}>
                        <RNText style={styles.browseMetaText}>
                          {formatProgramDuration(program.durationDays)}
                        </RNText>
                        <RNText
                          style={[
                            styles.browseMetaText,
                            { color: getProgramDifficultyColor(program.difficulty) },
                          ]}
                        >
                          {formatProgramDifficulty(program.difficulty)}
                        </RNText>
                      </View>
                      <View style={styles.browseMetaRow}>
                        <RNText style={styles.browseFootnote}>
                          {program.enrolledCount.toLocaleString()} enrolled
                        </RNText>
                        <RNText style={styles.browseFootnote}>
                          {progress?.status === 'active' ? 'Continue' : 'Start'}
                        </RNText>
                      </View>
                    </GlassCard>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {activeTab === 'completed' ? (
          <View style={styles.section}>
            {completedPrograms.length === 0 ? (
              <EmptyProgramsState
                title="No completed runs yet"
                body="Completed programs will land here with their finishing badge and progress snapshot."
                actionLabel="See active programs"
                onAction={() => setActiveTab('active')}
              />
            ) : (
              completedPrograms.map(({ program, progress }) => (
                <GlassCard key={program.id} level={1} contentStyle={styles.completedCard}>
                  <View style={styles.completedBadge}>
                    <MaterialSymbol name="military_tech" size={18} color={HB_STREAK.fire} />
                    <RNText style={styles.completedBadgeText}>Completed</RNText>
                  </View>
                  <RNText style={styles.completedTitle}>{program.name}</RNText>
                  <RNText style={styles.completedBody}>
                    Finished {progress?.completedDays ?? program.durationDays} tracked days across {formatProgramDuration(program.durationDays)}.
                  </RNText>
                  <View style={styles.completedFooter}>
                    <InfoChip label={formatProgramDifficulty(program.difficulty)} />
                    <Pressable
                      onPress={() => router.push({
                        pathname: '/(habits)/program-detail',
                        params: { programId: program.id },
                      })}
                    >
                      <RNText style={styles.completedLink}>View recap</RNText>
                    </Pressable>
                  </View>
                </GlassCard>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function InfoChip({ label }: { label: string }) {
  return (
    <View style={styles.infoChip}>
      <RNText style={styles.infoChipText}>{label}</RNText>
    </View>
  );
}

function EmptyProgramsState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <GlassCard level={1} contentStyle={styles.emptyStateCard}>
      <MaterialSymbol name="psychology" size={24} color={HB_ACCENT_LIGHT} />
      <RNText style={styles.emptyStateTitle}>{title}</RNText>
      <RNText style={styles.emptyStateBody}>{body}</RNText>
      <Pressable onPress={onAction} style={styles.emptyStateButton}>
        <RNText style={styles.emptyStateButtonText}>{actionLabel}</RNText>
      </Pressable>
    </GlassCard>
  );
}

function FilterRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.filterRow}>
      <RNText style={styles.filterLabel}>{label}</RNText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
        {options.map(([optionValue, optionLabel]) => (
          <Pressable
            key={optionValue}
            onPress={() => onChange(optionValue)}
            style={[
              styles.filterChip,
              value === optionValue ? styles.filterChipActive : null,
            ]}
          >
            <RNText
              style={[
                styles.filterChipText,
                value === optionValue ? styles.filterChipTextActive : null,
              ]}
            >
              {optionLabel}
            </RNText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 140,
    gap: 18,
  },
  header: {
    gap: 8,
  },
  eyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  title: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
  },
  subtitle: {
    fontFamily: HB_FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: HB_TEXT_SECONDARY,
  },
  heroCard: {
    padding: 0,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 240,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    gap: 12,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_ACCENT, 0.28),
  },
  heroBadgeText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 11,
    color: HB_TEXT,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroMeta: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    color: HB_TEXT_SECONDARY,
  },
  heroTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 28,
    lineHeight: 34,
    color: HB_TEXT,
  },
  heroBody: {
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: HB_TEXT_SECONDARY,
    maxWidth: '88%',
  },
  heroProgressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: withAlpha('#FFFFFF', 0.14),
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: HB_ACCENT_LIGHT,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  heroUsers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroUsersText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    color: HB_TEXT_SECONDARY,
  },
  heroAction: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_SURFACES.base, 0.68),
  },
  heroActionText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 13,
    color: HB_TEXT,
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_SURFACES.high, 0.7),
  },
  segment: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: withAlpha(HB_ACCENT, 0.26),
  },
  segmentText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 13,
    color: HB_TEXT_TERTIARY,
  },
  segmentTextActive: {
    color: HB_TEXT,
  },
  section: {
    gap: 14,
  },
  activeCard: {
    padding: 0,
    overflow: 'hidden',
  },
  activeImage: {
    width: '100%',
    height: 148,
  },
  activeBody: {
    padding: 16,
    gap: 12,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  activeCopy: {
    flex: 1,
    gap: 4,
  },
  activeTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  activeMeta: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    color: HB_TEXT_SECONDARY,
  },
  activeRate: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 22,
    lineHeight: 26,
    color: HB_ACCENT_LIGHT,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_SURFACES.highest, 0.86),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: HB_ACCENT_LIGHT,
  },
  activeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  activeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  continueButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_ACCENT, 0.2),
  },
  continueButtonText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 13,
    color: HB_TEXT,
  },
  infoChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_SURFACES.high, 0.82),
  },
  infoChipText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    color: HB_TEXT,
  },
  filterRow: {
    gap: 8,
  },
  filterLabel: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 13,
    color: HB_TEXT,
  },
  filterChips: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_SURFACES.high, 0.78),
  },
  filterChipActive: {
    backgroundColor: withAlpha(HB_ACCENT, 0.3),
  },
  filterChipText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    color: HB_TEXT_TERTIARY,
  },
  filterChipTextActive: {
    color: HB_TEXT,
  },
  browseGrid: {
    gap: 12,
  },
  browseCard: {
    gap: 12,
  },
  browseImage: {
    width: '100%',
    height: 140,
    borderRadius: 18,
  },
  browseTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  browseBody: {
    fontFamily: HB_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: HB_TEXT_SECONDARY,
  },
  browseMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  browseMetaText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 12,
    color: HB_TEXT,
  },
  browseFootnote: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    color: HB_TEXT_TERTIARY,
  },
  completedCard: {
    gap: 10,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedBadgeText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 12,
    color: HB_STREAK.fire,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  completedTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  completedBody: {
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: HB_TEXT_SECONDARY,
  },
  completedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  completedLink: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 13,
    color: HB_ACCENT_LIGHT,
  },
  emptyStateCard: {
    gap: 10,
    alignItems: 'flex-start',
  },
  emptyStateTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  emptyStateBody: {
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: HB_TEXT_SECONDARY,
  },
  emptyStateButton: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_ACCENT, 0.22),
  },
  emptyStateButtonText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 13,
    color: HB_TEXT,
  },
});
