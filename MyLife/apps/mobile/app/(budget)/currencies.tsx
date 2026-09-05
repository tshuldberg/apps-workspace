import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  BG_TYPOGRAPHY,
  GlassCard,
  MaterialSymbol,
  RATE_PRECISION,
  convertAmount,
  createCurrency,
  createExchangeRateHistory,
  getBaseCurrency,
  getCurrencies,
  getExchangeRates,
  getHistoricalRates,
  upsertExchangeRate,
  type Currency,
  type ExchangeRate,
} from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';
import { BudgetLineChart } from '../../components/budget/BudgetLineChart';
import { uuid } from '../../lib/uuid';

function formatRate(rate: ExchangeRate | null) {
  if (!rate) {
    return 'No live rate';
  }
  return Number(rate.rate_decimal).toFixed(4);
}

function formatFetchDate(timestamp: string | null | undefined) {
  if (!timestamp) {
    return 'No refresh yet';
  }
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function CurrenciesScreen() {
  const db = useDatabase();

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<Currency | null>(null);
  const [selectedCode, setSelectedCode] = useState<string>('EUR');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [newRate, setNewRate] = useState('');
  const [makeBase, setMakeBase] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const nextCurrencies = getCurrencies(db);
      const nextBase = getBaseCurrency(db);
      const nextRates = getExchangeRates(db);

      setCurrencies(nextCurrencies);
      setBaseCurrency(nextBase);
      setRates(nextRates);

      const firstTrackable =
        nextCurrencies.find((currency) => nextBase && currency.code !== nextBase.code)?.code ??
        nextCurrencies[0]?.code ??
        'USD';
      setSelectedCode((current) =>
        nextCurrencies.some((currency) => currency.code === current)
          ? current
          : firstTrackable,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load currencies.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedRate = useMemo(() => {
    if (!baseCurrency) {
      return null;
    }
    return (
      rates.find(
        (rate) =>
          rate.from_currency === baseCurrency.code &&
          rate.to_currency === selectedCode,
      ) ?? null
    );
  }, [baseCurrency, rates, selectedCode]);

  const historyPoints = useMemo(() => {
    if (!baseCurrency || !selectedCode || baseCurrency.code === selectedCode) {
      return [];
    }

    const history = getHistoricalRates(db, baseCurrency.code, selectedCode);
    if (history.length === 0 && selectedRate) {
      return [
        {
          label: 'Today',
          value: selectedRate.rate / RATE_PRECISION,
        },
      ];
    }

    return history.slice(-7).map((entry) => ({
      label: new Date(`${entry.effective_date}T12:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      value: Number(entry.rate_decimal),
    }));
  }, [baseCurrency, db, selectedCode, selectedRate]);

  const convertedPreview = useMemo(() => {
    if (!selectedRate || !baseCurrency || selectedCode === baseCurrency.code) {
      return null;
    }
    const converted = convertAmount(100_00, selectedRate.rate);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: selectedCode,
    }).format(converted / 100);
  }, [baseCurrency, selectedCode, selectedRate]);

  async function handleRefreshRates() {
    if (!baseCurrency || refreshing) {
      return;
    }

    setRefreshing(true);
    setError(null);

    try {
      const today = todayISO();

      db.transaction(() => {
        getCurrencies(db)
          .filter((currency) => currency.code !== baseCurrency.code)
          .forEach((currency) => {
            const currentRate = getExchangeRates(db).find(
              (rate) =>
                rate.from_currency === baseCurrency.code &&
                rate.to_currency === currency.code,
            );
            const latestHistory = getHistoricalRates(db, baseCurrency.code, currency.code).at(-1);

            if (currentRate) {
              if (latestHistory?.effective_date !== today) {
                createExchangeRateHistory(db, uuid(), {
                  effective_date: today,
                  from_currency: currentRate.from_currency,
                  rate: currentRate.rate,
                  rate_decimal: currentRate.rate_decimal,
                  source: 'manual',
                  to_currency: currentRate.to_currency,
                });
              }
              return;
            }

            if (latestHistory) {
              upsertExchangeRate(db, uuid(), {
                from_currency: latestHistory.from_currency,
                rate: latestHistory.rate,
                rate_decimal: latestHistory.rate_decimal,
                to_currency: latestHistory.to_currency,
              });
            }
          });
      });

      load();
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Failed to refresh rates.',
      );
      setRefreshing(false);
    }
  }

  function handleSetBaseCurrency(code: string) {
    try {
      db.transaction(() => {
        db.execute(`UPDATE bg_currencies SET is_base = 0`);
        db.execute(`UPDATE bg_currencies SET is_base = 1 WHERE code = ?`, [code]);
      });
      load();
    } catch (setBaseError) {
      setError(
        setBaseError instanceof Error
          ? setBaseError.message
          : 'Failed to update base currency.',
      );
    }
  }

  function handleAddCurrency() {
    const code = newCode.trim().toUpperCase();
    const name = newName.trim();
    const symbol = newSymbol.trim();
    const parsedRate = Number(newRate);

    if (code.length !== 3) {
      setError('Use a 3-letter currency code like EUR.');
      return;
    }
    if (!name) {
      setError('Currency name is required.');
      return;
    }
    if (!symbol) {
      setError('Currency symbol is required.');
      return;
    }
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      setError('Enter a valid exchange rate.');
      return;
    }

    try {
      db.transaction(() => {
        createCurrency(db, {
          code,
          decimal_places: 2,
          is_base: makeBase ? 1 : 0,
          name,
          symbol,
        });

        if (makeBase) {
          db.execute(`UPDATE bg_currencies SET is_base = 0 WHERE code != ?`, [code]);
        }

        const fromCode = makeBase ? code : baseCurrency?.code ?? 'USD';
        const toCode = makeBase ? 'USD' : code;
        const rateValue = Math.round(parsedRate * RATE_PRECISION);

        upsertExchangeRate(db, uuid(), {
          from_currency: fromCode,
          rate: rateValue,
          rate_decimal: parsedRate.toString(),
          to_currency: toCode,
        });
        createExchangeRateHistory(db, uuid(), {
          effective_date: todayISO(),
          from_currency: fromCode,
          rate: rateValue,
          rate_decimal: parsedRate.toString(),
          source: 'manual',
          to_currency: toCode,
        });
      });

      setNewCode('');
      setNewName('');
      setNewSymbol('');
      setNewRate('');
      setMakeBase(false);
      setShowAddModal(false);
      load();
    } catch (addError) {
      setError(
        addError instanceof Error
          ? addError.message
          : 'Failed to add currency.',
      );
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.loadingText}>Loading currencies...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <GlassCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Currencies</Text>
              <Text style={styles.heroTitle}>Keep your base currency stable while tracking the rates that matter.</Text>
            </View>
            <Pressable onPress={handleRefreshRates} style={styles.heroAction}>
              <MaterialSymbol color={BG_ACCENT_LIGHT} name="refresh" size={18} />
              <Text style={styles.heroActionLabel}>
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Text>
            </Pressable>
          </View>

          {baseCurrency ? (
            <>
              <Text style={styles.baseLabel}>Base currency</Text>
              <Text style={styles.baseCode}>{baseCurrency.code}</Text>
              <Text style={styles.baseMeta}>
                {baseCurrency.name} ({baseCurrency.symbol})
              </Text>
              {selectedRate && convertedPreview ? (
                <Text style={styles.heroMeta}>
                  100 {baseCurrency.code} currently maps to {convertedPreview}.
                </Text>
              ) : (
                <Text style={styles.heroMeta}>
                  Select a tracked currency to compare against your base.
                </Text>
              )}
            </>
          ) : null}
        </GlassCard>

        {error ? (
          <GlassCard style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </GlassCard>
        ) : null}

        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionLabel}>Enabled currencies</Text>
              <Text style={styles.sectionSubtitle}>
                Rates refresh from your local history until a live provider is added.
              </Text>
            </View>
            <Pressable onPress={() => setShowAddModal(true)} style={styles.inlineAction}>
              <Text style={styles.inlineActionLabel}>Add currency</Text>
              <MaterialSymbol color={BG_ACCENT_LIGHT} name="add" size={16} />
            </Pressable>
          </View>

          <View style={styles.currencyList}>
            {currencies.map((currency) => {
              const liveRate =
                baseCurrency && currency.code !== baseCurrency.code
                  ? rates.find(
                      (rate) =>
                        rate.from_currency === baseCurrency.code &&
                        rate.to_currency === currency.code,
                    ) ?? null
                  : null;
              const isSelected = selectedCode === currency.code;
              const isBase = baseCurrency?.code === currency.code;

              return (
                <Pressable
                  key={currency.code}
                  onPress={() => setSelectedCode(currency.code)}
                  style={[
                    styles.currencyCard,
                    isSelected ? styles.currencyCardSelected : null,
                  ]}
                >
                  <View style={styles.currencyCopy}>
                    <Text style={styles.currencyTitle}>
                      {currency.code} · {currency.symbol}
                    </Text>
                    <Text style={styles.currencyMeta}>{currency.name}</Text>
                    <Text style={styles.currencyMeta}>
                      {isBase
                        ? 'Base currency'
                        : `Rate ${formatRate(liveRate)} • ${formatFetchDate(liveRate?.fetched_at)}`}
                    </Text>
                  </View>

                  <View style={styles.currencyActions}>
                    <View style={[styles.statusPill, isBase ? styles.statusPillBase : styles.statusPillLive]}>
                      <Text style={styles.statusPillLabel}>{isBase ? 'Base' : 'Tracked'}</Text>
                    </View>
                    {!isBase ? (
                      <Pressable
                        onPress={() => handleSetBaseCurrency(currency.code)}
                        style={styles.baseAction}
                      >
                        <Text style={styles.baseActionLabel}>Make base</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionLabel}>Exchange history</Text>
              <Text style={styles.sectionSubtitle}>
                {baseCurrency && selectedCode
                  ? `${baseCurrency.code} to ${selectedCode}`
                  : 'Pick a tracked pair to inspect'}
              </Text>
            </View>
          </View>

          <BudgetLineChart
            fillFromColor="rgba(255, 184, 119, 0.28)"
            fillToColor="rgba(255, 184, 119, 0.03)"
            formatValue={(value) => value.toFixed(4)}
            points={historyPoints}
            strokeColor={BG_ACCENT_LIGHT}
          />
        </GlassCard>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
        transparent
        visible={showAddModal}
      >
        <View style={styles.modalScrim}>
          <GlassCard style={styles.modalCard}>
            <Text style={styles.eyebrow}>Add currency</Text>
            <Text style={styles.modalTitle}>Track another rate inside the phase 4 budget shell.</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Code</Text>
              <TextInput
                autoCapitalize="characters"
                maxLength={3}
                onChangeText={setNewCode}
                placeholder="EUR"
                placeholderTextColor={BG_TEXT_TERTIARY}
                style={styles.input}
                value={newCode}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                onChangeText={setNewName}
                placeholder="Euro"
                placeholderTextColor={BG_TEXT_TERTIARY}
                style={styles.input}
                value={newName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Symbol</Text>
              <TextInput
                onChangeText={setNewSymbol}
                placeholder="€"
                placeholderTextColor={BG_TEXT_TERTIARY}
                style={styles.input}
                value={newSymbol}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Rate against base</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setNewRate}
                placeholder="0.9214"
                placeholderTextColor={BG_TEXT_TERTIARY}
                style={styles.input}
                value={newRate}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Make this the base currency</Text>
                <Text style={styles.toggleSubtitle}>Used when your budget should report primarily in this code.</Text>
              </View>
              <Switch
                onValueChange={setMakeBase}
                thumbColor={makeBase ? BG_ACCENT_LIGHT : BG_TEXT_TERTIARY}
                trackColor={{ false: BG_SURFACES.high, true: `${BG_ACCENT}66` }}
                value={makeBase}
              />
            </View>

            <View style={styles.actionRow}>
              <Pressable
                onPress={() => setShowAddModal(false)}
                style={styles.secondaryAction}
              >
                <Text style={styles.secondaryActionLabel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleAddCurrency} style={styles.primaryAction}>
                <Text style={styles.primaryActionLabel}>Add</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG_SURFACES.base,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 18,
  },
  loadingState: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.base,
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  heroCard: {
    gap: 14,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  eyebrow: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    ...BG_TYPOGRAPHY.headlineMd,
    color: BG_TEXT,
  },
  heroAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  heroActionLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  baseLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  baseCode: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 40,
    lineHeight: 44,
  },
  baseMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
  },
  heroMeta: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  errorCard: {
    backgroundColor: `${BG_DANGER}18`,
  },
  errorText: {
    color: BG_DANGER,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionCard: {
    gap: 16,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  inlineAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  inlineActionLabel: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  currencyList: {
    gap: 12,
  },
  currencyCard: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 16,
  },
  currencyCardSelected: {
    backgroundColor: BG_SURFACES.high,
  },
  currencyCopy: {
    flex: 1,
    gap: 4,
  },
  currencyTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  currencyMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  currencyActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillBase: {
    backgroundColor: `${BG_ACCENT}22`,
  },
  statusPillLive: {
    backgroundColor: `${BG_MONEY}22`,
  },
  statusPillLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  baseAction: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  baseActionLabel: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  modalScrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  modalCard: {
    gap: 16,
    paddingBottom: 20,
  },
  modalTitle: {
    ...BG_TYPOGRAPHY.headlineMd,
    color: BG_TEXT,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 16,
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  toggleSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: BG_MONEY,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  primaryActionLabel: {
    color: BG_SURFACES.base,
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  secondaryActionLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
});
