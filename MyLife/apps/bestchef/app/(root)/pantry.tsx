import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Barcode,
  Calendar,
  Camera,
  FileText,
  Image as ImageIcon,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react-native';
import {
  JAKARTA_FONTS,
  daysUntilExpiration,
  type GrocerySection,
  type ExpirationStatus,
  type PantryBatchSource,
  type StorageLocation,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useDatabase } from './providers/DatabaseProvider';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from './providers/AppThemeProvider';
import { useI18n } from './i18n/I18nProvider';
import { HealthSummary } from './components/HealthSummary';
import { MediaSlot } from './components/MediaSlot';
import { NutritionPanel } from './components/NutritionPanel';
import {
  addPantryEntry,
  getPantryBatchSections,
  removePantryEntry,
  selectPantryNutritionSource,
  useNextPantryBatchEntry,
  type PantryBatchRow,
  type PantryBatchSection,
} from './data/kitchen';
import { BackArrow } from './components/DirectionalIcons';

const SECTIONS: GrocerySection[] = ['produce', 'dairy', 'meat', 'pantry', 'frozen', 'bakery', 'beverages', 'snacks', 'condiments', 'other'];
const LOCATIONS: StorageLocation[] = ['fridge', 'freezer', 'pantry', 'counter', 'other'];
const SOURCES: PantryBatchSource[] = ['manual', 'grocery_list', 'receipt_ocr', 'barcode_scan', 'food_recognition', 'expiration_ocr', 'import'];
type PantryInventoryFilter =
  | 'all'
  | 'use_next'
  | 'expired'
  | 'today'
  | 'next_3_days'
  | 'next_7_days'
  | 'fresh'
  | 'no_date';
const INVENTORY_FILTERS: Array<{ key: PantryInventoryFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'use_next', label: 'Use Next' },
  { key: 'expired', label: 'Expired' },
  { key: 'today', label: 'Today' },
  { key: 'next_3_days', label: 'Next 3 Days' },
  { key: 'next_7_days', label: 'Next 7 Days' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'no_date', label: 'No Date' },
];
const STATUS_TITLES: Record<ExpirationStatus, string> = {
  expired: 'Expired',
  expiring_soon: 'Expiring Soon',
  fresh: 'Fresh',
  no_date: 'No Date',
};

function parseQuantity(value: string): number | null {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function statusColor(status: ExpirationStatus, tc: ReturnType<typeof useThemeColors>): string {
  if (status === 'expired') return tc.danger;
  if (status === 'expiring_soon') return tc.primaryContainer;
  return tc.accent;
}

function matchesInventoryFilter(row: PantryBatchRow, filter: PantryInventoryFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'use_next') return row.useNext;
  if (filter === 'expired' || filter === 'fresh' || filter === 'no_date') {
    return row.status === filter;
  }

  if (!row.batch.expiration_date) return false;
  const daysLeft = daysUntilExpiration(row.batch.expiration_date);
  if (filter === 'today') return daysLeft === 0;
  if (filter === 'next_3_days') return daysLeft >= 0 && daysLeft <= 3;
  return daysLeft >= 0 && daysLeft <= 7;
}

function mediaKindForBatch(source: PantryBatchSource): 'pantryBatch' | 'receipt' | 'foodPhoto' {
  if (source === 'receipt_ocr') return 'receipt';
  if (source === 'food_recognition' || source === 'expiration_ocr') return 'foodPhoto';
  return 'pantryBatch';
}

