import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  createClothingItem,
  getClosetDashboard,
  listClothingItems,
  listDirtyClothingItems,
} from '@mylife/closet';
import type { CareInstruction, ClothingCategory, LaundryStatus } from '@mylife/closet';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const CLOSET_ACCENT = '#E879A8';
const CATEGORIES: ClothingCategory[] = [
  'tops',
  'bottoms',
  'dresses',
  'outerwear',
  'shoes',
  'accessories',
  'activewear',
  'underwear',
  'other',
];
const CARE_OPTIONS: CareInstruction[] = ['machine_wash', 'hand_wash', 'dry_clean', 'delicate'];
const LAUNDRY_FILTERS: Array<'all' | LaundryStatus> = ['all', 'clean', 'dirty'];

/**
 * Normalize and deduplicate a comma-separated tag string. Handles whitespace,
 * blank segments from trailing commas ("shirt,,red"), and case-insensitive
 * duplicates ("Red" and "red" collapse to one). Tags are lowercased for
 * storage so filtering/comparison is consistent.
 */
function splitTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const segment of raw.split(',')) {
    const normalized = segment.trim().toLowerCase();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
    </View>
  );
}

export default function ClosetWardrobeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');
  const [price, setPrice] = useState('');
  const [tags, setTags] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ClothingCategory>('tops');
  const [careInstructions, setCareInstructions] = useState<CareInstruction>('machine_wash');
  const [autoDirtyOnWear, setAutoDirtyOnWear] = useState(true);
  const [laundryFilter, setLaundryFilter] = useState<'all' | LaundryStatus>('all');
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((value) => value + 1);
  const items = useMemo(
    () =>
      listClothingItems(db, {
        status: 'active',
        limit: 200,
        search: search.trim() || undefined,
        laundryStatus: laundryFilter === 'all' ? undefined : laundryFilter,
      }),
    [db, tick, search, laundryFilter],
  );
  const dirtyItems = useMemo(() => listDirtyClothingItems(db), [db, tick]);
  const dashboard = useMemo(() => getClosetDashboard(db), [db, tick]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Text variant="heading">Wardrobe</Text>
        <Pressable style={styles.menuButton} onPress={() => setMenuOpen(true)}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.menuHandle} />
            <ScrollView bounces={false}>
              {[
                { label: 'Color Analysis', route: '/(closet)/color-analysis' },
                { label: 'Cost Per Wear', route: '/(closet)/cpw' },
                { label: 'Rotation', route: '/(closet)/rotation' },
                { label: 'Suggestions', route: '/(closet)/suggestions' },
                { label: 'Trends', route: '/(closet)/trends' },
                { label: 'Weather Score', route: '/(closet)/weather-score' },
                { label: 'Wishlist', route: '/(closet)/wishlist' },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  style={styles.menuItem}
                  onPress={() => { setMenuOpen(false); router.push(item.route as never); }}
                >
                  <Text variant="body" color={colors.text}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Card>
        <Text variant="subheading">Wardrobe Snapshot</Text>
        <View style={styles.statsGrid}>
          <Stat label="Items" value={String(dashboard.totalItems)} />
          <Stat label="Dirty" value={String(dirtyItems.length)} />
          <Stat label="Value" value={`$${(dashboard.wardrobeValueCents / 100).toFixed(0)}`} />
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Catalog Filters</Text>
        <View style={styles.formGrid}>
          <TextInput
            style={styles.input}
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, brand, or color"
            placeholderTextColor={colors.textTertiary}
          />
          <View style={styles.chipRow}>
            {LAUNDRY_FILTERS.map((option) => {
              const selected = option === laundryFilter;
              return (
                <Pressable
                  key={option}
                  onPress={() => setLaundryFilter(option)}
                  style={[styles.chip, selected ? styles.chipActive : null]}
                >
                  <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Add Item</Text>
        <View style={styles.formGrid}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Item name"
            placeholderTextColor={colors.textTertiary}
          />
          <View style={styles.chipRow}>
            {CATEGORIES.map((option) => {
              const selected = option === category;
              return (
                <Pressable
                  key={option}
                  onPress={() => setCategory(option)}
                  style={[styles.chip, selected ? styles.chipActive : null]}
                >
                  <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.chipRow}>
            {CARE_OPTIONS.map((option) => {
              const selected = option === careInstructions;
              return (
                <Pressable
                  key={option}
                  onPress={() => setCareInstructions(option)}
                  style={[styles.chip, selected ? styles.chipActive : null]}
                >
                  <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                    {option.replace('_', ' ')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.chipRow}>
            {[
              { label: 'Auto dirty on wear', value: true },
              { label: 'Track only', value: false },
            ].map((option) => {
              const selected = option.value === autoDirtyOnWear;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => setAutoDirtyOnWear(option.value)}
                  style={[styles.chip, selected ? styles.chipActive : null]}
                >
                  <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={styles.input}
            value={brand}
            onChangeText={setBrand}
            placeholder="Brand"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={styles.input}
            value={color}
            onChangeText={setColor}
            placeholder="Color"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="Price in dollars"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            value={tags}
            onChangeText={setTags}
            placeholder="Tags, comma separated"
            placeholderTextColor={colors.textTertiary}
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              if (!name.trim()) {
                return;
              }

              createClothingItem(db, uuid(), {
                name: name.trim(),
                category,
                brand: brand.trim() || null,
                color: color.trim() || null,
                purchasePriceCents: price.trim() ? Math.round(Number(price) * 100) : null,
                tags: splitTags(tags),
                careInstructions,
                autoDirtyOnWear,
              });
              setName('');
              setBrand('');
              setColor('');
              setPrice('');
              setTags('');
              setCareInstructions('machine_wash');
              setAutoDirtyOnWear(true);
              refresh();
            }}
          >
            <Text variant="label" color={colors.background}>Save Item</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Catalog</Text>
        <View style={styles.list}>
          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👚</Text>
              <Text variant="subheading" style={{ textAlign: 'center' }}>Your wardrobe is waiting</Text>
              <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
                Add your first item above to start building your closet.
              </Text>
            </View>
          ) : (
            items.map((item) => (
              <Card key={item.id} style={styles.innerCard}>
                <Text variant="body">{item.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {item.category}
                  {item.brand ? ` · ${item.brand}` : ''}
                  {item.color ? ` · ${item.color}` : ''}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {item.laundryStatus} · {item.careInstructions.replace('_', ' ')} · wears since wash {item.wearsSinceWash}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  Worn {item.timesWorn} times
                  {item.tags.length > 0 ? ` · ${item.tags.join(', ')}` : ''}
                </Text>
              </Card>
            ))
          )}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  menuButton: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  menuLine: { width: 18, height: 2, borderRadius: 1, backgroundColor: colors.text },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: spacing.xl, maxHeight: '70%',
  },
  menuHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: spacing.sm, marginBottom: spacing.sm },
  menuItem: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statCard: {
    minWidth: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: 4,
  },
  statValue: {
    color: CLOSET_ACCENT,
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 44,
  },
  formGrid: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: CLOSET_ACCENT,
    borderColor: CLOSET_ACCENT,
  },
  primaryButton: {
    backgroundColor: CLOSET_ACCENT,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  innerCard: {
    gap: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
});
