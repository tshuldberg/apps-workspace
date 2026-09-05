import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { Text as RNText } from 'react-native';
import { Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  CalendarRange,
  HeartPulse,
  Lock,
  ShieldCheck,
  Smile,
  Thermometer,
  TrendingUp,
} from 'lucide-react-native';
import {
  GlassCard,
  createPartnerLink,
  getActivePartnerLink,
  revokePartnerLink,
  updatePartnerLink,
  CYCLE_ACCENT,
  CYCLE_ACCENT_LIGHT,
  CYCLE_FONTS,
  CYCLE_PHASE_COLORS,
  CYCLE_SURFACES,
  CYCLE_TYPOGRAPHY,
  type PartnerLink,
} from '@mylife/cycle';
import { LinearGradient } from 'expo-linear-gradient';
import { uuid } from '../../lib/uuid';
import { useDatabase } from '../../components/DatabaseProvider';

type SharingToggleKey =
  | 'cycleDates'
  | 'symptoms'
  | 'mood'
  | 'predictions'
  | 'temperature';

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [pressed && !disabled && { opacity: 0.92 }]}
    >
      <LinearGradient
        colors={
          disabled
            ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.08)']
            : [CYCLE_ACCENT_LIGHT, CYCLE_ACCENT]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryButton}
      >
        <RNText
          style={[
            styles.primaryButtonText,
            disabled && { color: 'rgba(228, 225, 233, 0.45)' },
          ]}
        >
          {label}
        </RNText>
      </LinearGradient>
    </Pressable>
  );
}

