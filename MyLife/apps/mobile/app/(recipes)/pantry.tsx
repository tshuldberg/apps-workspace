import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Search,
  SlidersHorizontal,
  Camera,
  Plus,
  AlertTriangle,
  X,
} from 'lucide-react-native';
import {
  classifyExpiration,
  createPantryItem,
  deletePantryItem,
  daysUntilExpiration,
  getPantryItems,
  lookupBarcode,
  JAKARTA_FONTS,
  RECIPES_CATEGORY_COLORS,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from '@mylife/bestchef';
import { PantryItemCard, FilterChip, GradientButton } from '@mylife/bestchef/ui';
import type {
  GrocerySection,
  PantryItem,
  StorageLocation,
  ExpirationStatus,
  OffLookupResult,
} from '@mylife/bestchef';
import { colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const STORAGE_LOCATIONS: StorageLocation[] = ['pantry', 'fridge', 'freezer', 'counter', 'other'];

const SECTION_LABELS: Record<GrocerySection, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  meat: 'Meat',
  pantry: 'Pantry',
  frozen: 'Frozen',
  bakery: 'Bakery',
  beverages: 'Beverages',
  snacks: 'Snacks',
  condiments: 'Condiments',
  other: 'Other',
};

const SECTION_ORDER: GrocerySection[] = [
  'produce',
  'dairy',
  'meat',
  'bakery',
  'pantry',
  'frozen',
  'beverages',
  'snacks',
  'condiments',
  'other',
];

const SECTION_EMOJI: Record<GrocerySection, string> = {
  produce: '🥬',
  dairy: '🥛',
  meat: '🍗',
  bakery: '🍞',
  pantry: '🥫',
  frozen: '🧊',
  beverages: '🥤',
  snacks: '🍿',
  condiments: '🧂',
  other: '📦',
};

function inferEmoji(name: string, section: GrocerySection): string {
  const n = name.toLowerCase();
  if (n.includes('apple')) return '🍎';
  if (n.includes('banana')) return '🍌';
  if (n.includes('spinach') || n.includes('lettuce') || n.includes('kale')) return '🥬';
  if (n.includes('carrot')) return '🥕';
  if (n.includes('tomato')) return '🍅';
  if (n.includes('potato')) return '🥔';
  if (n.includes('milk')) return '🥛';
  if (n.includes('cheese')) return '🧀';
  if (n.includes('yogurt')) return '🥛';
  if (n.includes('butter')) return '🧈';
  if (n.includes('egg')) return '🥚';
  if (n.includes('chicken')) return '🍗';
  if (n.includes('beef') || n.includes('steak') || n.includes('flank')) return '🥩';
  if (n.includes('bacon') || n.includes('pork')) return '🥓';
  if (n.includes('fish') || n.includes('salmon') || n.includes('tuna')) return '🐟';
  if (n.includes('bread') || n.includes('toast')) return '🍞';
  if (n.includes('rice')) return '🍚';
  if (n.includes('pasta') || n.includes('noodle')) return '🍝';
  if (n.includes('cereal')) return '🥣';
  if (n.includes('coffee')) return '☕';
  if (n.includes('tea')) return '🍵';
  if (n.includes('water')) return '💧';
  if (n.includes('beer')) return '🍺';
  if (n.includes('wine')) return '🍷';
  return SECTION_EMOJI[section];
}

type Freshness = 'fresh' | 'expiring' | 'expired' | 'none';

function freshnessFromStatus(status: ExpirationStatus): Freshness {
  switch (status) {
    case 'expired':
      return 'expired';
    case 'expiring_soon':
      return 'expiring';
    case 'fresh':
      return 'fresh';
    default:
      return 'none';
  }
}

function expiryDetail(item: PantryItem): string {
  if (!item.expiration_date) return 'No expiration date';
  const days = daysUntilExpiration(item.expiration_date);
  if (days == null) return 'No expiration date';
  if (days < -1) return `Expired ${Math.abs(days)} days ago`;
  if (days === -1) return 'Expired yesterday';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Exp. in 1 day';
  return `Exp. in ${days} days`;
}

function quantityText(item: PantryItem): string {
  if (item.quantity != null && item.unit) {
    return `${item.quantity} ${item.unit} remaining`;
  }
  if (item.quantity != null) {
    return `${item.quantity} units remaining`;
  }
  if (item.unit) {
    return `${item.unit} remaining`;
  }
  return 'In stock';
}

function isLowStock(item: PantryItem): boolean {
  if (item.quantity != null && item.quantity <= 2) return true;
  const days = item.expiration_date ? daysUntilExpiration(item.expiration_date) : null;
  if (days != null && days <= 1 && days >= -1) return true;
  return false;
}

function categoryAccent(section: GrocerySection): string {
  switch (section) {
    case 'produce':
      return RECIPES_CATEGORY_COLORS.produce;
    case 'dairy':
      return RECIPES_CATEGORY_COLORS.dairy;
    case 'meat':
      return RECIPES_CATEGORY_COLORS.meat;
    case 'bakery':
      return RECIPES_CATEGORY_COLORS.bakery;
    case 'frozen':
      return RECIPES_CATEGORY_COLORS.frozen;
    case 'pantry':
      return RECIPES_CATEGORY_COLORS.pantry;
    default:
      return RECIPES_SECONDARY;
  }
}

export default function PantryScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [items, setItems] = useState<PantryItem[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [activeSection, setActiveSection] = useState<GrocerySection | 'all'>('all');

  // Add form state
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [storage, setStorage] = useState<StorageLocation>('pantry');
  const [section, setSection] = useState<GrocerySection>('pantry');
  const [expirationDate, setExpirationDate] = useState('');

  // Barcode state
  const [barcode, setBarcode] = useState('');
  const [barcodeResult, setBarcodeResult] = useState<OffLookupResult | null>(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);

  const load = useCallback(() => {
    setItems(getPantryItems(db, { sortBy: 'expiration_date', sortDir: 'ASC' }));
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (activeSection !== 'all' && item.grocery_section !== activeSection) return false;
      return true;
    });
  }, [items, search, activeSection]);

  const lowStock = useMemo(() => filteredItems.filter(isLowStock).slice(0, 5), [filteredItems]);

  const groupedByCategory = useMemo(() => {
    const groups = new Map<GrocerySection, PantryItem[]>();
    for (const item of filteredItems) {
      const key = (item.grocery_section ?? 'other') as GrocerySection;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return SECTION_ORDER.filter((s) => groups.has(s)).map((s) => ({
      section: s,
      items: groups.get(s)!,
    }));
  }, [filteredItems]);

  const categoryCount = groupedByCategory.length;

  const handleAdd = () => {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert('Missing Item', 'Enter a pantry item name.');
      return;
    }
    createPantryItem(db, {
      name: cleanName,
      quantity: quantity.trim() ? Number.parseFloat(quantity) || null : null,
      unit: unit.trim() || null,
      storage_location: storage,
      grocery_section: section,
      expiration_date: expirationDate.trim() || null,
      is_staple: storage === 'pantry' && !expirationDate.trim() ? 1 : 0,
    });
    setName('');
    setQuantity('');
    setUnit('');
    setExpirationDate('');
    setStorage('pantry');
    setSection('pantry');
    setShowForm(false);
    load();
  };

  const handleDelete = (item: PantryItem) => {
    Alert.alert('Delete Pantry Item', `Remove ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deletePantryItem(db, item.id);
          load();
        },
      },
    ]);
  };

  const handleBarcodeLookup = async () => {
    if (!barcode.trim()) return;
    setBarcodeLoading(true);
    try {
      const result = await lookupBarcode(barcode.trim());
      setBarcodeResult(result);
    } catch {
      Alert.alert('Error', 'Barcode lookup failed.');
    } finally {
      setBarcodeLoading(false);
    }
  };

  const handleAddFromBarcode = () => {
    if (!barcodeResult?.found || !barcodeResult.productName) return;
    createPantryItem(db, {
      name: barcodeResult.productName,
      quantity: null,
      unit: null,
      storage_location: 'pantry',
      grocery_section: 'pantry',
      expiration_date: null,
      barcode: barcode.trim(),
    });
    setBarcode('');
    setBarcodeResult(null);
    setShowBarcode(false);
    load();
  };

  const handleShop = (item: PantryItem) => {
    router.push({
      pathname: '/(recipes)/shopping-list',
      params: { suggested: item.name },
    });
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerBlock}>
          <RNText style={styles.headerTitle}>Kitchen Inventory</RNText>
          <RNText style={styles.headerSubtitle}>
            Managing {items.length} {items.length === 1 ? 'item' : 'items'} across {categoryCount}{' '}
            {categoryCount === 1 ? 'category' : 'categories'}
          </RNText>
        </View>

        {/* Search + Actions Bar */}
        <View style={styles.actionsBar}>
          <View style={styles.searchField}>
            <Search size={18} color={colors.textSecondary} strokeWidth={1.5} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search or quick add item..."
              placeholderTextColor={colors.textTertiary}
              returnKeyType="search"
            />
          </View>
          <Pressable style={styles.iconBtn} onPress={() => setShowFilter(true)} hitSlop={6}>
            <SlidersHorizontal size={18} color={RECIPES_SECONDARY} strokeWidth={1.8} />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setShowBarcode(true)}
            hitSlop={6}
          >
            <Camera size={18} color={RECIPES_SECONDARY} strokeWidth={1.8} />
          </Pressable>
          <Pressable style={styles.addPill} onPress={() => setShowForm(true)} hitSlop={6}>
            <Plus size={16} color="#4B2700" strokeWidth={2.4} />
            <RNText style={styles.addPillText}>Add</RNText>
          </Pressable>
        </View>

        {/* Low Stock Alerts */}
        {lowStock.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <RNText style={styles.sectionLabel}>LOW STOCK ALERTS</RNText>
              <RNText style={styles.viewAll}>View All</RNText>
            </View>
            <View style={styles.lowStockList}>
              {lowStock.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.lowStockCard}
                  onLongPress={() => handleDelete(item)}
                >
                  <View style={styles.lowStockAccent} />
                  <View style={styles.lowStockBody}>
                    <View style={styles.lowStockIcon}>
                      <AlertTriangle size={18} color={RECIPES_SECONDARY} strokeWidth={1.8} />
                    </View>
                    <View style={styles.flex1}>
                      <RNText style={styles.lowStockName}>{item.name}</RNText>
                      <RNText style={styles.lowStockSub}>
                        {item.quantity != null
                          ? `Only ${item.quantity}${item.unit ? ` ${item.unit}` : ''} left`
                          : 'Running low'}
                      </RNText>
                    </View>
                  </View>
                  <Pressable
                    style={styles.shopBtn}
                    onPress={() => handleShop(item)}
                    hitSlop={6}
                  >
                    <RNText style={styles.shopBtnText}>SHOP</RNText>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Inventory by Category */}
        {groupedByCategory.length === 0 ? (
          <View style={styles.emptyState}>
            <RNText style={styles.emptyEmoji}>🥫</RNText>
            <RNText style={styles.emptyTitle}>Pantry is empty</RNText>
            <RNText style={styles.emptyText}>
              {search ? 'No items match your search.' : 'Add your first item to start tracking.'}
            </RNText>
          </View>
        ) : (
          groupedByCategory.map(({ section: cat, items: catItems }) => {
            const accent = categoryAccent(cat);
            return (
            <View key={cat} style={styles.categoryBlock}>
              <View style={styles.categoryHeaderRow}>
                <View style={[styles.categoryPill, { backgroundColor: `${accent}22` }]}>
                  <RNText style={[styles.categoryPillText, { color: accent }]}>
                    {SECTION_LABELS[cat].toUpperCase()}
                  </RNText>
                </View>
                <View style={styles.categoryDivider} />
                <RNText style={styles.categoryCount}>{catItems.length}</RNText>
              </View>
              <View style={styles.itemList}>
                {catItems.map((item) => {
                  const fresh = freshnessFromStatus(classifyExpiration(item.expiration_date));
                  const cardFreshness = fresh === 'none' ? 'fresh' : fresh;
                  const subText =
                    fresh === 'expired' || fresh === 'expiring' || !item.expiration_date
                      ? expiryDetail(item)
                      : quantityText(item);
                  return (
                    <Pressable
                      key={item.id}
                      onLongPress={() => handleDelete(item)}
                    >
                      <PantryItemCard
                        name={item.name}
                        quantity={quantityText(item)}
                        emoji={inferEmoji(item.name, cat)}
                        freshness={cardFreshness}
                        expiryLabel={subText}
                        onShop={isLowStock(item) ? () => handleShop(item) : undefined}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Item Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <RNText style={styles.modalTitle}>Add Pantry Item</RNText>
              <Pressable onPress={() => setShowForm(false)} hitSlop={8}>
                <X size={20} color={colors.text} strokeWidth={1.8} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.modalScroll}>
              <RNText style={styles.fieldLabel}>NAME</RNText>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Apples"
                placeholderTextColor={colors.textTertiary}
              />

              <View style={styles.inlineFields}>
                <View style={styles.flex1}>
                  <RNText style={styles.fieldLabel}>QUANTITY</RNText>
                  <TextInput
                    style={styles.input}
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholder="6"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.flex1}>
                  <RNText style={styles.fieldLabel}>UNIT</RNText>
                  <TextInput
                    style={styles.input}
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="units"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              </View>

              <RNText style={styles.fieldLabel}>EXPIRATION (YYYY-MM-DD)</RNText>
              <TextInput
                style={styles.input}
                value={expirationDate}
                onChangeText={setExpirationDate}
                placeholder="2026-05-01"
                placeholderTextColor={colors.textTertiary}
              />

              <RNText style={styles.fieldLabel}>STORAGE</RNText>
              <View style={styles.chipRow}>
                {STORAGE_LOCATIONS.map((value) => (
                  <FilterChip
                    key={value}
                    label={value.charAt(0).toUpperCase() + value.slice(1)}
                    selected={storage === value}
                    onPress={() => setStorage(value)}
                  />
                ))}
              </View>

              <RNText style={styles.fieldLabel}>CATEGORY</RNText>
              <View style={styles.chipRow}>
                {SECTION_ORDER.map((value) => (
                  <FilterChip
                    key={value}
                    label={SECTION_LABELS[value]}
                    selected={section === value}
                    onPress={() => setSection(value)}
                  />
                ))}
              </View>

              <View style={styles.primaryBtnWrap}>
                <GradientButton title="Save Item" variant="accent" onPress={handleAdd} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Barcode Modal */}
      <Modal
        visible={showBarcode}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBarcode(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <RNText style={styles.modalTitle}>Scan Barcode</RNText>
              <Pressable onPress={() => setShowBarcode(false)} hitSlop={8}>
                <X size={20} color={colors.text} strokeWidth={1.8} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.modalScroll}>
              <RNText style={styles.fieldLabel}>BARCODE NUMBER</RNText>
              <TextInput
                style={styles.input}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="Enter or scan barcode"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
              <View style={[styles.primaryBtnWrap, barcodeLoading && styles.primaryBtnDisabled]}>
                <GradientButton
                  title={barcodeLoading ? 'Looking up...' : 'Lookup'}
                  variant="accent"
                  onPress={() => void handleBarcodeLookup()}
                />
              </View>

              {barcodeResult ? (
                barcodeResult.found ? (
                  <View style={styles.barcodeResult}>
                    <RNText style={styles.barcodeProductName}>{barcodeResult.productName}</RNText>
                    {barcodeResult.brand ? (
                      <RNText style={styles.barcodeMeta}>{barcodeResult.brand}</RNText>
                    ) : null}
                    <RNText style={styles.barcodeMeta}>
                      Category: {barcodeResult.category}
                    </RNText>
                    {barcodeResult.nutrition ? (
                      <RNText style={styles.barcodeMeta}>
                        {barcodeResult.nutrition.calories ?? 0} cal |{' '}
                        {barcodeResult.nutrition.protein_g ?? 0}g protein
                      </RNText>
                    ) : null}
                    <View style={styles.primaryBtnWrap}>
                      <GradientButton
                        title="Add to Pantry"
                        variant="accent"
                        onPress={handleAddFromBarcode}
                      />
                    </View>
                  </View>
                ) : (
                  <RNText style={styles.barcodeMeta}>
                    Not found. Try manual entry instead.
                  </RNText>
                )
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={showFilter}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFilter(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <RNText style={styles.modalTitle}>Filter by Category</RNText>
              <Pressable onPress={() => setShowFilter(false)} hitSlop={8}>
                <X size={20} color={colors.text} strokeWidth={1.8} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.modalScroll}>
              <View style={styles.chipRow}>
                <FilterChip
                  label="All"
                  selected={activeSection === 'all'}
                  onPress={() => {
                    setActiveSection('all');
                    setShowFilter(false);
                  }}
                />
                {SECTION_ORDER.map((value) => (
                  <FilterChip
                    key={value}
                    label={SECTION_LABELS[value]}
                    selected={activeSection === value}
                    onPress={() => {
                      setActiveSection(value);
                      setShowFilter(false);
                    }}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 24,
  },
  flex1: {
    flex: 1,
  },

  // Header
  headerBlock: {
    gap: 6,
  },
  headerTitle: {
    ...RECIPES_TYPOGRAPHY.displayLg,
    color: colors.text,
    fontSize: 30,
    letterSpacing: -0.02 * 30,
  },
  headerSubtitle: {
    ...RECIPES_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 1.4 * 13,
  },

  // Actions bar
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RECIPES_SURFACES.highest,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    minHeight: 38,
  },
  searchInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: RECIPES_SECONDARY,
    borderRadius: 999,
    paddingHorizontal: 18,
    height: 38,
  },
  addPillText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: '#4B2700',
  },

  // Section
  section: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.15 * 11,
    color: RECIPES_SECONDARY,
  },
  viewAll: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.textSecondary,
    textTransform: 'none',
  },

  // Low stock cards
  lowStockList: {
    gap: 10,
  },
  lowStockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 12,
    paddingVertical: 14,
    paddingRight: 16,
    overflow: 'hidden',
  },
  lowStockAccent: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: RECIPES_SECONDARY,
  },
  lowStockBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 14,
  },
  lowStockIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowStockName: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  lowStockSub: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  shopBtn: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  shopBtnText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: RECIPES_SECONDARY,
  },

  // Category block
  categoryBlock: {
    gap: 14,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryPill: {
    backgroundColor: 'rgba(201, 137, 77, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  categoryPillText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.15 * 10,
    color: RECIPES_SECONDARY,
  },
  categoryDivider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  categoryCount: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 11,
    color: colors.textTertiary,
  },

  // Item card
  itemList: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    overflow: 'hidden',
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemEmojiBubble: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEmoji: {
    fontSize: 24,
  },
  freshBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  freshBadgeText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
  },
  itemName: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 17,
    color: colors.text,
  },
  itemSub: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  barTrack: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: RECIPES_SURFACES.highest,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    color: colors.text,
  },
  emptyText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: RECIPES_SURFACES.base,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 20,
    color: colors.text,
  },
  modalScroll: {
    flexGrow: 0,
  },
  fieldLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.text,
  },
  inlineFields: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryBtnWrap: {
    marginTop: 20,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  barcodeResult: {
    marginTop: 16,
    padding: 14,
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 12,
    gap: 4,
  },
  barcodeProductName: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  barcodeMeta: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
