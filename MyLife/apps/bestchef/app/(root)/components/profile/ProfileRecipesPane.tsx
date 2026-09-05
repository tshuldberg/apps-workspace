import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { AlertCircle, ChefHat, Trash2 } from 'lucide-react-native';
import { Text } from '@mylife/ui';
import { JAKARTA_FONTS, RECIPES_TYPOGRAPHY } from '@mylife/bestchef';
import type { SignatureDish } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';
import type { CookProofViewModel } from '../../data/cloud-vote-proofs';
import { SignatureDishesSection } from './SignatureDishesSection';

interface Props {
  proofs: CookProofViewModel[];
  loading: boolean;
  proofsError?: { message: string } | null;
  onPressProof: (proof: CookProofViewModel) => void;
  onDeleteProof: (proof: CookProofViewModel) => void;
  onRetryProofs?: () => void;

  // Signature dishes
  signatureDishes: SignatureDish[];
  signatureDishesLoading?: boolean;
  canEditSignatures?: boolean;
  onPressEditSignatures?: () => void;
  onPressSignatureDish?: (dish: SignatureDish) => void;
}

export function ProfileRecipesPane({
  proofs,
  loading,
  proofsError = null,
  onPressProof,
  onDeleteProof,
  onRetryProofs,
  signatureDishes,
  signatureDishesLoading = false,
  canEditSignatures = false,
  onPressEditSignatures,
  onPressSignatureDish,
}: Props) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={styles.root}>
      {/* MyCookProofGrid */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: tc.text }]}>{t('My Cooks')}</Text>
          <Text style={[styles.sectionMeta, { color: tc.textTertiary }]}>
            {loading ? t('Loading') : t('{count} approved', { count: proofs.length.toString() })}
          </Text>
        </View>

        {proofsError ? (
          <View style={[styles.errorCard, { backgroundColor: `${tc.danger}10`, borderColor: `${tc.danger}55` }]}>
            <AlertCircle size={26} color={tc.danger} strokeWidth={1.8} />
            <Text style={[styles.errorTitle, { color: tc.text }]}>
              {t('profile_cookproof_failed')}
            </Text>
            {proofsError.message && proofsError.message.length > 0 && (
              <Text style={[styles.errorMessage, { color: tc.textSecondary }]} numberOfLines={3}>
                {proofsError.message}
              </Text>
            )}
            {onRetryProofs && (
              <Pressable
                style={({ pressed }) => [
                  styles.retryPill,
                  { backgroundColor: `${tc.danger}22`, borderColor: `${tc.danger}55` },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={onRetryProofs}
                accessibilityRole="button"
                accessibilityLabel={t('profile_cookproof_retry')}
              >
                <Text style={[styles.retryText, { color: tc.danger }]}>
                  {t('profile_cookproof_retry')}
                </Text>
              </Pressable>
            )}
          </View>
        ) : proofs.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <ChefHat size={28} color={tc.textTertiary} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: tc.text }]}>
              {loading ? t('Loading CookProofs') : t('No cooks yet')}
            </Text>
            <Text style={[styles.emptyMessage, { color: tc.textSecondary }]}>
              {t('Approved CookProofs from your votes will appear here.')}
            </Text>
          </View>
        ) : (
          <View style={styles.proofGrid}>
            {proofs.map((proof) => (
              <View
                key={proof.id}
                style={[styles.proofGridCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}
              >
                <View style={[styles.proofGridImageFrame, { backgroundColor: tc.surface }]}>
                  <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => onPressProof(proof)}
                    accessibilityRole="button"
                    accessibilityLabel={t('Open CookProof for {title}', { title: proof.submissionTitle })}
                  >
                    {proof.imageUrl ? (
                      <Image source={{ uri: proof.imageUrl }} style={styles.proofGridImage} contentFit="cover" />
                    ) : (
                      <View style={styles.proofGridFallback}>
                        <ChefHat size={22} color={tc.accent} strokeWidth={1.8} />
                      </View>
                    )}
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.proofGridDelete,
                      { backgroundColor: `${tc.danger}18`, borderColor: `${tc.danger}44` },
                      pressed && { opacity: 0.78, transform: [{ scale: 0.96 }] },
                    ]}
                    onPress={() => onDeleteProof(proof)}
                    accessibilityRole="button"
                    accessibilityLabel={t('Delete CookProof vote')}
                  >
                    <Trash2 size={13} color={tc.danger} strokeWidth={2.2} />
                  </Pressable>
                </View>
                <Pressable onPress={() => onPressProof(proof)} accessibilityRole="button">
                  <Text style={[styles.proofGridTitle, { color: tc.text }]} numberOfLines={2}>
                    {proof.submissionTitle}
                  </Text>
                  <Text style={[styles.proofGridTier, { color: tc.accent }]} numberOfLines={1}>
                    {t(proof.tier)}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      <SignatureDishesSection
        dishes={signatureDishes}
        loading={signatureDishesLoading}
        canEdit={canEditSignatures}
        onPressEdit={onPressEditSignatures}
        onPressDish={onPressSignatureDish}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },
  section: { gap: 12 },
  sectionTitle: { ...RECIPES_TYPOGRAPHY.headlineMd },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionMeta: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11 },

  proofGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  proofGridCard: {
    width: '31%' as unknown as number,
    borderRadius: 12,
    borderWidth: 1,
    padding: 7,
    gap: 7,
  },
  proofGridImageFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 9,
    overflow: 'hidden',
    position: 'relative',
  },
  proofGridImage: { width: '100%', height: '100%' },
  proofGridFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  proofGridDelete: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofGridTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, lineHeight: 13, minHeight: 26 },
  proofGridTier: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 9, textTransform: 'capitalize' },

  emptyCard: {
    borderRadius: 24, padding: 32,
    alignItems: 'center', gap: 8, borderWidth: 1,
  },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16, marginTop: 4 },
  emptyMessage: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, textAlign: 'center' },

  errorCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  errorTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15, marginTop: 2 },
  errorMessage: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12, textAlign: 'center' },
  retryPill: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  retryText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
});
