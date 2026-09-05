import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import {
  GlassCard,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_STREAK,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  HB_VIOLET_GLOW_STYLE,
  HB_XP,
  MaterialSymbol,
  PET_SPECIES_CATALOG,
  PetAvatar,
  SectionHeader,
  XPBar,
  ensurePetState,
  feedPet,
  getDaysTogether,
  getMoodEmoji,
  getMoodLabel,
  getPetCareState,
  getPetHistory,
  getPetState,
  getPetUnlockablesForState,
  getSpeciesByKey,
  playWithPet,
  restPet,
  updatePetName,
  updatePetSpecies,
  withAlpha,
} from '@mylife/habits';
import { useDatabase } from '../../components/DatabaseProvider';

function VitalRing({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  const size = 92;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, value / 100));

  return (
    <View style={styles.vitalWrap}>
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={withAlpha(color, 0.14)}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          origin={`${size / 2}, ${size / 2}`}
          r={radius}
          rotation="-90"
          stroke={color}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - progress)}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
      <View style={styles.vitalCenter}>
        <Text style={styles.vitalValue}>{Math.round(value)}%</Text>
        <Text style={styles.vitalLabel}>{label}</Text>
      </View>
    </View>
  );
}

function CareActionButton({
  color,
  icon,
  label,
  onPress,
}: {
  color: string;
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.actionButton, { backgroundColor: withAlpha(color, 0.14) }]}>
      <View style={[styles.actionIcon, { backgroundColor: withAlpha(color, 0.18) }]}>
        <MaterialSymbol color={color} filled name={icon} size={20} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

