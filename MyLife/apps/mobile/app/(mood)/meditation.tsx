import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Text as RNText } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Play, ChevronRight } from 'lucide-react-native';
import {
  getMeditationTemplates,
  getMeditationTemplatesByCategory,
  getMeditationSessions,
  getMeditationSessionCount,
  type MeditationTemplate,
  GlassCard,
  SectionHeader,
  MOOD_TYPOGRAPHY,
  MOOD_ACCENT,
  MOOD_ACCENT_LIGHT,
  MOOD_SURFACES,
} from '@mylife/mood';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

// -- Category definitions --

interface CategoryDef {
  key: string;
  label: string;
}

const CATEGORIES: CategoryDef[] = [
  { key: 'all', label: 'All' },
  { key: 'beginner', label: 'Breathe' },
  { key: 'body_scan', label: 'Calm' },
  { key: 'mindfulness', label: 'Focus' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'visualization', label: 'Visualize' },
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m} MIN`;
}

function formatCategoryLabel(category: string): string {
  const match = CATEGORIES.find((c) => c.key === category);
  return match?.label ?? category.toUpperCase();
}

export default function MeditationScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('all');

  const allTemplates = useMemo(() => getMeditationTemplates(db), [db]);
  const sessionCount = useMemo(() => getMeditationSessionCount(db), [db]);
  const recentSessions = useMemo(() => getMeditationSessions(db, 5), [db]);

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'all') return allTemplates;
    return getMeditationTemplatesByCategory(db, selectedCategory);
  }, [db, allTemplates, selectedCategory]);

  // Pick the first template as "featured"
  const featured = allTemplates.length > 0 ? allTemplates[0] : null;

  // Quick sessions: up to 3 templates (excluding featured)
  const quickSessions = useMemo(() => {
    return filteredTemplates
      .filter((t) => t.id !== featured?.id)
      .slice(0, 3);
  }, [filteredTemplates, featured]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <RNText style={styles.pageTitle}>Meditate</RNText>
            <RNText style={styles.pageSubtitle}>FIND YOUR STILLNESS</RNText>
          </View>
          <View style={styles.sessionBadge}>
            <RNText style={styles.sessionBadgeText}>
              {sessionCount} SESSION{sessionCount !== 1 ? 'S' : ''} THIS MONTH
            </RNText>
          </View>
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => setSelectedCategory(cat.key)}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
              >
                <RNText
                  style={[
                    styles.categoryChipText,
                    active && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.label}
                </RNText>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Daily Featured Card */}
        {featured && (
          <GlassCard
            level={2}
            style={styles.featuredCard}
            onPress={() =>
              router.push(`/(mood)/meditation-session?templateId=${featured.id}`)
            }
          >
            {/* Gradient overlay simulation */}
            <View style={styles.featuredGradient}>
              <View style={styles.featuredContent}>
                <RNText style={styles.featuredLabel}>DAILY FEATURED</RNText>
                <RNText style={styles.featuredTitle}>{featured.name}</RNText>
                <RNText style={styles.featuredDesc} numberOfLines={2}>
                  {featured.description}
                </RNText>
              </View>
              <View style={styles.featuredPlayBtn}>
                <Play size={24} color="#1a1008" fill="#1a1008" strokeWidth={0} />
              </View>
            </View>
          </GlassCard>
        )}

        {/* Quick Sessions */}
        {quickSessions.length > 0 && (
          <>
            <SectionHeader
              title="Quick Sessions"
              action={{ text: 'SEE ALL', onPress: () => setSelectedCategory('all') }}
            />
            <View style={styles.sessionList}>
              {quickSessions.map((template) => (
                <GlassCard key={template.id} level={2} style={styles.sessionCard}>
                  <View style={styles.sessionRow}>
                    {/* Thumbnail circle */}
                    <View style={styles.sessionThumb}>
                      <RNText style={styles.sessionThumbEmoji}>
                        {template.category === 'sleep'
                          ? '\u{1F319}'
                          : template.category === 'body_scan'
                            ? '\u{1F9D8}'
                            : template.category === 'visualization'
                              ? '\u{1F30C}'
                              : template.category === 'mindfulness'
                                ? '\u{1F4A0}'
                                : '\u{1F33F}'}
                      </RNText>
                    </View>
                    <View style={styles.sessionInfo}>
                      <RNText style={styles.sessionName}>{template.name}</RNText>
                      <RNText style={styles.sessionMeta}>
                        {formatDuration(template.durationSeconds)}
                        {'  \u00B7  '}
                        {formatCategoryLabel(template.category)}
                      </RNText>
                    </View>
                    <Pressable
                      onPress={() =>
                        router.push(`/(mood)/meditation-session?templateId=${template.id}`)
                      }
                      hitSlop={12}
                    >
                      <View style={styles.startLink}>
                        <RNText style={styles.startLinkText}>START</RNText>
                        <ChevronRight size={14} color={MOOD_ACCENT} strokeWidth={2.5} />
                      </View>
                    </Pressable>
                  </View>
                </GlassCard>
              ))}
            </View>
          </>
        )}

        {/* All Templates (when filtered or showing all beyond quick sessions) */}
        {filteredTemplates.length > 3 && (
          <>
            <SectionHeader title="All Sessions" />
            <View style={styles.sessionList}>
              {filteredTemplates.slice(3).map((template) => (
                <GlassCard key={template.id} level={2} style={styles.sessionCard}>
                  <View style={styles.sessionRow}>
                    <View style={styles.sessionThumb}>
                      <RNText style={styles.sessionThumbEmoji}>
                        {template.category === 'sleep'
                          ? '\u{1F319}'
                          : template.category === 'body_scan'
                            ? '\u{1F9D8}'
                            : template.category === 'visualization'
                              ? '\u{1F30C}'
                              : template.category === 'mindfulness'
                                ? '\u{1F4A0}'
                                : '\u{1F33F}'}
                      </RNText>
                    </View>
                    <View style={styles.sessionInfo}>
                      <RNText style={styles.sessionName}>{template.name}</RNText>
                      <RNText style={styles.sessionMeta}>
                        {formatDuration(template.durationSeconds)}
                        {'  \u00B7  '}
                        {formatCategoryLabel(template.category)}
                      </RNText>
                    </View>
                    <Pressable
                      onPress={() =>
                        router.push(`/(mood)/meditation-session?templateId=${template.id}`)
                      }
                      hitSlop={12}
                    >
                      <View style={styles.startLink}>
                        <RNText style={styles.startLinkText}>START</RNText>
                        <ChevronRight size={14} color={MOOD_ACCENT} strokeWidth={2.5} />
                      </View>
                    </Pressable>
                  </View>
                </GlassCard>
              ))}
            </View>
          </>
        )}

        {/* Custom Timer Row */}
        <GlassCard level={1} style={styles.customTimerCard}>
          <View style={styles.customTimerRow}>
            <View style={styles.customTimerIconWrap}>
              <Plus size={18} color={MOOD_ACCENT} strokeWidth={2.5} />
            </View>
            <RNText style={styles.customTimerText}>CUSTOM TIMER</RNText>
          </View>
        </GlassCard>

        {/* Empty state */}
        {allTemplates.length === 0 && (
          <GlassCard level={2} style={styles.emptyCard}>
            <RNText style={styles.emptyText}>
              Choose a meditation to begin.
            </RNText>
          </GlassCard>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 12,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  pageTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    color: colors.text,
    lineHeight: 38,
  },
  pageSubtitle: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
  sessionBadge: {
    backgroundColor: MOOD_SURFACES.focus,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  sessionBadgeText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.text,
    lineHeight: 14,
  },

  // Category chips
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: MOOD_SURFACES.lift,
  },
  categoryChipActive: {
    backgroundColor: MOOD_ACCENT,
  },
  categoryChipText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    letterSpacing: 0.05 * 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  categoryChipTextActive: {
    color: '#1a1008',
  },

  // Featured card
  featuredCard: {
    padding: 0,
    overflow: 'hidden',
    minHeight: 180,
  },
  featuredGradient: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 20,
    minHeight: 180,
    backgroundColor: MOOD_SURFACES.focus,
    borderRadius: 16,
  },
  featuredContent: {
    flex: 1,
    gap: 6,
  },
  featuredLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: MOOD_ACCENT,
    lineHeight: 14,
  },
  featuredTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 24,
    color: colors.text,
    lineHeight: 30,
  },
  featuredDesc: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  featuredPlayBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: MOOD_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  // Session list
  sessionList: {
    gap: 8,
  },
  sessionCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sessionThumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionThumbEmoji: {
    fontSize: 22,
  },
  sessionInfo: {
    flex: 1,
    gap: 3,
  },
  sessionName: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  sessionMeta: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  startLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  startLinkText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    letterSpacing: 0.05 * 12,
    color: MOOD_ACCENT,
    lineHeight: 16,
  },

  // Custom timer
  customTimerCard: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  customTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customTimerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customTimerText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    lineHeight: 16,
  },

  // Empty state
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },

  // Bottom spacer
  bottomSpacer: {
    height: 40,
  },
});
