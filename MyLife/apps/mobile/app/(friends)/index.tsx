import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import { Users, HeartPulse } from 'lucide-react-native';
import {
  listPeople,
  type PersonRecord,
  type PersonFilter,
  type PersonSort,
  type RelationshipType,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.friends;
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const SURFACE = '#2A292F';

// ── Avatar gradient from name hash ────────────────────────────────

const GRADIENT_PAIRS: [string, string][] = [
  ['#EC4899', '#F472B6'],
  ['#8B5CF6', '#A78BFA'],
  ['#06B6D4', '#22D3EE'],
  ['#F59E0B', '#FBBF24'],
  ['#10B981', '#34D399'],
  ['#EF4444', '#F87171'],
  ['#6366F1', '#818CF8'],
  ['#E879A1', '#F0ABAF'],
];

function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getGradient(name: string): [string, string] {
  return GRADIENT_PAIRS[nameHash(name) % GRADIENT_PAIRS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ── Relationship type display ────────────────────────────────────

const RELATIONSHIP_LABELS: Record<string, string> = {
  close_friend: 'Close friend',
  friend: 'Friend',
  acquaintance: 'Acquaintance',
  family: 'Family',
  partner: 'Partner',
  ex: 'Ex',
  colleague: 'Colleague',
  mentor: 'Mentor',
  neighbor: 'Neighbor',
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  close_friend: '#EC4899',
  friend: '#8B5CF6',
  acquaintance: '#9F8E81',
  family: '#F59E0B',
  partner: '#EF4444',
  ex: '#6B7280',
  colleague: '#06B6D4',
  mentor: '#10B981',
  neighbor: '#F97316',
};

const ENERGY_COLORS: Record<string, string> = {
  energizing: '#10B981',
  neutral: '#9F8E81',
  draining: '#EF4444',
  complicated: '#F59E0B',
};

// ── Filter options ───────────────────────────────────────────────

const RELATIONSHIP_FILTERS: { key: RelationshipType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'close_friend', label: 'Close' },
  { key: 'friend', label: 'Friend' },
  { key: 'family', label: 'Family' },
  { key: 'colleague', label: 'Colleague' },
  { key: 'acquaintance', label: 'Acquaintance' },
  { key: 'partner', label: 'Partner' },
  { key: 'mentor', label: 'Mentor' },
  { key: 'neighbor', label: 'Neighbor' },
];

const SORT_OPTIONS: { key: PersonSort; label: string }[] = [
  { key: 'name_asc', label: 'Name A-Z' },
  { key: 'created_at_desc', label: 'Recently added' },
  { key: 'last_seen_desc', label: 'Last seen' },
];

export default function FriendsPeopleScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [relationshipFilter, setRelationshipFilter] = useState<RelationshipType | 'all'>('all');
  const [sortBy, setSortBy] = useState<PersonSort>('name_asc');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [search]);

  const loadPeople = useCallback(() => {
    const filters: PersonFilter = { is_archived: false };
    if (relationshipFilter !== 'all') {
      filters.relationship_type = relationshipFilter;
    }
    if (debouncedSearch.trim()) {
      filters.search = debouncedSearch.trim();
    }
    const results = listPeople(db, filters, sortBy);
    setPeople(results);
    setLoading(false);
  }, [db, relationshipFilter, sortBy, debouncedSearch]);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPeople();
    setRefreshing(false);
  }, [loadPeople]);

  const hasFilters = relationshipFilter !== 'all' || debouncedSearch.trim().length > 0;
  const isEmpty = people.length === 0 && !loading;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Search bar + health link */}
        <View style={styles.searchContainer}>
          <View style={styles.searchRow}>
            <View style={[styles.searchBar, { flex: 1 }]}>
              <Text style={styles.searchIcon}>&#128269;</Text>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search people..."
                placeholderTextColor="#9F8E81"
                style={styles.searchInput}
              />
            </View>
            <Pressable
              onPress={() => router.push('/(friends)/health')}
              style={styles.healthButton}
            >
              <HeartPulse size={20} color={ACCENT} strokeWidth={1.8} />
            </Pressable>
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {RELATIONSHIP_FILTERS.map((f) => {
            const active = relationshipFilter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setRelationshipFilter(f.key)}
                style={[
                  styles.filterChip,
                  active && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Sort dropdown */}
        <View style={styles.sortRow}>
          <Text style={styles.countText}>
            {people.length} {people.length === 1 ? 'person' : 'people'}
          </Text>
          <Pressable
            onPress={() => setShowSortMenu(!showSortMenu)}
            style={styles.sortButton}
          >
            <Text style={styles.sortButtonText}>
              {SORT_OPTIONS.find((s) => s.key === sortBy)?.label ?? 'Sort'}
            </Text>
            <Text style={styles.sortArrow}>{showSortMenu ? '\u25B2' : '\u25BC'}</Text>
          </Pressable>
        </View>

        {/* Sort menu */}
        {showSortMenu && (
          <View style={styles.sortMenu}>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => {
                  setSortBy(opt.key);
                  setShowSortMenu(false);
                }}
                style={[
                  styles.sortMenuItem,
                  sortBy === opt.key && styles.sortMenuItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.sortMenuItemText,
                    sortBy === opt.key && styles.sortMenuItemTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* People list */}
        {isEmpty && !hasFilters ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Users size={48} color={ACCENT} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>Your people, your memories</Text>
            <Text style={styles.emptySubtitle}>
              Add your first friend to get started.
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={() => router.push('/(friends)/add-person')}
            >
              <Text style={styles.emptyButtonText}>Add First Friend</Text>
            </Pressable>
          </View>
        ) : isEmpty && hasFilters ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptySubtitle}>
              Try a different search or filter.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={ACCENT}
              />
            }
          >
            {people.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                onPress={() =>
                  router.push({
                    pathname: '/(friends)/person-detail',
                    params: { id: person.id },
                  })
                }
              />
            ))}
          </ScrollView>
        )}

        {/* FAB */}
        {(people.length > 0 || hasFilters) && (
          <Pressable
            style={styles.fab}
            onPress={() => router.push('/(friends)/add-person')}
          >
            <Text style={styles.fabText}>+</Text>
          </Pressable>
        )}
      </View>
    </>
  );
}

