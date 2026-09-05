import { useCallback, useEffect, useRef, useState } from 'react';
import { uuid } from '../../lib/uuid';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  SOUND_LIBRARY,
  getSoundPresetById,
  createFocusSession,
  completeFocusSession,
  createSoundPreset,
  validateLayers,
  mixLayers,
  getSoundById,
  type SoundLayer,
  GlassCard,
  GradientButton,
  SectionHeader,
  MOOD_SURFACES,
  MOOD_ACCENT,
  MOOD_ACCENT_LIGHT,
  MOOD_TYPOGRAPHY,
} from '@mylife/mood';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const DURATION_OPTIONS = [15, 30, 45] as const;

const SOUND_ICONS: Record<string, string> = {
  rain: '\u{1F327}\u{FE0F}',
  thunder_distant: '\u{26C8}\u{FE0F}',
  ocean: '\u{1F30A}',
  wind: '\u{1F32C}\u{FE0F}',
  birds: '\u{1F426}',
  creek: '\u{1F4A7}',
  fire: '\u{1F525}',
  cafe: '\u{2615}',
  library: '\u{1F4DA}',
  train: '\u{1F682}',
  white_noise: '\u{26AA}',
  pink_noise: '\u{1F7E3}',
  brown_noise: '\u{1F7E4}',
};