function BatchRow({
  row,
  onUseOne,
  onDelete,
  onSelectNutritionSource,
  onViewMedia,
}: {
  row: PantryBatchRow;
  onUseOne: () => void;
  onDelete: () => void;
  onSelectNutritionSource: (nutritionDataId: string) => void;
  onViewMedia: (photos: string[], title: string) => void;
}) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t, tp, formatNumber } = useI18n();
  const { item, batch, status, useNext } = row;
  const batchPhotos = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    const tryAdd = (value: string | null | undefined) => {
      if (!value) return;
      const trimmed = value.trim();
      if (!trimmed) return;
      if (seen.has(trimmed)) return;
      seen.add(trimmed);
      ordered.push(trimmed);
    };
    for (const photo of batch.photos) tryAdd(photo);
    tryAdd(item.photo_path);
    tryAdd(batch.receipt_link);
    return ordered;
  }, [batch.photos, batch.receipt_link, item.photo_path]);
  const hasMedia = batchPhotos.length > 0;
  const [showNutrition, setShowNutrition] = useState(false);
  const daysLeft = batch.expiration_date ? daysUntilExpiration(batch.expiration_date) : 0;
  const expirationLabel = !batch.expiration_date
    ? t('No expiration date')
    : status === 'expired'
      ? tp(Math.abs(daysLeft), 'Expired ({count} day ago)', 'Expired ({count} days ago)', { count: Math.abs(daysLeft) })
      : status === 'expiring_soon'
        ? tp(daysLeft, 'Expiring soon ({count} day left)', 'Expiring soon ({count} days left)', { count: daysLeft })
        : status === 'fresh'
          ? tp(daysLeft, 'Fresh ({count} day left)', 'Fresh ({count} days left)', { count: daysLeft })
          : t('No expiration date');
  const details = [
    batch.lot_code ? `${t('Lot')} ${batch.lot_code}` : null,
    batch.purchase_date ? `${t('Bought')} ${batch.purchase_date}` : null,
    t(batch.source),
    batch.receipt_link ? t('Receipt linked') : null,
    batch.photos.length > 0
      ? tp(batch.photos.length, '1 photo', '{count} photos', { count: formatNumber(batch.photos.length) })
      : null,
  ].filter(Boolean);

  return (
    <View style={[styles.itemCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
      <View style={styles.batchMain}>
        <View style={styles.batchMedia}>
          <MediaSlot
            kind={mediaKindForBatch(batch.source)}
            uri={batch.photos[0] ?? item.photo_path}
            label={item.name}
            meta={batch.source === 'receipt_ocr' ? 'Receipt thumbnail' : batch.source === 'food_recognition' ? 'Food photo crop' : 'Batch photo'}
            compact
            aspectRatio={4 / 3}
            onPress={hasMedia ? () => onViewMedia(batchPhotos, item.name) : undefined}
          />
        </View>
        <View style={styles.batchCopy}>
          <View style={styles.itemTop}>
            <View style={styles.itemTitleWrap}>
              <Text style={[styles.itemName, { color: tc.text }]}>{item.name}</Text>
              <Text style={[styles.itemMeta, { color: tc.textTertiary }]}>
                {[batch.quantity ?? null, batch.unit].filter(Boolean).join(' ') || t('No quantity')}
                {' / '}
                {t(item.storage_location)}
              </Text>
            </View>
            <View style={[styles.sectionPill, { backgroundColor: `${tc.accent}18` }]}>
              <Text style={[styles.sectionPillText, { color: tc.accent }]}>{t(item.grocery_section)}</Text>
            </View>
          </View>
          <Text style={[styles.expirationText, { color: statusColor(status, tc) }]}>
            {batch.expiration_date ? `${expirationLabel} / ${batch.expiration_date}` : expirationLabel}
          </Text>
          {details.length > 0 ? (
            <Text style={[styles.batchDetails, { color: tc.textTertiary }]}>{details.join(' / ')}</Text>
          ) : null}
        </View>
      </View>
      <HealthSummary
        detail={row.nutritionDetail}
        compact
        onPressDetails={() => setShowNutrition((value) => !value)}
      />
      {showNutrition ? (
        <NutritionPanel
          detail={row.nutritionDetail}
          compact
          sourceChoices={row.nutritionSourceChoices}
          onSelectSource={onSelectNutritionSource}
        />
      ) : null}
      <View style={styles.itemActions}>
        <View style={styles.itemActionGroup}>
          {useNext ? (
            <Pressable
              style={({ pressed }) => [
                styles.itemAction,
                { backgroundColor: `${tc.accent}18` },
                pressed && { opacity: 0.78, transform: [{ scale: 0.97 }] },
              ]}
              onPress={onUseOne}
            >
              <Text style={[styles.itemActionText, { color: tc.accent }]}>{t('Use Next')}</Text>
            </Pressable>
          ) : null}
          {hasMedia ? (
            <Pressable
              style={({ pressed }) => [
                styles.itemAction,
                { backgroundColor: `${tc.accent}14` },
                pressed && { opacity: 0.78, transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => onViewMedia(batchPhotos, item.name)}
              accessibilityRole="button"
              accessibilityLabel={t('View receipt')}
            >
              <ImageIcon size={13} color={tc.accent} strokeWidth={2} />
              <Text style={[styles.itemActionText, { color: tc.accent, marginLeft: 6 }]}>{t('View receipt')}</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.deleteAction,
            pressed && { opacity: 0.72, transform: [{ scale: 0.97 }] },
          ]}
          onPress={onDelete}
        >
          <Trash2 size={15} color={tc.danger} strokeWidth={2} />
          <Text style={[styles.deleteActionText, { color: tc.danger }]}>{t('Delete')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function PantryScreen() {
  const db = useDatabase();
  const router = useRouter();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t, formatNumber } = useI18n();
  const [sections, setSections] = useState<PantryBatchSection[]>(() => getPantryBatchSections(db));
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [lotCode, setLotCode] = useState('');
  const [receiptLink, setReceiptLink] = useState('');
  const [photosText, setPhotosText] = useState('');
  const [source, setSource] = useState<PantryBatchSource>('manual');
  const [section, setSection] = useState<GrocerySection>('pantry');
  const [location, setLocation] = useState<StorageLocation>('pantry');
  const [inventoryFilter, setInventoryFilter] = useState<PantryInventoryFilter>('all');
  const [mediaViewer, setMediaViewer] = useState<{ photos: string[]; title: string; index: number } | null>(null);

  const load = useCallback(() => {
    setSections(getPantryBatchSections(db, { search: search.trim() || undefined, sortBy: 'expiration_date', sortDir: 'ASC' }));
  }, [db, search]);

  useFocusEffect(load);

  const filteredSections = useMemo(() => sections.map((entry) => ({
    ...entry,
    rows: entry.rows.filter((row) => matchesInventoryFilter(row, inventoryFilter)),
  })), [sections, inventoryFilter]);
  const visibleSections = useMemo(() => filteredSections.filter((entry) => entry.rows.length > 0), [filteredSections]);
  const batchCount = useMemo(() => filteredSections.reduce((sum, entry) => sum + entry.rows.length, 0), [filteredSections]);
  const hasActiveFilter = search.trim().length > 0 || inventoryFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setInventoryFilter('all');
    setSections(getPantryBatchSections(db, { sortBy: 'expiration_date', sortDir: 'ASC' }));
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    const photos = photosText
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);
    addPantryEntry(db, {
      name: name.trim(),
      quantity: parseQuantity(quantity),
      unit: unit.trim() || null,
      storage_location: location,
      grocery_section: section,
      expiration_date: expirationDate.trim() || null,
      purchase_date: purchaseDate.trim() || null,
      lot_code: lotCode.trim() || null,
      batch_source: source,
      receipt_link: receiptLink.trim() || null,
      photos,
    });
    setName('');
    setQuantity('');
    setUnit('');
    setExpirationDate('');
    setPurchaseDate('');
    setLotCode('');
    setReceiptLink('');
    setPhotosText('');
    load();
  };

  const handleUseNext = (row: PantryBatchRow) => {
    useNextPantryBatchEntry(db, row.item.id, 1);
    load();
  };

  const handleSelectNutritionSource = (row: PantryBatchRow, nutritionDataId: string) => {
    const choice = row.nutritionSourceChoices.find((entry) => entry.nutritionDataId === nutritionDataId);
    if (!choice) return;
    Alert.alert(
      t('Use nutrition source?'),
      t('This updates {itemName} nutrition details to {sourceLabel}.', {
        itemName: row.item.name,
        sourceLabel: choice.display.label,
      }),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Use Source'),
          onPress: () => {
            selectPantryNutritionSource(db, row.item.id, nutritionDataId);
            load();
          },
        },
      ],
    );
  };

  const handleViewMedia = (photos: string[], title: string) => {
    if (photos.length === 0) return;
    setMediaViewer({ photos, title, index: 0 });
  };

  const handleDelete = (row: PantryBatchRow) => {
    const item = row.item;
    Alert.alert(
      t('Delete pantry item?'),
      t('This removes {itemName} from your pantry.', { itemName: item.name }),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: () => {
            removePantryEntry(db, item.id);
            load();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={styles.topBar}>
        <Pressable
          style={({ pressed }) => [styles.topIconButton, pressed && { opacity: 0.68, transform: [{ scale: 0.96 }] }]}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('Back')}
        >
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Pantry')}</Text>
        <Pressable
          style={({ pressed }) => [styles.topIconButton, pressed && { opacity: 0.68, transform: [{ scale: 0.96 }] }]}
          onPress={() => router.push('/kitchen-receipt')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('Import receipt')}
        >
          <FileText size={22} color={tc.accent} strokeWidth={2} />
        </Pressable>
        </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.captureRow}>
          <Pressable
            style={({ pressed }) => [
              styles.captureButton,
              { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
              pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => router.push('/kitchen-receipt')}
          >
            <FileText size={17} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.captureText, { color: tc.accent }]}>{t('Receipt')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.captureButton,
              { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
              pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => router.push('/kitchen-photo')}
          >
            <Camera size={17} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.captureText, { color: tc.accent }]}>{t('Grocery Photo')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.captureButton,
              { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
              pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => router.push('/expiration-photo')}
          >
            <Calendar size={17} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.captureText, { color: tc.accent }]}>{t('Expiration')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.captureButton,
              { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
              pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => router.push('/kitchen-barcode')}
            accessibilityRole="button"
            accessibilityLabel={t('kitchen_scan_barcode')}
          >
            <Barcode size={17} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.captureText, { color: tc.accent }]}>{t('kitchen_scan_barcode')}</Text>
          </Pressable>
        </View>

        <View style={[styles.searchBar, { backgroundColor: tc.surface }]}>
          <Search size={18} color={tc.textSecondary} strokeWidth={2} />
          <TextInput
            style={[styles.searchInput, { color: tc.text }]}
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              setSections(getPantryBatchSections(db, { search: value.trim() || undefined, sortBy: 'expiration_date', sortDir: 'ASC' }));
            }}
            placeholder={t('Search pantry')}
            placeholderTextColor={tc.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {INVENTORY_FILTERS.map((value) => (
            <Pressable
              key={value.key}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: tc.surface },
                inventoryFilter === value.key && { backgroundColor: `${tc.accent}24` },
                pressed && { opacity: 0.76, transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => setInventoryFilter(value.key)}
            >
              <Text style={[styles.chipText, { color: inventoryFilter === value.key ? tc.accent : tc.textSecondary }]}>
                {t(value.label)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={[styles.formCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <View style={styles.formHeader}>
            <Package size={18} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.formTitle, { color: tc.text }]}>{t('Add Pantry Item')}</Text>
          </View>
          <TextInput style={[styles.input, { color: tc.text, backgroundColor: tc.surface }]} value={name} onChangeText={setName} placeholder={t('Item name')} placeholderTextColor={tc.textTertiary} />
          <View style={styles.inlineInputs}>
            <TextInput style={[styles.input, styles.inlineInput, { color: tc.text, backgroundColor: tc.surface }]} value={quantity} onChangeText={setQuantity} placeholder={t('Qty')} placeholderTextColor={tc.textTertiary} keyboardType="decimal-pad" />
            <TextInput style={[styles.input, styles.inlineInput, { color: tc.text, backgroundColor: tc.surface }]} value={unit} onChangeText={setUnit} placeholder={t('Unit')} placeholderTextColor={tc.textTertiary} />
          </View>
          <TextInput style={[styles.input, { color: tc.text, backgroundColor: tc.surface }]} value={expirationDate} onChangeText={setExpirationDate} placeholder={t('Expiration YYYY-MM-DD')} placeholderTextColor={tc.textTertiary} />
          <View style={styles.inlineInputs}>
            <TextInput style={[styles.input, styles.inlineInput, { color: tc.text, backgroundColor: tc.surface }]} value={purchaseDate} onChangeText={setPurchaseDate} placeholder={t('Purchase YYYY-MM-DD')} placeholderTextColor={tc.textTertiary} />
            <TextInput style={[styles.input, styles.inlineInput, { color: tc.text, backgroundColor: tc.surface }]} value={lotCode} onChangeText={setLotCode} placeholder={t('Lot')} placeholderTextColor={tc.textTertiary} />
          </View>
          <TextInput style={[styles.input, { color: tc.text, backgroundColor: tc.surface }]} value={receiptLink} onChangeText={setReceiptLink} placeholder={t('Receipt link')} placeholderTextColor={tc.textTertiary} autoCapitalize="none" />
          <TextInput style={[styles.input, { color: tc.text, backgroundColor: tc.surface }]} value={photosText} onChangeText={setPhotosText} placeholder={t('Photo URIs, comma separated')} placeholderTextColor={tc.textTertiary} autoCapitalize="none" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {SOURCES.map((value) => (
              <Pressable
                key={value}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: tc.surface },
                  source === value && { backgroundColor: `${tc.accent}24` },
                  pressed && { opacity: 0.76, transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => setSource(value)}
              >
                <Text style={[styles.chipText, { color: source === value ? tc.accent : tc.textSecondary }]}>{t(value)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {SECTIONS.map((value) => (
              <Pressable
                key={value}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: tc.surface },
                  section === value && { backgroundColor: `${tc.accent}24` },
                  pressed && { opacity: 0.76, transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => setSection(value)}
              >
                <Text style={[styles.chipText, { color: section === value ? tc.accent : tc.textSecondary }]}>{t(value)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {LOCATIONS.map((value) => (
              <Pressable
                key={value}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: tc.surface },
                  location === value && { backgroundColor: `${tc.accent}24` },
                  pressed && { opacity: 0.76, transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => setLocation(value)}
              >
                <Text style={[styles.chipText, { color: location === value ? tc.accent : tc.textSecondary }]}>{t(value)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: tc.accent },
              !name.trim() && { opacity: 0.45 },
              pressed && name.trim() && { opacity: 0.82, transform: [{ scale: 0.98 }] },
            ]}
            disabled={!name.trim()}
            onPress={handleAdd}
          >
            <Plus size={18} color={tc.background} strokeWidth={2.5} />
            <Text style={[styles.addButtonText, { color: tc.background }]}>{t('Add Item')}</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionHeaderTitle, { color: tc.text }]}>{t('Inventory')}</Text>
          <Text style={[styles.sectionHeaderCount, { color: tc.textTertiary }]}>{formatNumber(batchCount)}</Text>
        </View>

        {batchCount === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <Package size={28} color={tc.textTertiary} strokeWidth={1.6} />
            <Text style={[styles.emptyTitle, { color: tc.text }]}>
              {hasActiveFilter ? t('No pantry matches') : t('No pantry items yet')}
            </Text>
            <Text style={[styles.emptyBody, { color: tc.textSecondary }]}>
              {hasActiveFilter
                ? t('Clear filters, import food, or open grocery lists to restock what is missing.')
                : t('Add what you already have, import a receipt, or build a grocery list from recipes.')}
            </Text>
            <View style={styles.emptyActions}>
              {hasActiveFilter ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.emptyButton,
                    { backgroundColor: tc.accent },
                    pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={clearFilters}
                >
                  <Text style={[styles.emptyButtonText, { color: tc.background }]}>{t('Clear Filters')}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.emptyButton,
                    { backgroundColor: tc.accent },
                    pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() => router.push('/kitchen-receipt')}
                >
                  <Text style={[styles.emptyButtonText, { color: tc.background }]}>{t('Import Receipt')}</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.emptyButtonSecondary,
                  { backgroundColor: tc.surface },
                  pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => router.push('/grocery')}
              >
                <Text style={[styles.emptyButtonSecondaryText, { color: tc.accent }]}>{t('Grocery Lists')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.emptyButtonSecondary,
                  { backgroundColor: tc.surface },
                  pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => router.push('/recipes/new')}
              >
                <Text style={[styles.emptyButtonSecondaryText, { color: tc.accent }]}>{t('Create Recipe')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          visibleSections.map((group) => (
            <View key={group.status} style={styles.group}>
              <Text style={[styles.groupTitle, { color: tc.text }]}>
                {t(STATUS_TITLES[group.status])} <Text style={{ color: tc.textTertiary }}>({group.rows.length})</Text>
              </Text>
              {group.rows.map((row) => (
                <BatchRow
                  key={row.batch.id}
                  row={row}
                  onUseOne={() => handleUseNext(row)}
                  onDelete={() => handleDelete(row)}
                  onSelectNutritionSource={(nutritionDataId) => handleSelectNutritionSource(row, nutritionDataId)}
                  onViewMedia={handleViewMedia}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
      <MediaCarouselModal
        visible={mediaViewer !== null}
        photos={mediaViewer?.photos ?? []}
        title={mediaViewer?.title ?? ''}
        initialIndex={mediaViewer?.index ?? 0}
        onClose={() => setMediaViewer(null)}
      />
    </View>
  );
}

function MediaCarouselModal({
  visible,
  photos,
  title,
  initialIndex,
  onClose,
}: {
  visible: boolean;
  photos: string[];
  title: string;
  initialIndex: number;
  onClose: () => void;
}) {
  const tc = useThemeColors();
  const { t, formatNumber } = useI18n();
  const screenWidth = Dimensions.get('window').width;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[viewerStyles.backdrop, { backgroundColor: 'rgba(0,0,0,0.92)' }]}>
        <View style={viewerStyles.header}>
          <Text style={[viewerStyles.title, { color: tc.text }]} numberOfLines={1}>{title}</Text>
          <Pressable
            style={({ pressed }) => [
              viewerStyles.closeButton,
              { backgroundColor: `${tc.accent}24` },
              pressed && { opacity: 0.78, transform: [{ scale: 0.95 }] },
            ]}
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('Close')}
          >
            <X size={20} color={tc.accent} strokeWidth={2.4} />
          </Pressable>
        </View>
        {photos.length === 0 ? (
          <View style={viewerStyles.empty}>
            <Text style={[viewerStyles.emptyText, { color: tc.textSecondary }]}>{t('Image unavailable')}</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const next = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
              setCurrentIndex(next);
            }}
            contentOffset={{ x: initialIndex * screenWidth, y: 0 }}
          >
            {photos.map((uri, index) => (
              <View key={`${uri}-${index}`} style={[viewerStyles.page, { width: screenWidth }]}>
                {uri.startsWith('http') || uri.startsWith('file') || uri.startsWith('content') || uri.startsWith('asset') ? (
                  <Image source={{ uri }} style={viewerStyles.image} contentFit="contain" />
                ) : (
                  <Text style={[viewerStyles.emptyText, { color: tc.textSecondary }]}>{t('Image unavailable')}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        )}
        {photos.length > 1 ? (
          <View style={viewerStyles.footer}>
            <Text style={[viewerStyles.counter, { color: tc.textSecondary }]}>
              {formatNumber(currentIndex + 1)} / {formatNumber(photos.length)}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const viewerStyles = StyleSheet.create({
  backdrop: { flex: 1 },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontFamily: JAKARTA_FONTS.extraBold, fontSize: 16 },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  footer: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  counter: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { minHeight: 92, paddingTop: 52, paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topIconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  content: { paddingHorizontal: 24, paddingBottom: 48, gap: 16 },
  captureRow: { flexDirection: 'row', gap: 8 },
  captureButton: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 8 },
  captureText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, fontFamily: JAKARTA_FONTS.regular, fontSize: 15, padding: 0 },
  formCard: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 12 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  formTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 16 },
  input: { borderRadius: 13, paddingHorizontal: 12, paddingVertical: 11, fontFamily: JAKARTA_FONTS.medium, fontSize: 14 },
  inlineInputs: { flexDirection: 'row', gap: 10 },
  inlineInput: { flex: 1 },
  chipRow: { gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11, textTransform: 'capitalize' },
  addButton: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  addButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeaderTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  sectionHeaderCount: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  emptyState: { borderWidth: 1, borderRadius: 18, padding: 22, alignItems: 'center', gap: 12 },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  emptyBody: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyActions: { width: '100%', gap: 8 },
  emptyButton: { minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  emptyButtonSecondary: { minHeight: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  emptyButtonText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 13 },
  emptyButtonSecondaryText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  group: { gap: 10 },
  groupTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 15, textTransform: 'capitalize' },
  itemCard: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  batchMain: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  batchMedia: { width: 94 },
  batchCopy: { flex: 1, gap: 6 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  itemTitleWrap: { flex: 1, gap: 4 },
  itemName: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  itemMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, textTransform: 'capitalize' },
  sectionPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  sectionPillText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, textTransform: 'capitalize' },
  expirationText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11 },
  batchDetails: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, lineHeight: 16 },
  itemActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  itemActionGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 1 },
  itemAction: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' },
  itemActionText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  deleteAction: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
  deleteActionText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
});
