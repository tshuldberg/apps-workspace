import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Plus, X } from 'lucide-react-native';
import {
  createShoppingList,
  getShoppingListById,
  getShoppingListItems,
  addCustomItem,
  addRecipeToShoppingList,
  removeRecipeFromShoppingList,
  toggleItemChecked,
  deleteShoppingListItem,
  addCheckedItemsToPantry,
  getRecipesInShoppingList,
  completeShoppingList,
  getRecipes,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_CATEGORY_COLORS,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
  type GrocerySection,
  type Recipe,
  type ShoppingListItemRow,
} from '@mylife/bestchef';
import { ShoppingItemRow } from '@mylife/bestchef/ui';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

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
  'pantry',
  'bakery',
  'frozen',
  'beverages',
  'condiments',
  'snacks',
  'other',
];

function sectionAccent(section: GrocerySection): string {
  switch (section) {
    case 'produce':
      return RECIPES_CATEGORY_COLORS.produce;
    case 'dairy':
      return RECIPES_CATEGORY_COLORS.dairy;
    case 'meat':
      return RECIPES_CATEGORY_COLORS.meat;
    case 'pantry':
    case 'condiments':
      return RECIPES_CATEGORY_COLORS.pantry;
    case 'bakery':
      return RECIPES_CATEGORY_COLORS.bakery;
    case 'frozen':
    case 'beverages':
      return RECIPES_CATEGORY_COLORS.frozen;
    default:
      return RECIPES_SURFACES.highest;
  }
}

function formatQuantity(item: ShoppingListItemRow): string {
  const qty = item.quantity ? `${item.quantity}` : '';
  const unit = item.unit ?? '';
  const combined = [qty, unit].filter(Boolean).join(' ').trim();
  return combined.length > 0 ? combined : '';
}

interface GroupedSection {
  key: GrocerySection;
  label: string;
  accent: string;
  items: ShoppingListItemRow[];
}

