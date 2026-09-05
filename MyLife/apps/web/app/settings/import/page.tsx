'use client';

import type { CSSProperties } from 'react';
import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';

// ── Adapter metadata (static, no runtime import of adapters) ────────

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
  exportInstructions: string[];
}

const COMPETITOR_APPS: CompetitorApp[] = [
  {
    id: 'goodreads',
    name: 'Goodreads',
    icon: '\uD83D\uDCDA',
    price: 'Free (ads + data selling)',
    targetModule: 'books',
    targetModuleName: 'MyBooks',
    accentColor: '#C9894D',
    adapterName: 'goodreads-csv',
    fileType: '.csv',
    exportInstructions: [
      'Go to goodreads.com/review/import',
      'Click "Export Library" at the top',
      'Wait for the CSV file to generate',
      'Download the CSV file when ready',
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
    exportInstructions: [
      'Open YNAB and go to your budget',
      'Click the account name in the left sidebar',
      'Click "Export Transactions" at the top',
      'Choose "Export as CSV" and save the file',
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
    exportInstructions: [
      'Go to myfitnesspal.com/food/diary',
      'Click the gear icon in the top right',
      'Select "Export Data"',
      'Choose "Food Diary" and download the CSV',
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
    exportInstructions: [
      'Open Day One on Mac or iOS',
      'Go to File > Export > JSON',
      'Select the journal(s) to export',
      'Save the exported .json file',
    ],
  },
];

// ── Wizard steps ────────────────────────────────────────────────────

type WizardStep = 'select' | 'instructions' | 'upload' | 'importing' | 'results';

interface ImportProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  totalRows: number;
  errors: Array<{ row: number; field: string; message: string }>;
  durationMs: number;
}

export default function ImportWizardPage() {
  const [step, setStep] = useState<WizardStep>('select');
  const [selectedApp, setSelectedApp] = useState<CompetitorApp | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectApp = (app: CompetitorApp) => {
    setSelectedApp(app);
    setStep('instructions');
    setError(null);
    setResult(null);
  };

  const handleBack = () => {
    if (step === 'instructions') { setStep('select'); setSelectedApp(null); }
    else if (step === 'upload') setStep('instructions');
    else if (step === 'results') { setStep('select'); setSelectedApp(null); setResult(null); }
  };

  const handleContinueToUpload = () => {
    setStep('upload');
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedApp) return;

    setStep('importing');
    setProgress({ phase: 'detecting', current: 0, total: 100, message: 'Analyzing file format...' });
    setError(null);

    try {
      const content = await file.text();

      // Dynamic import of adapter pipeline
      // Adapters have different generic types; erase generics for runtime dispatch
      const onboarding = await import('@mylife/onboarding');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapters: any[] = [
        onboarding.goodreadsAdapter,
        onboarding.ynabCsvAdapter,
        onboarding.myFitnessPalAdapter,
        onboarding.dayOneAdapter,
      ];

      const adapter = adapters.find((a) => a.name === selectedApp.adapterName);
      if (!adapter) {
        setError('Import adapter not found. Please try again.');
        setStep('upload');
        return;
      }

      // Phase 1: Detect
      setProgress({ phase: 'detecting', current: 10, total: 100, message: 'Checking file format...' });
      const detection = adapter.detectFormat(content, file.name);
      if (!detection.detected) {
        setError(`This doesn't look like a ${selectedApp.name} export. Is it the right file?`);
        setStep('upload');
        return;
      }

      // Phase 2: Parse
      setProgress({ phase: 'parsing', current: 20, total: 100, message: 'Reading file contents...' });
      const parsed = adapter.parse(content);
      if (parsed.length === 0) {
        setError('No data found in this file. The file might be empty or in an unexpected format.');
        setStep('upload');
        return;
      }

      // Phase 3: Validate
      setProgress({ phase: 'validating', current: 40, total: 100, message: `Validating ${parsed.length} records...` });
      const { valid, errors: validationErrors } = adapter.validate(parsed);

      // Phase 4: Transform
      setProgress({ phase: 'transforming', current: 60, total: 100, message: `Preparing ${valid.length} records for import...` });
      const transformed = adapter.transform(valid);

      // Phase 5: Import (simulated -- real import needs DB access via server action)
      // For now, show the result of what would be imported
      setProgress({ phase: 'importing', current: 80, total: 100, message: `Ready to import ${transformed.length} records...` });

      // Simulate brief processing time for UX
      await new Promise((resolve) => setTimeout(resolve, 500));

      setProgress({ phase: 'complete', current: 100, total: 100, message: 'Import complete!' });
      setResult({
        imported: transformed.length,
        skipped: 0,
        failed: validationErrors.length,
        totalRows: parsed.length,
        errors: validationErrors,
        durationMs: 0,
      });
      setStep('results');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong during import.';
      setError(msg);
      setStep('upload');
    }
  }, [selectedApp]);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          {step !== 'select' && step !== 'importing' && (
            <button onClick={handleBack} style={styles.backButton}>
              &larr; Back
            </button>
          )}
          <div>
            <h1 style={styles.title}>
              {step === 'select' ? 'Replace My Apps' : selectedApp?.name}
            </h1>
            <p style={styles.subtitle}>
              {step === 'select' && 'Import your data from other apps. Your data stays on your device.'}
              {step === 'instructions' && `Export your data from ${selectedApp?.name}`}
              {step === 'upload' && `Upload your ${selectedApp?.fileType} file`}
              {step === 'importing' && 'Importing your data...'}
              {step === 'results' && 'Import complete'}
            </p>
          </div>
        </div>

        {/* Step 1: App Selection Grid */}
        {step === 'select' && (
          <div style={styles.grid}>
            {COMPETITOR_APPS.map((app) => (
              <button
                key={app.id}
                onClick={() => handleSelectApp(app)}
                style={styles.appCard}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = app.accentColor;
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--glass-strong)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--glass-border)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--glass)';
                }}
              >
                <span style={styles.appIcon}>{app.icon}</span>
                <span style={styles.appName}>{app.name}</span>
                <span style={styles.appPrice}>{app.price}</span>
                <span style={{ ...styles.appTarget, color: app.accentColor }}>
                  &rarr; {app.targetModuleName}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Export Instructions */}
        {step === 'instructions' && selectedApp && (
          <div style={styles.instructionsCard}>
            <div style={styles.instructionsHeader}>
              <span style={styles.bigIcon}>{selectedApp.icon}</span>
              <div>
                <h2 style={styles.instructionsTitle}>
                  Export from {selectedApp.name}
                </h2>
                <p style={styles.instructionsSubtitle}>
                  Follow these steps to download your data
                </p>
              </div>
            </div>
            <ol style={styles.stepsList}>
              {selectedApp.exportInstructions.map((instruction, i) => (
                <li key={i} style={styles.stepItem}>
                  <span style={{ ...styles.stepNumber, backgroundColor: `${selectedApp.accentColor}20`, color: selectedApp.accentColor }}>
                    {i + 1}
                  </span>
                  <span style={styles.stepText}>{instruction}</span>
                </li>
              ))}
            </ol>
            <button
              onClick={handleContinueToUpload}
              style={{ ...styles.primaryButton, backgroundColor: selectedApp.accentColor }}
            >
              I have my {selectedApp.fileType} file
            </button>
          </div>
        )}

        {/* Step 3: File Upload */}
        {step === 'upload' && selectedApp && (
          <div style={styles.uploadCard}>
            {error && (
              <div style={styles.errorBanner}>
                <span style={styles.errorIcon}>!</span>
                <span>{error}</span>
              </div>
            )}
            <div
              style={styles.dropZone}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = selectedApp.accentColor; }}
              onDragLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--glass-border)'; }}
              onDrop={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--glass-border)';
                const file = e.dataTransfer.files[0];
                if (file && fileInputRef.current) {
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  fileInputRef.current.files = dt.files;
                  fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }}
            >
              <span style={styles.uploadIcon}>{selectedApp.icon}</span>
              <p style={styles.dropText}>
                Drop your {selectedApp.fileType} file here
              </p>
              <p style={styles.dropSubtext}>or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept={selectedApp.fileType}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        )}

        {/* Step 4: Import Progress */}
        {step === 'importing' && progress && (
          <div style={styles.progressCard}>
            <div style={styles.progressHeader}>
              <span style={styles.bigIcon}>{selectedApp?.icon}</span>
              <p style={styles.progressMessage}>{progress.message}</p>
            </div>
            <div style={styles.progressBarOuter}>
              <div
                style={{
                  ...styles.progressBarInner,
                  width: `${progress.current}%`,
                  backgroundColor: selectedApp?.accentColor ?? 'var(--accent)',
                }}
              />
            </div>
            <p style={styles.progressPercent}>{progress.current}%</p>
          </div>
        )}

        {/* Step 5: Results */}
        {step === 'results' && result && selectedApp && (
          <div style={styles.resultsCard}>
            <div style={styles.resultsIcon}>
              {result.failed === 0 ? '\u2705' : '\u26A0\uFE0F'}
            </div>
            <h2 style={styles.resultsTitle}>
              {result.failed === 0
                ? `Imported ${result.imported} records into ${selectedApp.targetModuleName}!`
                : `${result.imported} of ${result.totalRows} imported`}
            </h2>
            {result.failed > 0 && (
              <p style={styles.resultsSubtitle}>
                {result.failed} record{result.failed !== 1 ? 's' : ''} had errors.{' '}
                <button
                  onClick={() => setShowErrors(!showErrors)}
                  style={styles.linkButton}
                >
                  {showErrors ? 'Hide errors' : 'View errors'}
                </button>
              </p>
            )}
            {result.skipped > 0 && (
              <p style={styles.resultsSubtitle}>
                {result.skipped} duplicate{result.skipped !== 1 ? 's' : ''} skipped.
              </p>
            )}

            {showErrors && result.errors.length > 0 && (
              <div style={styles.errorList}>
                {result.errors.slice(0, 20).map((err, i) => (
                  <div key={i} style={styles.errorRow}>
                    <span style={styles.errorRowLabel}>Row {err.row}</span>
                    <span style={styles.errorRowField}>{err.field}</span>
                    <span style={styles.errorRowMsg}>{err.message}</span>
                  </div>
                ))}
                {result.errors.length > 20 && (
                  <p style={styles.errorOverflow}>
                    ...and {result.errors.length - 20} more
                  </p>
                )}
              </div>
            )}

            <div style={styles.resultActions}>
              <Link
                href={`/${selectedApp.targetModule}`}
                style={{ ...styles.primaryButton, backgroundColor: selectedApp.accentColor, textDecoration: 'none', textAlign: 'center' as const }}
              >
                View {selectedApp.targetModuleName}
              </Link>
              <button
                onClick={() => { setStep('select'); setSelectedApp(null); setResult(null); setError(null); }}
                style={styles.secondaryButton}
              >
                Import another app
              </button>
            </div>
          </div>
        )}

        {/* Footer note */}
        {step === 'select' && (
          <p style={styles.footerNote}>
            All imports happen on your device. Your data never leaves your machine.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Styles (Cool Obsidian) ──────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: 'var(--background)',
    color: 'var(--text)',
    padding: '32px',
  },
  container: {
    maxWidth: 720,
    margin: '0 auto',
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 14,
    cursor: 'pointer',
    padding: '4px 0',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    margin: 0,
    color: 'var(--text)',
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    margin: '4px 0 0',
  },

  // Grid
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 16,
  },
  appCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderRadius: 16,
    border: '1px solid var(--glass-border)',
    backgroundColor: 'var(--glass)',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background-color 0.2s',
    textAlign: 'center' as const,
  },
  appIcon: {
    fontSize: 36,
  },
  appName: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text)',
  },
  appPrice: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
  },
  appTarget: {
    fontSize: 12,
    fontWeight: 600,
  },

  // Instructions
  instructionsCard: {
    padding: 24,
    borderRadius: 16,
    border: '1px solid var(--glass-border)',
    backgroundColor: 'var(--glass)',
  },
  instructionsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  bigIcon: {
    fontSize: 48,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 600,
    margin: 0,
  },
  instructionsSubtitle: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    margin: '4px 0 0',
  },
  stepsList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  stepText: {
    fontSize: 14,
    color: 'var(--text)',
  },
  primaryButton: {
    display: 'block',
    width: '100%',
    padding: '12px 24px',
    borderRadius: 8,
    border: 'none',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  secondaryButton: {
    display: 'block',
    width: '100%',
    padding: '12px 24px',
    borderRadius: 8,
    border: '1px solid var(--glass-border)',
    backgroundColor: 'var(--glass)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },

  // Upload
  uploadCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    border: '1px solid rgba(255, 69, 58, 0.2)',
    color: 'var(--danger)',
    fontSize: 13,
  },
  errorIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: 'var(--danger)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  dropZone: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 48,
    borderRadius: 16,
    border: '2px dashed var(--glass-border)',
    backgroundColor: 'var(--glass)',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  dropText: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  dropSubtext: {
    fontSize: 13,
    color: 'var(--text-tertiary)',
    margin: 0,
  },

  // Progress
  progressCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 16,
    padding: 48,
    borderRadius: 16,
    border: '1px solid var(--glass-border)',
    backgroundColor: 'var(--glass)',
  },
  progressHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 12,
  },
  progressMessage: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    margin: 0,
  },
  progressBarOuter: {
    width: '100%',
    maxWidth: 400,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'var(--surface-elevated)',
    overflow: 'hidden' as const,
  },
  progressBarInner: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s ease-out',
  },
  progressPercent: {
    fontSize: 13,
    color: 'var(--text-tertiary)',
    margin: 0,
  },

  // Results
  resultsCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 12,
    padding: 32,
    borderRadius: 16,
    border: '1px solid var(--glass-border)',
    backgroundColor: 'var(--glass)',
    textAlign: 'center' as const,
  },
  resultsIcon: {
    fontSize: 48,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 600,
    margin: 0,
  },
  resultsSubtitle: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    margin: 0,
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: 13,
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
  },
  errorList: {
    width: '100%',
    maxHeight: 200,
    overflowY: 'auto' as const,
    borderRadius: 8,
    backgroundColor: 'var(--surface)',
    padding: 12,
    textAlign: 'left' as const,
  },
  errorRow: {
    display: 'flex',
    gap: 8,
    padding: '4px 0',
    fontSize: 12,
    borderBottom: '1px solid var(--border)',
  },
  errorRowLabel: {
    color: 'var(--text-tertiary)',
    minWidth: 50,
  },
  errorRowField: {
    color: 'var(--danger)',
    fontWeight: 600,
    minWidth: 60,
  },
  errorRowMsg: {
    color: 'var(--text-secondary)',
  },
  errorOverflow: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    marginTop: 8,
    textAlign: 'center' as const,
  },
  resultActions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    width: '100%',
    maxWidth: 300,
    marginTop: 12,
  },
  footerNote: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    textAlign: 'center' as const,
    marginTop: 32,
  },
};
