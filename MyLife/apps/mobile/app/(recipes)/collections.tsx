import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Plus,
  Share2,
  Sparkles,
  X,
} from 'lucide-react-native';
import {
  createCollection,
  deleteCollection,
  getCollections,
  JAKARTA_FONTS,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
} from '@mylife/bestchef';
import type { Collection } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const ACCENT = RECIPES_SECONDARY; // warm gold (#C9894D)
const ACCENT_LIGHT = '#FFB877';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const TEXT_MUTED = 'rgba(214, 195, 181, 0.6)';
const DIVIDER = 'rgba(159, 142, 129, 0.2)';

interface CollectionStats {
  recipeCount: number;
  avgTimeMins: number | null;
  thumbnails: string[];
}

interface EnrichedCollection extends Collection {
  stats: CollectionStats;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function formatAvgTime(mins: number | null): string {
  if (mins == null || mins <= 0) return '--';
  if (mins < 60) return `${Math.round(mins)}m`;
  const hours = mins / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

export default function CollectionsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [collections, setCollections] = useState<EnrichedCollection[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const enrichCollection = useCallback(
    (col: Collection): EnrichedCollection => {
      const recipeRows = db.query<{
        id: string;
        image_uri: string | null;
        total_time_mins: number | null;
        cook_time_mins: number | null;
        prep_time_mins: number | null;
      }>(
        `SELECT r.id, r.image_uri, r.total_time_mins, r.cook_time_mins, r.prep_time_mins
         FROM rc_recipes r
         INNER JOIN rc_recipe_collections rc ON rc.recipe_id = r.id
         WHERE rc.collection_id = ?
         ORDER BY rc.sort_order ASC, r.created_at DESC`,
        [col.id],
      );

      const recipeCount = recipeRows.length;
      const thumbnails = recipeRows
        .map((r) => r.image_uri)
        .filter((u): u is string => u != null && u.length > 0)
        .slice(0, 4);

      let totalMins = 0;
      let timedCount = 0;
      for (const r of recipeRows) {
        const t =
          r.total_time_mins ??
          (r.cook_time_mins != null || r.prep_time_mins != null
            ? (r.cook_time_mins ?? 0) + (r.prep_time_mins ?? 0)
            : null);
        if (t != null && t > 0) {
          totalMins += t;
          timedCount += 1;
        }
      }
      const avgTimeMins = timedCount > 0 ? Math.round(totalMins / timedCount) : null;

      return {
        ...col,
        stats: { recipeCount, avgTimeMins, thumbnails },
      };
    },
    [db],
  );

  const load = useCallback(() => {
    const raw = getCollections(db);
    setCollections(raw.map(enrichCollection));
  }, [db, enrichCollection]);

  useEffect(() => {
    load();
  }, [load]);

  const featured = useMemo(() => {
    if (collections.length === 0) return null;
    return [...collections].sort((a, b) => {
      const at = new Date(a.updated_at).getTime();
      const bt = new Date(b.updated_at).getTime();
      return bt - at;
    })[0] ?? null;
  }, [collections]);

  const handleCreate = () => {
    if (!name.trim()) return;
    createCollection(db, uuid(), {
      name: name.trim(),
      description: description.trim() || undefined,
    });
    setName('');
    setDescription('');
    setShowForm(false);
    load();
  };

  const handleDelete = (id: string, colName: string) => {
    Alert.alert(
      'Delete Collection',
      `Delete "${colName}"? Recipes will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteCollection(db, id);
            load();
          },
        },
      ],
    );
  };

  const handleOpenCollection = (id: string) => {
    router.push(`/(recipes)/collections?collectionId=${id}` as never);
  };

  const handleCookingMode = () => {
    if (featured == null) return;
    router.push(`/(recipes)/cooking-mode?collectionId=${featured.id}` as never);
  };

  const handleShareFeatured = async () => {
    if (featured == null) return;
    try {
      await Share.share({
        message: `Check out my "${featured.name}" recipe collection on BestChef`,
        title: featured.name,
      });
    } catch {
      // user cancelled or share unavailable; no-op
    }
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={collections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.titleBlock}>
              <View style={styles.titleRow}>
                <Sparkles size={14} color={ACCENT_LIGHT} />
                <Text style={styles.eyebrow}>Featured Collection</Text>
                <View style={styles.eyebrowDash} />
              </View>
              {featured != null ? (
                <FeaturedHero
                  collection={featured}
                  onCookingMode={handleCookingMode}
                  onShare={handleShareFeatured}
                  onOpen={() => handleOpenCollection(featured.id)}
                />
              ) : (
                <View style={styles.featuredEmpty}>
                  <Text style={styles.featuredEmptyTitle}>No collections yet</Text>
                  <Text style={styles.featuredEmptyBody}>
                    Create your first collection to organize favorite recipes by theme, season, or
                    occasion.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.controlsRow}>
              <Text style={styles.sectionHeading}>Your Collections</Text>
              <Pressable
                style={styles.newButton}
                onPress={() => setShowForm(true)}
                accessibilityRole="button"
                accessibilityLabel="Create a new collection"
              >
                <Plus size={16} color={ACCENT_LIGHT} />
                <Text style={styles.newButtonLabel}>New Collection</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <CollectionCard
            collection={item}
            onPress={() => handleOpenCollection(item.id)}
            onLongPress={() => handleDelete(item.id, item.name)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 20 }} />}
        ListEmptyComponent={
          collections.length === 0 ? null : (
            <Text style={styles.emptyText}>No collections yet.</Text>
          )
        }
      />

      <Modal
        visible={showForm}
        animationType="fade"
        transparent
        onRequestClose={() => setShowForm(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowForm(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create a Collection</Text>
              <Pressable
                onPress={() => setShowForm(false)}
                hitSlop={12}
                accessibilityLabel="Close create form"
              >
                <X size={20} color={TEXT_SECONDARY} />
              </Pressable>
            </View>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Quick Weeknight Meals"
              placeholderTextColor={TEXT_MUTED}
              autoFocus
            />
            <Text style={styles.inputLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="High-flavor dinners under 30 minutes"
              placeholderTextColor={TEXT_MUTED}
              multiline
              numberOfLines={3}
            />
            <Pressable
              style={[
                styles.createSubmitBtn,
                !name.trim() && styles.createSubmitBtnDisabled,
              ]}
              onPress={handleCreate}
              disabled={!name.trim()}
            >
              <Text style={styles.createSubmitLabel}>Create Collection</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

interface FeaturedHeroProps {
  collection: EnrichedCollection;
  onCookingMode: () => void;
  onShare: () => void;
  onOpen: () => void;
}

function FeaturedHero({ collection, onCookingMode, onShare, onOpen }: FeaturedHeroProps) {
  const heroImage = collection.stats.thumbnails[0] ?? null;
  const description =
    collection.description?.trim() ||
    'A curated set of recipes from your kitchen library. Tap below to start cooking.';

  return (
    <Pressable onPress={onOpen} style={styles.heroCard}>
      {heroImage != null ? (
        <Image source={{ uri: heroImage }} style={styles.heroBg} resizeMode="cover" />
      ) : (
        <View style={[styles.heroBg, styles.heroBgFallback]} />
      )}
      <View style={styles.heroGradient} />
      <View style={styles.heroContent}>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {collection.name}
        </Text>
        <Text style={styles.heroDescription} numberOfLines={3}>
          {description}
        </Text>

        <View style={styles.heroActions}>
          <Pressable
            style={styles.cookingModeBtn}
            onPress={onCookingMode}
            accessibilityRole="button"
            accessibilityLabel="Start cooking mode"
          >
            <View style={styles.playIcon}>
              <View style={styles.playTriangle} />
            </View>
            <Text style={styles.cookingModeLabel}>Cooking Mode</Text>
          </Pressable>
          <Pressable
            style={styles.shareBtn}
            onPress={onShare}
            accessibilityRole="button"
            accessibilityLabel="Share collection"
            hitSlop={6}
          >
            <Share2 size={18} color={TEXT_PRIMARY} />
          </Pressable>
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Recipes</Text>
            <Text style={[styles.heroStatValue, styles.heroStatAccent]}>
              {collection.stats.recipeCount}
            </Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Updated</Text>
            <Text style={styles.heroStatValue}>{formatRelative(collection.updated_at)}</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Avg Time</Text>
            <Text style={styles.heroStatValue}>{formatAvgTime(collection.stats.avgTimeMins)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

interface CollectionCardProps {
  collection: EnrichedCollection;
  onPress: () => void;
  onLongPress: () => void;
}

function CollectionCard({ collection, onPress, onLongPress }: CollectionCardProps) {
  const { thumbnails, recipeCount } = collection.stats;
  const slots: (string | null)[] = [
    thumbnails[0] ?? null,
    thumbnails[1] ?? null,
    thumbnails[2] ?? null,
    thumbnails[3] ?? null,
  ];
  const overflow = recipeCount > 4 ? recipeCount - 3 : 0;

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.cardOuter}>
      <View style={styles.thumbGrid}>
        {slots.map((uri, idx) => {
          // Last cell shows "+N more" overflow if applicable
          if (idx === 3 && overflow > 0) {
            return (
              <View key={idx} style={[styles.thumbCell, styles.thumbOverflow]}>
                <Text style={styles.thumbOverflowLabel}>+{overflow}</Text>
              </View>
            );
          }
          if (uri != null) {
            return (
              <Image
                key={idx}
                source={{ uri }}
                style={styles.thumbCell}
                resizeMode="cover"
              />
            );
          }
          return <View key={idx} style={[styles.thumbCell, styles.thumbEmpty]} />;
        })}
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.cardFooterText}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {collection.name}
          </Text>
          <Text style={styles.cardMeta}>
            {recipeCount} {recipeCount === 1 ? 'Recipe' : 'Recipes'} • Updated{' '}
            {formatRelative(collection.updated_at)}
          </Text>
        </View>
        <ArrowRight size={18} color={TEXT_MUTED} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 64,
  },

  // Featured eyebrow
  titleBlock: {
    marginBottom: 28,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  eyebrow: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 2,
    color: ACCENT_LIGHT,
    textTransform: 'uppercase',
  },
  eyebrowDash: {
    height: 1,
    width: 32,
    backgroundColor: 'rgba(255, 184, 119, 0.3)',
  },

  // Featured hero
  heroCard: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: RECIPES_SURFACES.lift,
    minHeight: 360,
    position: 'relative',
  },
  heroBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  heroBgFallback: {
    backgroundColor: RECIPES_SURFACES.focus,
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(14, 14, 19, 0.74)',
  },
  heroContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'flex-end',
    minHeight: 360,
  },
  heroTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  heroDescription: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: TEXT_SECONDARY,
    marginBottom: 24,
    maxWidth: 320,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
  },
  cookingModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: ACCENT_LIGHT,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  cookingModeLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: '#2E1600',
  },
  playIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 11,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#2E1600',
    marginLeft: 2,
  },
  shareBtn: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroStat: {
    flexShrink: 1,
  },
  heroStatLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: 'rgba(214, 195, 181, 0.6)',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroStatValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    color: TEXT_PRIMARY,
  },
  heroStatAccent: {
    color: ACCENT_LIGHT,
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: DIVIDER,
  },

  // Empty featured fallback
  featuredEmpty: {
    borderRadius: 24,
    backgroundColor: RECIPES_SURFACES.lift,
    padding: 32,
    minHeight: 200,
    justifyContent: 'center',
  },
  featuredEmptyTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 24,
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  featuredEmptyBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_SECONDARY,
  },

  // Section heading + new button
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionHeading: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: TEXT_PRIMARY,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 184, 119, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  newButtonLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: ACCENT_LIGHT,
  },

  // Collection card
  cardOuter: {
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  thumbGrid: {
    aspectRatio: 16 / 9,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: RECIPES_SURFACES.lift,
  },
  thumbCell: {
    width: '50%',
    height: '50%',
  },
  thumbEmpty: {
    backgroundColor: RECIPES_SURFACES.focus,
  },
  thumbOverflow: {
    backgroundColor: RECIPES_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbOverflowLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    color: ACCENT_LIGHT,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 14,
  },
  cardFooterText: {
    flex: 1,
    paddingRight: 12,
  },
  cardTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  cardMeta: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  emptyText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 32,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalSheet: {
    backgroundColor: RECIPES_SURFACES.focus,
    borderRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 22,
    color: TEXT_PRIMARY,
    letterSpacing: -0.4,
  },
  inputLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: TEXT_MUTED,
    marginBottom: 8,
  },
  input: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: TEXT_PRIMARY,
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  createSubmitBtn: {
    backgroundColor: ACCENT_LIGHT,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  createSubmitBtnDisabled: {
    opacity: 0.4,
  },
  createSubmitLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: '#2E1600',
  },
});
