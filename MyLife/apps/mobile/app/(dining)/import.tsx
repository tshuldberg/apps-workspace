import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  parseCsvText,
  parseGoogleMapsExport,
  importCsvRows,
} from '@mylife/dining';
import type { CsvRow } from '@mylife/dining';

const ACCENT = '#DC2626';
const BG = '#0E0E13';
const SURFACE = '#1B1B20';
const SURFACE_ELEVATED = '#1F1F25';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const TEXT_TERTIARY = '#9F8E81';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const SUCCESS = '#30D158';
const DANGER = '#FFB4AB';

type ImportSource = 'csv' | 'google_maps' | null;
type Step = 'source' | 'paste' | 'preview' | 'result';

interface ImportResultState {
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}

export default function ImportScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [step, setStep] = useState<Step>('source');
  const [source, setSource] = useState<ImportSource>(null);
  const [rawText, setRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResultState | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleSourceSelect = useCallback((s: ImportSource) => {
    setSource(s);
    setStep('paste');
    setRawText('');
    setParsedRows([]);
    setParseError(null);
  }, []);

  const handleParse = useCallback(() => {
    setParseError(null);
    try {
      let rows: CsvRow[];
      if (source === 'google_maps') {
        const places = parseGoogleMapsExport(rawText);
        if (places.length === 0) {
          setParseError('No restaurants found. Check the format and try again.');
          return;
        }
        rows = places.map((p) => ({
          name: p.name,
          address: p.address || undefined,
        }));
      } else {
        rows = parseCsvText(rawText);
        if (rows.length === 0) {
          setParseError('No restaurants found. Make sure the first row contains column headers.');
          return;
        }
      }
      setParsedRows(rows);
      setStep('preview');
    } catch {
      setParseError('Failed to parse the input. Check format and try again.');
    }
  }, [rawText, source]);

  const handleImport = useCallback(async () => {
    if (isImporting) return;
    setIsImporting(true);
    try {
      const importResult = importCsvRows(db, parsedRows);
      setResult(importResult);
      setStep('result');
    } catch {
      setResult({
        total: parsedRows.length,
        imported: 0,
        skipped: 0,
        errors: [{ row: 0, reason: 'Import failed unexpectedly' }],
      });
      setStep('result');
    } finally {
      setIsImporting(false);
    }
  }, [db, parsedRows, isImporting]);

  const handleDone = useCallback(() => {
    router.back();
  }, [router]);

  const handleReset = useCallback(() => {
    setStep('source');
    setSource(null);
    setRawText('');
    setParsedRows([]);
    setResult(null);
    setParseError(null);
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Import Restaurants', headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => (step === 'source' ? router.back() : handleReset())}>
            <Text style={styles.backButton}>
              {step === 'source' ? 'Cancel' : 'Start Over'}
            </Text>
          </Pressable>
          <Text style={styles.title}>Import</Text>
          <View style={{ width: 70 }} />
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          {['Source', 'Paste', 'Preview', 'Done'].map((label, i) => {
            const stepIndex = ['source', 'paste', 'preview', 'result'].indexOf(step);
            const active = i <= stepIndex;
            return (
              <View key={label} style={styles.stepItem}>
                <View style={[styles.stepDot, active && styles.stepDotActive]} />
                <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Step 1: Source */}
          {step === 'source' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Choose Source</Text>
              <Pressable style={styles.optionCard} onPress={() => handleSourceSelect('csv')}>
                <Text style={styles.optionIcon}>📄</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>CSV / Paste Text</Text>
                  <Text style={styles.optionDesc}>
                    Paste CSV data with restaurant names, addresses, and details
                  </Text>
                </View>
              </Pressable>
              <Pressable style={styles.optionCard} onPress={() => handleSourceSelect('google_maps')}>
                <Text style={styles.optionIcon}>📍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Google Maps Export</Text>
                  <Text style={styles.optionDesc}>
                    Paste your Google Maps Saved Places JSON export
                  </Text>
                </View>
              </Pressable>
            </View>
          )}

          {/* Step 2: Paste */}
          {step === 'paste' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {source === 'google_maps' ? 'Paste Google Maps JSON' : 'Paste CSV Data'}
              </Text>
              <Text style={styles.hint}>
                {source === 'google_maps'
                  ? 'Paste the contents of your Google Maps Saved Places export (GeoJSON format).'
                  : 'Paste CSV with headers: name, address, city, cuisine, rating, price, notes, etc.'}
              </Text>
              <TextInput
                style={styles.textarea}
                multiline
                numberOfLines={12}
                value={rawText}
                onChangeText={setRawText}
                placeholder={
                  source === 'google_maps'
                    ? '{"type":"FeatureCollection","features":[...]}'
                    : 'name,address,city,cuisine\nBestia,2121 E 7th Pl,Los Angeles,Italian'
                }
                placeholderTextColor={TEXT_TERTIARY}
                textAlignVertical="top"
              />
              {parseError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{parseError}</Text>
                </View>
              )}
              <Pressable
                style={[styles.primaryButton, !rawText.trim() && styles.buttonDisabled]}
                onPress={handleParse}
                disabled={!rawText.trim()}
              >
                <Text style={styles.primaryButtonText}>Parse</Text>
              </Pressable>
            </View>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Preview</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  Found {parsedRows.length} restaurant{parsedRows.length !== 1 ? 's' : ''}
                </Text>
              </View>

              <View style={styles.previewTable}>
                {/* Header row */}
                <View style={styles.previewHeader}>
                  <Text style={[styles.previewCell, { flex: 2 }]}>Name</Text>
                  <Text style={[styles.previewCell, { flex: 2 }]}>Address</Text>
                  <Text style={[styles.previewCell, { flex: 1 }]}>City</Text>
                </View>
                <FlatList
                  data={parsedRows.slice(0, 50)}
                  keyExtractor={(_, i) => String(i)}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <View style={styles.previewRow}>
                      <Text style={[styles.previewCellText, { flex: 2 }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.previewCellSecondary, { flex: 2 }]} numberOfLines={1}>
                        {item.address || '-'}
                      </Text>
                      <Text style={[styles.previewCellSecondary, { flex: 1 }]} numberOfLines={1}>
                        {item.city || '-'}
                      </Text>
                    </View>
                  )}
                />
                {parsedRows.length > 50 && (
                  <Text style={styles.hint}>
                    Showing first 50 of {parsedRows.length} rows
                  </Text>
                )}
              </View>

              <View style={styles.buttonRow}>
                <Pressable style={styles.secondaryButton} onPress={() => setStep('paste')}>
                  <Text style={styles.secondaryButtonText}>Back</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, { flex: 1 }]}
                  onPress={() => void handleImport()}
                >
                  {isImporting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      Import {parsedRows.length} Restaurant{parsedRows.length !== 1 ? 's' : ''}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* Step 4: Result */}
          {step === 'result' && result && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Import Complete</Text>

              <View style={styles.resultCards}>
                <View style={styles.resultCard}>
                  <Text style={styles.resultNumber}>{result.imported}</Text>
                  <Text style={styles.resultLabel}>Imported</Text>
                </View>
                <View style={styles.resultCard}>
                  <Text style={[styles.resultNumber, { color: TEXT_SECONDARY }]}>
                    {result.skipped}
                  </Text>
                  <Text style={styles.resultLabel}>Skipped</Text>
                </View>
                <View style={styles.resultCard}>
                  <Text style={[styles.resultNumber, { color: result.errors.length > 0 ? DANGER : TEXT_SECONDARY }]}>
                    {result.errors.length}
                  </Text>
                  <Text style={styles.resultLabel}>Errors</Text>
                </View>
              </View>

              {result.errors.length > 0 && (
                <View style={styles.errorList}>
                  <Text style={styles.errorListTitle}>Errors</Text>
                  {result.errors.slice(0, 10).map((e, i) => (
                    <Text key={i} style={styles.errorItem}>
                      Row {e.row}: {e.reason}
                    </Text>
                  ))}
                  {result.errors.length > 10 && (
                    <Text style={styles.hint}>
                      + {result.errors.length - 10} more errors
                    </Text>
                  )}
                </View>
              )}

              <Pressable style={styles.primaryButton} onPress={handleDone}>
                <Text style={styles.primaryButtonText}>Done</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: '600',
    width: 70,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GLASS_BORDER,
  },
  stepDotActive: {
    backgroundColor: ACCENT,
  },
  stepLabel: {
    fontSize: 11,
    color: TEXT_TERTIARY,
    fontWeight: '600',
  },
  stepLabelActive: {
    color: TEXT_SECONDARY,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: TEXT_TERTIARY,
    lineHeight: 18,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  optionIcon: {
    fontSize: 28,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  textarea: {
    backgroundColor: SURFACE_ELEVATED,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontFamily: 'monospace',
    minHeight: 200,
    textAlignVertical: 'top',
  },
  errorBanner: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(220,38,38,0.1)',
    borderWidth: 1,
    borderColor: DANGER,
  },
  errorText: {
    fontSize: 13,
    color: DANGER,
  },
  primaryButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    color: TEXT_SECONDARY,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  countBadge: {
    backgroundColor: 'rgba(220,38,38,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  countText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '600',
  },
  previewTable: {
    borderRadius: 14,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  previewCell: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_TERTIARY,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  previewRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  previewCellText: {
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  previewCellSecondary: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  resultCards: {
    flexDirection: 'row',
    gap: 12,
  },
  resultCard: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    gap: 4,
  },
  resultNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: SUCCESS,
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_TERTIARY,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  errorList: {
    backgroundColor: 'rgba(220,38,38,0.06)',
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  errorListTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: DANGER,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  errorItem: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
});
