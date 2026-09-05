/**
 * Barcode food lookup (P14-C / F-017).
 *
 * Resolves a UPC/EAN barcode against the Open Food Facts public API.
 * Open Food Facts is free, no API key required, and rate-limited to
 * roughly 100 requests / minute per IP. We cache results in a small
 * in-memory LRU so repeated scans of the same item during a session
 * never re-hit the network.
 *
 * Network failures and unknown barcodes fall through to `null` so the
 * caller can prompt the user to enter details manually.
 */

const OPEN_FOOD_FACTS_BASE = 'https://world.openfoodfacts.org/api/v2/product';
const DEFAULT_TIMEOUT_MS = 5000;
const CACHE_CAPACITY = 64;

export interface BarcodeFoodInfo {
  /** The original barcode that matched. */
  barcode: string;
  /** Friendly product name. May fall back to brand + generic name when missing. */
  name: string;
  /** Brand owner. May be empty when none is provided. */
  brand: string | null;
  /** Inferred grocery section (`produce`, `dairy`, `frozen`, ...). */
  category: string | null;
  /** Default unit (e.g. `g`, `ml`). May be null when no quantity is reported. */
  unit: string | null;
  /** Default quantity for the package (e.g. 500 for 500g). May be null. */
  quantity: number | null;
  /** Provenance string for downstream UI. Always `barcode`. */
  provenance: 'barcode';
  /** Free-form labels for downstream UI. */
  labels: string[];
}

export interface BarcodeLookupOptions {
  /** Override the fetch implementation. Used by tests. */
  fetchImpl?: typeof fetch;
  /** Override the request timeout (ms). */
  timeoutMs?: number;
  /** Skip the in-memory cache. Used by tests. */
  bypassCache?: boolean;
}

interface CacheNode {
  key: string;
  value: BarcodeFoodInfo | null;
  prev: CacheNode | null;
  next: CacheNode | null;
}

class LruCache {
  private map = new Map<string, CacheNode>();
  private head: CacheNode | null = null;
  private tail: CacheNode | null = null;
  constructor(private capacity: number) {}

  get(key: string): BarcodeFoodInfo | null | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;
    this.touch(node);
    return node.value;
  }

  set(key: string, value: BarcodeFoodInfo | null): void {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      this.touch(existing);
      return;
    }
    const node: CacheNode = { key, value, prev: null, next: this.head };
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
    this.map.set(key, node);
    if (this.map.size > this.capacity && this.tail) {
      const evict = this.tail;
      this.tail = evict.prev;
      if (this.tail) this.tail.next = null;
      this.map.delete(evict.key);
    }
  }

  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  private touch(node: CacheNode): void {
    if (node === this.head) return;
    // unlink
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.tail) this.tail = node.prev;
    // insert at head
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }
}

const cache = new LruCache(CACHE_CAPACITY);

export function clearBarcodeLookupCache(): void {
  cache.clear();
}

/**
 * Validate a barcode. Accepts UPC-A (12 digits), EAN-13 (13 digits),
 * EAN-8 (8 digits), and UPC-E (8 digits). Strips whitespace.
 */