export default function SharingScreen() {
  const db = useDatabase();
  const [refreshKey, setRefreshKey] = useState(0);
  const [partnerName, setPartnerName] = useState('');

  const refresh = useCallback(() => setRefreshKey((tick) => tick + 1), []);

  const activeLink = useMemo(() => {
    try {
      return getActivePartnerLink(db);
    } catch {
      return null;
    }
  }, [db, refreshKey]);

  const toggleRows = useMemo(
    () =>
      activeLink
        ? [
            {
              key: 'cycleDates' as const,
              label: 'Cycle Dates',
              description: 'Period start and end dates',
              icon: <CalendarRange color={CYCLE_PHASE_COLORS.ovulation} size={18} strokeWidth={2} />,
              value: activeLink.sharePhase,
            },
            {
              key: 'symptoms' as const,
              label: 'Symptoms',
              description: 'Physical symptom logs only',
              icon: <HeartPulse color={CYCLE_PHASE_COLORS.menstrual} size={18} strokeWidth={2} />,
              value: activeLink.shareSymptoms,
            },
            {
              key: 'mood' as const,
              label: 'Mood',
              description: 'Daily emotional check-ins',
              icon: <Smile color={CYCLE_PHASE_COLORS.follicular} size={18} strokeWidth={2} />,
              value: activeLink.shareMood,
            },
            {
              key: 'predictions' as const,
              label: 'Predictions',
              description: 'Next period and fertile window estimates',
              icon: <TrendingUp color={CYCLE_ACCENT} size={18} strokeWidth={2} />,
              value: activeLink.sharePredictions || activeLink.shareFertileWindow,
            },
            {
              key: 'temperature' as const,
              label: 'Temperature',
              description: 'Basal body temperature readings',
              icon: <Thermometer color={CYCLE_PHASE_COLORS.ovulation} size={18} strokeWidth={2} />,
              value: activeLink.shareTemperature,
            },
          ]
        : [],
    [activeLink],
  );

  const enabledCount = toggleRows.filter((row) => row.value).length;

  const handleCreateLink = useCallback(
    (base?: PartnerLink) => {
      try {
        if (base) {
          revokePartnerLink(db, base.id);
        }

        createPartnerLink(db, uuid(), {
          partnerName: partnerName.trim() || base?.partnerName || undefined,
          sharePhase: base?.sharePhase ?? true,
          sharePredictions: base?.sharePredictions ?? true,
          shareFertileWindow: base?.shareFertileWindow ?? true,
          shareSymptoms: base?.shareSymptoms ?? false,
          shareMood: base?.shareMood ?? false,
          shareTemperature: base?.shareTemperature ?? false,
          sharePregnancy: base?.sharePregnancy ?? true,
        });

        setPartnerName('');
        refresh();
      } catch (error) {
        Alert.alert(
          'Unable to create share link',
          error instanceof Error ? error.message : 'Please try again.',
        );
      }
    },
    [db, partnerName, refresh],
  );

  const handleCopyCode = useCallback(async () => {
    if (!activeLink) return;

    await Clipboard.setStringAsync(activeLink.linkCode);
    Alert.alert('Copied', 'Share code copied to your clipboard.');
  }, [activeLink]);

  const handleRevoke = useCallback(() => {
    if (!activeLink) return;

    Alert.alert('Revoke partner link?', 'The current share code will stop working immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => {
          try {
            revokePartnerLink(db, activeLink.id);
            refresh();
          } catch (error) {
            Alert.alert(
              'Unable to revoke link',
              error instanceof Error ? error.message : 'Please try again.',
            );
          }
        },
      },
    ]);
  }, [activeLink, db, refresh]);

  const handleRefreshCode = useCallback(() => {
    if (!activeLink) return;

    Alert.alert(
      'Generate a new share code?',
      'This creates a fresh code and disables the current one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: () => handleCreateLink(activeLink),
        },
      ],
    );
  }, [activeLink, handleCreateLink]);

  const updatePreference = useCallback(
    (key: SharingToggleKey, value: boolean) => {
      if (!activeLink) return;

      try {
        if (key === 'cycleDates') {
          updatePartnerLink(db, activeLink.id, { sharePhase: value });
        } else if (key === 'symptoms') {
          updatePartnerLink(db, activeLink.id, { shareSymptoms: value });
        } else if (key === 'mood') {
          updatePartnerLink(db, activeLink.id, { shareMood: value });
        } else if (key === 'predictions') {
          updatePartnerLink(db, activeLink.id, {
            sharePredictions: value,
            shareFertileWindow: value,
          });
        } else if (key === 'temperature') {
          updatePartnerLink(db, activeLink.id, { shareTemperature: value });
        }
        refresh();
      } catch (error) {
        Alert.alert(
          'Unable to update sharing preferences',
          error instanceof Error ? error.message : 'Please try again.',
        );
      }
    },
    [activeLink, db, refresh],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Partner Sync' }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.heroWrap}>
          <RNText style={styles.heroTitle}>Partner Sync</RNText>
          <RNText style={styles.heroBody}>
            Share only what matters, and keep reproductive health data fully under your control.
          </RNText>
        </View>

        {activeLink ? (
          <>
            <GlassCard style={styles.connectionCard}>
              <View style={styles.connectionCopy}>
                <View style={styles.connectionAvatar}>
                  <Lock color={CYCLE_ACCENT} size={18} strokeWidth={2.1} />
                </View>
                <View style={styles.connectionTextWrap}>
                  <RNText style={styles.sectionEyebrow}>Current Sync</RNText>
                  <RNText style={styles.connectionTitle}>
                    Connected: {activeLink.partnerName ?? 'Trusted partner'}
                  </RNText>
                </View>
              </View>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <RNText style={styles.statusText}>Active</RNText>
              </View>
            </GlassCard>

            <GlassCard variant="high" style={styles.codeCard}>
              <RNText style={styles.sectionEyebrow}>Share Code</RNText>
              <View style={styles.codeSurface}>
                <RNText style={styles.codeText}>{activeLink.linkCode}</RNText>
              </View>
              <View style={styles.codeMetaRow}>
                <RNText style={styles.codeMetaText}>
                  {enabledCount} of 5 privacy switches enabled
                </RNText>
                <Pressable
                  onPress={handleCopyCode}
                  style={({ pressed }) => [styles.copyButton, pressed && { opacity: 0.8 }]}
                >
                  <RNText style={styles.copyButtonText}>Copy</RNText>
                </Pressable>
              </View>
            </GlassCard>

            <GlassCard style={styles.privacyStoryCard}>
              <View style={styles.privacyStoryIcon}>
                <ShieldCheck color={CYCLE_PHASE_COLORS.ovulation} size={20} strokeWidth={2} />
              </View>
              <View style={styles.privacyStoryCopy}>
                <RNText style={styles.privacyStoryTitle}>Your data, your control.</RNText>
                <RNText style={styles.privacyStoryBody}>
                  Choose exactly what your partner can see. Changes apply instantly to this link
                  and can be revoked at any time.
                </RNText>
              </View>
            </GlassCard>

            <View style={styles.sectionHeaderRow}>
              <RNText style={styles.sectionEyebrow}>Granular Privacy Control</RNText>
              <RNText style={styles.sectionHeaderAction}>
                {enabledCount === 5 ? 'All active' : `${enabledCount}/5 active`}
              </RNText>
            </View>

            <View style={styles.toggleList}>
              {toggleRows.map((row) => (
                <GlassCard key={row.key} style={styles.toggleRow}>
                  <View style={styles.toggleIconWrap}>{row.icon}</View>
                  <View style={styles.toggleCopy}>
                    <RNText style={styles.toggleLabel}>{row.label}</RNText>
                    <RNText style={styles.toggleDescription}>{row.description}</RNText>
                  </View>
                  <Switch
                    value={row.value}
                    onValueChange={(value) => updatePreference(row.key, value)}
                    trackColor={{
                      false: CYCLE_SURFACES.highest,
                      true: `${CYCLE_PHASE_COLORS.ovulation}AA`,
                    }}
                    thumbColor={row.value ? '#FFF7FB' : 'rgba(214, 195, 181, 0.72)'}
                  />
                </GlassCard>
              ))}
            </View>

            <View style={styles.actionsGrid}>
              <PrimaryButton label="Generate new code" onPress={handleRefreshCode} />
              <Pressable
                onPress={handleRevoke}
                style={({ pressed }) => [styles.revokeButton, pressed && { opacity: 0.8 }]}
              >
                <RNText style={styles.revokeButtonText}>Revoke link</RNText>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <GlassCard variant="high" style={styles.emptyHeroCard}>
              <View style={styles.emptyHeroIcon}>
                <Lock color={CYCLE_PHASE_COLORS.ovulation} size={24} strokeWidth={2} />
              </View>
              <RNText style={styles.emptyHeroTitle}>Create a private share link</RNText>
              <RNText style={styles.emptyHeroBody}>
                Generate a code for a partner, then decide exactly which parts of your cycle story
                they can see.
              </RNText>
            </GlassCard>

            <GlassCard style={styles.createCard}>
              <RNText style={styles.sectionEyebrow}>Share Setup</RNText>
              <TextInput
                value={partnerName}
                onChangeText={setPartnerName}
                placeholder="Partner name (optional)"
                placeholderTextColor="rgba(214, 195, 181, 0.42)"
                style={styles.nameInput}
              />
              <PrimaryButton label="Create share link" onPress={() => handleCreateLink()} />
            </GlassCard>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: CYCLE_SURFACES.base,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 48,
    gap: 18,
  },
  heroWrap: {
    gap: 8,
  },
  heroTitle: {
    ...CYCLE_TYPOGRAPHY.displayMd,
    color: '#F7F2FA',
  },
  heroBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.82)',
  },
  sectionEyebrow: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.58)',
  },
  connectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  connectionCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  connectionAvatar: {
    width: 52,
    height: 52,
    borderRadius: 20,
    backgroundColor: 'rgba(201, 137, 77, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionTextWrap: {
    gap: 2,
    flex: 1,
  },
  connectionTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#F5F0F8',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#30D158',
  },
  statusText: {
    ...CYCLE_TYPOGRAPHY.labelTight,
    color: '#30D158',
  },
  codeCard: {
    gap: 14,
  },
  codeSurface: {
    minHeight: 96,
    borderRadius: 24,
    backgroundColor: CYCLE_SURFACES.base,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: CYCLE_PHASE_COLORS.ovulation,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  codeText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: 3,
    color: CYCLE_PHASE_COLORS.ovulation,
  },
  codeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  codeMetaText: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.74)',
  },
  copyButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonText: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 12,
    lineHeight: 14,
    color: '#F5F0F8',
  },
  privacyStoryCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  privacyStoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(244, 114, 182, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyStoryCopy: {
    flex: 1,
    gap: 4,
  },
  privacyStoryTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#F5F0F8',
  },
  privacyStoryBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.76)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderAction: {
    ...CYCLE_TYPOGRAPHY.labelTight,
    color: CYCLE_PHASE_COLORS.ovulation,
  },
  toggleList: {
    gap: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    ...CYCLE_TYPOGRAPHY.titleMd,
    color: '#F5F0F8',
  },
  toggleDescription: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.74)',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  revokeButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  revokeButtonText: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
    color: CYCLE_PHASE_COLORS.menstrual,
  },
  primaryButton: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 142,
  },
  primaryButtonText: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
    color: '#4B2700',
  },
  emptyHeroCard: {
    gap: 10,
    alignItems: 'center',
  },
  emptyHeroIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: 'rgba(244, 114, 182, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHeroTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#F7F2FA',
    textAlign: 'center',
  },
  emptyHeroBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.78)',
    textAlign: 'center',
  },
  createCard: {
    gap: 14,
  },
  nameInput: {
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: CYCLE_SURFACES.high,
    paddingHorizontal: 18,
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 16,
    lineHeight: 20,
    color: '#F7F2FA',
  },
});
