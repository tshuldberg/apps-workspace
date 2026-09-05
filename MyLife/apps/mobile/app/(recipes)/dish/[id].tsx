import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Flag as FlagIcon, ShieldCheck } from 'lucide-react-native';
import {
  type CloudDish,
  type CloudNote,
  type DishAlias,
  type Submission,
  type BestChefResult,
  getDishById,
  getPublicNotes,
  getSubmissionsForDish,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from '@mylife/bestchef';
import { GlassCard, VoteTierSelector } from '@mylife/bestchef/ui';
import { EmptyState, ErrorState, LoadingState, Text, colors } from '@mylife/ui';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Stub for castVote -- cloud function not yet implemented.
 */
async function castVote(
  _submissionId: string,
  _tier: number,
): Promise<BestChefResult<void>> {
  return { ok: true, data: undefined };
}

export default function DishDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [dish, setDish] = useState<CloudDish | null>(null);
  const [aliases, setAliases] = useState<DishAlias[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<'global' | 'my_region'>('global');
  const [communityNotes, setCommunityNotes] = useState<Record<string, CloudNote[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const dishResult = await getDishById(id);
      if (!dishResult.ok) {
        setError(dishResult.error);
        return;
      }
      setDish(dishResult.data.dish);
      setAliases(dishResult.data.aliases);

      const subResult = await getSubmissionsForDish(id);
      if (subResult.ok) {
        setSubmissions(subResult.data);

        // Load community notes for each submission
        const notesMap: Record<string, CloudNote[]> = {};
        await Promise.all(
          subResult.data.map(async (sub) => {
            const notesResult = await getPublicNotes('submission', sub.id);
            if (notesResult.ok && notesResult.data.length > 0) {
              notesMap[sub.id] = notesResult.data;
            }
          }),
        );
        setCommunityNotes(notesMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dish');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleVote = async (submissionId: string, tier: number) => {
    setVotes((prev) => ({ ...prev, [submissionId]: tier }));
    try {
      await castVote(submissionId, tier);
    } catch {
      // Revert on failure
      setVotes((prev) => {
        const next = { ...prev };
        delete next[submissionId];
        return next;
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState rows={6} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ErrorState message={error} onRetry={() => void load()} />
      </View>
    );
  }

  if (!dish) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="fork.knife"
          title="Dish not found"
          message="This dish may have been removed"
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>
              {capitalize(dish.category)}
            </Text>
          </View>
          <Text style={styles.title}>{dish.name}</Text>
          {dish.nativeName != null && (
            <Text style={styles.nativeName}>{dish.nativeName}</Text>
          )}
          {aliases.length > 0 && (
            <Text style={styles.metaText}>
              Also known as: {aliases.map((a) => a.alias).join(', ')}
            </Text>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{dish.cuisine}</Text>
            {dish.region != null && (
              <>
                <Text style={styles.metaDot}>{'\u00B7'}</Text>
                <Text style={styles.metaText}>{dish.region}</Text>
              </>
            )}
          </View>
          {dish.description != null && (
            <Text style={styles.description}>{dish.description}</Text>
          )}
        </View>

        {/* Submit CTA */}
        <Pressable
          style={({ pressed }) => [styles.submitCta, pressed && styles.submitCtaPressed]}
          onPress={() => router.push({ pathname: '/(recipes)/submit', params: { dishId: dish.id, dishName: dish.name } })}
        >
          <Text style={styles.submitCtaText}>Submit your recipe</Text>
          <Text style={styles.submitCtaArrow}>{'>'}</Text>
        </Pressable>

        {/* Region toggle */}
        <View style={styles.regionRow}>
          <Text style={styles.sectionTitle}>Submissions</Text>
          <View style={styles.regionToggle}>
            <Pressable
              style={[
                styles.regionButton,
                regionFilter === 'global' && styles.regionButtonActive,
              ]}
              onPress={() => setRegionFilter('global')}
            >
              <Text
                style={[
                  styles.regionButtonText,
                  regionFilter === 'global' && styles.regionButtonTextActive,
                ]}
              >
                Global
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.regionButton,
                regionFilter === 'my_region' && styles.regionButtonActive,
              ]}
              onPress={() => setRegionFilter('my_region')}
            >
              <Text
                style={[
                  styles.regionButtonText,
                  regionFilter === 'my_region' && styles.regionButtonTextActive,
                ]}
              >
                My Region
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Submissions list */}
        {submissions.length === 0 ? (
          <GlassCard level={2} style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No submissions yet</Text>
            <Text style={styles.emptyMessage}>
              Be the first to submit your recipe for {dish.name}
            </Text>
          </GlassCard>
        ) : (
          <View style={styles.submissionsList}>
            {submissions.map((sub, idx) => {
              const rank = idx + 1;
              const isExpanded = expandedSubmission === sub.id;
              const subNotes = communityNotes[sub.id];
              return (
                <GlassCard key={sub.id} level={2} style={styles.submissionCard}>
                  <Pressable
                    style={styles.submissionHeader}
                    onPress={() =>
                      setExpandedSubmission(isExpanded ? null : sub.id)
                    }
                  >
                    <View style={styles.rankCircle}>
                      <Text style={styles.rankText}>#{rank}</Text>
                    </View>
                    <View style={styles.submissionInfo}>
                      <Text style={styles.submissionTitle}>
                        Recipe #{sub.recipeSnapshotId.slice(0, 8)}
                      </Text>
                      <Text style={styles.submissionChef}>
                        {sub.chefOrigin ?? 'Anonymous Chef'}
                      </Text>
                    </View>

                    {/* Photo with verified badge */}
                    {sub.photoUrl != null && (
                      <View style={styles.photoWrap}>
                        <Image
                          source={{ uri: sub.photoUrl }}
                          style={styles.submissionPhoto}
                          resizeMode="cover"
                        />
                        {sub.photoVerified && (
                          <View style={styles.verifiedBadge}>
                            <ShieldCheck size={10} color="#fff" strokeWidth={2.5} />
                          </View>
                        )}
                      </View>
                    )}

                    <View style={styles.scoreWrap}>
                      <Text style={styles.scoreValue}>
                        {sub.voteScore.toFixed(1)}
                      </Text>
                      <Text style={styles.scoreLabel}>SCORE</Text>
                    </View>
                  </Pressable>

                  <VoteTierSelector
                    selectedTier={votes[sub.id]}
                    onVote={(tier) => void handleVote(sub.id, tier)}
                  />

                  {/* Report button */}
                  <Pressable
                    style={styles.reportButton}
                    onPress={() =>
                      router.push({
                        pathname: '/(recipes)/report-modal',
                        params: { targetType: 'submission', targetId: sub.id },
                      })
                    }
                  >
                    <FlagIcon size={14} color={colors.textTertiary} strokeWidth={1.5} />
                    <Text style={styles.reportButtonText}>Report</Text>
                  </Pressable>

                  {/* Community Notes */}
                  {subNotes != null && subNotes.length > 0 && (
                    <View style={styles.notesSection}>
                      <Text style={styles.notesHeader}>Community Notes</Text>
                      {subNotes.slice(0, 2).map((note) => (
                        <View key={note.id} style={styles.noteCard}>
                          <Text style={styles.noteBody}>{note.body}</Text>
                          <View style={styles.noteFooter}>
                            <Text style={styles.noteHelpful}>
                              {note.helpfulCount} helpful
                            </Text>
                          </View>
                        </View>
                      ))}
                      {subNotes.length > 2 && (
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: '/(recipes)/community-notes',
                              params: { targetType: 'submission', targetId: sub.id },
                            })
                          }
                        >
                          <Text style={styles.viewAllNotes}>
                            View all {subNotes.length} notes
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}

                  {isExpanded && (
                    <View style={styles.expandedSection}>
                      <Text style={styles.expandedLabel}>
                        Tap to view full recipe details in a future update.
                      </Text>
                      {sub.chefLocation != null && (
                        <Text style={styles.expandedMeta}>
                          Location: {sub.chefLocation}
                        </Text>
                      )}
                    </View>
                  )}
                </GlassCard>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 24,
  },

  // Header
  header: {
    gap: 8,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  categoryPillText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: RECIPES_ACCENT,
  },
  title: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 28,
    letterSpacing: -0.5,
    color: colors.text,
  },
  nativeName: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 16,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: 'rgba(214, 195, 181, 0.6)',
  },
  metaDot: {
    fontSize: 13,
    color: 'rgba(214, 195, 181, 0.3)',
  },
  description: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Submit CTA
  submitCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: RECIPES_ACCENT,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  submitCtaPressed: {
    opacity: 0.85,
  },
  submitCtaText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: '#0E0E13',
  },
  submitCtaArrow: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: '#0E0E13',
  },

  // Region toggle
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  regionToggle: {
    flexDirection: 'row',
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 10,
    overflow: 'hidden',
  },
  regionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  regionButtonActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
  },
  regionButtonText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  regionButtonTextActive: {
    color: RECIPES_ACCENT,
  },

  // Submissions
  submissionsList: {
    gap: 12,
  },
  submissionCard: {
    gap: 12,
  },
  submissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: RECIPES_ACCENT,
  },
  submissionInfo: {
    flex: 1,
    gap: 2,
  },
  submissionTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: colors.text,
  },
  submissionChef: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.6)',
  },

  // Photo with verified badge
  photoWrap: {
    position: 'relative',
  },
  submissionPhoto: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: RECIPES_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: RECIPES_SURFACES.lift,
  },

  scoreWrap: {
    alignItems: 'center',
    gap: 2,
  },
  scoreValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 18,
    color: RECIPES_SECONDARY,
  },
  scoreLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 8,
    letterSpacing: 1,
    color: 'rgba(214, 195, 181, 0.5)',
  },

  // Report button
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  reportButtonText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: colors.textTertiary,
  },

  // Community Notes
  notesSection: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 12,
  },
  notesHeader: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  noteCard: {
    backgroundColor: 'rgba(139, 207, 240, 0.06)',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  noteBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  noteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteHelpful: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: 'rgba(214, 195, 181, 0.5)',
  },
  viewAllNotes: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: RECIPES_ACCENT,
    paddingVertical: 4,
  },

  // Empty
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  emptyTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  emptyMessage: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Expanded
  expandedSection: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 12,
  },
  expandedLabel: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  expandedMeta: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.5)',
  },
});