// ── Person card ────────────────────────────────────────────────────

function PersonCard({
  person,
  onPress,
}: {
  person: PersonRecord;
  onPress: () => void;
}) {
  const initials = getInitials(person.display_name);
  const [gradStart] = getGradient(person.display_name);
  const relColor = RELATIONSHIP_COLORS[person.relationship_type] ?? '#9F8E81';
  const relLabel = RELATIONSHIP_LABELS[person.relationship_type] ?? person.relationship_type;
  const energyColor = person.energy_tag
    ? ENERGY_COLORS[person.energy_tag]
    : null;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: gradStart }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <View style={styles.cardNameRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {person.display_name}
          </Text>
          {energyColor && (
            <View
              style={[styles.energyDot, { backgroundColor: energyColor }]}
            />
          )}
        </View>
        <View style={styles.cardMeta}>
          <View
            style={[styles.relBadge, { backgroundColor: `${relColor}20` }]}
          >
            <Text style={[styles.relBadgeText, { color: relColor }]}>
              {relLabel}
            </Text>
          </View>
          {person.city && (
            <Text style={styles.cardCity} numberOfLines={1}>
              {person.city}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  healthButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchIcon: {
    fontSize: 16,
    color: '#9F8E81',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: TEXT_PRIMARY,
    padding: 0,
    margin: 0,
  },
  filterRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  countText: {
    fontSize: 13,
    color: '#9F8E81',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: GLASS,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  sortArrow: {
    fontSize: 10,
    color: TEXT_SECONDARY,
  },
  sortMenu: {
    position: 'absolute',
    top: 180,
    right: 20,
    zIndex: 100,
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingVertical: 4,
    minWidth: 160,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  sortMenuItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sortMenuItemActive: {
    backgroundColor: `${ACCENT}20`,
  },
  sortMenuItemText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  sortMenuItemTextActive: {
    color: ACCENT,
    fontWeight: '600',
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    flex: 1,
  },
  energyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  relBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  relBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardCity: {
    fontSize: 12,
    color: '#9F8E81',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyButton: {
    backgroundColor: ACCENT,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 30,
  },
});
