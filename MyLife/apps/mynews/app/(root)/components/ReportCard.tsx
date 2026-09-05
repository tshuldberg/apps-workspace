import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  REPORT_REASONS,
  REPORT_REASON_HINTS,
  REPORT_REASON_LABELS,
  submitReport,
  type ReportReason,
  type ReportTargetKind,
} from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { useMyNewsAuth } from '../providers/AuthProvider';
import { useMyNewsCloud } from '../providers/CloudProvider';
import { PrimaryButton, SecondaryButton } from './Buttons';
import { reportErrorMessage } from '../lib/report-errors';
import { ErrorText } from './ErrorText';

/**
 * Report affordance shared by the article, suggestion, and journalist screens.
 * A toggle-open in-scroll card (the app idiom, not a native sheet): pick a reason
 * from the taxonomy, add optional detail, submit through the pure submitReport
 * orchestrator. Every state is honest: signed-out shows a sign-in prompt, typed
 * server errors render mapped copy, and success is only shown on a real ok.
 */
export function ReportCard({
  targetKind,
  targetId,
  label,
}: {
  targetKind: ReportTargetKind;
  targetId: string;
  label?: string;
}) {
  const router = useRouter();
  const auth = useMyNewsAuth();
  const { port } = useMyNewsCloud();
  const hasSession = auth.status === 'anonymous' || auth.status === 'linked';

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [done, setDone] = useState<'submitted' | 'already-reported' | null>(null);

  const onSubmit = async () => {
    if (!port || !reason) return;
    setBusy(true);
    setError(null);
    setNeedsSignIn(false);
    const result = await submitReport({ targetKind, targetId, reason, detail: detail.trim(), port });
    setBusy(false);
    if (result.ok) {
      setDone(result.status);
      return;
    }
    const mapped = reportErrorMessage(result.code, result.detail);
    setError(mapped.message);
    setNeedsSignIn(mapped.action === 'sign-in');
  };

  if (done) {
    return (
      <View style={styles.card}>
        <Text style={styles.doneTitle}>
          {done === 'already-reported' ? 'Already reported' : 'Report submitted'}
        </Text>
        <Text style={styles.note}>
          {done === 'already-reported'
            ? 'You already have an open report on this. Our team reviews reports and takes action where needed.'
            : 'Thanks. Our team reviews reports and takes action where needed. You can see your reports in the Me tab.'}
        </Text>
      </View>
    );
  }

  if (!open) {
    return (
      <View style={styles.trigger}>
        <SecondaryButton label={label ?? 'Report'} onPress={() => setOpen(true)} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Report this content</Text>
      {!hasSession ? (
        <>
          <Text style={styles.note}>Sign in to report content. Reports are tied to your account.</Text>
          <SecondaryButton
            label="Sign in"
            onPress={() => router.push('/(root)/register')}
          />
        </>
      ) : (
        <>
          <Text style={styles.note}>Choose the closest reason.</Text>
          <View style={styles.reasons}>
            {REPORT_REASONS.map((r) => {
              const active = reason === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setReason(r)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.reasonChip, active && styles.reasonChipActive]}
                >
                  <Text style={[styles.reasonText, active && styles.reasonTextActive]}>
                    {REPORT_REASON_LABELS[r]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {/* Plan 48 WP8: the taxonomy is thirteen reasons now, so the sheet
              explains the selected one. Reason accuracy is what makes the
              severity rank and the SLA routing worth anything. */}
          {reason ? <Text style={styles.hint}>{REPORT_REASON_HINTS[reason]}</Text> : null}
          <TextInput
            accessibilityLabel="Report detail, optional"
            style={styles.input}
            placeholder="Add detail (optional)"
            placeholderTextColor={tokens.textTertiary}
            value={detail}
            onChangeText={setDetail}
            multiline
            maxLength={2000}
          />
          {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}
          {error && needsSignIn ? (
            <SecondaryButton label="Sign in" onPress={() => router.push('/(root)/register')} />
          ) : null}
          <PrimaryButton
            label="Submit report"
            onPress={() => void onSubmit()}
            disabled={!reason}
            loading={busy}
          />
        </>
      )}
      <View style={styles.cancel}>
        <SecondaryButton label="Cancel" onPress={() => setOpen(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    marginTop: 12,
  },
  card: {
    marginTop: 16,
    backgroundColor: tokens.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    gap: 10,
  },
  title: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '800',
  },
  doneTitle: {
    color: tokens.success,
    fontSize: 16,
    fontWeight: '800',
  },
  note: {
    color: tokens.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  reasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.surface,
  },
  reasonChipActive: {
    borderColor: tokens.accent,
    backgroundColor: tokens.accentDim,
  },
  reasonText: {
    color: tokens.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  reasonTextActive: {
    color: tokens.accent,
  },
  input: {
    minHeight: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.surface,
    color: tokens.text,
    padding: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  hint: { color: tokens.textTertiary, fontSize: 12, lineHeight: 17 },
  error: {
    color: tokens.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  cancel: {
    marginTop: 2,
  },
});
