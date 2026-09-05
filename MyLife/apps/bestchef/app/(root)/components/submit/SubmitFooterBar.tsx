import { ActivityIndicator, StyleSheet, View, Pressable } from 'react-native';
import { Send, X } from 'lucide-react-native';
import { Text } from '@mylife/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { type SubmitStep } from './types';
import { BackChevron, ForwardArrow } from '../DirectionalIcons';

interface Props {
  step: SubmitStep;
  canAdvance: boolean;
  publishing: boolean;
  /** 0-100 while the media queue uploads; null otherwise (Phase 4.4). */
  uploadProgress?: number | null;
  onCancelUpload?: () => void;
  onBack: () => void;
  onNext: () => void;
}

function primaryLabel(step: SubmitStep, publishing: boolean, t: (k: string) => string): string {
  if (publishing) return t('Publishing…');
  if (step === 'review') return t('Publish Recipe');
  if (step === 'details') return t('Review');
  return t('Continue');
}

function isBackCancel(step: SubmitStep): boolean {
  return step === 'dishSelection' || step === 'finalPhotos';
}

export function SubmitFooterBar({ step, canAdvance, publishing, uploadProgress, onCancelUpload, onBack, onNext }: Props) {
  const tc = useThemeColors();
  const { t } = useI18n();

  const backCancel = isBackCancel(step);
  const primaryActive = canAdvance && !publishing;

  const showProgress = publishing && uploadProgress !== null && uploadProgress !== undefined;

  return (
    <View style={[styles.container, { borderTopColor: tc.border ?? 'rgba(255,255,255,0.08)' }]}>
      {showProgress && (
        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: tc.surface }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: tc.accent, width: `${Math.max(2, Math.min(100, uploadProgress))}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressLabel, { color: tc.textSecondary }]}>
            {t('Uploading {pct}%', { pct: String(Math.round(uploadProgress)) })}
          </Text>
          {onCancelUpload && (
            <Pressable
              onPress={onCancelUpload}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('Cancel upload')}
            >
              <Text style={[styles.progressCancel, { color: tc.danger ?? '#FFB4AB' }]}>{t('Cancel')}</Text>
            </Pressable>
          )}
        </View>
      )}
      <View style={styles.row}>
        <Pressable
          onPress={onBack}
          style={[styles.backButton, { backgroundColor: tc.surface }]}
          hitSlop={8}
        >
          {backCancel ? (
            <X size={16} color={tc.text} strokeWidth={2.5} />
          ) : (
            <BackChevron size={16} color={tc.text} strokeWidth={2.5} />
          )}
          <Text style={[styles.backLabel, { color: tc.text }]}>
            {backCancel ? t('Cancel') : t('Back')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => { if (primaryActive) onNext(); }}
          disabled={!primaryActive}
          style={[
            styles.primaryButton,
            primaryActive
              ? { backgroundColor: tc.accent }
              : { backgroundColor: tc.textSecondary ? `${tc.textSecondary}59` : '#52443A' },
          ]}
        >
          {publishing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={[styles.primaryLabel, { color: '#fff' }]}>
                {primaryLabel(step, publishing, t)}
              </Text>
              {step === 'review' ? (
                <Send size={16} color="#fff" strokeWidth={2.5} />
              ) : (
                <ForwardArrow size={16} color="#fff" strokeWidth={2.5} />
              )}
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    minWidth: 88,
  },
  progressCancel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
  },
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
  },
  backLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
  },
  primaryButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
  },
  primaryLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
  },
});
