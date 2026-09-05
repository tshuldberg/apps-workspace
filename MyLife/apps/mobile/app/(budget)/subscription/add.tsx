import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  BG_FONTS,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  calculateNextRenewal,
  createSubscription,
  getPopularEntries,
  listEnvelopes,
  searchCatalog,
  type BillingCycle,
  type CatalogCategory,
  type CatalogEntry,
  type Envelope,
} from '@mylife/budget';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  BudgetActionButton,
  BudgetChip,
  BudgetHeroCard,
  BudgetMetricCard,
  BudgetPhaseHeader,
  BudgetPhaseScreen,
  BudgetProgressBar,
  BudgetSection,
} from '../../../components/budget/BudgetPhase5Kit';
import {
  allCatalogCategories,
  categoryMeta,
  resolveSubscriptionMeta,
} from '../../../components/budget/budgetSubscriptionMeta';
import { uuid } from '../../../lib/uuid';

const BILLING_OPTIONS: Array<{ label: string; value: BillingCycle }> = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Semi Annual', value: 'semi_annual' },
  { label: 'Annual', value: 'annual' },
  { label: 'Weekly', value: 'weekly' },
];

type CategoryFilter = 'all' | CatalogCategory;

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizePriceInput(value: string): string {
  return value.replace(/[^0-9.]/g, '');
}

