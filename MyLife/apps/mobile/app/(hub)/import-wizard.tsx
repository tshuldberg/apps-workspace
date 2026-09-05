import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ScrollView,
  View,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, colors, surfaceTiers, spacing, glassFills, glassBorders } from '@mylife/ui';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  registerAdapter,
  getAdapterByName,
  goodreadsAdapter,
  ynabCsvAdapter,
  myFitnessPalAdapter,
  dayOneAdapter,
} from '@mylife/onboarding';
import type { ImportProgress, ImportResult } from '@mylife/onboarding';
import { useDatabase } from '../../components/DatabaseProvider';

// ── Competitor app metadata ─────────────────────────────────────────

interface CompetitorApp {
  id: string;
  name: string;
  icon: string;
  price: string;
  targetModule: string;
  targetModuleName: string;
  accentColor: string;
  adapterName: string;
  fileType: string;
  mimeType: string;
  exportSteps: string[];
}

const COMPETITOR_APPS: CompetitorApp[] = [
  {
    id: 'goodreads',
    name: 'Goodreads',
    icon: '\uD83D\uDCDA',
    price: 'Free (ads + data)',
    targetModule: 'books',
    targetModuleName: 'MyBooks',
    accentColor: '#C9894D',
    adapterName: 'goodreads-csv',
    fileType: '.csv',
    mimeType: 'text/csv',
    exportSteps: [
      'Go to goodreads.com/review/import',
      'Click "Export Library" at the top',
      'Wait for the CSV to generate',
      'Download and transfer to your device',
    ],
  },
  {
    id: 'ynab',
    name: 'YNAB',
    icon: '\uD83D\uDCB0',
    price: '$109/yr',
    targetModule: 'budget',
    targetModuleName: 'MyBudget',
    accentColor: '#22C55E',
    adapterName: 'ynab-csv',
    fileType: '.csv',
    mimeType: 'text/csv',
    exportSteps: [
      'Open YNAB and go to your budget',
      'Click the account name',
      'Click "Export Transactions"',
      'Choose CSV and save the file',
    ],
  },
  {
    id: 'myfitnesspal',
    name: 'MyFitnessPal',
    icon: '\uD83C\uDF4E',
    price: '$80/yr',
    targetModule: 'nutrition',
    targetModuleName: 'MyNutrition',
    accentColor: '#F97316',
    adapterName: 'myfitnesspal-csv',
    fileType: '.csv',
    mimeType: 'text/csv',
    exportSteps: [
      'Go to myfitnesspal.com/food/diary',
      'Click the gear icon',
      'Select "Export Data"',
      'Download the Food Diary CSV',
    ],
  },
  {
    id: 'dayone',
    name: 'Day One',
    icon: '\uD83D\uDCD3',
    price: '$35/yr',
    targetModule: 'journal',
    targetModuleName: 'MyJournal',
    accentColor: '#A78BFA',
    adapterName: 'dayone-json',
    fileType: '.json',
    mimeType: 'application/json',
    exportSteps: [
      'Open Day One on Mac or iOS',
      'Go to File > Export > JSON',
      'Select the journal(s) to export',
      'Save the .json file',
    ],
  },
];

// ── Types ───────────────────────────────────────────────────────────

type WizardStep = 'select' | 'instructions' | 'importing' | 'results';

const STEP_INDEX: Record<WizardStep, number> = {
  select: 1,
  instructions: 2,
  importing: 3,
  results: 4,
};

