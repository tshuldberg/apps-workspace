import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Camera, Trash2, Upload, Video } from 'lucide-react-native';
import { InfoCard, StepHeader } from '@mylife/bestchef/ui';
import { HERO_GRADIENT, JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { useI18n } from '../../../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors } from '../../../providers/AppThemeProvider';
import { pickVideo } from '../../../utils/media';
import { videoDurationSecondsFromMs } from '../../../utils/media-limits';
import type { SubmitDraftState, DraftVideoClip } from '../../../state/useSubmitDraft';
import type { Dispatch } from 'react';

const TARGET_SECONDS = 300;

type Action =
  | { type: 'SET_VIDEO_CLIP'; clip: DraftVideoClip | null }
  | { type: 'SET_ENTER_COMPETITION'; value: boolean };

interface VideoStepProps {
  draft: SubmitDraftState;
  dispatch: Dispatch<Action>;
}

function timeStr(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export function VideoStep({ draft, dispatch }: VideoStepProps) {
  const tc = useThemeColors();
  const { t } = useI18n();

  const totalSeconds = draft.videoClip?.durationSeconds ?? 0;
  const ratio = Math.min(1, totalSeconds / TARGET_SECONDS);
  const atTarget = totalSeconds >= TARGET_SECONDS;

  async function handlePick(source: 'camera' | 'library') {
    try {
      const result = await pickVideo(source, t);
      if (!result) return;
      const durationSeconds = videoDurationSecondsFromMs(result.duration);
      dispatch({
        type: 'SET_VIDEO_CLIP',
        clip: {
          id: `vc-${Date.now()}`,
          uri: result.uri,
          type: 'video/mp4',
          durationSeconds,
          width: result.width,
          height: result.height,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('Could not access camera/library. Please try again.');
      Alert.alert(t('Error'), msg);
    }
  }

  return (
    <View style={styles.container}>
      <StepHeader
        title={t('Cook-along video')}
        subtitle={t('Optional 5-min cook-along')}
        required={draft.enterCompetition}
      />

      <InfoCard
        title={t('Up to 5 minutes')}
        message={t('A quick cook-along boosts your submission')}
      />

      {/* Progress card */}
      <View style={[styles.progressCard, { backgroundColor: tc.surface }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressTime, { color: tc.text }]}>{timeStr(totalSeconds)}</Text>
          <Text style={[styles.progressTarget, { color: tc.textSecondary }]}>/ 5:00 {t('min')}</Text>
          <View style={{ flex: 1 }} />
          {atTarget && (
            <View style={[styles.readyPill, { backgroundColor: 'rgba(48,209,88,0.15)' }]}>
              <Text style={[styles.readyPillText, { color: '#30D158' }]}>Ready</Text>
            </View>
          )}
        </View>
        <View style={[styles.trackBg, { backgroundColor: `${tc.text}14` }]}>
          <LinearGradient
            colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.trackFill, { width: `${ratio * 100}%` }]}
          />
        </View>
      </View>

      {/* Clip preview */}
      {draft.videoClip ? (
        <View style={[styles.clipRow, { backgroundColor: tc.surface }]}>
          <View style={[styles.clipThumb, { backgroundColor: tc.background }]}>
            <Video size={24} color={tc.accent} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.clipTitle, { color: tc.text }]}>{t('Cook-along video')}</Text>
            {draft.videoClip.durationSeconds !== undefined && (
              <Text style={[styles.clipDuration, { color: tc.textSecondary }]}>
                {timeStr(draft.videoClip.durationSeconds)}
              </Text>
            )}
          </View>
          <Pressable
            onPress={() => dispatch({ type: 'SET_VIDEO_CLIP', clip: null })}
            hitSlop={8}
          >
            <Trash2 size={16} color={`${tc.accent}CC`} strokeWidth={2} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.addButtons}>
          <Pressable
            style={[styles.dashedButton, { backgroundColor: tc.surface, borderColor: `${tc.accent}80` }]}
            onPress={() => handlePick('camera')}
          >
            <Camera size={20} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.dashedLabel, { color: tc.text }]}>{t('Record Video')}</Text>
          </Pressable>
          <Pressable
            style={[styles.dashedButton, { backgroundColor: tc.surface, borderColor: `${tc.accent}80` }]}
            onPress={() => handlePick('library')}
          >
            <Upload size={20} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.dashedLabel, { color: tc.text }]}>{t('Upload')}</Text>
          </Pressable>
        </View>
      )}

      {/* Competition toggle */}
      <View style={[styles.toggleCard, { backgroundColor: tc.surface }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.toggleTitle, { color: tc.text }]}>{t('Enter Top-100 competition')}</Text>
          <Text style={[styles.toggleSub, { color: tc.textSecondary }]}>
            {t('Required for top-100 leaderboard rankings. Use a real photo of your finished dish.')}
          </Text>
        </View>
        <Switch
          value={draft.enterCompetition}
          onValueChange={(v) => dispatch({ type: 'SET_ENTER_COMPETITION', value: v })}
          trackColor={{ true: tc.accent }}
          ios_backgroundColor={tc.surface}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 18 },
  progressCard: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressTime: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 28 },
  progressTarget: { fontFamily: JAKARTA_FONTS.regular, fontSize: 13 },
  readyPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  readyPillText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 11 },
  trackBg: { height: 8, borderRadius: 999, overflow: 'hidden' },
  trackFill: { height: 8, borderRadius: 999 },
  clipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
  },
  clipThumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipTitle: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 14 },
  clipDuration: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12 },
  addButtons: { flexDirection: 'row', gap: 10 },
  dashedButton: {
    flex: 1,
    height: 96,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dashedLabel: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
  },
  toggleTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  toggleSub: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12, lineHeight: 16 },
});
