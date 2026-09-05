import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  type BestChefResult,
  type Post,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from '@mylife/bestchef';
import { GlassCard } from '@mylife/bestchef/ui';
import { EmptyState, ErrorState, LoadingState, Text, colors } from '@mylife/ui';

// ── Stubs (cloud functions not yet implemented) ─────────────────────

async function getPostsByAuthor(
  _authorId: string,
): Promise<BestChefResult<Post[]>> {
  return { ok: true, data: [] };
}

async function getPublicPostsByAuthor(
  _authorId: string,
): Promise<BestChefResult<Post[]>> {
  return { ok: true, data: [] };
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatPostDate(date: Date): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function getTypeBadgeColor(postType: string): string {
  switch (postType) {
    case 'exclusive_recipe':
      return RECIPES_ACCENT;
    case 'announcement':
      return '#FFB877';
    default:
      return RECIPES_SECONDARY;
  }
}

function getTypeBadgeLabel(postType: string): string {
  switch (postType) {
    case 'exclusive_recipe':
      return 'Recipe';
    case 'announcement':
      return 'Announcement';
    default:
      return 'Blog';
  }
}

function truncateBody(body: string, maxLen: number): string {
  if (body.length <= maxLen) return body;
  return body.slice(0, maxLen).trimEnd() + '...';
}

// ── Screen ──────────────────────────────────────────────────────────

export default function CreatorPostsScreen() {
  const { authorId, isOwner } = useLocalSearchParams<{
    authorId: string;
    isOwner?: string;
  }>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const viewingOwn = isOwner === 'true';

  const load = useCallback(async () => {
    if (!authorId) return;
    setLoading(true);
    setError(null);
    try {
      const result = viewingOwn
        ? await getPostsByAuthor(authorId)
        : await getPublicPostsByAuthor(authorId);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPosts(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [authorId, viewingOwn]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Posts</Text>
          {viewingOwn && (
            <Pressable style={styles.writeButton}>
              <Text style={styles.writeButtonText}>Write a Post</Text>
            </Pressable>
          )}
        </View>

        {/* Posts list */}
        {posts.length === 0 ? (
          <EmptyState
            icon="document-text"
            title="No posts yet"
            message={
              viewingOwn
                ? 'Share recipes, tips, and updates with your subscribers'
                : 'This chef hasn\'t published any posts yet'
            }
          />
        ) : (
          <View style={styles.postList}>
            {posts.map((post) => {
              const isLocked = post.visibility !== 'public';
              const badgeColor = getTypeBadgeColor(post.postType);
              const badgeLabel = getTypeBadgeLabel(post.postType);

              return (
                <GlassCard key={post.id} level={2} style={styles.postCard}>
                  {/* Cover image */}
                  {post.coverImageUrl && (
                    <Image
                      source={{ uri: post.coverImageUrl }}
                      style={styles.coverImage}
                      resizeMode="cover"
                    />
                  )}

                  <View style={styles.postBody}>
                    {/* Type badge + lock row */}
                    <View style={styles.badgeRow}>
                      <View
                        style={[
                          styles.typeBadge,
                          { backgroundColor: `${badgeColor}15` },
                        ]}
                      >
                        <Text style={[styles.typeBadgeText, { color: badgeColor }]}>
                          {badgeLabel}
                        </Text>
                      </View>
                      {isLocked && (
                        <View style={styles.lockBadge}>
                          <Text style={styles.lockIcon}>🔒</Text>
                          <Text style={styles.lockText}>Subscribers</Text>
                        </View>
                      )}
                    </View>

                    {/* Title */}
                    <Text style={styles.postTitle} numberOfLines={2}>
                      {post.title}
                    </Text>

                    {/* Excerpt */}
                    <Text style={styles.postExcerpt} numberOfLines={3}>
                      {truncateBody(post.body, 150)}
                    </Text>

                    {/* Footer */}
                    <View style={styles.postFooter}>
                      <Text style={styles.postDate}>
                        {formatPostDate(post.createdAt)}
                      </Text>
                      <View style={styles.postStats}>
                        <Text style={styles.postStat}>
                          {post.likeCount} likes
                        </Text>
                        <Text style={styles.postStatDot}>·</Text>
                        <Text style={styles.postStat}>
                          {post.commentCount} comments
                        </Text>
                      </View>
                    </View>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitle: {
    ...RECIPES_TYPOGRAPHY.displayLg,
    fontSize: 26,
    lineHeight: 34,
    color: colors.text,
  },
  writeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: RECIPES_ACCENT,
  },
  writeButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: '#0E0E13',
  },

  // Post list
  postList: {
    gap: 16,
  },
  postCard: {
    padding: 0,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: 160,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  postBody: {
    padding: 16,
    gap: 10,
  },

  // Badge row
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typeBadgeText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  lockIcon: {
    fontSize: 10,
  },
  lockText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    color: 'rgba(214, 195, 181, 0.6)',
  },

  // Post content
  postTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
    color: colors.text,
  },
  postExcerpt: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  // Footer
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  postDate: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.5)',
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postStat: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: RECIPES_SECONDARY,
  },
  postStatDot: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.3)',
  },
});