export default function ImportWizardScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [step, setStep] = useState<WizardStep>('select');
  const [selectedApp, setSelectedApp] = useState<CompetitorApp | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const registeredRef = useRef(false);

  // Register all adapters once on mount
  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;
    registerAdapter(goodreadsAdapter);
    registerAdapter(ynabCsvAdapter);
    registerAdapter(myFitnessPalAdapter);
    registerAdapter(dayOneAdapter);
  }, []);

  const handleSelectApp = (app: CompetitorApp) => {
    setSelectedApp(app);
    setStep('instructions');
    setError(null);
    setResult(null);
  };

  const handleBack = () => {
    if (step === 'instructions') { setStep('select'); setSelectedApp(null); }
    else if (step === 'results') { setStep('select'); setSelectedApp(null); setResult(null); }
  };

  const handlePickFile = useCallback(async () => {
    if (!selectedApp) return;

    try {
      const docResult = await DocumentPicker.getDocumentAsync({
        type: selectedApp.mimeType === 'text/csv'
          ? ['text/csv', 'text/comma-separated-values', '*/*']
          : [selectedApp.mimeType, '*/*'],
        copyToCacheDirectory: true,
      });

      if (docResult.canceled || !docResult.assets?.[0]) return;

      const asset = docResult.assets[0];
      setStep('importing');
      setProgress({ phase: 'detecting', current: 0, total: 100, message: 'Reading file...' });
      setError(null);

      const content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Look up the adapter from the registry
      const adapter = getAdapterByName(selectedApp.adapterName);
      if (!adapter) {
        setError(`Import adapter "${selectedApp.adapterName}" not found.`);
        setStep('instructions');
        return;
      }

      // Detect
      setProgress({ phase: 'detecting', current: 10, total: 100, message: 'Checking file format...' });
      const detection = adapter.detectFormat(content, asset.name);
      if (!detection.detected) {
        setError(`This doesn't look like a ${selectedApp.name} export. Is it the right file?`);
        setStep('instructions');
        return;
      }

      // Parse
      setProgress({ phase: 'parsing', current: 25, total: 100, message: 'Reading records...' });
      const parsed = adapter.parse(content);
      if (parsed.length === 0) {
        setError('No data found in this file.');
        setStep('instructions');
        return;
      }

      // Validate
      setProgress({ phase: 'validating', current: 45, total: 100, message: `Validating ${parsed.length} records...` });
      const { valid, errors: validationErrors } = adapter.validate(parsed);

      if (valid.length === 0) {
        setError(`All ${parsed.length} records failed validation. Check the file format.`);
        setStep('instructions');
        return;
      }

      // Transform
      setProgress({ phase: 'transforming', current: 65, total: 100, message: `Preparing ${valid.length} records...` });
      const transformed = adapter.transform(valid);

      // Import into database
      setProgress({ phase: 'importing', current: 70, total: 100, message: `Importing ${transformed.length} records...` });

      const importResult = adapter.import(db, transformed, (p: ImportProgress) => {
        // Scale import progress from 70-95%
        const scaled = 70 + Math.round((p.current / Math.max(p.total, 1)) * 25);
        setProgress({ ...p, current: scaled, total: 100 });
      });

      // Merge validation errors into import result
      const finalResult: ImportResult = {
        ...importResult,
        totalRows: parsed.length,
        failed: importResult.failed + validationErrors.length,
        errors: [...validationErrors, ...importResult.errors],
      };

      setProgress({ phase: 'complete', current: 100, total: 100, message: 'Done!' });
      setResult(finalResult);
      setStep('results');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setError(msg);
      setStep('instructions');
    }
  }, [selectedApp, db]);

  const totalErrors = result ? result.errors.length : 0;
  const displayDuration = result?.durationMs
    ? result.durationMs < 1000
      ? `${result.durationMs}ms`
      : `${(result.durationMs / 1000).toFixed(1)}s`
    : null;
  const stepNum = STEP_INDEX[step];
  const stepProgress = (stepNum / 4) * 100;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      {/* Page header */}
      <View style={styles.headerBlock}>
        {(step === 'instructions' || step === 'results') && (
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>{'\u2190'} Back</Text>
          </Pressable>
        )}
        <Text style={styles.pageTitle}>Sync your data</Text>
        <Text style={styles.stepIndicator}>Step {stepNum} of 4</Text>
        <View style={styles.stepProgressTrack}>
          <View style={[styles.stepProgressFill, { width: `${stepProgress}%` }]} />
        </View>
      </View>

      {/* Step 1: Source selection */}
      {step === 'select' && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SELECT SOURCE</Text>
          <View style={styles.grid}>
            {COMPETITOR_APPS.map((app) => (
              <Pressable
                key={app.id}
                onPress={() => handleSelectApp(app)}
                style={({ pressed }) => [
                  styles.sourceCard,
                  pressed && styles.sourceCardPressed,
                ]}
              >
                <Text style={styles.sourceIcon}>{app.icon}</Text>
                <Text style={styles.sourceName}>{app.name}</Text>
                <Text style={styles.sourcePrice}>{app.price}</Text>
                <Text style={[styles.sourceTarget, { color: app.accentColor }]}>
                  {'\u2192'} {app.targetModuleName}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Privacy notice */}
          <View style={styles.privacyNotice}>
            <Text style={styles.privacyIcon}>🛡️</Text>
            <Text style={styles.privacyText}>
              All imports happen on your device. Your data never leaves your phone.
            </Text>
          </View>
        </View>
      )}

      {/* Step 2: Instructions + file upload */}
      {step === 'instructions' && selectedApp && (
        <View style={styles.section}>
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.instructionsCard}>
            <Text style={styles.bigIcon}>{selectedApp.icon}</Text>
            <Text style={styles.instructionsTitle}>
              Export from {selectedApp.name}
            </Text>
            {selectedApp.exportSteps.map((s, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={[styles.stepBadge, { backgroundColor: `${selectedApp.accentColor}20` }]}>
                  <Text style={[styles.stepBadgeText, { color: selectedApp.accentColor }]}>
                    {i + 1}
                  </Text>
                </View>
                <Text style={styles.stepText}>{s}</Text>
              </View>
            ))}
          </View>

          {/* File upload area */}
          <Pressable onPress={handlePickFile} style={styles.uploadArea}>
            <Text style={styles.uploadIcon}>📁</Text>
            <Text style={styles.uploadText}>
              Pick {selectedApp.fileType} File
            </Text>
            <Text style={styles.uploadHint}>Tap to browse files</Text>
          </Pressable>
        </View>
      )}

      {/* Step 3: Progress */}
      {step === 'importing' && progress && selectedApp && (
        <View style={styles.section}>
          <View style={styles.progressCard}>
            <Text style={styles.bigIcon}>{selectedApp.icon}</Text>
            <Text style={styles.bodyText}>{progress.message}</Text>
            <View style={styles.importProgressTrack}>
              <View
                style={[
                  styles.importProgressFill,
                  { width: `${progress.current}%` as unknown as number },
                ]}
              />
            </View>
            <Text style={styles.progressPercent}>{progress.current}%</Text>
            {progress.phase !== 'complete' && (
              <ActivityIndicator size="small" color={colors.hubAccent} style={{ marginTop: spacing.sm }} />
            )}
          </View>
        </View>
      )}

      {/* Step 4: Results */}
      {step === 'results' && result && selectedApp && (
        <View style={styles.section}>
          <View style={styles.resultsCard}>
            <Text style={styles.resultsEmoji}>
              {totalErrors === 0 ? '\u2705' : '\u26A0\uFE0F'}
            </Text>
            <Text style={styles.resultsTitle}>
              {totalErrors === 0
                ? `Imported ${result.imported} records into ${selectedApp.targetModuleName}!`
                : `${result.imported} of ${result.totalRows} imported`}
            </Text>

            {/* Stats grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{result.imported}</Text>
                <Text style={styles.statLabel}>Imported</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{result.totalRows}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{result.skipped}</Text>
                <Text style={styles.statLabel}>Skipped</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={[styles.statValue, totalErrors > 0 && { color: colors.danger }]}>
                  {totalErrors}
                </Text>
                <Text style={styles.statLabel}>Errors</Text>
              </View>
            </View>

            {displayDuration && (
              <Text style={styles.captionText}>
                Completed in {displayDuration}
              </Text>
            )}

            {totalErrors > 0 && (
              <Pressable onPress={() => setShowErrors(!showErrors)}>
                <Text style={styles.errorToggle}>
                  {totalErrors} error{totalErrors !== 1 ? 's' : ''}.{' '}
                  <Text style={styles.errorToggleLink}>
                    {showErrors ? 'Hide details' : 'View details'}
                  </Text>
                </Text>
              </Pressable>
            )}

            {showErrors && result.errors.length > 0 && (
              <View style={styles.errorList}>
                {result.errors.slice(0, 20).map((err, i) => (
                  <View key={i} style={styles.errorRow}>
                    <Text style={styles.errorRowNum}>Row {err.row}</Text>
                    <Text style={styles.errorField}>{err.field}</Text>
                    <Text style={styles.errorMessage}>{err.message}</Text>
                  </View>
                ))}
                {result.errors.length > 20 && (
                  <Text style={styles.moreErrors}>
                    ...and {result.errors.length - 20} more
                  </Text>
                )}
              </View>
            )}

            <Pressable onPress={() => router.back()}>
              <LinearGradient
                colors={[colors.hubAccentLight, colors.hubAccent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaButton}
              >
                <Text style={styles.ctaText}>Done</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => { setStep('select'); setSelectedApp(null); setResult(null); setError(null); setShowErrors(false); }}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>Import another app</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerBlock: {
    marginBottom: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  backText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  stepIndicator: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  stepProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: surfaceTiers.highest,
    overflow: 'hidden',
  },
  stepProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.hubAccent,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    color: `${colors.hubAccent}99`,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  bodyText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  captionText: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 4,
  },

  // Source selection grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sourceCard: {
    width: '47%' as unknown as number,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: glassBorders.subtle,
    backgroundColor: surfaceTiers.low,
  },
  sourceCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  sourceIcon: {
    fontSize: 36,
  },
  sourceName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  sourcePrice: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  sourceTarget: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Privacy notice
  privacyNotice: {
    backgroundColor: surfaceTiers.high,
    borderRadius: 16,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.md,
  },
  privacyIcon: {
    fontSize: 24,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Instructions
  instructionsCard: {
    backgroundColor: surfaceTiers.low,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  bigIcon: {
    fontSize: 48,
    textAlign: 'center',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },

  // Upload area
  uploadArea: {
    backgroundColor: surfaceTiers.low,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: glassBorders.standard,
    marginTop: spacing.md,
  },
  uploadIcon: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  uploadHint: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 4,
  },

  // Error banner
  errorBanner: {
    padding: spacing.sm,
    borderRadius: 16,
    backgroundColor: 'rgba(255,69,58,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.2)',
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },

  // Progress
  progressCard: {
    backgroundColor: surfaceTiers.low,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  importProgressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: surfaceTiers.highest,
    overflow: 'hidden',
  },
  importProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.hubAccent,
  },
  progressPercent: {
    fontSize: 13,
    color: colors.textTertiary,
  },

  // Results
  resultsCard: {
    backgroundColor: surfaceTiers.low,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultsEmoji: {
    fontSize: 48,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    marginTop: spacing.sm,
  },
  statCell: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Error details
  errorToggle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  errorToggleLink: {
    color: colors.hubAccent,
    textDecorationLine: 'underline',
  },
  errorList: {
    width: '100%',
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: surfaceTiers.lowest,
    marginTop: spacing.sm,
  },
  errorRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: 2,
  },
  errorRowNum: {
    width: 52,
    fontSize: 12,
    color: colors.textTertiary,
    fontFamily: 'monospace',
  },
  errorField: {
    width: 60,
    fontSize: 12,
    color: colors.danger,
  },
  errorMessage: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },
  moreErrors: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // Buttons
  ctaButton: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.md,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: glassBorders.subtle,
    backgroundColor: glassFills.subtle,
    width: '100%',
    marginTop: spacing.sm,
  },
  secondaryBtnText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
});
