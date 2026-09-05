import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import {
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  createTransaction,
  listAccounts,
  listEnvelopes,
  updatePayeeCache,
  type Account,
  type Envelope,
} from '@mylife/budget';
import {
  BudgetButton,
  BudgetHeadline,
  BudgetScreen,
  BudgetSectionLabel,
} from '../../components/budget/BudgetPhase2Primitives';
import {
  buildCsvPreviewRows,
  guessCsvMapping,
  inferDirectionFromAmount,
  parseCsvText,
  type CsvAmountSign,
  type CsvFieldKey,
  type CsvMapping,
  type ParsedCsvData,
} from '../../components/budget/csvImportUtils';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

type DateFormatOption = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';

type CsvProfileRecord = {
  id: string;
  name: string;
  date_column: number;
  payee_column: number;
  amount_column: number;
  memo_column: number | null;
  date_format: DateFormatOption;
  amount_sign: CsvAmountSign;
  debit_column: number | null;
  credit_column: number | null;
  skip_rows: number;
  created_at: string;
};

const CSV_FIELDS: CsvFieldKey[] = ['date', 'amount', 'payee', 'notes', 'account', 'category', 'type'];
const DATE_FORMATS: DateFormatOption[] = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];
const AMOUNT_FORMATS: CsvAmountSign[] = [
  'negative_is_outflow',
  'positive_is_outflow',
  'separate_columns',
];

function getCsvProfiles(db: ReturnType<typeof useDatabase>): CsvProfileRecord[] {
  return db.query<CsvProfileRecord>(
    `SELECT * FROM bg_csv_profiles ORDER BY created_at DESC LIMIT 8`,
  );
}

function saveCsvProfile(args: {
  db: ReturnType<typeof useDatabase>;
  name: string;
  mapping: CsvMapping;
  dateFormat: DateFormatOption;
  amountSign: CsvAmountSign;
  debitColumn: number | null;
  creditColumn: number | null;
}) {
  const { db, name, mapping, dateFormat, amountSign, debitColumn, creditColumn } = args;
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO bg_csv_profiles
      (id, name, date_column, payee_column, amount_column, memo_column, date_format, amount_sign, debit_column, credit_column, skip_rows, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      name,
      mapping.date ?? 0,
      mapping.payee ?? 0,
      mapping.amount ?? 0,
      mapping.notes ?? null,
      dateFormat,
      amountSign,
      debitColumn,
      creditColumn,
      0,
      now,
    ],
  );
}

