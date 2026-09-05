import { Image, Pressable, StyleSheet, View } from 'react-native';
import { CheckCircle, Clock, Edit2, UtensilsCrossed, XCircle } from 'lucide-react-native';
import { DishVisual } from '@mylife/bestchef/ui';
import { HERO_GRADIENT, JAKARTA_FONTS, getDishVisuals } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { useI18n } from '../../../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors } from '../../../providers/AppThemeProvider';
import type { SubmitDraftState } from '../../../state/useSubmitDraft';
import type { SubmitStep } from '../types';

interface ReviewStepProps {
  draft: SubmitDraftState;
  setStep: (step: SubmitStep) => void;
}

function CheckRow({ ok, label, detail, onEdit }: { ok: boolean; label: string; detail: string; onEdit: () => void }) {
  const tc = useThemeColors();
  return (
    <View style={[styles.checkRow, { backgroundColor: tc.surface }]}>
      {ok
        ? <CheckCircle size={18} color="#30D158" strokeWidth={2} />
        : <XCircle size={18} color={tc.accent} strokeWidth={2} />
      }
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.checkLabel, { color: tc.text }]}>{label}</Text>
        <Text style={[styles.checkDetail, { color: ok ? tc.textSecondary : tc.accent }]}>{detail}</Text>
      </View>
      <Pressable onPress={onEdit} hitSlop={8}>
        <Edit2 size={14} color={tc.textSecondary} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

export function ReviewStep({ draft, setStep }: ReviewStepProps) {
  const tc = useThemeColors();
  const { t } = useI18n();

  const dishVisuals = draft.selectedDish
    ? getDishVisuals(draft.selectedDish.name)
    : null;

  const totalVideoSec = draft.videoClip?.durationSeconds ?? 0;
  const videoOk = !draft.enterCompetition || totalVideoSec >= 300;
  const videoDetail = draft.videoClip
    ? `${Math.floor(totalVideoSec / 60)}:${String(Math.floor(totalVideoSec % 60)).padStart(2, '0')}`
    : t('No video');

  return (
    <View style={styles.container}>
      {/* Hero preview */}
      <View style={[styles.hero, { overflow: 'hidden', borderRadius: 20 }]}>
        {draft.finalPhotos[0] ? (
          <Image source={{ uri: draft.finalPhotos[0].uri }} style={styles.heroImage} />
        ) : dishVisuals ? (
          <DishVisual
            dish={{ name: draft.selectedDish?.name ?? '', emoji: dishVisuals.emoji, gradientFrom: dishVisuals.from, gradientTo: dishVisuals.to }}
            size={260}
            radius={0}
            style={{ width: '100%' }}
          />
        ) : (
          <LinearGradient
            colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
            style={styles.heroFallback}
          />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.65)']}
          style={styles.heroOverlay}
        />
        <View style={styles.heroText}>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {draft.title || t('Your recipe title')}
          </Text>
          <Text style={styles.heroMeta}>
            {[draft.difficulty, draft.region].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {/* Checklist */}
      <View style={styles.section}>
        <CheckRow
          ok={draft.finalPhotos.length > 0}
          label={t('Final photos')}
          detail={`${draft.finalPhotos.length} ${t('Added')}`}
          onEdit={() => setStep('finalPhotos')}
        />
        <CheckRow
          ok={draft.ingredientPhoto !== null}
          label={t('Portioned ingredients photo')}
          detail={draft.ingredientPhoto ? t('Added') : t('Missing')}
          onEdit={() => setStep('ingredients')}
        />
        <CheckRow
          ok={draft.ingredients.length > 0}
          label={t('Ingredients')}
          detail={`${draft.ingredients.length} ${t('items')}`}
          onEdit={() => setStep('ingredients')}
        />
        <CheckRow
          ok={videoOk}
          label={t('Cook-along video')}
          detail={videoDetail}
          onEdit={() => setStep('video')}
        />
        <CheckRow
          ok={draft.title.trim().length > 0}
          label={t('Recipe Title')}
          detail={draft.title.trim() || t('Missing')}
          onEdit={() => setStep('details')}
        />
      </View>

      {/* Summary card */}
      <View style={[styles.summaryCard, { backgroundColor: tc.surface }]}>
        <Text style={[styles.summaryTitle, { color: tc.text }]}>{t('Submission summary')}</Text>
        <View style={styles.chips}>
          <Chip icon={<UtensilsCrossed size={11} color={tc.text} strokeWidth={2} />} label={draft.selectedDish?.name ?? '—'} tc={tc} />
          <Chip icon={<Clock size={11} color={tc.text} strokeWidth={2} />} label={`${draft.cookMinutes}m`} tc={tc} />
        </View>
        {draft.enterCompetition && (
          <Text style={[styles.competitionNote, { color: tc.accent }]}>
            Entered into Top 100 leaderboards
          </Text>
        )}
      </View>
    </View>
  );
}

function Chip({ icon, label, tc }: { icon: React.ReactNode; label: string; tc: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={[styles.chip, { backgroundColor: `${tc.text}12` }]}>
      {icon}
      <Text style={[styles.chipText, { color: tc.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  hero: { height: 200, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroFallback: { width: '100%', height: '100%' },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroText: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    right: 16,
    gap: 4,
  },
  heroTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 22, color: '#fff' },
  heroMeta: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  section: { gap: 8 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  checkLabel: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 14 },
  checkDetail: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12 },
  summaryCard: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  summaryTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 },
  competitionNote: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13 },
});
