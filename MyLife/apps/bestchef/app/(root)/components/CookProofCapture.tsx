import { Image } from 'expo-image';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  CloudOff,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { JAKARTA_FONTS, type VoteProofTier } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import {
  useAppThemeColors as useThemeColors,
  useAppThemeProfile as useTheme,
} from '../providers/AppThemeProvider';
import { useI18n } from '../i18n/I18nProvider';

export type CookProofCaptureState =
  | 'empty'
  | 'loading'
  | 'error'
  | 'success'
  | 'partial';

export interface CookProofCaptureProps {
  submissionTitle: string;
  selectedTier: VoteProofTier;
  photoUri: string | null;
  state: CookProofCaptureState;
  errorMessage?: string | null;
  onSelectTier: (tier: VoteProofTier) => void;
  onPickCamera: () => void;
  onPickLibrary: () => void;
  onSubmit: () => void;
}

export const COOK_PROOF_TIERS: Array<{
  tier: VoteProofTier;
  label: string;
  value: string;
}> = [
  { tier: 'gold', label: 'Gold', value: 'Best dish' },
  { tier: 'silver', label: 'Silver', value: 'Great cook' },
  { tier: 'bronze', label: 'Bronze', value: 'Solid plate' },
  { tier: 'like', label: 'Like', value: 'I cooked this' },
];

function StatusMessage({
  state,
  errorMessage,
}: {
  state: CookProofCaptureState;
  errorMessage?: string | null;
}) {
  const tc = useThemeColors();
  const { t } = useI18n();

  if (state === 'loading') {
    return (
      <View style={[styles.statusRow, { backgroundColor: `${tc.accent}14` }]}>
        <Loader2 size={18} color={tc.accent} strokeWidth={2.2} />
        <Text style={[styles.statusText, { color: tc.accent }]}>{t('Uploading proof and casting vote')}</Text>
      </View>
    );
  }

  if (state === 'success') {
    return (
      <View style={[styles.statusRow, { backgroundColor: `${tc.success}18` }]}>
        <CheckCircle2 size={18} color={tc.success} strokeWidth={2.2} />
        <Text style={[styles.statusText, { color: tc.success }]}>{t('Vote committed, pending review')}</Text>
      </View>
    );
  }

  if (state === 'partial') {
    return (
      <View style={[styles.statusRow, { backgroundColor: `${tc.primaryContainer}18` }]}>
        <CloudOff size={18} color={tc.primaryContainer} strokeWidth={2.2} />
        <Text style={[styles.statusText, { color: tc.primaryContainer }]}>{t('Offline draft queued')}</Text>
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={[styles.statusRow, { backgroundColor: `${tc.danger}16` }]}>
        <AlertCircle size={18} color={tc.danger} strokeWidth={2.2} />
        <Text style={[styles.statusText, { color: tc.danger }]}>{errorMessage ?? t('Unable to cast vote')}</Text>
      </View>
    );
  }

  return null;
}