export function normalizeBarcode(value: string): string | null {
  const cleaned = value.replace(/\s+/g, '');
  if (!/^\d{8}$|^\d{12,13}$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Look up a barcode against Open Food Facts. Returns null when the
 * code is not found, when the network call fails, or when the user
 * interrupts via `AbortSignal`.
 */
export async function lookupBarcode(
  rawBarcode: string,
  options: BarcodeLookupOptions = {},
): Promise<BarcodeFoodInfo | null> {
  const barcode = normalizeBarcode(rawBarcode);
  if (!barcode) return null;

  if (!options.bypassCache) {
    const cached = cache.get(barcode);
    if (cached !== undefined) return cached;
  }

  const result = await fetchProduct(barcode, options);
  if (!options.bypassCache) cache.set(barcode, result);
  return result;
}

async function fetchProduct(
  barcode: string,
  options: BarcodeLookupOptions,
): Promise<BarcodeFoodInfo | null> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') return null;

  const url = `${OPEN_FOOD_FACTS_BASE}/${encodeURIComponent(barcode)}.json?fields=product_name,brands,categories,categories_tags,labels,labels_tags,quantity,product_quantity,product_quantity_unit`;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    : null;

  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as OpenFoodFactsResponse;
    if (!payload || payload.status !== 1 || !payload.product) return null;
    return mapToFoodInfo(barcode, payload.product);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface OpenFoodFactsResponse {
  status: number;
  product?: OpenFoodFactsProduct;
}

interface OpenFoodFactsProduct {
  product_name?: string;
  generic_name?: string;
  brands?: string;
  categories?: string;
  categories_tags?: string[];
  labels?: string;
  labels_tags?: string[];
  quantity?: string;
  product_quantity?: string | number;
  product_quantity_unit?: string;
}

function mapToFoodInfo(barcode: string, product: OpenFoodFactsProduct): BarcodeFoodInfo {
  const name = (product.product_name?.trim() || product.generic_name?.trim() || product.brands?.trim() || '').slice(0, 120);
  const brand = product.brands?.split(',')[0]?.trim() || null;
  const category = inferCategory(product);
  const unit = (product.product_quantity_unit?.trim() || null);
  const quantity = parseQuantity(product.product_quantity);
  const labels = parseLabels(product);

  return {
    barcode,
    name: name || `Barcode ${barcode}`,
    brand,
    category,
    unit,
    quantity,
    provenance: 'barcode',
    labels,
  };
}

function parseQuantity(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  return match ? Number.parseFloat(match[1]) : null;
}

const CATEGORY_KEYWORDS: Array<{ keyword: string; section: string }> = [
  { keyword: 'beverage', section: 'beverages' },
  { keyword: 'drink', section: 'beverages' },
  { keyword: 'dairy', section: 'dairy' },
  { keyword: 'milk', section: 'dairy' },
  { keyword: 'cheese', section: 'dairy' },
  { keyword: 'yogurt', section: 'dairy' },
  { keyword: 'meat', section: 'meat' },
  { keyword: 'poultry', section: 'meat' },
  { keyword: 'seafood', section: 'meat' },
  { keyword: 'fish', section: 'meat' },
  { keyword: 'fruit', section: 'produce' },
  { keyword: 'vegetable', section: 'produce' },
  { keyword: 'produce', section: 'produce' },
  { keyword: 'frozen', section: 'frozen' },
  { keyword: 'ice cream', section: 'frozen' },
  { keyword: 'pasta', section: 'pantry' },
  { keyword: 'rice', section: 'pantry' },
  { keyword: 'bread', section: 'bakery' },
  { keyword: 'bakery', section: 'bakery' },
  { keyword: 'snack', section: 'snacks' },
  { keyword: 'cereal', section: 'pantry' },
  { keyword: 'condiment', section: 'pantry' },
  { keyword: 'sauce', section: 'pantry' },
  { keyword: 'oil', section: 'pantry' },
  { keyword: 'baking', section: 'pantry' },
  { keyword: 'spice', section: 'pantry' },
  { keyword: 'tea', section: 'beverages' },
  { keyword: 'coffee', section: 'beverages' },
];

function inferCategory(product: OpenFoodFactsProduct): string | null {
  const tags = product.categories_tags ?? [];
  const text = (`${product.categories ?? ''} ${tags.join(' ')}`).toLowerCase();
  for (const entry of CATEGORY_KEYWORDS) {
    if (text.includes(entry.keyword)) return entry.section;
  }
  return null;
}

function parseLabels(product: OpenFoodFactsProduct): string[] {
  const sources = [
    product.labels,
    ...(product.labels_tags ?? []),
  ];
  const set = new Set<string>();
  for (const source of sources) {
    if (!source) continue;
    for (const piece of source.split(',')) {
      const value = piece.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ').trim();
      if (value.length > 0) set.add(value);
    }
  }
  return Array.from(set).slice(0, 8);
}
