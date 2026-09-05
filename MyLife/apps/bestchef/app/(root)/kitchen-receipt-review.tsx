import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, Check, Circle, FileText, PackagePlus, RotateCcw, Trash2 } from 'lucide-react-native';
import {
  JAKARTA_FONTS,
  type ReceiptImportLine,
  type ReceiptImportReview,
  type ReceiptLineProductCandidate,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useDatabase } from './providers/DatabaseProvider';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from './providers/AppThemeProvider';
import { useI18n } from './i18n/I18nProvider';
import {
  confirmKitchenReceiptLines,
  getKitchenReceiptReview,
  ignoreKitchenReceiptLine,
  undoKitchenReceiptLine,
} from './data/kitchen';
import { BackArrow } from './components/DirectionalIcons';

function parseCandidates(value: string): ReceiptLineProductCandidate[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as ReceiptLineProductCandidate[] : [];
  } catch {
    return [];
  }
}

function cents(value: number | null): string {
  if (value == null) return '';
  return `$${(value / 100).toFixed(2)}`;
}

interface LineDraft {
  itemName: string;
  quantity: string;
  unit: string;
  expirationDate: string;
  lotCode: string;
  selectedCandidateId: string | null;
}

function defaultLineDraft(line: ReceiptImportLine): LineDraft {
  const candidate = parseCandidates(line.candidate_json)[0] ?? null;
  return {
    itemName: candidate?.label ?? line.normalized_name ?? line.raw_description,
    quantity: line.quantity == null ? '' : String(line.quantity),
    unit: '',
    expirationDate: '',
    lotCode: '',
    selectedCandidateId: candidate?.id ?? null,
  };
}