function parsePriceToCents(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function inferEnvelopeId(
  entry: CatalogEntry | null,
  envelopes: Envelope[],
): string | null {
  if (!entry) {
    return null;
  }

  const candidates: Record<CatalogCategory, string[]> = {
    entertainment: ['entertainment', 'fun', 'media', 'streaming'],
    productivity: ['software', 'apps', 'subscriptions', 'work', 'storage'],
    health: ['health', 'fitness', 'gym', 'wellness'],
    shopping: ['shopping', 'amazon', 'household'],
    news: ['news', 'media', 'reading'],
    finance: ['finance', 'budget', 'tools'],
    utilities: ['utilities', 'internet', 'phone', 'software'],
    other: ['misc', 'other'],
  };

  const names = candidates[entry.category];
  const match = envelopes.find((envelope) =>
    names.some((candidate) => envelope.name.toLowerCase().includes(candidate)),
  );
  return match?.id ?? null;
}

export default function BudgetAddSubscriptionScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedEntry, setSelectedEntry] = useState<CatalogEntry | null>(null);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [startDate, setStartDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [manualCategory, setManualCategory] = useState<CatalogCategory>('other');
  const [providerUrl, setProviderUrl] = useState('');
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      setEnvelopes(listEnvelopes(db, false).filter((envelope) => envelope.archived === 0));
    } catch {
      setEnvelopes([]);
    }
  }, [db]);

  const catalogResults = useMemo(() => {
    const base = searchQuery.trim().length > 0 ? searchCatalog(searchQuery) : getPopularEntries();
    return base
      .filter((entry) => categoryFilter === 'all' || entry.category === categoryFilter)
      .slice(0, 18);
  }, [categoryFilter, searchQuery]);

  const resolvedMeta = useMemo(
    () =>
      resolveSubscriptionMeta({
        catalog_id: selectedEntry?.id ?? null,
        color: null,
        icon: null,
        name: name.trim() || selectedEntry?.name || 'Custom subscription',
        url: providerUrl.trim() || null,
      }),
    [name, providerUrl, selectedEntry],
  );

  const monthlyPreview = useMemo(() => {
    const cents = parsePriceToCents(price);
    if (cents === null) {
      return 0;
    }
    if (billingCycle === 'monthly') return cents;
    if (billingCycle === 'quarterly') return Math.round(cents / 3);
    if (billingCycle === 'semi_annual') return Math.round(cents / 6);
    if (billingCycle === 'annual') return Math.round(cents / 12);
    if (billingCycle === 'weekly') return Math.round((cents * 52) / 12);
    return cents;
  }, [billingCycle, price]);

  const annualPreview = useMemo(() => {
    const cents = parsePriceToCents(price);
    if (cents === null) {
      return 0;
    }
    if (billingCycle === 'monthly') return cents * 12;
    if (billingCycle === 'quarterly') return cents * 4;
    if (billingCycle === 'semi_annual') return cents * 2;
    if (billingCycle === 'annual') return cents;
    if (billingCycle === 'weekly') return cents * 52;
    return cents;
  }, [billingCycle, price]);

  const completionProgress = useMemo(() => {
    const checks = [
      Boolean(name.trim()),
      parsePriceToCents(price) !== null,
      isIsoDate(startDate),
      Boolean(billingCycle),
      true,
    ];
    return checks.filter(Boolean).length / checks.length;
  }, [billingCycle, name, price, startDate]);

  const handleSelectEntry = useCallback(
    (entry: CatalogEntry) => {
      const meta = resolveSubscriptionMeta({
        catalog_id: entry.id,
        color: null,
        icon: null,
        name: entry.name,
        url: null,
      });
      setSelectedEntry(entry);
      setName(entry.name);
      setPrice((entry.defaultPrice / 100).toFixed(2));
      setBillingCycle(entry.billingCycle);
      setManualCategory(entry.category);
      setProviderUrl(meta.url ?? '');
      setSelectedEnvelopeId((current) => current ?? inferEnvelopeId(entry, envelopes));
    },
    [envelopes],
  );

  const handleManualEntry = useCallback(() => {
    setSelectedEntry(null);
    setName('');
    setPrice('');
    setBillingCycle('monthly');
    setNotes('');
    setProviderUrl('');
    setManualCategory('other');
    setSelectedEnvelopeId(null);
  }, []);

  const handleSave = useCallback(() => {
    if (submitting) {
      return;
    }

    const cents = parsePriceToCents(price);
    if (!name.trim()) {
      Alert.alert('Subscription name required', 'Add a name before saving.');
      return;
    }
    if (cents === null) {
      Alert.alert('Valid price required', 'Enter a monthly or recurring cost greater than zero.');
      return;
    }
    if (!isIsoDate(startDate)) {
      Alert.alert('Invalid start date', 'Use the YYYY-MM-DD format.');
      return;
    }

    setSubmitting(true);
    try {
      const nextRenewal = calculateNextRenewal(startDate, billingCycle);
      const meta = resolveSubscriptionMeta({
        catalog_id: selectedEntry?.id ?? null,
        color: null,
        icon: null,
        name: name.trim(),
        url: providerUrl.trim() || null,
      });

      createSubscription(db, uuid(), {
        billing_cycle: billingCycle,
        catalog_id: selectedEntry?.id ?? null,
        color: meta.accentColor,
        envelope_id: selectedEnvelopeId,
        icon: meta.glyph,
        name: name.trim(),
        notes: notes.trim() || null,
        next_renewal: nextRenewal,
        price: cents,
        start_date: startDate,
        status: 'active',
        url: providerUrl.trim() || meta.url,
      });

      router.replace(`/(budget)/subscriptions?refresh=${Date.now()}` as never);
    } catch (error) {
      Alert.alert(
        'Unable to save subscription',
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
      setSubmitting(false);
    }
  }, [
    billingCycle,
    db,
    name,
    notes,
    price,
    providerUrl,
    router,
    selectedEntry,
    selectedEnvelopeId,
    startDate,
    submitting,
  ]);

  const selectedCategory = selectedEntry?.category ?? manualCategory;

  return (
    <BudgetPhaseScreen>
      <BudgetPhaseHeader
        eyebrow="Subscriptions"
        eyebrowIcon="add_circle"
        subtitle="Pick from the catalog or capture a custom bill with the fields budget needs right now."
        title="New Subscription"
      />

      <BudgetHeroCard
        detail={
          selectedEntry
            ? `${resolvedMeta.categoryLabel} catalog match${providerUrl ? ' with provider link' : ''}`
            : 'Manual entry ready for recurring bills, trials, and niche tools'
        }
        subtitle={selectedEntry ? 'Catalog-selected service' : 'Tap a catalog card or complete the form manually'}
        title="Budget-ready setup"
        value={selectedEntry ? selectedEntry.name : 'Manual'}
      />

      <BudgetSection
        action={
          <BudgetActionButton
            icon="edit"
            label="Manual Entry"
            onPress={handleManualEntry}
            quiet
            tone="gold"
          />
        }
        subtitle="Search the 215-entry catalog, then fine-tune the record before saving."
        title="Catalog"
      >
        <View style={styles.inputShell}>
          <Text style={styles.inputLabel}>Search services</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearchQuery}
            placeholder="Netflix, iCloud, YNAB..."
            placeholderTextColor={BG_TEXT_TERTIARY}
            style={styles.input}
            value={searchQuery}
          />
        </View>

        <View style={styles.chipWrap}>
          <BudgetChip
            active={categoryFilter === 'all'}
            label="All"
            onPress={() => setCategoryFilter('all')}
            tone="gold"
          />
          {allCatalogCategories().map((category) => (
            <BudgetChip
              active={categoryFilter === category}
              key={category}
              label={categoryMeta(category).label}
              onPress={() => setCategoryFilter(category)}
              tone={category === 'health' || category === 'finance' ? 'money' : 'info'}
            />
          ))}
        </View>

        <View style={styles.catalogGrid}>
          {catalogResults.map((entry) => {
            const meta = resolveSubscriptionMeta({
              catalog_id: entry.id,
              color: null,
              icon: null,
              name: entry.name,
              url: null,
            });
            const active = selectedEntry?.id === entry.id;
            return (
              <Pressable
                key={entry.id}
                onPress={() => handleSelectEntry(entry)}
                style={[
                  styles.catalogCard,
                  active ? { backgroundColor: `${meta.accentColor}14` } : null,
                ]}
              >
                <View
                  style={[
                    styles.catalogGlyph,
                    { backgroundColor: `${meta.accentColor}18` },
                  ]}
                >
                  <Text style={[styles.catalogGlyphText, { color: meta.accentColor }]}>
                    {meta.glyph}
                  </Text>
                </View>
                <View style={styles.catalogCopy}>
                  <Text numberOfLines={2} style={styles.catalogName}>
                    {entry.name}
                  </Text>
                  <Text style={styles.catalogMeta}>
                    {meta.categoryLabel} · {formatCurrency(entry.defaultPrice)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </BudgetSection>

      <BudgetSection
        subtitle="Everything below is persisted to the current MyBudget subscription schema."
        title="Details"
      >
        <BudgetProgressBar progress={completionProgress} tone="money" />

        <View style={styles.metricRow}>
          <BudgetMetricCard
            caption="Normalized monthly view"
            label="Monthly impact"
            tone="gold"
            value={monthlyPreview > 0 ? formatCurrency(monthlyPreview) : '$0.00'}
          />
          <BudgetMetricCard
            caption="Annualized cost preview"
            label="Annual impact"
            tone="money"
            value={annualPreview > 0 ? formatCurrency(annualPreview) : '$0.00'}
          />
        </View>

        <View style={styles.fieldGrid}>
          <View style={styles.inputShell}>
            <Text style={styles.inputLabel}>Subscription name</Text>
            <TextInput
              onChangeText={setName}
              placeholder="Spotify Premium"
              placeholderTextColor={BG_TEXT_TERTIARY}
              style={styles.input}
              value={name}
            />
          </View>

          <View style={styles.inputShell}>
            <Text style={styles.inputLabel}>Cost</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={(value) => setPrice(normalizePriceInput(value))}
              placeholder="14.99"
              placeholderTextColor={BG_TEXT_TERTIARY}
              style={styles.input}
              value={price}
            />
          </View>
        </View>

        <View style={styles.inputShell}>
          <Text style={styles.inputLabel}>Billing cycle</Text>
          <View style={styles.chipWrap}>
            {BILLING_OPTIONS.map((option) => (
              <BudgetChip
                active={billingCycle === option.value}
                key={option.value}
                label={option.label}
                onPress={() => setBillingCycle(option.value)}
                tone="gold"
              />
            ))}
          </View>
        </View>

        <View style={styles.fieldGrid}>
          <View style={styles.inputShell}>
            <Text style={styles.inputLabel}>Start date</Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setStartDate}
              placeholder="2026-04-07"
              placeholderTextColor={BG_TEXT_TERTIARY}
              style={styles.input}
              value={startDate}
            />
          </View>

          <View style={styles.inputShell}>
            <Text style={styles.inputLabel}>Provider site</Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setProviderUrl}
              placeholder="https://service.example"
              placeholderTextColor={BG_TEXT_TERTIARY}
              style={styles.input}
              value={providerUrl}
            />
          </View>
        </View>

        <View style={styles.inputShell}>
          <Text style={styles.inputLabel}>Category</Text>
          <View style={styles.chipWrap}>
            {allCatalogCategories().map((category) => (
              <BudgetChip
                active={selectedCategory === category}
                key={category}
                label={categoryMeta(category).label}
                onPress={() => {
                  setManualCategory(category);
                  setSelectedEntry((current) =>
                    current ? { ...current, category } : current,
                  );
                }}
                tone={category === 'health' || category === 'finance' ? 'money' : 'info'}
              />
            ))}
          </View>
        </View>

        <View style={styles.inputShell}>
          <Text style={styles.inputLabel}>Linked envelope</Text>
          <View style={styles.chipWrap}>
            <BudgetChip
              active={selectedEnvelopeId === null}
              label="Not linked"
              onPress={() => setSelectedEnvelopeId(null)}
              tone="neutral"
            />
            {envelopes.map((envelope) => (
              <BudgetChip
                active={selectedEnvelopeId === envelope.id}
                key={envelope.id}
                label={envelope.name}
                onPress={() => setSelectedEnvelopeId(envelope.id)}
                tone="money"
              />
            ))}
          </View>
        </View>

        <View style={styles.inputShell}>
          <Text style={styles.inputLabel}>Notes</Text>
          <TextInput
            multiline
            onChangeText={setNotes}
            placeholder="Family plan, employer reimbursed, annual discount..."
            placeholderTextColor={BG_TEXT_TERTIARY}
            style={[styles.input, styles.notesInput]}
            textAlignVertical="top"
            value={notes}
          />
        </View>

        <BudgetActionButton
          icon="save"
          label={submitting ? 'Saving...' : 'Save Subscription'}
          onPress={handleSave}
          tone="money"
        />
      </BudgetSection>
    </BudgetPhaseScreen>
  );
}

const styles = StyleSheet.create({
  inputShell: {
    gap: 8,
    backgroundColor: BG_SURFACES.low,
    borderRadius: 20,
    padding: 16,
  },
  inputLabel: {
    fontFamily: BG_FONTS.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: BG_TEXT_TERTIARY,
  },
  input: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  notesInput: {
    minHeight: 96,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  catalogCard: {
    width: '47%',
    minHeight: 132,
    borderRadius: 22,
    padding: 16,
    backgroundColor: BG_SURFACES.low,
    gap: 14,
    justifyContent: 'space-between',
  },
  catalogGlyph: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogGlyphText: {
    fontFamily: BG_FONTS.extraBold,
    fontSize: 22,
    lineHeight: 24,
  },
  catalogCopy: {
    gap: 6,
  },
  catalogName: {
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: BG_TEXT,
  },
  catalogMeta: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
    color: BG_TEXT_SECONDARY,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldGrid: {
    flexDirection: 'row',
    gap: 12,
  },
});