type Phase = 'pre' | 'active' | 'post';

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function FocusSessionScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { presetId, presetName: paramName, layers: paramLayers } = useLocalSearchParams<{
    presetId?: string;
    presetName?: string;
    layers?: string;
  }>();

  const [phase, setPhase] = useState<Phase>('pre');
  const [sessionId] = useState(() => uuid());
  const [presetDisplayName, setPresetDisplayName] = useState('Focus Session');
  const [activeLayers, setActiveLayers] = useState<SoundLayer[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [preMood, setPreMood] = useState(7);
  const [postMood, setPostMood] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.7);
  const [showAddSound, setShowAddSound] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (presetId) {
      const preset = getSoundPresetById(db, presetId);
      if (preset) {
        setPresetDisplayName(preset.name);
        setActiveLayers(preset.layers);
      }
    } else if (paramLayers) {
      try {
        const parsed = JSON.parse(paramLayers) as SoundLayer[];
        setActiveLayers(parsed);
      } catch {
        // ignore parse errors
      }
      if (paramName) setPresetDisplayName(decodeURIComponent(paramName));
    }
  }, [db, presetId, paramName, paramLayers]);

  const targetSeconds = durationMinutes * 60;
  const remaining = Math.max(0, targetSeconds - elapsed);

  const addSound = useCallback((soundId: string) => {
    setActiveLayers((prev) => {
      if (prev.some((l) => l.sound === soundId)) return prev;
      return [...prev, { sound: soundId, volume: 0.5 }];
    });
  }, []);

  const removeSound = useCallback((soundId: string) => {
    setActiveLayers((prev) => prev.filter((l) => l.sound !== soundId));
  }, []);

  const setLayerVolume = useCallback((soundId: string, volume: number) => {
    setActiveLayers((prev) =>
      prev.map((l) => (l.sound === soundId ? { ...l, volume } : l)),
    );
  }, []);

  const startSession = useCallback(() => {
    const validation = validateLayers(activeLayers);
    if (!validation.valid) return;

    createFocusSession(db, sessionId, {
      presetName: presetDisplayName,
      layers: activeLayers,
      targetDurationSeconds: targetSeconds,
      preMoodScore: preMood,
    });

    startTimeRef.current = Date.now();
    setPhase('active');

    intervalRef.current = setInterval(() => {
      const now = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(now);
      if (now >= targetSeconds) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setPhase('post');
      }
    }, 1000);
  }, [db, sessionId, presetDisplayName, activeLayers, targetSeconds, preMood]);

  const pauseSession = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resumeSession = useCallback(() => {
    const alreadyElapsed = elapsed;
    startTimeRef.current = Date.now() - alreadyElapsed * 1000;
    intervalRef.current = setInterval(() => {
      const now = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(now);
      if (now >= targetSeconds) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setPhase('post');
      }
    }, 1000);
  }, [elapsed, targetSeconds]);

  const stopSession = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPhase('post');
  }, []);

  const finishSession = useCallback(() => {
    completeFocusSession(db, sessionId, {
      actualDurationSeconds: elapsed,
      postMoodScore: postMood,
    });
    router.back();
  }, [db, sessionId, elapsed, postMood, router]);

  const handleSavePreset = useCallback(() => {
    if (activeLayers.length === 0) return;
    createSoundPreset(db, uuid(), {
      name: presetDisplayName || 'Custom Mix',
      layers: activeLayers,
    });
  }, [db, activeLayers, presetDisplayName]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const mixedLayers = mixLayers(activeLayers, masterVolume);

  // --- PRE-SESSION ---
  if (phase === 'pre') {
    const availableSounds = SOUND_LIBRARY.filter(
      (s) => !activeLayers.some((l) => l.sound === s.id),
    );

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.labelUpper}>FOCUS SESSION</Text>
            <Text style={styles.timerDisplay}>{formatTime(targetSeconds)}</Text>
          </View>

          {/* Duration chips */}
          <View style={styles.chipRow}>
            {DURATION_OPTIONS.map((mins) => {
              const selected = mins === durationMinutes;
              return (
                <Pressable
                  key={mins}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => setDurationMinutes(mins)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextActive,
                    ]}
                  >
                    {mins}m
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Current Vibe - mood slider */}
          <View style={styles.section}>
            <SectionHeader label="CURRENT VIBE" title="" />
            <GlassCard level={3} style={styles.vibeCard}>
              <View style={styles.vibeHeader}>
                <Text style={styles.vibeLabel}>PRE-SESSION MOOD</Text>
                <Text style={styles.vibeScore}>{preMood}/10</Text>
              </View>
              <SessionVolumeBar
                value={preMood / 10}
                onValueChange={(v) => setPreMood(Math.max(1, Math.round(v * 10)))}
              />
              <View style={styles.vibeRange}>
                <Text style={styles.vibeRangeText}>DRAINED</Text>
                <Text style={styles.vibeRangeText}>RADIANT</Text>
              </View>
            </GlassCard>
          </View>

          {/* Layer Mixer */}
          <View style={styles.section}>
            <SectionHeader
              label="LAYER MIXER"
              title=""
              action={{
                text: '\u{2795} ADD SOUND',
                onPress: () => setShowAddSound(!showAddSound),
              }}
            />

            {showAddSound && (
              <View style={styles.addSoundGrid}>
                {availableSounds.map((s) => (
                  <Pressable
                    key={s.id}
                    style={styles.addSoundChip}
                    onPress={() => {
                      addSound(s.id);
                      setShowAddSound(false);
                    }}
                  >
                    <Text style={styles.addSoundIcon}>
                      {SOUND_ICONS[s.id] || '\u{1F3B5}'}
                    </Text>
                    <Text style={styles.addSoundName}>{s.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {activeLayers.map((layer) => {
              const sound = getSoundById(layer.sound);
              return (
                <GlassCard key={layer.sound} level={3} style={styles.layerCard}>
                  <View style={styles.layerHeader}>
                    <View style={styles.layerInfo}>
                      <Text style={styles.layerIcon}>
                        {SOUND_ICONS[layer.sound] || '\u{1F3B5}'}
                      </Text>
                      <Text style={styles.layerName}>
                        {sound?.name ?? layer.sound}
                      </Text>
                    </View>
                    <View style={styles.layerRight}>
                      <Text style={styles.layerPercent}>
                        {Math.round(layer.volume * 100)}%
                      </Text>
                      <Pressable
                        onPress={() => removeSound(layer.sound)}
                        hitSlop={8}
                      >
                        <Text style={styles.layerRemove}>{'\u00D7'}</Text>
                      </Pressable>
                    </View>
                  </View>
                  <SessionVolumeBar
                    value={layer.volume}
                    onValueChange={(v) => setLayerVolume(layer.sound, v)}
                  />
                </GlassCard>
              );
            })}

            {activeLayers.length === 0 && (
              <GlassCard level={2} style={styles.emptyMixer}>
                <Text style={styles.emptyText}>
                  Tap "Add Sound" to build your mix
                </Text>
              </GlassCard>
            )}
          </View>

          {/* Master Volume */}
          <View style={styles.section}>
            <GlassCard level={3} style={styles.masterCard}>
              <View style={styles.masterRow}>
                <Text style={styles.masterIconSmall}>{'\u{1F509}'}</Text>
                <SessionVolumeBar
                  value={masterVolume}
                  onValueChange={setMasterVolume}
                />
                <Text style={styles.masterIconLoud}>{'\u{1F50A}'}</Text>
              </View>
            </GlassCard>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <View style={styles.actionBtnWrap}>
              <GradientButton title="Start Session" onPress={startSession} />
            </View>
            <View style={styles.actionBtnWrap}>
              <GradientButton
                title="Save Preset"
                variant="secondary"
                onPress={handleSavePreset}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // --- ACTIVE SESSION ---
  if (phase === 'active') {
    return (
      <View style={styles.screen}>
        <View style={styles.activeContainer}>
          {/* Timer */}
          <Text style={styles.labelUpper}>FOCUS SESSION</Text>
          <Text style={styles.activeTimer}>{formatTime(remaining)}</Text>
          <Text style={styles.activeElapsed}>{formatTime(elapsed)} elapsed</Text>

          {/* Active layers */}
          <View style={styles.activeLayers}>
            <SectionHeader label="NOW PLAYING" title="" />
            {mixedLayers.map((layer) => {
              const sound = getSoundById(layer.sound);
              return (
                <GlassCard key={layer.sound} level={3} style={styles.activeLayerCard}>
                  <View style={styles.layerInfo}>
                    <Text style={styles.layerIcon}>
                      {SOUND_ICONS[layer.sound] || '\u{1F3B5}'}
                    </Text>
                    <Text style={styles.layerName}>
                      {sound?.name ?? layer.sound}
                    </Text>
                  </View>
                  <View style={styles.activeBarOuter}>
                    <View
                      style={[
                        styles.activeBarFill,
                        { width: `${Math.round(layer.volume * 100)}%` },
                      ]}
                    />
                  </View>
                </GlassCard>
              );
            })}
          </View>

          {/* Controls */}
          <View style={styles.activeControls}>
            <GradientButton title="Pause" variant="secondary" onPress={pauseSession} />
            <GradientButton title="Stop" variant="danger" onPress={stopSession} />
          </View>

          <Text style={styles.audioNote}>Audio playback coming soon</Text>
        </View>
      </View>
    );
  }

  // --- POST SESSION ---
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.labelUpper}>SESSION COMPLETE</Text>
          <Text style={styles.heroTitle}>Well Done.</Text>
        </View>

        {/* Summary */}
        <GlassCard level={3} style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>DURATION</Text>
              <Text style={styles.summaryValue}>{formatTime(elapsed)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>PRESET</Text>
              <Text style={styles.summaryPreset}>{presetDisplayName}</Text>
            </View>
          </View>
        </GlassCard>

        {/* Post mood */}
        <View style={styles.section}>
          <SectionHeader label="POST-SESSION CHECK-IN" title="" />
          <GlassCard level={3} style={styles.vibeCard}>
            <View style={styles.vibeHeader}>
              <Text style={styles.vibeLabel}>HOW DO YOU FEEL NOW?</Text>
              <Text style={styles.vibeScore}>
                {postMood != null ? `${postMood}/10` : '--'}
              </Text>
            </View>
            <SessionVolumeBar
              value={(postMood ?? 5) / 10}
              onValueChange={(v) => setPostMood(Math.max(1, Math.round(v * 10)))}
            />
            <View style={styles.vibeRange}>
              <Text style={styles.vibeRangeText}>DRAINED</Text>
              <Text style={styles.vibeRangeText}>RADIANT</Text>
            </View>
          </GlassCard>
        </View>

        <View style={styles.actionRow}>
          <View style={styles.actionBtnWrap}>
            <GradientButton title="Done" onPress={finishSession} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* --- VolumeBar sub-component --- */

function SessionVolumeBar({
  value,
  onValueChange,
}: {
  value: number;
  onValueChange: (v: number) => void;
}) {
  const trackWidth = useRef(0);

  const clamp = (v: number) => Math.min(1, Math.max(0, v));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        if (trackWidth.current > 0) {
          const ratio = evt.nativeEvent.locationX / trackWidth.current;
          onValueChange(clamp(ratio));
        }
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        if (trackWidth.current > 0) {
          const ratio = evt.nativeEvent.locationX / trackWidth.current;
          onValueChange(clamp(ratio));
        }
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  return (
    <View
      style={styles.volTrack}
      onLayout={onLayout}
      {...panResponder.panHandlers}
    >
      <View style={[styles.volFill, { width: `${Math.round(value * 100)}%` }]} />
      <View style={[styles.volThumb, { left: `${Math.round(value * 100)}%` }]} />
    </View>
  );
}

/* --- Styles --- */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.base,
  },
  content: {
    paddingBottom: 48,
  },

  /* Header */
  header: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 8,
  },
  labelUpper: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: 'rgba(228, 225, 233, 0.5)',
    lineHeight: 16,
    textAlign: 'center',
  },
  timerDisplay: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 48,
    lineHeight: 56,
    color: colors.text,
    textAlign: 'center',
  },
  heroTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 36,
    lineHeight: 44,
    color: colors.text,
    fontStyle: 'italic',
  },

  /* Duration chips */
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  chip: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: MOOD_SURFACES.lift,
  },
  chipActive: {
    backgroundColor: MOOD_ACCENT,
  },
  chipText: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  chipTextActive: {
    color: '#1a1008',
  },

  /* Section */
  section: {
    marginTop: 24,
    gap: 12,
  },

  /* Vibe card (mood slider) */
  vibeCard: {
    marginHorizontal: 20,
    gap: 12,
  },
  vibeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vibeLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.05 * 11,
    color: 'rgba(228, 225, 233, 0.5)',
  },
  vibeScore: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 24,
    lineHeight: 32,
    color: MOOD_ACCENT,
    fontStyle: 'italic',
  },
  vibeRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vibeRangeText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.05 * 10,
    color: 'rgba(228, 225, 233, 0.3)',
  },

  /* Layer Mixer */
  layerCard: {
    marginHorizontal: 20,
    gap: 8,
  },
  layerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  layerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  layerIcon: {
    fontSize: 20,
  },
  layerName: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  layerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  layerPercent: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(228, 225, 233, 0.5)',
  },
  layerRemove: {
    fontSize: 22,
    lineHeight: 26,
    color: 'rgba(228, 225, 233, 0.3)',
  },

  /* Add sound picker */
  addSoundGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  addSoundChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: MOOD_SURFACES.focus,
  },
  addSoundIcon: {
    fontSize: 14,
  },
  addSoundName: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },

  /* Empty mixer */
  emptyMixer: {
    marginHorizontal: 20,
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(228, 225, 233, 0.3)',
  },

  /* Master volume */
  masterCard: {
    marginHorizontal: 20,
  },
  masterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  masterIconSmall: {
    fontSize: 16,
  },
  masterIconLoud: {
    fontSize: 16,
  },

  /* Action buttons */
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 32,
  },
  actionBtnWrap: {
    flex: 1,
  },

  /* VolumeBar */
  volTrack: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
  },
  volFill: {
    position: 'absolute',
    left: 0,
    top: 10,
    height: 4,
    borderRadius: 2,
    backgroundColor: MOOD_ACCENT,
  },
  volThumb: {
    position: 'absolute',
    top: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: MOOD_ACCENT_LIGHT,
    marginLeft: -8,
  },

  /* Active session */
  activeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
  },
  activeTimer: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 64,
    lineHeight: 72,
    color: colors.text,
    letterSpacing: -2,
  },
  activeElapsed: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(228, 225, 233, 0.4)',
  },
  activeLayers: {
    width: '100%',
    gap: 8,
    marginTop: 16,
  },
  activeLayerCard: {
    marginHorizontal: 20,
    gap: 8,
  },
  activeBarOuter: {
    height: 4,
    borderRadius: 2,
    backgroundColor: MOOD_SURFACES.focus,
    overflow: 'hidden',
  },
  activeBarFill: {
    height: '100%',
    backgroundColor: MOOD_ACCENT,
    borderRadius: 2,
  },
  activeControls: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  audioNote: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(228, 225, 233, 0.2)',
    textAlign: 'center',
    marginTop: 8,
  },

  /* Post session */
  summaryCard: {
    marginHorizontal: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  summaryLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.05 * 10,
    color: 'rgba(228, 225, 233, 0.4)',
  },
  summaryValue: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 28,
    lineHeight: 36,
    color: MOOD_ACCENT,
  },
  summaryPreset: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    lineHeight: 22,
    color: MOOD_ACCENT,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
});