export function CookProofCapture({
  submissionTitle,
  selectedTier,
  photoUri,
  state,
  errorMessage,
  onSelectTier,
  onPickCamera,
  onPickLibrary,
  onSubmit,
}: CookProofCaptureProps) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const busy = state === 'loading';
  const canSubmit = Boolean(photoUri) && !busy && state !== 'success';

  return (
    <View style={styles.container}>
      <View style={styles.copyBlock}>
        <Text style={[styles.eyebrow, { color: tc.accent }]}>{t('CookProof')}</Text>
        <Text style={[styles.title, { color: tc.text }]}>{submissionTitle}</Text>
        <Text style={[styles.subtitle, { color: tc.textSecondary }]}>
          {t('Upload a photo of your completed plated dish before you eat. No photo, no vote.')}
        </Text>
      </View>

      <View style={[styles.notice, { backgroundColor: `${tc.primaryContainer}16`, borderColor: `${tc.primaryContainer}44` }]}>
        <Text style={[styles.noticeText, { color: tc.text }]}>
          {t('Your photo will be public on this recipe and your profile.')}
        </Text>
      </View>

      <View style={styles.tierSheet}>
        <Text style={[styles.sectionLabel, { color: tc.text }]}>{t('Vote Tier')}</Text>
        <View style={styles.tierGrid}>
          {COOK_PROOF_TIERS.map((tier) => {
            const selected = tier.tier === selectedTier;
            return (
              <Pressable
                key={tier.tier}
                style={({ pressed }) => [
                  styles.tierButton,
                  {
                    backgroundColor: selected ? `${tc.accent}20` : theme.glass.cardFill,
                    borderColor: selected ? tc.accent : theme.glass.cardBorder,
                  },
                  pressed && !busy && { opacity: 0.82, transform: [{ scale: 0.98 }] },
                ]}
                disabled={busy}
                onPress={() => onSelectTier(tier.tier)}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: busy }}
                accessibilityLabel={t('Select {tier} vote', { tier: tier.label })}
              >
                <Text style={[styles.tierLabel, { color: selected ? tc.accent : tc.text }]}>{t(tier.label)}</Text>
                <Text style={[styles.tierValue, { color: tc.textTertiary }]}>{t(tier.value)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.photoPanel, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
        <View style={[styles.preview, { backgroundColor: tc.surface }]}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.previewImage} contentFit="cover" />
          ) : (
            <View style={styles.emptyPreview}>
              <Camera size={38} color={tc.accent} strokeWidth={1.8} />
              <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('No candidate photo')}</Text>
              <Text style={[styles.emptyText, { color: tc.textSecondary }]}>
                {t('Choose the plated dish photo you cooked yourself.')}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.photoActions}>
          <Pressable
            style={({ pressed }) => [
              styles.photoButton,
              { backgroundColor: tc.accent },
              pressed && !busy && { opacity: 0.82, transform: [{ scale: 0.98 }] },
            ]}
            disabled={busy}
            onPress={onPickCamera}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            accessibilityLabel={t('Open camera for CookProof photo')}
          >
            <Camera size={18} color={tc.background} strokeWidth={2.4} />
            <Text style={[styles.photoButtonText, { color: tc.background }]}>{t('Camera')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.photoButton,
              { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder, borderWidth: 1 },
              pressed && !busy && { opacity: 0.82, transform: [{ scale: 0.98 }] },
            ]}
            disabled={busy}
            onPress={onPickLibrary}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            accessibilityLabel={t('Choose CookProof photo from library')}
          >
            <ImageIcon size={18} color={tc.accent} strokeWidth={2.3} />
            <Text style={[styles.photoButtonText, { color: tc.accent }]}>{t('Library')}</Text>
          </Pressable>
        </View>
      </View>

      <StatusMessage state={state} errorMessage={errorMessage} />

      <Pressable
        style={({ pressed }) => [
          styles.submitButton,
          { backgroundColor: canSubmit ? tc.accent : tc.surfaceElevated },
          pressed && canSubmit && { opacity: 0.84, transform: [{ scale: 0.99 }] },
        ]}
        disabled={!canSubmit}
        onPress={onSubmit}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit, busy }}
        accessibilityLabel={t('Submit CookProof vote')}
      >
        <Text style={[styles.submitText, { color: canSubmit ? tc.background : tc.textTertiary }]}>
          {busy ? t('Uploading') : t('Submit Vote')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 18 },
  copyBlock: { gap: 8 },
  eyebrow: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 26, lineHeight: 32 },
  subtitle: { fontFamily: JAKARTA_FONTS.regular, fontSize: 14, lineHeight: 21 },
  notice: { borderWidth: 1, borderRadius: 12, padding: 13 },
  noticeText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13, lineHeight: 19 },
  tierSheet: { gap: 10 },
  sectionLabel: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 15 },
  tierGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tierButton: { width: '47%' as unknown as number, minHeight: 76, borderRadius: 14, borderWidth: 1, padding: 12, gap: 5, justifyContent: 'center' },
  tierLabel: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 15 },
  tierValue: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, lineHeight: 15 },
  photoPanel: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  preview: { minHeight: 260, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '100%', height: '100%' },
  emptyPreview: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 22 },
  emptyTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 16 },
  emptyText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  photoActions: { flexDirection: 'row', gap: 10 },
  photoButton: { flex: 1, minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  photoButtonText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 13 },
  statusRow: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 13, flexDirection: 'row', gap: 9, alignItems: 'center' },
  statusText: { flex: 1, fontFamily: JAKARTA_FONTS.bold, fontSize: 13, lineHeight: 18 },
  submitButton: { minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 15 },
});
