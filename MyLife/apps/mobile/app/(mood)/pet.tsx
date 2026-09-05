import { useCallback, useEffect, useMemo, useState } from 'react';
import { uuid } from '../../lib/uuid';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getPet,
  createPet,
  renamePet,
  getPetActivities,
  getPetActivitiesToday,
  updatePetStats,
  createPetActivity,
  applyDecay,
  feedPet,
  EVOLUTION_NAMES,
  EVOLUTION_THRESHOLDS,
  HATCH_MOOD_ENTRIES_REQUIRED,
  getMoodEntryCount,
  type Pet,
  type PetActivity,
  type PetActivityType,
  GlassCard,
  GradientButton,
  SectionHeader,
  StatBadge,
  MOOD_TYPOGRAPHY,
  MOOD_ACCENT,
  MOOD_ACCENT_LIGHT,
  MOOD_SURFACES,
} from '@mylife/mood';
import { colors, Text } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

// ── Wardrobe items (cosmetic, no backend yet) ─────────────────────────
const WARDROBE_ITEMS = [
  { id: 'top_hat', icon: '\uD83C\uDFA9', name: "Gentleman's Visit", unlockLevel: 0 },
  { id: 'glasses', icon: '\uD83D\uDC53', name: 'Wise Eyes', unlockLevel: 2 },
  { id: 'scarf', icon: '\uD83E\uDDE3', name: 'Cozy Wrap', unlockLevel: 1 },
  { id: 'bow', icon: '\uD83C\uDF80', name: 'Pretty Bow', unlockLevel: 3 },
  { id: 'crown', icon: '\uD83D\uDC51', name: 'Royal Crown', unlockLevel: 5 },
  { id: 'flower', icon: '\uD83C\uDF3B', name: 'Sunflower', unlockLevel: 1 },
  { id: 'shield', icon: '\uD83D\uDEE1\uFE0F', name: 'Guardian', unlockLevel: 4 },
  { id: 'star_pin', icon: '\u2B50', name: 'Star Pin', unlockLevel: 2 },
  { id: 'cape', icon: '\uD83E\uDDB8', name: 'Hero Cape', unlockLevel: 4 },
  { id: 'bell', icon: '\uD83D\uDD14', name: 'Jingle Bell', unlockLevel: 0 },
  { id: 'gem', icon: '\uD83D\uDC8E', name: 'Soul Gem', unlockLevel: 5 },
  { id: 'leaf', icon: '\uD83C\uDF43', name: 'Autumn Leaf', unlockLevel: 3 },
] as const;

// ── Species emoji mapping ─────────────────────────────────────────────
const SPECIES_EMOJI: Record<string, Record<number, string>> = {
  egg: { 0: '\uD83E\uDD5A', 1: '\uD83E\uDD5A', 2: '\uD83E\uDD5A', 3: '\uD83E\uDD5A', 4: '\uD83E\uDD5A', 5: '\uD83E\uDD5A' },
  cat: { 0: '\uD83E\uDD5A', 1: '\uD83D\uDC31', 2: '\uD83D\uDC31', 3: '\uD83D\uDC08', 4: '\uD83D\uDC08', 5: '\uD83D\uDC08\u200D\u2B1B' },
  dog: { 0: '\uD83E\uDD5A', 1: '\uD83D\uDC36', 2: '\uD83D\uDC36', 3: '\uD83D\uDC15', 4: '\uD83D\uDC15', 5: '\uD83D\uDC15\u200D\uD83E\uDDBA' },
  bird: { 0: '\uD83E\uDD5A', 1: '\uD83D\uDC25', 2: '\uD83D\uDC24', 3: '\uD83D\uDC26', 4: '\uD83D\uDC26', 5: '\uD83E\uDD85' },
  bunny: { 0: '\uD83E\uDD5A', 1: '\uD83D\uDC30', 2: '\uD83D\uDC30', 3: '\uD83D\uDC07', 4: '\uD83D\uDC07', 5: '\uD83D\uDC07' },
  fox: { 0: '\uD83E\uDD5A', 1: '\uD83E\uDD8A', 2: '\uD83E\uDD8A', 3: '\uD83E\uDD8A', 4: '\uD83E\uDD8A', 5: '\uD83E\uDD8A' },
};

