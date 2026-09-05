import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GitFork } from 'lucide-react-native';
import {
  type BestChefResult,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from '@mylife/bestchef';
import { GlassCard } from '@mylife/bestchef/ui';
import { EmptyState, ErrorState, LoadingState, Text, colors } from '@mylife/ui';

// ── Types ────────────────────────────────────────────────────────────

interface LineageNode {
  snapshotId: string;
  title: string;
  chefName: string;
  chefProfileId: string;
  date: Date;
  forkCount: number;
  isOriginal: boolean;
  isCurrent: boolean;
}

// ── Stub (cloud function not yet implemented) ────────────────────────

async function getRecipeLineage(
  _snapshotId: string,
): Promise<BestChefResult<LineageNode[]>> {
  return { ok: true, data: [] };
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Component ────────────────────────────────────────────────────────

export default function RecipeLineageScreen() {
  const { snapshotId } = useLocalSearchParams<{ snapshotId: string }>();
  const router = useRouter();

  const [nodes, setNodes] = useState<LineageNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!snapshotId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getRecipeLineage(snapshotId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNodes(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lineage');
    } finally {
      setLoading(false);
    }
  }, [snapshotId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState rows={5} />
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

  if (nodes.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="arrow.triangle.branch"
          title="No lineage found"
          message="This recipe has no fork history"
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
          <GitFork size={20} color={RECIPES_ACCENT} strokeWidth={2} />
          <Text style={styles.title}>Recipe Lineage</Text>
        </View>
        <Text style={styles.subtitle}>
          Trace the evolution of this recipe through forks and remixes
        </Text>

        {/* Timeline */}
        <View style={styles.timeline}>
          {nodes.map((node, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === nodes.length - 1;

            return (
              <View key={node.snapshotId} style={styles.timelineRow}>
                {/* Vertical line and dot */}
                <View style={styles.timelineTrack}>
                  {!isFirst && <View style={styles.lineAbove} />}
                  <View
                    style={[
                      styles.dot,
                      node.isOriginal && styles.dotOriginal,
                      node.isCurrent && styles.dotCurrent,
                    ]}
                  >
                    {node.isOriginal && (
                      <View style={styles.dotInner} />
                    )}
                  </View>
                  {!isLast && <View style={styles.lineBelow} />}
                </View>

                {/* Node card */}
                <GlassCard
                  level={node.isCurrent ? 3 : 2}
                  style={[
                    styles.nodeCard,
                    node.isCurrent && styles.nodeCardCurrent,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: '/(recipes)/remix',
                      params: {
                        snapshotId: node.snapshotId,
                        sourceTitle: node.title,
                      },
                    })
                  }
                >
                  {/* Labels */}
                  <View style={styles.nodeLabels}>
                    {node.isOriginal && (
                      <View style={styles.originalBadge}>
                        <Text style={styles.originalBadgeText}>Original</Text>
                      </View>
                    )}
                    {node.isCurrent && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Current</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.nodeTitle}>{node.title}</Text>

                  <View style={styles.nodeMetaRow}>
                    <Text style={styles.nodeChef}>@{node.chefName}</Text>
                    <Text style={styles.nodeDot}>{'\u00B7'}</Text>
                    <Text style={styles.nodeDate}>
                      {formatDate(node.date)}
                    </Text>
                  </View>

                  {node.forkCount > 0 && (
                    <View style={styles.forkCountRow}>
                      <GitFork
                        size={12}
                        color="rgba(214, 195, 181, 0.5)"
                        strokeWidth={1.5}
                      />
                      <Text style={styles.forkCountText}>
                        {node.forkCount} fork{node.forkCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                </GlassCard>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const TRACK_WIDTH = 40;
const DOT_SIZE = 14;
const DOT_SIZE_LG = 20;
const LINE_WIDTH = 2;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 12,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  // Timeline
  timeline: {
    marginTop: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timelineTrack: {
    width: TRACK_WIDTH,
    alignItems: 'center',
  },
  lineAbove: {
    width: LINE_WIDTH,
    flex: 1,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  lineBelow: {
    width: LINE_WIDTH,
    flex: 1,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: RECIPES_SURFACES.focus,
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOriginal: {
    width: DOT_SIZE_LG,
    height: DOT_SIZE_LG,
    borderRadius: DOT_SIZE_LG / 2,
    borderColor: RECIPES_SECONDARY,
    backgroundColor: 'rgba(201, 137, 77, 0.15)',
  },
  dotCurrent: {
    borderColor: RECIPES_ACCENT,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  dotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: RECIPES_SECONDARY,
  },

  // Node card
  nodeCard: {
    flex: 1,
    marginLeft: 8,
    marginBottom: 12,
    gap: 6,
  },
  nodeCardCurrent: {
    borderLeftWidth: 2,
    borderLeftColor: RECIPES_ACCENT,
  },
  nodeLabels: {
    flexDirection: 'row',
    gap: 6,
  },
  originalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(201, 137, 77, 0.12)',
  },
  originalBadgeText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    color: RECIPES_SECONDARY,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  currentBadgeText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    color: RECIPES_ACCENT,
  },
  nodeTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: colors.text,
  },
  nodeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nodeChef: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.6)',
  },
  nodeDot: {
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.3)',
  },
  nodeDate: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.5)',
  },
  forkCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  forkCountText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: 'rgba(214, 195, 181, 0.5)',
  },
});
