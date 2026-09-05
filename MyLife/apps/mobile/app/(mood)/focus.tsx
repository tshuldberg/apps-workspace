import { useCallback, useMemo, useRef, useState } from 'react';
import { uuid } from '../../lib/uuid';
import {
  type LayoutChangeEvent,
  type GestureResponderEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import {
  DEFAULT_PRESETS,
  getSoundsByCategory,
  getSoundPresets,
  getFocusSessions,
  createSoundPreset,
  getSoundById,
  type SoundLayer,
  type FocusSession,
  type SoundDefinition,
  GlassCard,
  GradientButton,
  SectionHeader,
  MOOD_SURFACES,
  MOOD_ACCENT,
  MOOD_ACCENT_LIGHT,
  MOOD_TYPOGRAPHY,
} from '@mylife/mood';
import { colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const CATEGORIES: SoundDefinition['category'][] = ['nature', 'ambient', 'music', 'noise'];

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

const CATEGORY_LABELS: Record<string, string> = {
  nature: 'NATURE',
  ambient: 'AMBIENT',
  music: 'MUSIC',
  noise: 'WHITE NOISE',
};

export default function FocusScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  const dbPresets = useMemo(() => getSoundPresets(db), [db, tick]);
  const presets = dbPresets.length > 0
    ? dbPresets
    : DEFAULT_PRESETS.map((p, i) => ({
        id: `default-${i}`,
        name: p.name,
        layers: p.layers,
        isDefault: true,
        sortOrder: i,
        createdAt: '',
        updatedAt: '',
      }));

  const recentSessions = useMemo(() => getFocusSessions(db, 5), [db, tick]);

  const [activeLayers, setActiveLayers] = useState<SoundLayer[]>([]);
  const [showMixer, setShowMixer] = useState(false);

  const toggleSound = useCallback((soundId: string) => {
    setActiveLayers((prev) => {
      const exists = prev.find((l) => l.sound === soundId);
      if (exists) return prev.filter((l) => l.sound !== soundId);
      return [...prev, { sound: soundId, volume: 0.5 }];
    });
  }, []);

  const setVolume = useCallback((soundId: string, volume: number) => {
    setActiveLayers((prev) =>
      prev.map((l) => (l.sound === soundId ? { ...l, volume } : l)),
    );
  }, []);

  const removeLayer = useCallback((soundId: string) => {
    setActiveLayers((prev) => prev.filter((l) => l.sound !== soundId));
  }, []);

  const handleSavePreset = useCallback(() => {
    if (activeLayers.length === 0) return;
    createSoundPreset(db, uuid(), { name: 'Custom Mix', layers: activeLayers });
    setTick((t) => t + 1);
  }, [db, activeLayers]);

  const navigateToPreset = useCallback(
    (preset: (typeof presets)[0]) => {
      if ('id' in preset && !String(preset.id).startsWith('default-')) {
        router.push(`/(mood)/focus-session?presetId=${preset.id}`);
      } else {
        router.push(
          `/(mood)/focus-session?presetName=${encodeURIComponent(preset.name)}&layers=${encodeURIComponent(JSON.stringify(preset.layers))}`,
        );
      }
    },
    [router],
  );

  const navigateCustom = useCallback(() => {
    if (activeLayers.length === 0) return;
    router.push(
      `/(mood)/focus-session?presetName=Custom&layers=${encodeURIComponent(JSON.stringify(activeLayers))}`,
    );
  }, [router, activeLayers]);

  const activeCount = activeLayers.length;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Editorial Header */}
        <View style={styles.header}>
          <Text style={styles.labelUpper}>CURATE YOUR AUDITORY SANCTUARY</Text>
          <Text style={styles.heroTitle}>Focus Sounds</Text>
          <Text style={styles.subtitle}>
            Mix ambient frequencies and nature textures to build the perfect focus environment.
          </Text>
        </View>

        {/* Sound Categories */}
        {CATEGORIES.map((category) => {
          const sounds = getSoundsByCategory(category);
          if (sounds.length === 0) return null;

          return (
            <View key={category} style={styles.categoryBlock}>
              <SectionHeader label={CATEGORY_LABELS[category]} title="" />

              {/* Featured card for first sound in nature */}
              {category === 'nature' && sounds.length > 0 && (
                <View style={styles.featuredSection}>
                  <FeaturedSoundCard
                    sound={sounds[0]}
                    isActive={activeLayers.some((l) => l.sound === sounds[0].id)}
                    onToggle={() => toggleSound(sounds[0].id)}
                  />
                  <View style={styles.smallCardsRow}>
                    {sounds.slice(1, 3).map((s) => (
                      <SmallSoundCard
                        key={s.id}
                        sound={s}
                        isActive={activeLayers.some((l) => l.sound === s.id)}
                        onToggle={() => toggleSound(s.id)}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Remaining nature sounds or all sounds for other categories */}
              {category === 'nature' ? (
                sounds.length > 3 && (
                  <View style={styles.soundGrid}>
                    {sounds.slice(3).map((s) => (
                      <SoundCard
                        key={s.id}
                        sound={s}
                        isActive={activeLayers.some((l) => l.sound === s.id)}
                        onToggle={() => toggleSound(s.id)}
                      />
                    ))}
                  </View>
                )
              ) : category === 'noise' ? (
                <View style={styles.noiseList}>
                  {sounds.map((s) => (
                    <NoiseSoundCard
                      key={s.id}
                      sound={s}
                      isActive={activeLayers.some((l) => l.sound === s.id)}
                      onToggle={() => toggleSound(s.id)}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.soundGrid}>
                  {sounds.map((s) => (
                    <SoundCard
                      key={s.id}
                      sound={s}
                      isActive={activeLayers.some((l) => l.sound === s.id)}
                      onToggle={() => toggleSound(s.id)}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* Presets */}
        <View style={styles.categoryBlock}>
          <SectionHeader label="QUICK START" title="Presets" />
          <View style={styles.presetGrid}>
            {presets.map((preset) => (
              <GlassCard
                key={preset.id ?? preset.name}
                level={3}
                style={styles.presetCard}
                onPress={() => navigateToPreset(preset)}
              >
                <Text style={styles.presetName}>{preset.name}</Text>
                <Text style={styles.presetLayers} numberOfLines={1}>
                  {preset.layers
                    .map((l) => getSoundById(l.sound)?.name ?? l.sound)
                    .join(' + ')}
                </Text>
              </GlassCard>
            ))}
          </View>
        </View>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <View style={styles.categoryBlock}>
            <SectionHeader label="HISTORY" title="Recent Sessions" />
            {recentSessions.map((session: FocusSession) => (
              <GlassCard key={session.id} level={2} style={styles.sessionCard}>
                <View style={styles.sessionRow}>
                  <View style={styles.sessionLeft}>
                    <Text style={styles.sessionName}>{session.presetName}</Text>
                    <Text style={styles.sessionDate}>
                      {new Date(session.startedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.sessionDuration}>
                    {Math.round(session.actualDurationSeconds / 60)}m
                  </Text>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        {/* Active Spectrum (when sounds selected) */}
        {activeLayers.length > 0 && (
          <View style={styles.categoryBlock}>
            <SectionHeader
              label="ACTIVE SPECTRUM"
              title="Now Playing"
              action={{ text: 'SAVE MIX', onPress: handleSavePreset }}
            />
            {activeLayers.map((layer) => {
              const sound = getSoundById(layer.sound);
              return (
                <GlassCard key={layer.sound} level={3} style={styles.activeLayerCard}>
                  <View style={styles.activeLayerHeader}>
                    <View style={styles.activeLayerInfo}>
                      <Text style={styles.activeLayerIcon}>
                        {SOUND_ICONS[layer.sound] || '\u{1F3B5}'}
                      </Text>
                      <Text style={styles.activeLayerName}>
                        {sound?.name ?? layer.sound}
                      </Text>
                    </View>
                    <Pressable onPress={() => removeLayer(layer.sound)} hitSlop={8}>
                      <Text style={styles.removeBtn}>{'\u00D7'}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.sliderRow}>
                    <VolumeBar
                      value={layer.volume}
                      onValueChange={(v) => setVolume(layer.sound, v)}
                    />
                    <Text style={styles.volumePercent}>
                      {Math.round(layer.volume * 100)}%
                    </Text>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        )}

        {/* Bottom spacer for the floating bar */}
        {activeCount > 0 && <View style={{ height: 100 }} />}
      </ScrollView>

      {/* Floating bottom bar */}
      {activeCount > 0 && (
        <View style={styles.bottomBar}>
          <GlassCard level={4} style={styles.bottomBarCard}>
            <View style={styles.bottomBarContent}>
              <Pressable
                style={styles.mixSoundsChip}
                onPress={() => setShowMixer(!showMixer)}
              >
                <Text style={styles.mixSoundsIcon}>{'\u{1F3B6}'}</Text>
                <Text style={styles.mixSoundsText}>
                  {activeCount} SOUND{activeCount !== 1 ? 'S' : ''} ACTIVE
                </Text>
              </Pressable>
              <GradientButton title="START SESSION  \u{203A}" onPress={navigateCustom} />
            </View>
          </GlassCard>
        </View>
      )}
    </View>
  );
}

/* --- Sub-components --- */

function VolumeBar({
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
      style={styles.volumeTrack}
      onLayout={onLayout}
      {...panResponder.panHandlers}
    >
      <View style={[styles.volumeFill, { width: `${Math.round(value * 100)}%` }]} />
      <View
        style={[
          styles.volumeThumb,
          { left: `${Math.round(value * 100)}%` },
        ]}
      />
    </View>
  );
}

function FeaturedSoundCard({
  sound,
  isActive,
  onToggle,
}: {
  sound: SoundDefinition;
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <GlassCard
      level={isActive ? 3 : 2}
      style={[styles.featuredCard, isActive && styles.activeCardBorder]}
      onPress={onToggle}
    >
      <View style={styles.featuredImageArea}>
        <Text style={styles.featuredEmoji}>{SOUND_ICONS[sound.id] || '\u{1F3B5}'}</Text>
      </View>
      <View style={styles.featuredInfo}>
        <Text style={styles.featuredName}>{sound.name}</Text>
        <Text style={styles.featuredDesc}>
          {getSoundDescription(sound.id)}
        </Text>
        <View style={styles.playBtnCircle}>
          <Text style={styles.playBtnText}>{isActive ? '\u{23F8}' : '\u{25B6}'}</Text>
        </View>
      </View>
    </GlassCard>
  );
}

function SmallSoundCard({
  sound,
  isActive,
  onToggle,
}: {
  sound: SoundDefinition;
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <GlassCard
      level={isActive ? 3 : 2}
      style={[styles.smallCard, isActive && styles.activeCardBorder]}
      onPress={onToggle}
    >
      <Text style={styles.smallCardIcon}>{SOUND_ICONS[sound.id] || '\u{1F3B5}'}</Text>
      <Text style={styles.smallCardName}>{sound.name}</Text>
      <Text style={styles.smallCardDesc} numberOfLines={1}>
        {getSoundDescription(sound.id)}
      </Text>
    </GlassCard>
  );
}

function SoundCard({
  sound,
  isActive,
  onToggle,
}: {
  sound: SoundDefinition;
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <GlassCard
      level={isActive ? 3 : 2}
      style={[styles.gridCard, isActive && styles.activeCardBorder]}
      onPress={onToggle}
    >
      <Text style={styles.gridCardIcon}>{SOUND_ICONS[sound.id] || '\u{1F3B5}'}</Text>
      <Text style={styles.gridCardName}>{sound.name}</Text>
    </GlassCard>
  );
}

function NoiseSoundCard({
  sound,
  isActive,
  onToggle,
}: {
  sound: SoundDefinition;
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <GlassCard
      level={isActive ? 3 : 2}
      style={[styles.noiseCard, isActive && styles.activeCardBorder]}
      onPress={onToggle}
    >
      <View style={styles.noiseCardLeft}>
        <Text style={styles.noiseCardIcon}>{SOUND_ICONS[sound.id] || '\u{1F3B5}'}</Text>
        <View>
          <Text style={styles.noiseCardName}>{sound.name}</Text>
          <Text style={styles.noiseCardDesc}>{getSoundDescription(sound.id)}</Text>
        </View>
      </View>
      <View
        style={[styles.toggleTrack, isActive && styles.toggleTrackActive]}
      >
        <View
          style={[styles.toggleThumb, isActive && styles.toggleThumbActive]}
        />
      </View>
    </GlassCard>
  );
}

function getSoundDescription(id: string): string {
  const descriptions: Record<string, string> = {
    rain: 'Gentle summer shower',
    thunder_distant: 'Rumbling distance storm',
    ocean: 'Rolling waves on sand',
    wind: 'Soft mountain breeze',
    birds: 'Morning forest chorus',
    creek: 'Babbling stream',
    fire: 'Crackling fireplace',
    cafe: 'Warm coffee shop chatter',
    library: 'Quiet page-turning ambiance',
    train: 'Rhythmic rail journey',
    white_noise: 'Full-spectrum static for focus',
    pink_noise: 'Balanced static for focus',
    brown_noise: 'Deep, low frequency rumble',
  };
  return descriptions[id] || '';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.base,
  },
  content: {
    paddingBottom: spacing.xxl,
  },

  /* Header */
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 8,
  },
  labelUpper: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: MOOD_ACCENT,
    lineHeight: 16,
  },
  heroTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    color: colors.text,
    lineHeight: 40,
  },
  subtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: 'rgba(228, 225, 233, 0.6)',
  },

  /* Category blocks */
  categoryBlock: {
    marginTop: 24,
    gap: 12,
  },

  /* Featured (nature first sound) */
  featuredSection: {
    paddingHorizontal: 20,
    gap: 12,
  },
  featuredCard: {
    overflow: 'hidden',
  },
  featuredImageArea: {
    height: 120,
    borderRadius: 12,
    backgroundColor: MOOD_SURFACES.depth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featuredEmoji: {
    fontSize: 48,
  },
  featuredInfo: {
    gap: 4,
  },
  featuredName: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
    lineHeight: 28,
  },
  featuredDesc: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(228, 225, 233, 0.5)',
  },
  playBtnCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MOOD_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  playBtnText: {
    fontSize: 16,
    color: '#1a1008',
  },

  smallCardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  smallCard: {
    flex: 1,
    gap: 6,
  },
  smallCardIcon: {
    fontSize: 24,
  },
  smallCardName: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  smallCardDesc: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: MOOD_TYPOGRAPHY.bodyMd.fontFamily,
    color: 'rgba(228, 225, 233, 0.5)',
  },

  /* Generic sound grid */
  soundGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
  },
  gridCard: {
    width: '47%' as unknown as number,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  gridCardIcon: {
    fontSize: 28,
  },
  gridCardName: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
    textAlign: 'center',
  },

  /* Noise toggle cards */
  noiseList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  noiseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noiseCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  noiseCardIcon: {
    fontSize: 24,
  },
  noiseCardName: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  noiseCardDesc: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: MOOD_TYPOGRAPHY.bodyMd.fontFamily,
    color: 'rgba(228, 225, 233, 0.5)',
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: MOOD_SURFACES.focus,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackActive: {
    backgroundColor: MOOD_ACCENT,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(228, 225, 233, 0.4)',
  },
  toggleThumbActive: {
    backgroundColor: '#1a1008',
    alignSelf: 'flex-end',
  },

  /* Active border highlight */
  activeCardBorder: {
    borderWidth: 1,
    borderColor: MOOD_ACCENT,
  },

  /* Presets */
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
  },
  presetCard: {
    width: '47%' as unknown as number,
    gap: 4,
  },
  presetName: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    fontWeight: '600',
  },
  presetLayers: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: MOOD_TYPOGRAPHY.bodyMd.fontFamily,
    color: 'rgba(228, 225, 233, 0.5)',
  },

  /* Recent sessions */
  sessionCard: {
    marginHorizontal: 20,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionLeft: {
    flex: 1,
    gap: 2,
  },
  sessionName: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  sessionDate: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: MOOD_TYPOGRAPHY.bodyMd.fontFamily,
    color: 'rgba(228, 225, 233, 0.5)',
  },
  sessionDuration: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: MOOD_ACCENT,
    lineHeight: 16,
  },

  /* Active Spectrum */
  activeLayerCard: {
    marginHorizontal: 20,
    gap: 8,
  },
  activeLayerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeLayerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeLayerIcon: {
    fontSize: 20,
  },
  activeLayerName: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  removeBtn: {
    fontSize: 20,
    color: 'rgba(228, 225, 233, 0.4)',
    lineHeight: 24,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slider: {
    flex: 1,
    height: 24,
  },
  volumePercent: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.05 * 11,
    color: 'rgba(228, 225, 233, 0.5)',
    width: 36,
    textAlign: 'right',
  },

  /* Bottom floating bar */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  bottomBarCard: {
    padding: 12,
  },
  bottomBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mixSoundsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mixSoundsIcon: {
    fontSize: 16,
  },
  mixSoundsText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.05 * 11,
    color: colors.text,
  },

  /* VolumeBar */
  volumeTrack: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
  },
  volumeFill: {
    position: 'absolute',
    left: 0,
    top: 10,
    height: 4,
    borderRadius: 2,
    backgroundColor: MOOD_ACCENT,
  },
  volumeThumb: {
    position: 'absolute',
    top: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: MOOD_ACCENT_LIGHT,
    marginLeft: -8,
  },
});
