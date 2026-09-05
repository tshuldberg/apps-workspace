import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getIngredients,
  getPantryItems,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  buildCart,
  checkProviderAvailability,
  getProviderConfig,
  PROVIDER_CONFIGS,
  type Ingredient,
  type PantryItem,
  type CartItem,
  type DeliveryCart,
  type GroceryProvider,
  type ProviderAvailability,
} from '@mylife/bestchef';
import { GlassCard } from '@mylife/bestchef/ui';
import { Text, colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

// ── Types ──────────────────────────────────────────────────────────────

type ScreenState = 'provider' | 'cart';

// ── Screen ─────────────────────────────────────────────────────────────

export default function OrderIngredientsScreen() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const router = useRouter();
  const db = useDatabase();

  const [state, setState] = useState<ScreenState>('provider');
  const [selectedProvider, setSelectedProvider] = useState<GroceryProvider | null>(null);
  const [zipCode, setZipCode] = useState('');
  const [availability, setAvailability] = useState<ProviderAvailability[]>([]);
  const [checkingZip, setCheckingZip] = useState(false);
  const [pantryOnly, setPantryOnly] = useState(true);
  const [cart, setCart] = useState<DeliveryCart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Check zip availability ──────────────────────────────────────────

  const handleCheckZip = useCallback(async () => {
    if (zipCode.length < 5) return;
    setCheckingZip(true);
    try {
      const results = await checkProviderAvailability(zipCode);
      setAvailability(results);
    } catch {
      setError('Could not check availability');
    } finally {
      setCheckingZip(false);
    }
  }, [zipCode]);

  // ── Build cart ──────────────────────────────────────────────────────

  const handleSelectProvider = useCallback(
    async (provider: GroceryProvider) => {
      if (!recipeId || !db) return;
      setSelectedProvider(provider);
      setLoading(true);
      setError(null);
      setState('cart');

      try {
        const ingredients = await getIngredients(db, recipeId);
        const pantryItems = pantryOnly ? await getPantryItems(db) : [];

        const ingredientInputs = ingredients.map((ing: Ingredient) => ({
          name: ing.item ?? ing.name,
          quantity: ing.quantity_value ?? 1,
          unit: ing.unit ?? '',
        }));

        const result = await buildCart(provider, ingredientInputs, {
          subtractPantry: pantryItems as PantryItem[],
          zipCode: zipCode || undefined,
        });
        setCart(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to build cart');
      } finally {
        setLoading(false);
      }
    },
    [recipeId, db, pantryOnly, zipCode],
  );

  // ── Open checkout ───────────────────────────────────────────────────

  const handleCheckout = useCallback(() => {
    if (!cart?.checkoutUrl) return;
    Linking.openURL(cart.checkoutUrl);
  }, [cart]);

  // ── Cart stats ──────────────────────────────────────────────────────

  const cartItems = cart?.items ?? [];
  const needItems = cartItems.filter((i) => !i.inPantry);
  const matchedCount = needItems.filter((i) => i.matchedProduct !== null).length;

  // ── Provider selector ───────────────────────────────────────────────

  if (state === 'provider') {
    const providers: GroceryProvider[] = ['instacart', 'amazon_fresh', 'walmart'];
    return (
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Order Ingredients</Text>
            <Text style={styles.subtitle}>
              Choose a delivery provider to order recipe ingredients
            </Text>
          </View>

          {/* Zip code input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Zip Code</Text>
            <View style={styles.zipRow}>
              <TextInput
                style={styles.zipInput}
                value={zipCode}
                onChangeText={setZipCode}
                placeholder="Enter zip code"
                placeholderTextColor={RECIPES_SECONDARY}
                keyboardType="number-pad"
                maxLength={5}
              />
              <Pressable
                style={[
                  styles.zipButton,
                  zipCode.length < 5 && styles.zipButtonDisabled,
                ]}
                onPress={handleCheckZip}
                disabled={zipCode.length < 5 || checkingZip}
              >
                {checkingZip ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={styles.zipButtonText}>Check</Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* Pantry toggle */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Missing items only</Text>
              <Text style={styles.toggleSub}>
                Subtract items already in your pantry
              </Text>
            </View>
            <Switch
              value={pantryOnly}
              onValueChange={setPantryOnly}
              trackColor={{ true: RECIPES_ACCENT, false: RECIPES_SURFACES.focus }}
              thumbColor={colors.text}
            />
          </View>

          {/* Provider cards */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Provider</Text>
            {providers.map((p) => {
              const config = getProviderConfig(p);
              const avail = availability.find((a) => a.provider === p);
              const isAvailable = !avail || avail.available;
              return (
                <Pressable
                  key={p}
                  style={[
                    styles.providerCard,
                    !isAvailable && styles.providerCardDisabled,
                  ]}
                  onPress={() => isAvailable && handleSelectProvider(p)}
                  disabled={!isAvailable}
                >
                  <View
                    style={[
                      styles.providerDot,
                      { backgroundColor: config.color },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.providerName}>{config.name}</Text>
                    {!isAvailable && (
                      <Text style={styles.providerUnavailable}>
                        Not available in {zipCode}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.providerArrow}>&rsaquo;</Text>
                </Pressable>
              );
            })}
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Cart view ───────────────────────────────────────────────────────

  const providerConfig = selectedProvider
    ? getProviderConfig(selectedProvider)
    : null;

  return (
    <View style={styles.screen}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RECIPES_ACCENT} />
          <Text style={styles.loadingText}>Building your cart...</Text>
        </View>
      ) : (
        <FlatList
          data={cartItems}
          keyExtractor={(item, idx) => `${item.ingredientName}_${idx}`}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View>
              <View style={styles.header}>
                <Pressable onPress={() => setState('provider')}>
                  <Text style={styles.backText}>&lsaquo; Change Provider</Text>
                </Pressable>
                <Text style={styles.title}>
                  {providerConfig?.name ?? 'Cart'}
                </Text>
                <Text style={styles.subtitle}>
                  {matchedCount} of {needItems.length} items matched
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.cartItem,
                item.inPantry && styles.cartItemPantry,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.cartItemName,
                    item.inPantry && styles.cartItemStrikethrough,
                  ]}
                >
                  {item.ingredientName}
                </Text>
                <Text style={styles.cartItemDetail}>
                  {item.quantity} {item.unit}
                </Text>
                {item.matchedProduct ? (
                  <Text style={styles.cartItemMatch}>
                    {item.matchedProduct.productName}
                    {item.matchedProduct.price !== null &&
                      ` - $${item.matchedProduct.price.toFixed(2)}`}
                  </Text>
                ) : !item.inPantry ? (
                  <Text style={styles.cartItemNoMatch}>No match found</Text>
                ) : null}
              </View>
              {item.inPantry && (
                <View style={styles.pantryBadge}>
                  <Text style={styles.pantryBadgeText}>In Pantry</Text>
                </View>
              )}
            </View>
          )}
          ListFooterComponent={
            <View style={styles.footer}>
              {/* Cart summary */}
              <GlassCard style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Cart Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>Items to order</Text>
                  <Text style={styles.summaryValue}>{needItems.length}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>In pantry</Text>
                  <Text style={styles.summaryValue}>
                    {cartItems.length - needItems.length}
                  </Text>
                </View>
                {cart?.estimatedTotal !== null &&
                  cart?.estimatedTotal !== undefined && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryKey}>Estimated total</Text>
                      <Text style={styles.summaryValueAccent}>
                        ${cart.estimatedTotal.toFixed(2)}
                      </Text>
                    </View>
                  )}
              </GlassCard>

              {/* Checkout button */}
              <Pressable style={styles.checkoutButton} onPress={handleCheckout}>
                <Text style={styles.checkoutText}>
                  Order on {providerConfig?.name ?? 'Provider'}
                </Text>
              </Pressable>

              {error && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontFamily: JAKARTA_FONTS.bold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: JAKARTA_FONTS.regular,
    color: RECIPES_SECONDARY,
    marginTop: 4,
  },
  backText: {
    fontSize: 14,
    fontFamily: JAKARTA_FONTS.semiBold,
    color: RECIPES_ACCENT,
    marginBottom: 12,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: JAKARTA_FONTS.bold,
    color: RECIPES_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  zipRow: {
    flexDirection: 'row',
    gap: 12,
  },
  zipInput: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.focus,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: JAKARTA_FONTS.medium,
    color: colors.text,
  },
  zipButton: {
    backgroundColor: RECIPES_ACCENT,
    borderRadius: 14,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zipButtonDisabled: {
    opacity: 0.4,
  },
  zipButtonText: {
    fontSize: 14,
    fontFamily: JAKARTA_FONTS.bold,
    color: colors.background,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RECIPES_SURFACES.focus,
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
  },
  toggleLabel: {
    fontSize: 15,
    fontFamily: JAKARTA_FONTS.semiBold,
    color: colors.text,
  },
  toggleSub: {
    fontSize: 12,
    fontFamily: JAKARTA_FONTS.regular,
    color: RECIPES_SECONDARY,
    marginTop: 2,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RECIPES_SURFACES.focus,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    gap: 16,
  },
  providerCardDisabled: {
    opacity: 0.4,
  },
  providerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  providerName: {
    fontSize: 16,
    fontFamily: JAKARTA_FONTS.semiBold,
    color: colors.text,
  },
  providerUnavailable: {
    fontSize: 12,
    fontFamily: JAKARTA_FONTS.regular,
    color: '#FFB4AB',
    marginTop: 2,
  },
  providerArrow: {
    fontSize: 24,
    color: RECIPES_SECONDARY,
    fontWeight: '300',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: JAKARTA_FONTS.medium,
    color: RECIPES_SECONDARY,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RECIPES_SURFACES.focus,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  cartItemPantry: {
    opacity: 0.5,
  },
  cartItemName: {
    fontSize: 15,
    fontFamily: JAKARTA_FONTS.semiBold,
    color: colors.text,
  },
  cartItemStrikethrough: {
    textDecorationLine: 'line-through',
  },
  cartItemDetail: {
    fontSize: 12,
    fontFamily: JAKARTA_FONTS.regular,
    color: RECIPES_SECONDARY,
    marginTop: 2,
  },
  cartItemMatch: {
    fontSize: 12,
    fontFamily: JAKARTA_FONTS.medium,
    color: RECIPES_ACCENT,
    marginTop: 4,
  },
  cartItemNoMatch: {
    fontSize: 12,
    fontFamily: JAKARTA_FONTS.regular,
    color: '#FFB4AB',
    marginTop: 4,
  },
  pantryBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pantryBadgeText: {
    fontSize: 10,
    fontFamily: JAKARTA_FONTS.bold,
    color: '#22C55E',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  footer: {
    marginTop: 24,
    gap: 20,
  },
  summaryCard: {
    padding: 20,
  },
  summaryLabel: {
    fontSize: 10,
    fontFamily: JAKARTA_FONTS.bold,
    color: RECIPES_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryKey: {
    fontSize: 14,
    fontFamily: JAKARTA_FONTS.regular,
    color: RECIPES_SECONDARY,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: JAKARTA_FONTS.semiBold,
    color: colors.text,
  },
  summaryValueAccent: {
    fontSize: 14,
    fontFamily: JAKARTA_FONTS.bold,
    color: RECIPES_ACCENT,
  },
  checkoutButton: {
    backgroundColor: RECIPES_ACCENT,
    borderRadius: 9999,
    paddingVertical: 18,
    alignItems: 'center',
  },
  checkoutText: {
    fontSize: 16,
    fontFamily: JAKARTA_FONTS.bold,
    color: colors.background,
  },
  errorBanner: {
    backgroundColor: 'rgba(147,0,10,0.2)',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: JAKARTA_FONTS.medium,
    color: '#FFB4AB',
    textAlign: 'center',
  },
});