export default function ShoppingListScreen() {
  const { listId: paramListId } = useLocalSearchParams<{ listId?: string }>();
  const router = useRouter();
  const db = useDatabase();

  const [listId, setListId] = useState(paramListId ?? '');
  const [items, setItems] = useState<ShoppingListItemRow[]>([]);
  const [customText, setCustomText] = useState('');
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeResults, setRecipeResults] = useState<Recipe[]>([]);
  const [addedRecipes, setAddedRecipes] = useState<
    Array<{ recipe_id: string; recipe_title: string; multiplier: number }>
  >([]);

  // Create or load list
  useEffect(() => {
    if (paramListId) {
      const existing = getShoppingListById(db, paramListId);
      if (existing) {
        setListId(paramListId);
      }
    } else {
      const id = uuid();
      const name = `Shopping List - ${new Date().toLocaleDateString()}`;
      createShoppingList(db, id, name);
      setListId(id);
    }
  }, [db, paramListId]);

  const reload = useCallback(() => {
    if (!listId) return;
    const allItems = getShoppingListItems(db, listId);
    setItems(allItems);
    setAddedRecipes(getRecipesInShoppingList(db, listId));
  }, [db, listId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const { checked, groupedSections, remainingCount } = useMemo(() => {
    const uncheckedItems = items.filter((i) => !i.is_checked);
    const checkedItems = items.filter((i) => i.is_checked);

    const grouped = new Map<GrocerySection, ShoppingListItemRow[]>();
    for (const item of uncheckedItems) {
      const section = (item.grocery_section ?? 'other') as GrocerySection;
      if (!grouped.has(section)) grouped.set(section, []);
      grouped.get(section)!.push(item);
    }

    const sections: GroupedSection[] = [];
    for (const key of SECTION_ORDER) {
      const data = grouped.get(key);
      if (data && data.length > 0) {
        sections.push({
          key,
          label: SECTION_LABELS[key],
          accent: sectionAccent(key),
          items: data,
        });
        grouped.delete(key);
      }
    }
    // Append any remaining sections that weren't in the order list
    for (const [key, data] of grouped) {
      sections.push({
        key,
        label: SECTION_LABELS[key] ?? key,
        accent: sectionAccent(key),
        items: data,
      });
    }

    return {
      checked: checkedItems,
      groupedSections: sections,
      remainingCount: uncheckedItems.length,
    };
  }, [items]);

  const handleAddCustomItem = () => {
    const trimmed = customText.trim();
    if (!trimmed || !listId) return;
    addCustomItem(db, uuid(), listId, trimmed);
    setCustomText('');
    reload();
  };

  const handleAddRecipe = (recipe: Recipe, multiplier: number) => {
    if (!listId) return;
    addRecipeToShoppingList(db, listId, recipe.id, multiplier, uuid);
    setShowRecipePicker(false);
    setRecipeSearch('');
    reload();
  };

  const handleRemoveRecipe = (recipeId: string) => {
    if (!listId) return;
    Alert.alert('Remove Recipe', 'Remove all ingredients from this recipe?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeRecipeFromShoppingList(db, listId, recipeId);
          reload();
        },
      },
    ]);
  };

  const handleToggleItem = (itemId: string) => {
    toggleItemChecked(db, itemId);
    reload();
  };

  const handleClearCompleted = () => {
    if (checked.length === 0) {
      Alert.alert('Nothing to Clear', 'Check off items as you shop, then tap Clear.');
      return;
    }
    Alert.alert(
      'Clear Completed',
      `Remove ${checked.length} completed item${checked.length === 1 ? '' : 's'} from this list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            for (const item of checked) {
              deleteShoppingListItem(db, item.id);
            }
            reload();
          },
        },
        {
          text: 'Add to Pantry & Clear',
          onPress: () => {
            const added = addCheckedItemsToPantry(db, listId, uuid);
            for (const item of checked) {
              deleteShoppingListItem(db, item.id);
            }
            Alert.alert('Done', `${added} item${added === 1 ? '' : 's'} added to pantry.`);
            reload();
          },
        },
      ],
    );
  };

  const handleComplete = () => {
    if (!listId) return;
    if (checked.length === 0) {
      Alert.alert('No Items Checked', 'Check off items as you shop before completing.');
      return;
    }
    Alert.alert(
      'Complete Shopping Trip',
      `Add ${checked.length} checked item(s) to your pantry?`,
      [
        {
          text: 'Just Complete',
          onPress: () => {
            completeShoppingList(db, listId);
            router.back();
          },
        },
        {
          text: 'Add to Pantry & Complete',
          onPress: () => {
            const added = addCheckedItemsToPantry(db, listId, uuid);
            completeShoppingList(db, listId);
            Alert.alert('Done', `${added} new item(s) added to pantry.`);
            router.back();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const searchRecipes = (query: string) => {
    setRecipeSearch(query);
    if (query.trim()) {
      setRecipeResults(getRecipes(db, { search: query.trim() }));
    } else {
      setRecipeResults(getRecipes(db).slice(0, 20));
    }
  };

  const openRecipePicker = () => {
    setShowRecipePicker(true);
    setRecipeResults(getRecipes(db).slice(0, 20));
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <RNText style={styles.title}>Shopping List</RNText>
            <RNText style={styles.subtitle}>
              {remainingCount} ITEM{remainingCount === 1 ? '' : 'S'} REMAINING
            </RNText>
          </View>
          <Pressable
            hitSlop={8}
            onPress={handleClearCompleted}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
          >
            <RNText style={styles.clearText}>CLEAR</RNText>
          </Pressable>
        </View>

        {/* Recipe sources strip */}
        {addedRecipes.length > 0 && (
          <View style={styles.recipeStrip}>
            <RNText style={styles.recipeStripLabel}>FROM RECIPES</RNText>
            <View style={styles.recipeChips}>
              {addedRecipes.map((r) => (
                <Pressable
                  key={r.recipe_id}
                  onPress={() => handleRemoveRecipe(r.recipe_id)}
                  style={styles.recipeChip}
                >
                  <RNText style={styles.recipeChipText}>
                    {r.recipe_title}
                    {r.multiplier > 1 ? ` (${r.multiplier}x)` : ''}
                  </RNText>
                  <X size={12} color={colors.textSecondary} strokeWidth={2} />
                </Pressable>
              ))}
              <Pressable onPress={openRecipePicker} style={styles.recipeAddChip}>
                <Plus size={12} color={RECIPES_ACCENT} strokeWidth={2.5} />
                <RNText style={styles.recipeAddChipText}>Add Recipe</RNText>
              </Pressable>
            </View>
          </View>
        )}
        {addedRecipes.length === 0 && (
          <View style={styles.recipeStrip}>
            <Pressable onPress={openRecipePicker} style={styles.recipeAddChipFull}>
              <Plus size={14} color={RECIPES_ACCENT} strokeWidth={2.5} />
              <RNText style={styles.recipeAddChipText}>Add from Recipe</RNText>
            </Pressable>
          </View>
        )}

        {/* Empty state */}
        {items.length === 0 && (
          <View style={styles.emptyState}>
            <RNText style={styles.emptyTitle}>Your list is empty</RNText>
            <RNText style={styles.emptyBody}>
              Add custom items below or pull ingredients from a recipe to get started.
            </RNText>
          </View>
        )}

        {/* Grouped sections */}
        {groupedSections.map((section) => (
          <View key={section.key} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionAccent, { backgroundColor: section.accent }]} />
              <RNText style={styles.sectionLabel}>{section.label.toUpperCase()}</RNText>
            </View>
            <View style={styles.sectionItems}>
              {section.items.map((item) => (
                <ShoppingItemRow
                  key={item.id}
                  name={item.item}
                  quantity={formatQuantity(item)}
                  category={section.key}
                  sourceRecipe={item.recipe_id ?? undefined}
                  checked={false}
                  onToggle={() => handleToggleItem(item.id)}
                />
              ))}
            </View>
          </View>
        ))}

        {/* Completed section */}
        {checked.length > 0 && (
          <View style={[styles.section, styles.completedSection]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderRow}>
                <View
                  style={[styles.sectionAccent, { backgroundColor: RECIPES_SURFACES.highest }]}
                />
                <RNText style={styles.sectionLabel}>COMPLETED</RNText>
              </View>
              <RNText style={styles.completedCount}>
                {checked.length} ITEM{checked.length === 1 ? '' : 'S'}
              </RNText>
            </View>
            <View style={styles.sectionItems}>
              {checked.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleToggleItem(item.id)}
                  onLongPress={() => {
                    Alert.alert('Delete Item', `Remove "${item.item}"?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          deleteShoppingListItem(db, item.id);
                          reload();
                        },
                      },
                    ]);
                  }}
                  style={styles.completedRow}
                >
                  <View style={styles.completedCheckbox}>
                    <Check size={14} color="#0E0E13" strokeWidth={3} />
                  </View>
                  <View style={styles.completedBody}>
                    <RNText style={styles.completedName} numberOfLines={1}>
                      {item.item}
                    </RNText>
                    {formatQuantity(item).length > 0 && (
                      <RNText style={styles.completedQty}>
                        Quantity: {formatQuantity(item)}
                      </RNText>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Complete shopping CTA */}
        {items.length > 0 && (
          <Pressable
            onPress={handleComplete}
            style={({ pressed }) => [styles.completeCta, pressed && styles.pressed]}
          >
            <RNText style={styles.completeCtaText}>Complete Shopping Trip</RNText>
          </Pressable>
        )}
      </ScrollView>

      {/* Floating add custom item bar */}
      <View style={styles.floatingBar} pointerEvents="box-none">
        <View style={styles.floatingBarInner}>
          <TextInput
            style={styles.floatingInput}
            value={customText}
            onChangeText={setCustomText}
            placeholder="Add custom item (e.g. Flour - 4 cups)"
            placeholderTextColor="rgba(214,195,181,0.5)"
            returnKeyType="done"
            onSubmitEditing={handleAddCustomItem}
          />
          <Pressable
            onPress={handleAddCustomItem}
            style={({ pressed }) => [styles.floatingAddBtn, pressed && styles.pressed]}
          >
            <Plus size={18} color="#4A2600" strokeWidth={3} />
          </Pressable>
        </View>
      </View>

      {/* Recipe picker modal-ish overlay */}
      {showRecipePicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <RNText style={styles.pickerTitle}>Add From Recipe</RNText>
              <Pressable hitSlop={8} onPress={() => setShowRecipePicker(false)}>
                <X size={20} color={colors.text} strokeWidth={2} />
              </Pressable>
            </View>
            <TextInput
              style={styles.pickerSearch}
              value={recipeSearch}
              onChangeText={searchRecipes}
              placeholder="Search recipes..."
              placeholderTextColor="rgba(214,195,181,0.5)"
            />
            <FlatList
              data={recipeResults}
              keyExtractor={(item) => item.id}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <View style={styles.pickerRow}>
                  <View style={styles.flex1}>
                    <RNText style={styles.pickerRowTitle} numberOfLines={1}>
                      {item.title}
                    </RNText>
                    {item.servings ? (
                      <RNText style={styles.pickerRowSub}>{item.servings} servings</RNText>
                    ) : null}
                  </View>
                  <View style={styles.multiplierRow}>
                    {[1, 2, 3].map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => handleAddRecipe(item, m)}
                        style={styles.multiplierBtn}
                      >
                        <RNText style={styles.multiplierText}>{m}x</RNText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <RNText style={styles.pickerEmpty}>No recipes found.</RNText>
              }
            />
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 200,
  },
  pressed: {
    opacity: 0.7,
  },
  flex1: {
    flex: 1,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  title: {
    ...RECIPES_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  subtitle: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    letterSpacing: 0.1 * 12,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(201, 137, 77, 0.12)',
  },
  clearText: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    color: RECIPES_SECONDARY,
    fontSize: 11,
    letterSpacing: 0.12 * 11,
  },
  // Recipe strip
  recipeStrip: {
    marginBottom: 24,
    gap: 10,
  },
  recipeStripLabel: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    fontSize: 11,
  },
  recipeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recipeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.lift,
  },
  recipeChipText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.text,
  },
  recipeAddChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.10)',
  },
  recipeAddChipFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(34, 197, 94, 0.10)',
  },
  recipeAddChipText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: RECIPES_ACCENT,
  },
  // Empty state
  emptyState: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 18,
    marginBottom: 24,
  },
  emptyTitle: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    color: colors.text,
    fontSize: 18,
  },
  emptyBody: {
    ...RECIPES_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  // Section
  section: {
    marginBottom: 28,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionAccent: {
    width: 4,
    height: 22,
    borderRadius: 2,
  },
  sectionLabel: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    fontSize: 12,
    letterSpacing: 0.18 * 12,
  },
  sectionItems: {
    gap: 8,
  },
  // Completed
  completedSection: {
    opacity: 0.55,
  },
  completedCount: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    fontSize: 11,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: RECIPES_SURFACES.depth,
  },
  completedCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: RECIPES_SECONDARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBody: {
    flex: 1,
    gap: 2,
  },
  completedName: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
    textDecorationLine: 'line-through',
  },
  completedQty: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  // Complete CTA
  completeCta: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: RECIPES_SECONDARY,
    alignItems: 'center',
  },
  completeCtaText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: '#2E1600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Floating add bar
  floatingBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    paddingHorizontal: 20,
  },
  floatingBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    paddingLeft: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(53, 52, 58, 0.92)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  floatingInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 6,
  },
  floatingAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: RECIPES_SECONDARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Picker overlay
  pickerOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(14, 14, 19, 0.85)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: RECIPES_SURFACES.lift,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    gap: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerTitle: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    color: colors.text,
    fontSize: 18,
  },
  pickerSearch: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: RECIPES_SURFACES.focus,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.text,
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  pickerRowTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  pickerRowSub: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  multiplierRow: {
    flexDirection: 'row',
    gap: 6,
  },
  multiplierBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  multiplierText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: RECIPES_ACCENT,
  },
  pickerEmpty: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