export default function PetDetailScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const data = useMemo(() => {
    try {
      ensurePetState(db);

      const pet = getPetState(db);
      const care = getPetCareState(db);
      const history = getPetHistory(db);
      const unlockables = getPetUnlockablesForState(db);

      return {
        pet,
        care,
        history,
        unlockables,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unable to load your companion.',
      };
    }
  }, [db, tick]);

  useEffect(() => {
    if ('error' in data || data.pet == null) {
      return;
    }

    setDraftName(data.pet.name);
  }, [data]);

  if ('error' in data || data.pet == null) {
    return (
      <View style={styles.screen}>
        <GlassCard level={2} style={styles.errorCard}>
          <MaterialSymbol color={HB_ACCENT_LIGHT} filled name="pets" size={26} />
          <Text style={styles.errorTitle}>Pet companion unavailable</Text>
          <Text style={styles.errorBody}>{'error' in data ? data.error : 'No pet data found.'}</Text>
        </GlassCard>
      </View>
    );
  }

  const pet = data.pet;
  const care = data.care;
  const species = getSpeciesByKey(pet.species) ?? PET_SPECIES_CATALOG[0];
  const today = new Date().toISOString().slice(0, 10);
  const daysTogether = getDaysTogether(pet.createdAt, today);
  const moodLabel = getMoodLabel(care.mood);
  const moodEmoji = getMoodEmoji(care.mood);
  const currentLevelXP = care.petXP % 120;

  const performAction = (action: 'feed' | 'play' | 'rest') => {
    try {
      if (action === 'feed') {
        feedPet(db);
        setFeedback('Your companion is full and energized.');
      } else if (action === 'play') {
        playWithPet(db);
        setFeedback('Playtime lifted the sanctuary mood.');
      } else {
        restPet(db);
        setFeedback('A calm rest restored energy.');
      }

      setTick((value) => value + 1);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not update your companion right now.');
    }
  };

  const saveCustomization = () => {
    const trimmed = draftName.trim();

    if (trimmed.length > 0 && trimmed !== pet.name) {
      updatePetName(db, trimmed);
    }

    setCustomizeVisible(false);
    setTick((value) => value + 1);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>Companion</Text>
            <Text style={styles.headerTitle}>Pet Sanctuary</Text>
          </View>
          <Pressable onPress={() => setCustomizeVisible(true)} style={styles.headerAction}>
            <MaterialSymbol color={HB_TEXT} name="settings" size={20} />
          </Pressable>
        </View>

        <GlassCard level={4} style={styles.sceneCard} contentStyle={styles.sceneInner}>
          <LinearGradient
            colors={[withAlpha(HB_ACCENT, 0.16), withAlpha(HB_XP, 0.06), withAlpha(HB_STREAK.fire, 0.06)]}
            end={{ x: 0.9, y: 1 }}
            start={{ x: 0.05, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.sceneGlowLarge} />
          <View style={styles.sceneGlowSmall} />
          <View style={styles.sceneTopRow}>
            <View style={styles.sceneMoodPill}>
              <Text style={styles.sceneMoodText}>{moodEmoji} {moodLabel}</Text>
            </View>
            <View style={styles.sceneSpeciesPill}>
              <Text style={styles.sceneSpeciesText}>{species.description}</Text>
            </View>
          </View>
          <Pressable onPress={() => performAction('play')} style={styles.avatarPressable}>
            <PetAvatar
              animate
              pet={{ level: care.petLevel, name: pet.name, species: pet.species }}
              size={168}
              stats={{
                hunger: care.hunger / 100,
                happiness: care.happiness / 100,
                energy: care.energy / 100,
              }}
            />
          </Pressable>
          <Text style={styles.sceneHint}>Tap your companion to play instantly.</Text>
        </GlassCard>

        <GlassCard level={2} style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.profileText}>
              <Text style={styles.profileName}>{pet.name}</Text>
              <Text style={styles.profileMeta}>{species.emoji} {species.key} · {daysTogether} days together</Text>
            </View>
            <View style={styles.profileLevelBadge}>
              <Text style={styles.profileLevelText}>Lv {care.petLevel}</Text>
            </View>
          </View>
          <XPBar current={currentLevelXP} level={care.petLevel} max={120} showLevel={false} />
          <Text style={styles.profileXPText}>{care.petXP.toLocaleString()} sanctuary XP</Text>
        </GlassCard>

        <View style={styles.vitalsRow}>
          <VitalRing color={HB_STREAK.fire} label="Hunger" value={care.hunger} />
          <VitalRing color={HB_ACCENT_LIGHT} label="Happy" value={care.happiness} />
          <VitalRing color={HB_XP} label="Energy" value={care.energy} />
        </View>

        <View style={styles.actionsRow}>
          <CareActionButton color={HB_STREAK.fire} icon="favorite" label="Feed" onPress={() => performAction('feed')} />
          <CareActionButton color={HB_ACCENT_LIGHT} icon="sports_esports" label="Play" onPress={() => performAction('play')} />
          <CareActionButton color={HB_XP} icon="timer" label="Rest" onPress={() => performAction('rest')} />
        </View>

        {feedback != null ? (
          <GlassCard level={1} style={styles.feedbackCard}>
            <Text style={styles.feedbackText}>{feedback}</Text>
          </GlassCard>
        ) : null}

        <GlassCard level={2} style={styles.unlockablesCard}>
          <SectionHeader title="Unlockables" />
          <View style={styles.unlockablesGrid}>
            {data.unlockables.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.unlockableTile,
                  item.unlocked ? styles.unlockableTileActive : styles.unlockableTileLocked,
                ]}
              >
                <View style={[styles.unlockableIcon, item.unlocked ? styles.unlockableIconActive : null]}>
                  <MaterialSymbol
                    color={item.unlocked ? HB_ACCENT_LIGHT : HB_TEXT_TERTIARY}
                    filled={item.unlocked}
                    name={item.icon}
                    size={18}
                  />
                </View>
                <Text style={styles.unlockableTitle}>{item.name}</Text>
                <Text style={styles.unlockableMeta}>
                  {item.unlocked ? item.category : `Lvl ${item.requiredLevel}`}
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>

        <GlassCard level={2} style={styles.historyCard}>
          <SectionHeader title="Pet History" />
          {data.history.length === 0 ? (
            <Text style={styles.emptyText}>Care actions and level ups will build a timeline here.</Text>
          ) : (
            data.history.map((entry) => (
              <View key={entry.id} style={styles.historyRow}>
                <View style={styles.historyIcon}>
                  <MaterialSymbol
                    color={HB_ACCENT_LIGHT}
                    filled
                    name={entry.action === 'level_up' ? 'military_tech' : entry.action === 'feed' ? 'favorite' : entry.action === 'play' ? 'sports_esports' : 'timer'}
                    size={18}
                  />
                </View>
                <View style={styles.historyBody}>
                  <Text style={styles.historyTitle}>{entry.title}</Text>
                  <Text style={styles.historyDetail}>{entry.detail}</Text>
                </View>
                <Text style={styles.historyDate}>{entry.timestamp.slice(0, 10)}</Text>
              </View>
            ))
          )}
        </GlassCard>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setCustomizeVisible(false)}
        transparent
        visible={customizeVisible}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setCustomizeVisible(false)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheetFrame}>
            <GlassCard level={5} style={styles.sheetCard} contentStyle={styles.sheetInner}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Customize Companion</Text>

              <View style={styles.sheetField}>
                <Text style={styles.sheetLabel}>Name</Text>
                <TextInput
                  onChangeText={setDraftName}
                  placeholder="Companion name"
                  placeholderTextColor={HB_TEXT_TERTIARY}
                  style={styles.nameInput}
                  value={draftName}
                />
              </View>

              <View style={styles.sheetField}>
                <Text style={styles.sheetLabel}>Species</Text>
                <View style={styles.speciesRail}>
                  {PET_SPECIES_CATALOG.map((option) => {
                    const active = option.key === pet.species;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => {
                          updatePetSpecies(db, option.key);
                          setTick((value) => value + 1);
                        }}
                        style={[styles.speciesChip, active ? styles.speciesChipActive : null]}
                      >
                        <Text style={styles.speciesChipEmoji}>{option.emoji}</Text>
                        <Text style={[styles.speciesChipText, active ? styles.speciesChipTextActive : null]}>
                          {option.key}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable onPress={saveCustomization} style={styles.saveButton}>
                <LinearGradient
                  colors={[HB_ACCENT_LIGHT, HB_ACCENT]}
                  end={{ x: 1, y: 0.5 }}
                  start={{ x: 0, y: 0.5 }}
                  style={styles.saveButtonGradient}
                >
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </LinearGradient>
              </Pressable>
            </GlassCard>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  eyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  headerTitle: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
    fontSize: 32,
    lineHeight: 36,
  },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_ACCENT, 0.16),
  },
  sceneCard: {
    overflow: 'hidden',
    minHeight: 360,
    ...HB_VIOLET_GLOW_STYLE,
  },
  sceneInner: {
    minHeight: 360,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sceneGlowLarge: {
    position: 'absolute',
    top: 50,
    left: '50%',
    marginLeft: -120,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: withAlpha(HB_ACCENT_LIGHT, 0.12),
  },
  sceneGlowSmall: {
    position: 'absolute',
    bottom: 32,
    right: 40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: withAlpha(HB_XP, 0.08),
  },
  sceneTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sceneMoodPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: withAlpha(HB_ACCENT, 0.18),
  },
  sceneMoodText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
    fontFamily: HB_TYPOGRAPHY.headlineMd.fontFamily,
  },
  sceneSpeciesPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: withAlpha(HB_SURFACES.highest, 0.82),
  },
  sceneSpeciesText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
  avatarPressable: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  sceneHint: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 16,
  },
  profileCard: {
    gap: 14,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileText: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
    fontSize: 28,
    lineHeight: 32,
  },
  profileMeta: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  profileLevelBadge: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: withAlpha(HB_XP, 0.16),
  },
  profileLevelText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_XP,
  },
  profileXPText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 16,
  },
  vitalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  vitalWrap: {
    flex: 1,
    minHeight: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vitalCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vitalValue: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 18,
    lineHeight: 22,
  },
  vitalLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
    fontFamily: HB_TYPOGRAPHY.headlineMd.fontFamily,
  },
  feedbackCard: {
    backgroundColor: withAlpha(HB_ACCENT_LIGHT, 0.08),
  },
  feedbackText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
  },
  unlockablesCard: {
    gap: 14,
  },
  unlockablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  unlockableTile: {
    width: '47%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 8,
  },
  unlockableTileActive: {
    backgroundColor: withAlpha(HB_ACCENT, 0.16),
  },
  unlockableTileLocked: {
    backgroundColor: withAlpha(HB_SURFACES.high, 0.82),
    opacity: 0.7,
  },
  unlockableIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_SURFACES.highest, 0.8),
  },
  unlockableIconActive: {
    backgroundColor: withAlpha(HB_ACCENT_LIGHT, 0.18),
  },
  unlockableTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 17,
    lineHeight: 20,
  },
  unlockableMeta: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'capitalize',
  },
  historyCard: {
    gap: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  historyIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_ACCENT_LIGHT, 0.12),
  },
  historyBody: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
    fontFamily: HB_TYPOGRAPHY.headlineMd.fontFamily,
  },
  historyDetail: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
  historyDate: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  emptyText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 15, 0.8)',
    justifyContent: 'flex-end',
  },
  sheetFrame: {
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  sheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetInner: {
    gap: 18,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_TEXT_TERTIARY, 0.4),
    alignSelf: 'center',
  },
  sheetTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 24,
    lineHeight: 28,
    textAlign: 'center',
  },
  sheetField: {
    gap: 10,
  },
  sheetLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  nameInput: {
    borderRadius: 18,
    backgroundColor: HB_SURFACES.high,
    color: HB_TEXT,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: HB_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 16,
  },
  speciesRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  speciesChip: {
    minWidth: 88,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
    backgroundColor: HB_SURFACES.high,
  },
  speciesChipActive: {
    backgroundColor: withAlpha(HB_ACCENT, 0.18),
  },
  speciesChipEmoji: {
    fontSize: 20,
  },
  speciesChipText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    textTransform: 'capitalize',
    fontSize: 12,
    lineHeight: 16,
  },
  speciesChipTextActive: {
    color: HB_TEXT,
    fontFamily: HB_TYPOGRAPHY.headlineMd.fontFamily,
  },
  saveButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_SURFACES.lowest,
    fontSize: 16,
    lineHeight: 20,
  },
  errorCard: {
    margin: 20,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  errorTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
  },
  errorBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    textAlign: 'center',
  },
});