function labelForField(field: CsvFieldKey): string {
  return field === 'notes' ? 'Notes' : field[0].toUpperCase() + field.slice(1);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export default function ImportCSVScreen() {
  const db = useDatabase();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [profiles, setProfiles] = useState<CsvProfileRecord[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedCsv, setParsedCsv] = useState<ParsedCsvData>({ headers: [], rows: [] });
  const [mapping, setMapping] = useState<CsvMapping>({});
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [dateFormat, setDateFormat] = useState<DateFormatOption>('MM/DD/YYYY');
  const [amountSign, setAmountSign] = useState<CsvAmountSign>('negative_is_outflow');
  const [debitColumn, setDebitColumn] = useState<number | null>(null);
  const [creditColumn, setCreditColumn] = useState<number | null>(null);
  const [saveProfileToggle, setSaveProfileToggle] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const accountRows = listAccounts(db, false);
      setAccounts(accountRows);
      setEnvelopes(listEnvelopes(db, false));
      setProfiles(getCsvProfiles(db));
      if (accountRows[0]) {
        setSelectedAccountId(accountRows[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load CSV settings.');
    }
  }, [db]);

  const previewRows = useMemo(
    () =>
      buildCsvPreviewRows({
        parsed: parsedCsv,
        mapping,
        dateFormat,
        amountSign,
        debitColumn,
        creditColumn,
      }).slice(0, 10),
    [amountSign, creditColumn, dateFormat, debitColumn, mapping, parsedCsv],
  );

  const handlePickFile = async () => {
    setBusy(true);
    setError(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) {
        setBusy(false);
        return;
      }

      const asset = result.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri);
      const parsed = parseCsvText(content);

      setFileName(asset.name);
      setParsedCsv(parsed);
      setMapping(guessCsvMapping(parsed.headers));
      setImportResult(null);
      setDebitColumn(null);
      setCreditColumn(null);
    } catch (pickError) {
      setError(pickError instanceof Error ? pickError.message : 'Failed to read CSV file.');
    } finally {
      setBusy(false);
    }
  };

  const applyProfile = (profile: CsvProfileRecord) => {
    setMapping({
      date: profile.date_column,
      payee: profile.payee_column,
      amount: profile.amount_column,
      notes: profile.memo_column ?? undefined,
    });
    setDateFormat(profile.date_format);
    setAmountSign(profile.amount_sign);
    setDebitColumn(profile.debit_column);
    setCreditColumn(profile.credit_column);
  };

  const handleImport = () => {
    if (busy) {
      return;
    }

    const rows = buildCsvPreviewRows({
      parsed: parsedCsv,
      mapping,
      dateFormat,
      amountSign,
      debitColumn,
      creditColumn,
    });

    if (rows.length === 0) {
      setError('Map at least date, payee, and amount to preview import rows.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      let imported = 0;

      db.transaction(() => {
        rows.forEach((row, index) => {
          const sourceRow = parsedCsv.rows[index];
          const typeRaw = mapping.type === undefined ? '' : (sourceRow[mapping.type] ?? '').toLowerCase();
          const rawAmountValue =
            mapping.amount === undefined ? '' : sourceRow[mapping.amount] ?? '';

          const direction =
            typeRaw.includes('credit') || typeRaw.includes('income')
              ? 'inflow'
              : typeRaw.includes('debit') || typeRaw.includes('expense')
                ? 'outflow'
                : inferDirectionFromAmount(rawAmountValue, amountSign);

          const rowAccountName =
            mapping.account === undefined ? '' : normalize(sourceRow[mapping.account] ?? '');
          const rowCategoryName =
            mapping.category === undefined ? '' : normalize(sourceRow[mapping.category] ?? '');

          const accountId =
            accounts.find((account) => normalize(account.name) === rowAccountName)?.id ??
            (selectedAccountId || null);
          const envelopeId =
            direction === 'outflow'
              ? envelopes.find((envelope) => normalize(envelope.name) === rowCategoryName)?.id ?? null
              : null;

          createTransaction(db, uuid(), {
            account_id: accountId,
            envelope_id: envelopeId,
            amount: row.amount,
            direction,
            merchant: row.payee,
            note: row.notes ?? null,
            occurred_on: row.date,
          });

          if (row.payee) {
            updatePayeeCache(db, row.payee, envelopeId);
          }
          imported += 1;
        });
      });

      if (saveProfileToggle && fileName) {
        saveCsvProfile({
          db,
          name: fileName.replace(/\.csv$/i, ''),
          mapping,
          dateFormat,
          amountSign,
          debitColumn,
          creditColumn,
        });
        setProfiles(getCsvProfiles(db));
      }

      setImportResult({
        imported,
        skipped: Math.max(parsedCsv.rows.length - imported, 0),
      });
      Alert.alert('Import Complete', `Imported ${imported} transactions.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Failed to import CSV.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BudgetScreen>
      <GlassCard style={styles.heroCard}>
        <BudgetHeadline
          title="Import CSV"
          subtitle="Pick a bank export, map columns, preview rows, and import into an account."
        />
        <BudgetButton
          label={busy ? 'Loading…' : fileName ? `Replace ${fileName}` : 'Choose CSV File'}
          onPress={() => void handlePickFile()}
          disabled={busy}
        />
      </GlassCard>

      <BudgetSectionLabel>Saved profiles</BudgetSectionLabel>
      <View style={styles.choiceGrid}>
        {profiles.length === 0 ? (
          <Text style={styles.helperText}>No CSV profiles saved yet.</Text>
        ) : (
          profiles.map((profile) => (
            <BudgetButton
              key={profile.id}
              tone="secondary"
              label={profile.name}
              onPress={() => applyProfile(profile)}
            />
          ))
        )}
      </View>

      <GlassCard style={styles.card}>
        <BudgetHeadline title="Column mapping" subtitle="Tap a header chip to assign it to a target field." />
        {CSV_FIELDS.map((field) => (
          <View key={field} style={styles.mappingRow}>
            <Text style={styles.mappingLabel}>{labelForField(field)}</Text>
            <View style={styles.choiceGrid}>
              <BudgetButton
                tone={mapping[field] === undefined ? 'primary' : 'secondary'}
                label="None"
                onPress={() =>
                  setMapping((current) => ({
                    ...current,
                    [field]: undefined,
                  }))
                }
              />
              {parsedCsv.headers.map((header, index) => (
                <BudgetButton
                  key={`${field}:${header}:${index}`}
                  tone={mapping[field] === index ? 'primary' : 'secondary'}
                  label={header}
                  onPress={() =>
                    setMapping((current) => ({
                      ...current,
                      [field]: index,
                    }))
                  }
                />
              ))}
            </View>
          </View>
        ))}
      </GlassCard>

      <GlassCard style={styles.card}>
        <BudgetHeadline title="Import settings" subtitle="Choose the target account and parsing rules." />
        <BudgetSectionLabel>Account</BudgetSectionLabel>
        <View style={styles.choiceGrid}>
          {accounts.map((account) => (
            <BudgetButton
              key={account.id}
              label={account.name}
              tone={selectedAccountId === account.id ? 'primary' : 'secondary'}
              onPress={() => setSelectedAccountId(account.id)}
            />
          ))}
        </View>

        <BudgetSectionLabel>Date format</BudgetSectionLabel>
        <View style={styles.choiceGrid}>
          {DATE_FORMATS.map((option) => (
            <BudgetButton
              key={option}
              label={option}
              tone={dateFormat === option ? 'primary' : 'secondary'}
              onPress={() => setDateFormat(option)}
            />
          ))}
        </View>

        <BudgetSectionLabel>Amount format</BudgetSectionLabel>
        <View style={styles.choiceGrid}>
          {AMOUNT_FORMATS.map((option) => (
            <BudgetButton
              key={option}
              label={option.replace(/_/g, ' ')}
              tone={amountSign === option ? 'primary' : 'secondary'}
              onPress={() => setAmountSign(option)}
            />
          ))}
        </View>

        {amountSign === 'separate_columns' ? (
          <>
            <BudgetSectionLabel>Separate debit / credit columns</BudgetSectionLabel>
            <View style={styles.mappingRow}>
              <Text style={styles.mappingLabel}>Debit column</Text>
              <View style={styles.choiceGrid}>
                {parsedCsv.headers.map((header, index) => (
                  <BudgetButton
                    key={`debit:${header}:${index}`}
                    label={header}
                    tone={debitColumn === index ? 'primary' : 'secondary'}
                    onPress={() => setDebitColumn(index)}
                  />
                ))}
              </View>
            </View>
            <View style={styles.mappingRow}>
              <Text style={styles.mappingLabel}>Credit column</Text>
              <View style={styles.choiceGrid}>
                {parsedCsv.headers.map((header, index) => (
                  <BudgetButton
                    key={`credit:${header}:${index}`}
                    label={header}
                    tone={creditColumn === index ? 'primary' : 'secondary'}
                    onPress={() => setCreditColumn(index)}
                  />
                ))}
              </View>
            </View>
          </>
        ) : null}

        <BudgetButton
          tone={saveProfileToggle ? 'primary' : 'secondary'}
          label={saveProfileToggle ? 'Save Profile On' : 'Save Profile Off'}
          onPress={() => setSaveProfileToggle((current) => !current)}
        />
      </GlassCard>

      <View style={styles.previewSection}>
        <BudgetSectionLabel>Preview</BudgetSectionLabel>
        {previewRows.length === 0 ? (
          <GlassCard style={styles.previewCard}>
            <Text style={styles.previewTitle}>No preview rows yet</Text>
            <Text style={styles.helperText}>
              Choose a file and map at least date, payee, and amount to preview parsed rows.
            </Text>
          </GlassCard>
        ) : (
          previewRows.map((row, index) => (
            <GlassCard key={`${row.payee}:${row.date}:${index}`} style={styles.previewCard}>
              <Text style={styles.previewTitle}>{row.payee}</Text>
              <Text style={styles.previewMeta}>
                {row.date} • {(row.amount / 100).toFixed(2)}
              </Text>
            </GlassCard>
          ))
        )}
      </View>

      <View style={styles.actions}>
        <BudgetButton
          label={busy ? 'Importing…' : 'Import CSV'}
          onPress={handleImport}
          disabled={busy}
        />
      </View>

      {importResult ? (
        <Text style={styles.successText}>
          Imported {importResult.imported} rows, skipped {importResult.skipped}.
        </Text>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </BudgetScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: 14,
  },
  card: {
    gap: 14,
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  helperText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 17,
    color: BG_TEXT_SECONDARY,
  },
  mappingRow: {
    gap: 8,
  },
  mappingLabel: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: BG_TEXT,
  },
  previewSection: {
    gap: 10,
  },
  previewCard: {
    gap: 6,
    backgroundColor: BG_SURFACES.low,
  },
  previewTitle: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: BG_TEXT,
  },
  previewMeta: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT_TERTIARY,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  successText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: BG_MONEY,
  },
  errorText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: BG_DANGER,
  },
});