function parseQuantity(value: string): number | null {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function LineCard({
  line,
  selected,
  draft,
  onToggle,
  onIgnore,
  onChange,
  onUndo,
}: {
  line: ReceiptImportLine;
  selected: boolean;
  draft: LineDraft;
  onToggle: () => void;
  onIgnore: () => void;
  onChange: (updates: Partial<LineDraft>) => void;
  onUndo: () => void;
}) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const candidates = useMemo(() => parseCandidates(line.candidate_json), [line.candidate_json]);
  const candidate = candidates[0];
  const statusColor = line.match_status === 'matched'
    ? tc.accent
    : line.match_status === 'confirmed'
      ? tc.success
      : line.match_status === 'ignored'
        ? tc.textTertiary
        : tc.primaryContainer;

  return (
    <View
      style={[
        styles.lineCard,
        { backgroundColor: theme.glass.cardFill, borderColor: selected ? tc.accent : theme.glass.cardBorder },
      ]}
    >
      <Pressable
        style={({ pressed }) => [styles.lineTop, pressed && { opacity: 0.84, transform: [{ scale: 0.99 }] }]}
        onPress={onToggle}
        disabled={line.match_status === 'confirmed' || line.match_status === 'ignored'}
      >
        <View style={[styles.checkIcon, { borderColor: selected ? tc.accent : tc.textTertiary, backgroundColor: selected ? `${tc.accent}24` : 'transparent' }]}>
          {selected ? <Check size={15} color={tc.accent} strokeWidth={2.6} /> : <Circle size={13} color={tc.textTertiary} strokeWidth={2} />}
        </View>
        <View style={styles.lineBody}>
          <Text style={[styles.lineTitle, { color: tc.text }]} numberOfLines={2}>{line.raw_description}</Text>
          <Text style={[styles.lineMeta, { color: tc.textTertiary }]} numberOfLines={1}>
            {[line.quantity ? `${line.quantity}x` : null, cents(line.total_cents)].filter(Boolean).join(' / ') || t('No price')}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor}20` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{t(line.match_status)}</Text>
        </View>
      </Pressable>

      <View style={[styles.candidateBox, { backgroundColor: tc.surface }]}>
        {candidate ? (
          <>
            <Text style={[styles.candidateLabel, { color: tc.text }]} numberOfLines={1}>{candidate.label}</Text>
            <Text style={[styles.candidateMeta, { color: tc.textTertiary }]} numberOfLines={2}>
              {t(candidate.source)} / {Math.round(candidate.confidence * 100)}% / {candidate.reason}
            </Text>
          </>
        ) : (
          <Text style={[styles.candidateMeta, { color: tc.textTertiary }]}>{t('Needs manual review')}</Text>
        )}
      </View>

      {line.match_status !== 'confirmed' && line.match_status !== 'ignored' ? (
        <>
          <View style={styles.correctionBlock}>
            <Text style={[styles.correctionTitle, { color: tc.text }]}>{t('Correction')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.candidateChoices}>
              <Pressable
                style={({ pressed }) => [
                  styles.candidateChoice,
                  { backgroundColor: draft.selectedCandidateId === null ? `${tc.accent}20` : tc.surface, borderColor: draft.selectedCandidateId === null ? tc.accent : 'transparent' },
                  pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => onChange({ selectedCandidateId: null })}
              >
                <Text style={[styles.candidateChoiceTitle, { color: draft.selectedCandidateId === null ? tc.accent : tc.text }]}>{t('New item')}</Text>
                <Text style={[styles.candidateChoiceMeta, { color: tc.textTertiary }]}>{t('Use edited name')}</Text>
              </Pressable>
              {candidates.map((entry) => {
                const isSelected = draft.selectedCandidateId === entry.id;
                return (
                  <Pressable
                    key={entry.id}
                    style={({ pressed }) => [
                      styles.candidateChoice,
                      { backgroundColor: isSelected ? `${tc.accent}20` : tc.surface, borderColor: isSelected ? tc.accent : 'transparent' },
                      pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() => onChange({
                      selectedCandidateId: entry.id,
                      itemName: entry.label,
                    })}
                  >
                    <Text style={[styles.candidateChoiceTitle, { color: isSelected ? tc.accent : tc.text }]} numberOfLines={1}>
                      {entry.label}
                    </Text>
                    <Text style={[styles.candidateChoiceMeta, { color: tc.textTertiary }]} numberOfLines={2}>
                      {entry.pantry_item_id ? t('Merge into pantry') : t('Use product match')} / {Math.round(entry.confidence * 100)}%
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <TextInput
              style={[styles.input, { color: tc.text, backgroundColor: tc.surface }]}
              value={draft.itemName}
              onChangeText={(itemName) => onChange({ itemName })}
              placeholder={t('Item name')}
              placeholderTextColor={tc.textTertiary}
            />
            <View style={styles.inlineInputs}>
              <TextInput
                style={[styles.input, styles.inlineInput, { color: tc.text, backgroundColor: tc.surface }]}
                value={draft.quantity}
                onChangeText={(quantity) => onChange({ quantity })}
                placeholder={t('Qty')}
                placeholderTextColor={tc.textTertiary}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, styles.inlineInput, { color: tc.text, backgroundColor: tc.surface }]}
                value={draft.unit}
                onChangeText={(unit) => onChange({ unit })}
                placeholder={t('Unit')}
                placeholderTextColor={tc.textTertiary}
              />
            </View>
            <View style={styles.inlineInputs}>
              <TextInput
                style={[styles.input, styles.inlineInput, { color: tc.text, backgroundColor: tc.surface }]}
                value={draft.expirationDate}
                onChangeText={(expirationDate) => onChange({ expirationDate })}
                placeholder={t('YYYY-MM-DD')}
                placeholderTextColor={tc.textTertiary}
              />
              <TextInput
                style={[styles.input, styles.inlineInput, { color: tc.text, backgroundColor: tc.surface }]}
                value={draft.lotCode}
                onChangeText={(lotCode) => onChange({ lotCode })}
                placeholder={t('Lot')}
                placeholderTextColor={tc.textTertiary}
              />
            </View>
          </View>
        </>
      ) : null}

      {line.match_status !== 'confirmed' && line.match_status !== 'ignored' ? (
        <View style={styles.lineActions}>
          <Pressable
            style={({ pressed }) => [styles.ignoreButton, pressed && { opacity: 0.72, transform: [{ scale: 0.97 }] }]}
            onPress={onIgnore}
          >
            <Trash2 size={14} color={tc.danger} strokeWidth={2} />
            <Text style={[styles.ignoreText, { color: tc.danger }]}>{t('Ignore')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.lineActions}>
          <Pressable
            style={({ pressed }) => [styles.undoButton, pressed && { opacity: 0.72, transform: [{ scale: 0.97 }] }]}
            onPress={onUndo}
            accessibilityRole="button"
            accessibilityLabel={t('receipt_undo')}
          >
            <RotateCcw size={14} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.undoText, { color: tc.accent }]}>{t('receipt_undo')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function KitchenReceiptReviewScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ importId?: string }>();
  const importId = typeof params.importId === 'string' ? params.importId : '';
  const tc = useThemeColors();
  const theme = useTheme();
  const { t, formatNumber } = useI18n();
  const [review, setReview] = useState<ReceiptImportReview | null>(() => importId ? getKitchenReceiptReview(db, importId) : null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(
    review?.lines.filter((line) => line.match_status === 'matched').map((line) => line.id) ?? [],
  ));
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>(() => Object.fromEntries(
    review?.lines.map((line) => [line.id, defaultLineDraft(line)]) ?? [],
  ));
  const [busy, setBusy] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [confirmFailures, setConfirmFailures] = useState<{ lineId: string; reason: string }[]>([]);

  const load = useCallback(() => {
    if (!importId) return;
    const next = getKitchenReceiptReview(db, importId);
    setReview(next);
    setDrafts((current) => ({
      ...Object.fromEntries(next?.lines.map((line) => [line.id, current[line.id] ?? defaultLineDraft(line)]) ?? []),
    }));
    setSelectedIds((current) => {
      if (current.size > 0) return current;
      return new Set(next?.lines.filter((line) => line.match_status === 'matched').map((line) => line.id) ?? []);
    });
  }, [db, importId]);

  useFocusEffect(load);

  const lines = review?.lines ?? [];
  const selectedCount = selectedIds.size;

  const toggleLine = (line: ReceiptImportLine) => {
    if (line.match_status === 'confirmed' || line.match_status === 'ignored') return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(line.id)) {
        next.delete(line.id);
      } else {
        next.add(line.id);
      }
      return next;
    });
  };

  const ignoreLine = (line: ReceiptImportLine) => {
    ignoreKitchenReceiptLine(db, line.id);
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(line.id);
      return next;
    });
    load();
  };

  const undoLine = (line: ReceiptImportLine) => {
    undoKitchenReceiptLine(db, line.id);
    setSelectedIds((current) => {
      const next = new Set(current);
      next.add(line.id);
      return next;
    });
    load();
  };

  const reviewableLines = lines.filter(
    (line) => line.match_status !== 'confirmed' && line.match_status !== 'ignored',
  );
  const allSelected = reviewableLines.length > 0
    && reviewableLines.every((line) => selectedIds.has(line.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(reviewableLines.map((line) => line.id)));
    }
  };

  const updateDraft = (lineId: string, updates: Partial<LineDraft>) => {
    setDrafts((current) => ({
      ...current,
      [lineId]: { ...(current[lineId] ?? defaultLineDraft(lines.find((line) => line.id === lineId)!)), ...updates },
    }));
  };

  const confirmSelected = () => {
    if (!review || selectedIds.size === 0 || busy) return;
    const inputs = lines.flatMap((line) => {
      if (!selectedIds.has(line.id)) return [];
      const draft = drafts[line.id] ?? defaultLineDraft(line);
      if (!draft.itemName.trim()) return [];
      return [{
        lineId: line.id,
        selectedCandidateId: draft.selectedCandidateId,
        itemName: draft.itemName.trim(),
        quantity: parseQuantity(draft.quantity),
        unit: draft.unit.trim() || null,
        expirationDate: draft.expirationDate.trim() || null,
        lotCode: draft.lotCode.trim() || null,
      }];
    });
    if (inputs.length === 0) return;
    setBusy(true);
    setConfirmFailures([]);
    try {
      confirmKitchenReceiptLines(
        db,
        review.receipt.id,
        inputs,
      );
      router.replace('/pantry');
      return;
    } catch (error) {
      // Engine confirms in a single pass; on failure, fall back to per-row
      // commits so successful rows remain confirmed and the user can see
      // exactly which lines need attention.
      const failures: { lineId: string; reason: string }[] = [];
      for (const input of inputs) {
        try {
          confirmKitchenReceiptLines(db, review.receipt.id, [input]);
        } catch (rowError) {
          failures.push({
            lineId: input.lineId,
            reason: rowError instanceof Error ? rowError.message : t('Unable to update pantry.'),
          });
        }
      }
      setConfirmFailures(failures);
      if (failures.length === 0) {
        // The first throw was a transient race; everything ultimately committed.
        router.replace('/pantry');
        return;
      }
      const summary = failures.length === 1
        ? failures[0]!.reason
        : `${failures.length} ${t('lines')}: ${failures[0]!.reason}`;
      Alert.alert(t('Confirmation failed'), error instanceof Error ? error.message : summary);
    } finally {
      setBusy(false);
      load();
    }
  };

  const handleRetryOcr = () => {
    setRetryCount((current) => current + 1);
    router.back();
  };

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 14 }]}>
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.68, transform: [{ scale: 0.96 }] }]}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('Back')}
        >
          <BackArrow size={23} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Receipt Review')}</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!review ? (
          <View style={[styles.emptyState, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <AlertTriangle size={28} color={tc.primaryContainer} strokeWidth={1.7} />
            <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('Receipt not found')}</Text>
          </View>
        ) : (
          <>
            <View style={[styles.summaryCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
              <View style={styles.summaryTop}>
                <View style={[styles.summaryIcon, { backgroundColor: `${tc.accent}18` }]}>
                  <FileText size={20} color={tc.accent} strokeWidth={2} />
                </View>
                <View style={styles.summaryText}>
                  <Text style={[styles.summaryTitle, { color: tc.text }]} numberOfLines={1}>
                    {review.receipt.merchant ?? t('Receipt')}
                  </Text>
                  <Text style={[styles.summaryMeta, { color: tc.textTertiary }]} numberOfLines={1}>
                    {[review.receipt.receipt_date, cents(review.receipt.total_cents), review.receipt.ocr_provider].filter(Boolean).join(' / ')}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryStats}>
                <Text style={[styles.summaryStat, { color: tc.textSecondary }]}>
                  {formatNumber(lines.length)} {t('lines')}
                </Text>
                <Text style={[styles.summaryStat, { color: tc.textSecondary }]}>
                  {formatNumber(selectedCount)} {t('selected')}
                </Text>
              </View>
              {review.receipt.provider_status === 'failed' ? (
                <Text style={[styles.failureText, { color: tc.danger }]}>{review.receipt.provider_error}</Text>
              ) : null}
            </View>

            {(review.receipt.provider_status === 'failed' || lines.length === 0) ? (
              <View style={[styles.retryCard, { backgroundColor: theme.glass.cardFill, borderColor: tc.danger }]}>
                <View style={styles.retryHeader}>
                  <AlertTriangle size={18} color={tc.danger} strokeWidth={2.2} />
                  <Text style={[styles.retryTitle, { color: tc.danger }]}>{t('ocr_retry')}</Text>
                </View>
                {retryCount < 2 ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.retryButton,
                      { backgroundColor: tc.accent },
                      pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={handleRetryOcr}
                    accessibilityRole="button"
                    accessibilityLabel={t('ocr_retry')}
                  >
                    <RotateCcw size={16} color={tc.background} strokeWidth={2.4} />
                    <Text style={[styles.retryButtonText, { color: tc.background }]}>{t('ocr_retry')}</Text>
                  </Pressable>
                ) : (
                  <View style={styles.retryEscalation}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.retryButton,
                        { backgroundColor: tc.accent },
                        pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
                      ]}
                      onPress={() => router.back()}
                      accessibilityRole="button"
                      accessibilityLabel={t('ocr_switch_provider')}
                    >
                      <Text style={[styles.retryButtonText, { color: tc.background }]}>{t('ocr_switch_provider')}</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.retryButton,
                        { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder, borderWidth: 1 },
                        pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
                      ]}
                      onPress={() => router.back()}
                      accessibilityRole="button"
                      accessibilityLabel={t('ocr_pick_different_photo')}
                    >
                      <Text style={[styles.retryButtonText, { color: tc.text }]}>{t('ocr_pick_different_photo')}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ) : null}

            {reviewableLines.length > 0 ? (
              <Pressable
                style={({ pressed }) => [
                  styles.selectAllRow,
                  { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
                  pressed && { opacity: 0.84, transform: [{ scale: 0.99 }] },
                ]}
                onPress={toggleSelectAll}
                accessibilityRole="button"
                accessibilityLabel={t('receipt_select_all')}
              >
                <View style={[styles.checkIcon, { borderColor: allSelected ? tc.accent : tc.textTertiary, backgroundColor: allSelected ? `${tc.accent}24` : 'transparent' }]}>
                  {allSelected ? <Check size={15} color={tc.accent} strokeWidth={2.6} /> : <Circle size={13} color={tc.textTertiary} strokeWidth={2} />}
                </View>
                <Text style={[styles.selectAllText, { color: tc.text }]}>{t('receipt_select_all')}</Text>
                <Text style={[styles.selectAllMeta, { color: tc.textTertiary }]}>
                  {formatNumber(selectedCount)} / {formatNumber(reviewableLines.length)}
                </Text>
              </Pressable>
            ) : null}

            {confirmFailures.length > 0 ? (
              <View style={[styles.retryCard, { backgroundColor: theme.glass.cardFill, borderColor: tc.danger }]}>
                <View style={styles.retryHeader}>
                  <AlertTriangle size={18} color={tc.danger} strokeWidth={2.2} />
                  <Text style={[styles.retryTitle, { color: tc.danger }]}>{t('Confirmation failed')}</Text>
                </View>
                {confirmFailures.map((failure) => (
                  <Text key={failure.lineId} style={[styles.failureText, { color: tc.danger }]} numberOfLines={3}>
                    {failure.reason}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.lines}>
              {lines.map((line) => (
                <LineCard
                  key={line.id}
                  line={line}
                  selected={selectedIds.has(line.id)}
                  draft={drafts[line.id] ?? defaultLineDraft(line)}
                  onToggle={() => toggleLine(line)}
                  onIgnore={() => ignoreLine(line)}
                  onChange={(updates) => updateDraft(line.id, updates)}
                  onUndo={() => undoLine(line)}
                />
              ))}
            </View>

            {review.receipt.redacted_ocr_text ? (
              <View style={[styles.rawPanel, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
                <Text style={[styles.rawTitle, { color: tc.text }]}>{t('Redacted OCR')}</Text>
                <Text style={[styles.rawText, { color: tc.textSecondary }]}>{review.receipt.redacted_ocr_text}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {review ? (
        <View style={[styles.footer, { backgroundColor: tc.background, borderTopColor: theme.glass.cardBorder }]}>
          <Pressable
            style={({ pressed }) => [
              styles.confirmButton,
              { backgroundColor: tc.accent },
              (selectedCount === 0 || busy) && { opacity: 0.45 },
              pressed && selectedCount > 0 && !busy && { opacity: 0.82, transform: [{ scale: 0.99 }] },
            ]}
            disabled={selectedCount === 0 || busy}
            onPress={confirmSelected}
          >
            <PackagePlus size={18} color={tc.background} strokeWidth={2.5} />
            <Text style={[styles.confirmText, { color: tc.background }]}>
              {busy ? t('Updating') : t('receipt_confirm_selected', { count: selectedCount })}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  content: { paddingHorizontal: 24, paddingBottom: 116, gap: 14 },
  summaryCard: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryText: { flex: 1, gap: 3 },
  summaryTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 16 },
  summaryMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11 },
  summaryStats: { flexDirection: 'row', gap: 10 },
  summaryStat: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  failureText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12, lineHeight: 17 },
  lines: { gap: 10 },
  lineCard: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  lineTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkIcon: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  lineBody: { flex: 1, gap: 3 },
  lineTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14, lineHeight: 19 },
  lineMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 9, textTransform: 'capitalize' },
  candidateBox: { borderRadius: 13, padding: 10, gap: 3 },
  candidateLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  candidateMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, lineHeight: 16 },
  correctionBlock: { gap: 10 },
  correctionTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 12 },
  candidateChoices: { gap: 8 },
  candidateChoice: { width: 168, minHeight: 64, borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 9, gap: 4 },
  candidateChoiceTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11 },
  candidateChoiceMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 10, lineHeight: 14 },
  input: { minHeight: 42, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9, fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  inlineInputs: { flexDirection: 'row', gap: 10 },
  inlineInput: { flex: 1 },
  lineActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  ignoreButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6 },
  ignoreText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  rawPanel: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 8 },
  rawTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 15 },
  rawText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, lineHeight: 17 },
  emptyState: { borderWidth: 1, borderRadius: 18, padding: 22, alignItems: 'center', gap: 12 },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  confirmButton: { minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  confirmText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 14 },
  selectAllRow: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectAllText: { flex: 1, fontFamily: JAKARTA_FONTS.extraBold, fontSize: 13 },
  selectAllMeta: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  retryCard: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  retryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  retryTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 14 },
  retryButton: { minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  retryButtonText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 13 },
  retryEscalation: { flexDirection: 'row', gap: 10 },
  undoButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6 },
  undoText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
});
