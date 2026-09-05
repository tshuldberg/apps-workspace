'use client';

import { Suspense, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchProviderAvailability, buildDeliveryCart } from './order-actions';

// ── Design tokens ─────────────────────────────────────────────────────

const C = {
  bg: '#131318',
  surfaceLow: '#1B1B20',
  surface: '#1F1F25',
  surfaceHigh: '#2A292F',
  surfaceHighest: '#35343A',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  accent: '#FFB877',
  accentContainer: '#C9894D',
  accentOnPrimary: '#4B2700',
  glass: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.06)',
  green: '#22C55E',
  danger: '#FFB4AB',
  outlineVariant: '#52443A',
} as const;

type GroceryProvider = 'instacart' | 'amazon_fresh' | 'walmart';

interface ProviderInfo {
  id: GroceryProvider;
  name: string;
  color: string;
}

const PROVIDERS: ProviderInfo[] = [
  { id: 'instacart', name: 'Instacart', color: '#43B02A' },
  { id: 'amazon_fresh', name: 'Amazon Fresh', color: '#FF9900' },
  { id: 'walmart', name: 'Walmart', color: '#0071CE' },
];

interface CartItemDisplay {
  ingredientName: string;
  quantity: number;
  unit: string;
  matchedProduct: {
    productName: string;
    price: number | null;
  } | null;
  inPantry: boolean;
}

interface CartDisplay {
  provider: GroceryProvider;
  items: CartItemDisplay[];
  estimatedTotal: number | null;
  checkoutUrl: string;
}

// ── Component ─────────────────────────────────────────────────────────