function getPetEmoji(species: string, stage: number): string {
  return SPECIES_EMOJI[species]?.[stage] ?? '\uD83E\uDD5A';
}

// ── Activity type display config ──────────────────────────────────────
const ACTIVITY_DISPLAY: Record<PetActivityType, { icon: string; label: string }> = {
  mood_log: { icon: '\uD83C\uDF73', label: 'Morning Meal' },
  breathing: { icon: '\uD83E\uDDD8', label: 'Spirit Meditation' },
  meditation: { icon: '\u2728', label: 'Deep Rest Cycle' },
  journal: { icon: '\uD83D\uDCD3', label: 'Story Time' },
  workout: { icon: '\uD83C\uDFC3', label: 'Play Session' },
  experiment: { icon: '\uD83E\uDDEA', label: 'Lab Snack' },
  streak_bonus: { icon: '\uD83C\uDF89', label: 'Joyful Treat' },
};

// ── Progress Bar ──────────────────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={s.progressTrack}>
      <LinearGradient
        colors={[MOOD_ACCENT_LIGHT, color]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.progressFill, { width: `${pct}%` }]}
      />
    </View>
  );
}

export default function PetScreen() {
  const db = useDatabase();
  const [pet, setPet] = useState<Pet | null>(null);
  const [activities, setActivities] = useState<PetActivity[]>([]);
  const [tick, setTick] = useState(0);
  const [newName, setNewName] = useState('');
  const [showAdopt, setShowAdopt] = useState(false);
  const [equippedItem, setEquippedItem] = useState('top_hat');

  const entryCount = useMemo(() => getMoodEntryCount(db), [db, tick]);

  useEffect(() => {
    const p = getPet(db);
    if (p) {
      const { newHappiness, decayAmount } = applyDecay(p, new Date().toISOString());
      if (decayAmount > 0) {
        updatePetStats(db, newHappiness, p.experience, p.evolutionStage, p.totalFeeds);
        setPet({ ...p, happiness: newHappiness });
      } else {
        setPet(p);
      }
      setActivities(getPetActivities(db, 20));
    } else {
      setPet(null);
      setShowAdopt(true);
    }
  }, [db, tick]);

  const handleAdopt = useCallback(() => {
    if (!newName.trim()) return;
    createPet(db, newName.trim());
    setNewName('');
    setShowAdopt(false);
    setTick((t) => t + 1);
  }, [db, newName]);

  const handleRename = useCallback(() => {
    if (!pet) return;
    Alert.prompt('Rename Pet', 'Enter a new name:', (name) => {
      if (name && name.trim()) {
        renamePet(db, name.trim());
        setTick((t) => t + 1);
      }
    });
  }, [db, pet]);

  const handleFeed = useCallback(() => {
    if (!pet) return;
    const today = new Date().toISOString().slice(0, 10);
    const feedCount = getPetActivitiesToday(db, 'mood_log', today);
    const result = feedPet(pet, 'mood_log', feedCount, entryCount);
    if (result.dailyLimitReached) {
      Alert.alert('Daily Limit', `${pet.name} is full for today! Come back tomorrow.`);
      return;
    }
    updatePetStats(db, result.newHappiness, result.newExperience, result.newEvolutionStage, pet.totalFeeds + 1);
    createPetActivity(db, uuid(), 'mood_log', result.happinessDelta, result.experienceDelta);
    if (result.justHatched) Alert.alert('Hatched!', `${pet.name} has hatched!`);
    else if (result.justEvolved) Alert.alert('Evolved!', `${pet.name} evolved to ${EVOLUTION_NAMES[result.newEvolutionStage]}!`);
    setTick((t) => t + 1);
  }, [db, pet, entryCount]);

  const handlePlay = useCallback(() => {
    if (!pet) return;
    const today = new Date().toISOString().slice(0, 10);
    const feedCount = getPetActivitiesToday(db, 'workout', today);
    const result = feedPet(pet, 'workout', feedCount, entryCount);
    if (result.dailyLimitReached) {
      Alert.alert('Tired Out', `${pet.name} needs rest! Try again tomorrow.`);
      return;
    }
    updatePetStats(db, result.newHappiness, result.newExperience, result.newEvolutionStage, pet.totalFeeds + 1);
    createPetActivity(db, uuid(), 'workout', result.happinessDelta, result.experienceDelta);
    setTick((t) => t + 1);
  }, [db, pet, entryCount]);

  // ── Adopt Screen ────────────────────────────────────────────────────
  if (showAdopt || !pet) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.content}>
        <GlassCard level={2}>
          <View style={s.adoptCenter}>
            <View style={s.adoptEgg}>
              <Text style={s.adoptEggEmoji}>{'\uD83E\uDD5A'}</Text>
            </View>
            <Text style={s.adoptTitle}>Adopt Your Companion</Text>
            <Text style={s.adoptSubtitle}>
              Your pet grows as you log moods, breathe, and meditate.
            </Text>
            <TextInput
              style={s.nameInput}
              placeholder="Choose a name..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={newName}
              onChangeText={setNewName}
              maxLength={20}
            />
            <GradientButton title="Hatch Companion" onPress={handleAdopt} />
          </View>
        </GlassCard>
      </ScrollView>
    );
  }

  const emoji = getPetEmoji(pet.species, pet.evolutionStage);
  const stageName = EVOLUTION_NAMES[pet.evolutionStage] ?? 'Unknown';
  const nextStage = pet.evolutionStage + 1;
  const nextThreshold = EVOLUTION_THRESHOLDS[nextStage];
  const expProgress = nextThreshold ? Math.min(pet.experience / nextThreshold, 1) : 1;
  const petAge = Math.floor((Date.now() - new Date(pet.createdAt).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={s.headerSection}>
        <View style={s.headerTextCol}>
          <Pressable onPress={handleRename}>
            <Text style={s.heroTitle}>Meet {pet.name}</Text>
          </Pressable>
          <Text style={s.heroSubtitle}>Your emotional sanctuary companion</Text>
        </View>
        <View style={s.levelBadge}>
          <Text style={s.levelBadgeText}>
            MOOD GARDEN LEVEL {pet.evolutionStage + 1}
          </Text>
        </View>
      </View>

      {/* ── Companion Stats + Pet Display Row ──────────────────── */}
      <GlassCard level={2} style={s.statsCard}>
        <Text style={s.statsCardLabel}>COMPANION STATS</Text>

        <View style={s.statRow}>
          <Text style={s.statLabel}>Happiness</Text>
          <View style={s.statBarRow}>
            <ProgressBar value={pet.happiness} max={100} color={pet.happiness > 60 ? '#4ADE80' : pet.happiness > 30 ? MOOD_ACCENT : '#EF4444'} />
            <Text style={s.statPct}>{pet.happiness}%</Text>
          </View>
        </View>

        <View style={s.statRow}>
          <Text style={s.statLabel}>Spirit Energy</Text>
          <View style={s.statBarRow}>
            <ProgressBar value={expProgress * 100} max={100} color="#8BCFF0" />
            <Text style={s.statPct}>{Math.round(expProgress * 100)}%</Text>
          </View>
        </View>

        <View style={s.inlineStatsRow}>
          <StatBadge icon={'\uD83D\uDCC5'} value={`${petAge} Days`} label="AGE" />
          <StatBadge icon={'\uD83C\uDF1F'} value={stageName} label="MOOD" />
        </View>
      </GlassCard>

      {/* ── Pet Display Circle ─────────────────────────────────── */}
      <View style={s.petDisplayWrap}>
        <View style={s.petCircleOuter}>
          <View style={s.petCircleInner}>
            <Text style={s.petEmoji}>{emoji}</Text>
          </View>
        </View>
        <Text style={s.stageLabel}>{stageName}</Text>
      </View>

      {/* ── Egg hatching progress ──────────────────────────────── */}
      {pet.evolutionStage === 0 && (
        <GlassCard level={2}>
          <Text style={s.statsCardLabel}>HATCHING PROGRESS</Text>
          <ProgressBar value={entryCount} max={HATCH_MOOD_ENTRIES_REQUIRED} color={MOOD_ACCENT} />
          <Text style={s.hatchHint}>
            Log {Math.max(0, HATCH_MOOD_ENTRIES_REQUIRED - entryCount)} more moods to hatch!
          </Text>
        </GlassCard>
      )}

      {/* ── Action Buttons ─────────────────────────────────────── */}
      <View style={s.actionRow}>
        <View style={s.actionBtnWrap}>
          <GradientButton title={`\uD83C\uDF7D Feed ${pet.name}`} onPress={handleFeed} />
        </View>
        <View style={s.actionBtnWrap}>
          <GradientButton title={`\uD83C\uDFAE Play Session`} onPress={handlePlay} variant="secondary" />
        </View>
      </View>

      {/* ── Evolution Stage ────────────────────────────────────── */}
      <GlassCard level={2} style={s.evoCard}>
        <Text style={s.statsCardLabel}>EVOLUTION STAGE</Text>
        <View style={s.evoRow}>
          {Object.entries(EVOLUTION_NAMES).map(([stageKey, name]) => {
            const stageNum = Number(stageKey);
            const isCurrent = stageNum === pet.evolutionStage;
            const isPast = stageNum < pet.evolutionStage;
            return (
              <View key={stageKey} style={s.evoStepWrap}>
                <View style={[
                  s.evoDot,
                  isCurrent && s.evoDotCurrent,
                  isPast && s.evoDotPast,
                ]}>
                  <Text style={s.evoDotText}>
                    {isPast ? '\u2713' : stageNum === 0 ? '\uD83E\uDD5A' : (stageNum + '')}
                  </Text>
                </View>
                <Text style={[
                  s.evoLabel,
                  isCurrent && s.evoLabelCurrent,
                ]}>{name}</Text>
              </View>
            );
          })}
        </View>
        {nextThreshold != null && (
          <View style={s.evoProgressSection}>
            <ProgressBar value={pet.experience} max={nextThreshold} color={MOOD_ACCENT} />
            <Text style={s.evoProgressText}>
              {pet.experience} / {nextThreshold} XP to {EVOLUTION_NAMES[nextStage]}
            </Text>
          </View>
        )}
      </GlassCard>

      {/* ── Wardrobe ───────────────────────────────────────────── */}
      <SectionHeader
        label="WARDROBE"
        title={`${WARDROBE_ITEMS.length} Items`}
      />
      <View style={s.wardrobeGrid}>
        {WARDROBE_ITEMS.map((item) => {
          const locked = pet.evolutionStage < item.unlockLevel;
          const equipped = equippedItem === item.id;
          return (
            <Pressable
              key={item.id}
              style={[
                s.wardrobeItem,
                equipped && s.wardrobeItemEquipped,
              ]}
              onPress={() => {
                if (!locked) setEquippedItem(item.id);
              }}
            >
              <Text style={s.wardrobeIcon}>{item.icon}</Text>
              {locked && (
                <View style={s.wardrobeLockOverlay}>
                  <Text style={s.wardrobeLockIcon}>{'\uD83D\uDD12'}</Text>
                </View>
              )}
              {equipped && (
                <View style={s.wardrobeCheck}>
                  <Text style={s.wardrobeCheckText}>{'\u2713'}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* ── Kitchen Log (Feeding & Care History) ───────────────── */}
      {activities.length > 0 && (
        <>
          <SectionHeader
            label="KITCHEN LOG"
            title="Feeding & Care History"
            action={{ text: 'VIEW ALL', onPress: () => {} }}
          />
          <FlatList
            horizontal
            data={activities.slice(0, 10)}
            keyExtractor={(a) => a.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.feedScroll}
            renderItem={({ item }) => {
              const display = ACTIVITY_DISPLAY[item.activityType] ?? { icon: '\u2753', label: item.activityType };
              return (
                <GlassCard level={3} style={s.feedCard}>
                  <Text style={s.feedIcon}>{display.icon}</Text>
                  <Text style={s.feedLabel}>{display.label}</Text>
                  <Text style={s.feedTime}>
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <View style={s.feedDeltas}>
                    {item.happinessDelta !== 0 && (
                      <Text style={[s.feedDelta, { color: item.happinessDelta > 0 ? '#4ADE80' : '#EF4444' }]}>
                        {item.happinessDelta > 0 ? '+' : ''}{item.happinessDelta} hp
                      </Text>
                    )}
                    {item.experienceDelta !== 0 && (
                      <Text style={[s.feedDelta, { color: MOOD_ACCENT }]}>
                        +{item.experienceDelta} xp
                      </Text>
                    )}
                  </View>
                </GlassCard>
              );
            }}
          />
        </>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MOOD_SURFACES.depth },
  content: { paddingBottom: 40, gap: 16 },

  // Header
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerTextCol: { flex: 1, gap: 4 },
  heroTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 26,
    letterSpacing: -0.02 * 26,
    color: colors.text,
  },
  heroSubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.5)',
  },
  levelBadge: {
    backgroundColor: MOOD_SURFACES.focus,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  levelBadgeText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: MOOD_ACCENT,
  },

  // Stats card
  statsCard: { marginHorizontal: 20 },
  statsCardLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: MOOD_ACCENT,
    marginBottom: 12,
  },
  statRow: { marginBottom: 10 },
  statLabel: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  statBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statPct: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    width: 38,
    textAlign: 'right',
  },
  inlineStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },

  // Progress bar
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: MOOD_SURFACES.highest,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },

  // Pet display
  petDisplayWrap: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  petCircleOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: MOOD_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petCircleInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petEmoji: { fontSize: 72, lineHeight: 88 },
  stageLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: 'rgba(255,255,255,0.5)',
  },

  // Hatch hint
  hatchHint: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  actionBtnWrap: { flex: 1 },

  // Evolution
  evoCard: { marginHorizontal: 20 },
  evoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  evoStepWrap: { alignItems: 'center', gap: 4 },
  evoDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: MOOD_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  evoDotCurrent: { backgroundColor: MOOD_ACCENT },
  evoDotPast: { backgroundColor: 'rgba(251,146,60,0.3)' },
  evoDotText: { fontSize: 14, color: colors.text },
  evoLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 8,
    letterSpacing: 0.05 * 8,
    color: 'rgba(255,255,255,0.4)',
  },
  evoLabelCurrent: { color: MOOD_ACCENT },
  evoProgressSection: { marginTop: 12, gap: 6 },
  evoProgressText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },

  // Wardrobe
  wardrobeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
  },
  wardrobeItem: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: MOOD_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wardrobeItemEquipped: {
    backgroundColor: MOOD_SURFACES.focus,
  },
  wardrobeIcon: { fontSize: 24 },
  wardrobeLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wardrobeLockIcon: { fontSize: 16 },
  wardrobeCheck: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: MOOD_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wardrobeCheckText: { fontSize: 10, color: '#1a1008', fontWeight: '700' },

  // Kitchen Log
  feedScroll: { paddingHorizontal: 20, gap: 10 },
  feedCard: { width: 120, alignItems: 'center', gap: 6, paddingVertical: 14 },
  feedIcon: { fontSize: 28 },
  feedLabel: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 11,
    lineHeight: 16,
    color: colors.text,
    textAlign: 'center',
  },
  feedTime: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.05 * 9,
    color: 'rgba(255,255,255,0.4)',
  },
  feedDeltas: { flexDirection: 'row', gap: 6 },
  feedDelta: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 10,
    fontWeight: '600',
  },

  // Adopt screen
  adoptCenter: { alignItems: 'center', gap: 16, paddingVertical: 32 },
  adoptEgg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adoptEggEmoji: { fontSize: 48 },
  adoptTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  adoptSubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  nameInput: {
    width: '80%',
    color: colors.text,
    fontSize: 16,
    fontFamily: MOOD_TYPOGRAPHY.bodyMd.fontFamily,
    padding: 14,
    backgroundColor: MOOD_SURFACES.focus,
    borderRadius: 12,
    textAlign: 'center',
  },
});
