import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type TextProps,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  createShoppingList,
  deleteShoppingList,
  getShoppingListItems,
  getShoppingLists,
  getShoppingListSummary,
  updateShoppingList,
  RECIPES_ACCENT,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
  type ShoppingList,
  type ShoppingListItemRow,
  type ShoppingListSummary,
} from '@mylife/bestchef';
import { GlassCard, GradientButton } from '@mylife/bestchef/ui';
import { ErrorState, LoadingState } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

function Text(props: TextProps) {
  return (
    <RNText
      {...props}
      style={[{ fontFamily: RECIPES_TYPOGRAPHY.bodyMd.fontFamily }, props.style]}
    />
  );
}

type ListView = {
  list: ShoppingList;
  summary: ShoppingListSummary | null;
  previewItems: ShoppingListItemRow[];
};

type Tab = 'active' | 'archived';

const PREVIEW_CHIP_COUNT = 3;

function formatRelative(updated: string): string {
  const now = Date.now();
  const then = new Date(updated.replace(' ', 'T') + 'Z').getTime();
  if (Number.isNaN(then)) return updated;
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

export default function ShoppingListsScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('active');
  const [activeLists, setActiveLists] = useState<ListView[]>([]);
  const [archivedLists, setArchivedLists] = useState<ListView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const buildView = useCallback(
    (lists: ShoppingList[]): ListView[] =>
      lists.map((list) => ({
        list,
        summary: getShoppingListSummary(db, list.id),
        previewItems: getShoppingListItems(db, list.id).slice(0, PREVIEW_CHIP_COUNT),
      })),
    [db],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      const all = getShoppingLists(db, false);
      const active = all.filter((list) => list.is_active === 1);
      const archived = all.filter((list) => list.is_active === 0);
      setActiveLists(buildView(active));
      setArchivedLists(buildView(archived));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shopping lists');
    } finally {
      setLoading(false);
    }
  }, [db, buildView]);

  useEffect(() => {
    load();
  }, [load]);

  const lists = tab === 'active' ? activeLists : archivedLists;

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      Alert.alert('Missing Name', 'Enter a name for your new list.');
      return;
    }
    const id = uuid();
    createShoppingList(db, id, trimmed);
    setNewName('');
    setShowCreate(false);
    load();
    router.push({ pathname: '/(recipes)/shopping-list', params: { listId: id } });
  };

  const handleOpen = (id: string) => {
    router.push({ pathname: '/(recipes)/shopping-list', params: { listId: id } });
  };

  const handleArchive = (item: ListView) => {
    Alert.alert('Archive List', `Move "${item.list.name}" to history?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: () => {
          updateShoppingList(db, item.list.id, { is_active: 0 });
          load();
        },
      },
    ]);
  };

  const handleRestore = (item: ListView) => {
    updateShoppingList(db, item.list.id, { is_active: 1 });
    load();
  };

  const handleDelete = (item: ListView) => {
    Alert.alert('Delete List', `Permanently delete "${item.list.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteShoppingList(db, item.list.id);
          load();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState rows={4} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>PANTRY & PROVISIONS</Text>
          <Text style={styles.headline}>Shopping Lists</Text>
        </View>
        <View style={styles.headerCta}>
          <GradientButton
            title={showCreate ? 'Cancel' : '+ New List'}
            onPress={() => setShowCreate((v) => !v)}
          />
        </View>
      </View>

      {/* Inline create form */}
      {showCreate ? (
        <GlassCard level={2} style={styles.createCard}>
          <Text style={styles.createLabel}>NAME YOUR LIST</Text>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Weekly Essentials"
            placeholderTextColor="rgba(214,195,181,0.5)"
            style={styles.createInput}
            autoFocus
            onSubmitEditing={handleCreate}
            returnKeyType="done"
          />
          <View style={styles.createActions}>
            <GradientButton title="Create List" onPress={handleCreate} variant="accent" />
          </View>
        </GlassCard>
      ) : null}

      {/* Tab toggle */}
      <View style={styles.toggleWrap}>
        <View style={styles.toggle}>
          <Pressable
            onPress={() => setTab('active')}
            style={[styles.toggleBtn, tab === 'active' && styles.toggleBtnActive]}
          >
            <Text
              style={[
                styles.toggleText,
                tab === 'active' && styles.toggleTextActive,
              ]}
            >
              Active
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('archived')}
            style={[styles.toggleBtn, tab === 'archived' && styles.toggleBtnActive]}
          >
            <Text
              style={[
                styles.toggleText,
                tab === 'archived' && styles.toggleTextActive,
              ]}
            >
              Archived
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Lists */}
      {lists.length === 0 ? (
        <GlassCard level={1} style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>{tab === 'active' ? '🛒' : '📦'}</Text>
          <Text style={styles.emptyTitle}>
            {tab === 'active' ? 'No active lists' : 'No archived lists'}
          </Text>
          <Text style={styles.emptyBody}>
            {tab === 'active'
              ? 'Tap “+ New List” to start collecting ingredients.'
              : 'Completed lists will appear here.'}
          </Text>
        </GlassCard>
      ) : (
        lists.map((item, index) => {
          const total = item.summary?.totalItems ?? 0;
          const checked = item.summary?.checkedItems ?? 0;
          const pct = total > 0 ? Math.min(1, checked / total) : 0;
          const isHero = tab === 'active' && index === 0;

          return (
            <ListCard
              key={item.list.id}
              item={item}
              hero={isHero}
              archived={tab === 'archived'}
              checked={checked}
              total={total}
              pct={pct}
              onPress={() => handleOpen(item.list.id)}
              onArchive={() => handleArchive(item)}
              onRestore={() => handleRestore(item)}
              onDelete={() => handleDelete(item)}
            />
          );
        })
      )}

      {/* Recent History header (only on active tab if there are archived lists) */}
      {tab === 'active' && archivedLists.length > 0 ? (
        <View style={styles.historyHeader}>
          <Text style={styles.historyLabel}>RECENT HISTORY</Text>
          <View style={styles.historyDivider} />
        </View>
      ) : null}

      {/* History preview rows on active tab */}
      {tab === 'active' && archivedLists.length > 0
        ? archivedLists.slice(0, 3).map((item) => (
            <Pressable
              key={`history-${item.list.id}`}
              onPress={() => handleOpen(item.list.id)}
              style={styles.historyRow}
            >
              <View style={styles.flex1}>
                <Text style={styles.historyName}>{item.list.name}</Text>
                <Text style={styles.historyMeta}>COMPLETED</Text>
              </View>
              <Pressable
                onPress={() => handleRestore(item)}
                hitSlop={8}
                style={styles.historyAction}
              >
                <Text style={styles.historyActionText}>↺</Text>
              </Pressable>
            </Pressable>
          ))
        : null}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// List card