function OrderIngredientsPageContent() {
  const searchParams = useSearchParams();
  const recipeId = searchParams.get('recipeId') ?? '';

  const [zipCode, setZipCode] = useState('');
  const [checkingZip, setCheckingZip] = useState(false);
  const [availability, setAvailability] = useState<Record<GroceryProvider, boolean>>({
    instacart: true,
    amazon_fresh: true,
    walmart: true,
  });
  const [pantryOnly, setPantryOnly] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<GroceryProvider | null>(null);
  const [cart, setCart] = useState<CartDisplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckZip = useCallback(async () => {
    if (zipCode.length < 5) return;
    setCheckingZip(true);
    try {
      const results = await fetchProviderAvailability(zipCode);
      const map: Record<GroceryProvider, boolean> = {
        instacart: true,
        amazon_fresh: true,
        walmart: true,
      };
      for (const r of results) {
        map[r.provider as GroceryProvider] = r.available;
      }
      setAvailability(map);
    } catch {
      setError('Could not check availability');
    } finally {
      setCheckingZip(false);
    }
  }, [zipCode]);

  const handleSelectProvider = useCallback(
    async (provider: GroceryProvider) => {
      if (!recipeId) {
        setError('No recipe selected');
        return;
      }
      setSelectedProvider(provider);
      setLoading(true);
      setError(null);
      try {
        const result = await buildDeliveryCart(recipeId, provider, {
          subtractPantry: pantryOnly,
          zipCode: zipCode || undefined,
        });
        if (result) {
          setCart(result as CartDisplay);
        } else {
          setError('Failed to build cart');
        }
      } catch {
        setError('Failed to build cart');
      } finally {
        setLoading(false);
      }
    },
    [recipeId, pantryOnly, zipCode],
  );

  const needItems = cart?.items.filter((i) => !i.inPantry) ?? [];
  const matchedCount = needItems.filter((i) => i.matchedProduct !== null).length;
  const providerInfo = PROVIDERS.find((p) => p.id === selectedProvider);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.text,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 32px 120px' }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: C.accentContainer,
              textTransform: 'uppercase',
              margin: '0 0 8px',
            }}
          >
            Grocery Delivery
          </p>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
            Order Ingredients
          </h1>
        </div>

        {!cart ? (
          <>
            {/* Zip code */}
            <section style={{ marginBottom: 36 }}>
              <h3
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: C.textSecondary,
                  margin: '0 0 16px',
                }}
              >
                Delivery Zip Code
              </h3>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="Enter zip code"
                  style={{
                    flex: 1,
                    background: C.surfaceHigh,
                    border: 'none',
                    borderRadius: 14,
                    padding: '14px 16px',
                    fontSize: 15,
                    color: C.text,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleCheckZip}
                  disabled={zipCode.length < 5 || checkingZip}
                  style={{
                    background: C.accent,
                    color: C.accentOnPrimary,
                    border: 'none',
                    borderRadius: 14,
                    padding: '14px 24px',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: zipCode.length < 5 ? 'not-allowed' : 'pointer',
                    opacity: zipCode.length < 5 ? 0.4 : 1,
                  }}
                >
                  {checkingZip ? 'Checking...' : 'Check'}
                </button>
              </div>
            </section>

            {/* Pantry toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: C.surfaceHigh,
                borderRadius: 16,
                padding: 20,
                marginBottom: 36,
              }}
            >
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Missing items only</p>
                <p style={{ fontSize: 12, color: C.textSecondary, margin: '4px 0 0' }}>
                  Subtract items already in your pantry
                </p>
              </div>
              <button
                onClick={() => setPantryOnly(!pantryOnly)}
                style={{
                  width: 48,
                  height: 28,
                  borderRadius: 9999,
                  border: 'none',
                  background: pantryOnly ? C.accent : C.surfaceHighest,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 0.2s',
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 9999,
                    background: '#fff',
                    position: 'absolute',
                    top: 4,
                    left: pantryOnly ? 24 : 4,
                    transition: 'left 0.2s',
                  }}
                />
              </button>
            </div>

            {/* Provider cards */}
            <section>
              <h3
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: C.textSecondary,
                  margin: '0 0 16px',
                }}
              >
                Select Provider
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {PROVIDERS.map((p) => {
                  const isAvailable = availability[p.id];
                  return (
                    <button
                      key={p.id}
                      onClick={() => isAvailable && handleSelectProvider(p.id)}
                      disabled={!isAvailable}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        background: C.surfaceLow,
                        border: 'none',
                        borderRadius: 16,
                        padding: 20,
                        cursor: isAvailable ? 'pointer' : 'not-allowed',
                        opacity: isAvailable ? 1 : 0.4,
                        transition: 'background 0.15s',
                        textAlign: 'left',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => {
                        if (isAvailable) e.currentTarget.style.background = C.surfaceHigh;
                      }}
                      onMouseLeave={(e) => {
                        if (isAvailable) e.currentTarget.style.background = C.surfaceLow;
                      }}
                    >
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: p.color,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>
                          {p.name}
                        </p>
                        {!isAvailable && (
                          <p style={{ fontSize: 12, color: C.danger, margin: '4px 0 0' }}>
                            Not available in {zipCode}
                          </p>
                        )}
                      </div>
                      <span style={{ fontSize: 24, color: C.textSecondary, fontWeight: 300 }}>
                        &rsaquo;
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <>
            {/* Back button */}
            <button
              onClick={() => {
                setCart(null);
                setSelectedProvider(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: C.accent,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                marginBottom: 24,
              }}
            >
              &lsaquo; Change Provider
            </button>

            {/* Cart header */}
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
                {providerInfo?.name ?? 'Cart'}
              </h2>
              <p style={{ fontSize: 14, color: C.textSecondary, margin: '4px 0 0' }}>
                {matchedCount} of {needItems.length} items matched
              </p>
            </div>

            {/* Cart items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 36 }}>
              {cart.items.map((item, idx) => (
                <div
                  key={`${item.ingredientName}_${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 16,
                    borderRadius: 14,
                    background: C.surfaceLow,
                    opacity: item.inPantry ? 0.5 : 1,
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        margin: 0,
                        textDecoration: item.inPantry ? 'line-through' : 'none',
                      }}
                    >
                      {item.ingredientName}
                    </p>
                    <p style={{ fontSize: 12, color: C.textSecondary, margin: '4px 0 0' }}>
                      {item.quantity} {item.unit}
                    </p>
                    {item.matchedProduct ? (
                      <p style={{ fontSize: 12, color: C.accent, margin: '4px 0 0' }}>
                        {item.matchedProduct.productName}
                        {item.matchedProduct.price !== null &&
                          ` - $${item.matchedProduct.price.toFixed(2)}`}
                      </p>
                    ) : !item.inPantry ? (
                      <p style={{ fontSize: 12, color: C.danger, margin: '4px 0 0' }}>
                        No match found
                      </p>
                    ) : null}
                  </div>
                  {item.inPantry && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: C.green,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        background: 'rgba(34,197,94,0.15)',
                        padding: '4px 10px',
                        borderRadius: 8,
                      }}
                    >
                      In Pantry
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Cart summary */}
            <div
              style={{
                padding: 28,
                borderRadius: 24,
                background: C.glass,
                backdropFilter: 'blur(20px)',
                marginBottom: 24,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(135deg, ${C.accent}0D, transparent)`,
                  opacity: 0.5,
                }}
              />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: C.textSecondary,
                    margin: '0 0 16px',
                  }}
                >
                  Cart Summary
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 14, color: C.textSecondary }}>Items to order</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{needItems.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 14, color: C.textSecondary }}>In pantry</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {cart.items.length - needItems.length}
                  </span>
                </div>
                {cart.estimatedTotal !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, color: C.textSecondary }}>Estimated total</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>
                      ${cart.estimatedTotal.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Checkout button */}
            <button
              onClick={() => window.open(cart.checkoutUrl, '_blank')}
              style={{
                width: '100%',
                background: `linear-gradient(135deg, ${C.accent}, ${C.accentContainer})`,
                color: C.accentOnPrimary,
                border: 'none',
                padding: '18px 32px',
                borderRadius: 9999,
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(201,137,77,0.2)',
                transition: 'transform 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Order on {providerInfo?.name ?? 'Provider'}
            </button>
          </>
        )}

        {/* Loading overlay */}
        {loading && (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 0',
              color: C.textSecondary,
            }}
          >
            Building your cart...
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              background: 'rgba(147,0,10,0.2)',
              borderRadius: 12,
              padding: 14,
              marginTop: 20,
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 500, color: C.danger, margin: 0 }}>
              {error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrderIngredientsPage() {
  return (
    <Suspense fallback={null}>
      <OrderIngredientsPageContent />
    </Suspense>
  );
}
