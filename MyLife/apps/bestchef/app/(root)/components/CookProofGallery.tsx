import { Image } from 'expo-image';
import { ChefHat, Flag, Images, Trash2 } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import type { CookProofViewModel } from '../data/cloud-vote-proofs';
import {
  useAppThemeColors as useThemeColors,
  useAppThemeProfile as useTheme,
} from '../providers/AppThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { useReducedMotionPreference } from '../utils/media';
import { ReportMenu } from './ReportMenu';

export interface CookProofGalleryProps {
  proofs: CookProofViewModel[];
  loading?: boolean;
  title?: string;
  emptyMessage?: string;
  totalCount?: number;
  expanded?: boolean;
  highlightProofId?: string | null;
  canDeleteProof?: (proof: CookProofViewModel) => boolean;
  onPressProof?: (proof: CookProofViewModel) => void;
  onDeleteProof?: (proof: CookProofViewModel) => void;
  onViewAll?: () => void;
}

export function CookProofGallery({
  proofs,
  loading = false,
  title = 'CookProof Gallery',
  emptyMessage = 'Approved cook proofs will appear here.',
  totalCount,
  expanded = false,
  highlightProofId,
  canDeleteProof,
  onPressProof,
  onDeleteProof,
  onViewAll,
}: CookProofGalleryProps) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const reducedMotion = useReducedMotionPreference();

  const displayedCount = totalCount ?? proofs.length;
  const showViewAll = Boolean(onViewAll) && !expanded && displayedCount > proofs.length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Images size={18} color={tc.accent} strokeWidth={2.2} />
          <Text style={[styles.title, { color: tc.text }]}>{t(title)}</Text>
        </View>
        <View style={styles.headerActions}>
          {showViewAll ? (
            <Pressable
              hitSlop={8}
              onPress={onViewAll}
              accessibilityRole="button"
              accessibilityLabel={t('View all CookProofs')}
            >
              <Text style={[styles.viewAll, { color: tc.accent }]}>
                {t('View all ({count})', { count: displayedCount.toString() })}
              </Text>
            </Pressable>
          ) : null}
          <Text style={[styles.count, { color: tc.textTertiary }]}>
            {loading ? t('Loading') : t('{count} cooks', { count: displayedCount.toString() })}
          </Text>
        </View>
      </View>

      {proofs.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <ChefHat size={24} color={tc.textTertiary} strokeWidth={1.8} />
          <Text style={[styles.emptyText, { color: tc.textSecondary }]}>{loading ? t('Loading CookProofs') : t(emptyMessage)}</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
          accessibilityLabel={t('Approved CookProof gallery')}
        >
          {proofs.map((proof) => {
            const highlighted = proof.id === highlightProofId;
            const deletable = Boolean(canDeleteProof?.(proof) && onDeleteProof);
            // Guideline 1.2: every piece of UGC a viewer doesn't own must be reportable.
            const reportable = !deletable;
            return (
              <View
                key={proof.id}
                style={[
                  styles.proofCard,
                  {
                    backgroundColor: theme.glass.cardFill,
                    borderColor: highlighted ? tc.accent : theme.glass.cardBorder,
                  },
                ]}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.proofPressable,
                    pressed && !reducedMotion && { opacity: 0.84, transform: [{ scale: 0.98 }] },
                    pressed && reducedMotion && { opacity: 0.84 },
                  ]}
                  onPress={() => onPressProof?.(proof)}
                  accessibilityRole="button"
                  accessibilityLabel={t('Open CookProof by {name}', { name: proof.authorName })}
                >
                  <View style={[styles.imageFrame, { backgroundColor: tc.surface }]}>
                    {proof.imageUrl ? (
                      <Image source={{ uri: proof.imageUrl }} style={styles.proofImage} contentFit="cover" />
                    ) : (
                      <ChefHat size={26} color={tc.accent} strokeWidth={1.8} />
                    )}
                  </View>
                  <Text style={[styles.author, { color: tc.text }]} numberOfLines={1}>{proof.authorName}</Text>
                  <Text style={[styles.handle, { color: tc.textTertiary }]} numberOfLines={1}>@{proof.authorHandle}</Text>
                  <Text style={[styles.tier, { color: tc.accent }]} numberOfLines={1}>{t(proof.tier)}</Text>
                </Pressable>
                {deletable ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.deleteButton,
                      { backgroundColor: `${tc.danger}18`, borderColor: `${tc.danger}44` },
                      pressed && { opacity: 0.78, transform: [{ scale: 0.96 }] },
                    ]}
                    onPress={() => onDeleteProof?.(proof)}
                    accessibilityRole="button"
                    accessibilityLabel={t('Delete CookProof vote')}
                  >
                    <Trash2 size={14} color={tc.danger} strokeWidth={2.2} />
                  </Pressable>
                ) : null}
                {reportable ? (
                  <ReportMenu
                    targetKind="vote_proof"
                    targetId={proof.id}
                    accessibilityLabel={t('Report this CookProof')}
                    style={[
                      styles.reportButton,
                      { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
                    ]}
                  >
                    <Flag size={13} color={tc.textSecondary} strokeWidth={2.2} />
                  </ReportMenu>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  title: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  headerActions: { alignItems: 'flex-end', gap: 3 },
  viewAll: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 11 },
  count: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11 },
  emptyCard: { borderWidth: 1, borderRadius: 16, minHeight: 116, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18 },
  emptyText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  strip: { gap: 12, paddingRight: 2 },
  proofCard: { width: 118, borderWidth: 1, borderRadius: 14, padding: 9, gap: 7, position: 'relative' },
  proofPressable: { gap: 7 },
  imageFrame: { height: 96, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  proofImage: { width: '100%', height: '100%' },
  author: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  handle: { fontFamily: JAKARTA_FONTS.medium, fontSize: 10 },
  tier: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 10, textTransform: 'capitalize' },
  deleteButton: { position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  reportButton: { position: 'absolute', top: 6, left: 6, width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