// ─────────────────────────────────────────────────────────────────────────

interface ListCardProps {
  item: ListView;
  hero: boolean;
  archived: boolean;
  checked: number;
  total: number;
  pct: number;
  onPress: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

function ListCard({
  item,
  hero,
  archived,
  checked,
  total,
  pct,
  onPress,
  onArchive,
  onRestore,
  onDelete,
}: ListCardProps) {
  const handleLongPress = () => {
    Alert.alert(item.list.name, undefined, [
      { text: 'Cancel', style: 'cancel' },
      archived
        ? { text: 'Restore', onPress: onRestore }
        : { text: 'Archive', onPress: onArchive },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  if (hero) {
    return (
      <GlassCard level={3} style={styles.heroCard} onPress={onPress}>
        <View style={styles.heroHeader}>
          <View style={styles.flex1}>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {item.list.name}
            </Text>
            <Text style={styles.heroSub}>WEEKLY ESSENTIALS</Text>
          </View>
          <View style={styles.heroProgressBlock}>
            <Text style={styles.heroProgressNum}>
              {checked}/{total}
            </Text>
            <Text style={styles.heroProgressLabel}>ITEMS COLLECTED</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
        </View>

        <View style={styles.chipsRow}>
          {item.previewItems.length === 0 ? (
            <Text style={styles.emptyChip}>No items yet</Text>
          ) : (
            <>
              {item.previewItems.map((row) => (
                <View key={row.id} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {row.item}
                  </Text>
                </View>
              ))}
              {total > PREVIEW_CHIP_COUNT ? (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    +{total - PREVIEW_CHIP_COUNT} more
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        <Pressable onPress={handleLongPress} hitSlop={8} style={styles.moreBtn}>
          <Text style={styles.moreBtnText}>•••</Text>
        </Pressable>
      </GlassCard>
    );
  }

  return (
    <GlassCard level={1} style={styles.smallCard} onPress={onPress}>
      <View style={styles.smallHeader}>
        <View style={styles.flex1}>
          <Text style={styles.smallTitle} numberOfLines={1}>
            {item.list.name}
          </Text>
          <Text style={styles.smallMeta}>
            {archived ? 'COMPLETED' : `UPDATED ${formatRelative(item.list.updated_at).toUpperCase()}`}
          </Text>
        </View>
        {archived ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>DONE</Text>
          </View>
        ) : null}
      </View>

      {total > 0 ? (
        <View style={styles.smallProgressRow}>
          <Text style={styles.smallProgressNum}>
            {checked}/{total}
          </Text>
          <View style={styles.smallProgressTrack}>
            <View
              style={[styles.smallProgressFill, { width: `${pct * 100}%` }]}
            />
          </View>
        </View>
      ) : (
        <Text style={styles.smallEmpty}>No items added yet</Text>
      )}

      <View style={styles.smallActions}>
        <Pressable onPress={onPress} style={styles.viewBtn}>
          <Text style={styles.viewBtnText}>View Details</Text>
        </Pressable>
        <Pressable onPress={handleLongPress} hitSlop={8} style={styles.smallMoreBtn}>
          <Text style={styles.moreBtnText}>•••</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────

const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const TEXT_MUTED = 'rgba(214,195,181,0.6)';
const PROGRESS_TRACK = '#35343A';
const CHIP_BG = '#2A292F';
const CHIP_BORDER = 'rgba(82,68,58,0.4)';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  container: {
    padding: 24,
    paddingBottom: 96,
    gap: 16,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#FFB877',
    fontFamily: RECIPES_TYPOGRAPHY.labelUpper.fontFamily,
    marginBottom: 6,
  },
  headline: {
    fontSize: 32,
    fontFamily: RECIPES_TYPOGRAPHY.displayLg.fontFamily,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  headerCta: {
    alignSelf: 'flex-end',
  },

  // Create form
  createCard: {
    gap: 12,
    padding: 20,
  },
  createLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#FFB877',
    fontFamily: RECIPES_TYPOGRAPHY.labelUpper.fontFamily,
  },
  createInput: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontFamily: RECIPES_TYPOGRAPHY.bodyMd.fontFamily,
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  // Toggle
  toggleWrap: {
    flexDirection: 'row',
    marginVertical: 8,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 999,
    padding: 4,
  },
  toggleBtn: {
    paddingHorizontal: 28,
    paddingVertical: 8,
    borderRadius: 999,
  },
  toggleBtnActive: {
    backgroundColor: RECIPES_SURFACES.focus,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    fontFamily: RECIPES_TYPOGRAPHY.headlineMd.fontFamily,
  },
  toggleTextActive: {
    color: '#FFB877',
    fontWeight: '700',
  },

  // Hero card
  heroCard: {
    padding: 24,
    gap: 24,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 4,
    fontFamily: RECIPES_TYPOGRAPHY.headlineMd.fontFamily,
  },
  heroSub: {
    fontSize: 12,
    letterSpacing: 1.2,
    color: TEXT_SECONDARY,
    fontFamily: RECIPES_TYPOGRAPHY.labelUpper.fontFamily,
  },
  heroProgressBlock: {
    alignItems: 'flex-end',
  },
  heroProgressNum: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFB877',
    fontFamily: RECIPES_TYPOGRAPHY.displayLg.fontFamily,
  },
  heroProgressLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: TEXT_MUTED,
    marginTop: 2,
    fontFamily: RECIPES_TYPOGRAPHY.labelUpper.fontFamily,
  },

  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: PROGRESS_TRACK,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFB877',
    borderRadius: 999,
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: CHIP_BG,
    borderWidth: 1,
    borderColor: CHIP_BORDER,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 140,
  },
  chipText: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    fontFamily: RECIPES_TYPOGRAPHY.bodyMd.fontFamily,
  },
  emptyChip: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontStyle: 'italic',
    fontFamily: RECIPES_TYPOGRAPHY.bodyMd.fontFamily,
  },

  moreBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  moreBtnText: {
    color: TEXT_MUTED,
    fontSize: 16,
    fontWeight: '700',
  },

  // Small card
  smallCard: {
    padding: 20,
    gap: 14,
  },
  smallHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  smallTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 4,
    fontFamily: RECIPES_TYPOGRAPHY.headlineMd.fontFamily,
  },
  smallMeta: {
    fontSize: 10,
    letterSpacing: 1,
    color: TEXT_MUTED,
    fontFamily: RECIPES_TYPOGRAPHY.labelUpper.fontFamily,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(48,209,88,0.15)',
  },
  badgeText: {
    fontSize: 10,
    letterSpacing: 1,
    color: '#30D158',
    fontFamily: RECIPES_TYPOGRAPHY.labelUpper.fontFamily,
    fontWeight: '700',
  },
  smallProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  smallProgressNum: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFB877',
    fontFamily: RECIPES_TYPOGRAPHY.headlineMd.fontFamily,
  },
  smallProgressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: PROGRESS_TRACK,
    overflow: 'hidden',
  },
  smallProgressFill: {
    height: '100%',
    backgroundColor: '#FFB877',
    borderRadius: 999,
  },
  smallEmpty: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontFamily: RECIPES_TYPOGRAPHY.bodyMd.fontFamily,
  },
  smallActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  viewBtn: {
    flex: 1,
    backgroundColor: 'rgba(34,197,94,0.10)',
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  viewBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: RECIPES_ACCENT,
    fontFamily: RECIPES_TYPOGRAPHY.headlineMd.fontFamily,
    letterSpacing: 0.3,
  },
  smallMoreBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  // History section
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 24,
    opacity: 0.5,
  },
  historyLabel: {
    fontSize: 11,
    letterSpacing: 3,
    color: TEXT_SECONDARY,
    fontFamily: RECIPES_TYPOGRAPHY.labelUpper.fontFamily,
    fontWeight: '700',
  },
  historyDivider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(82,68,58,0.3)',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RECIPES_SURFACES.depth,
    borderRadius: 16,
    padding: 20,
    opacity: 0.7,
  },
  historyName: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    fontFamily: RECIPES_TYPOGRAPHY.headlineMd.fontFamily,
  },
  historyMeta: {
    fontSize: 9,
    letterSpacing: 1,
    color: TEXT_MUTED,
    marginTop: 2,
    fontFamily: RECIPES_TYPOGRAPHY.labelUpper.fontFamily,
  },
  historyAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyActionText: {
    fontSize: 18,
    color: '#C9894D',
  },

  // Empty state
  emptyCard: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    fontFamily: RECIPES_TYPOGRAPHY.headlineMd.fontFamily,
  },
  emptyBody: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    fontFamily: RECIPES_TYPOGRAPHY.bodyMd.fontFamily,
  },

  // Shared
  flex1: {
    flex: 1,
  },
});
