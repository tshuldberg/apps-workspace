import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  Edit3,
  Flame,
  Leaf,
  Salad,
  Settings as SettingsIcon,
  Sliders,
  Trash2,
  Upload,
  WheatOff,
} from 'lucide-react-native';
import {
  getRecipes,
  getSetting,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_DANGER,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  RECIPES_TERTIARY,
  setSetting,
} from '@mylife/bestchef';
import { GlassCard } from '@mylife/bestchef/ui';
import { ErrorState, LoadingState, Text, colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const APP_VERSION = '2.4.0';
const STORAGE_LABEL = '1.2 GB';

const CUISINES = [
  'Mediterranean',
  'Italian',
  'Mexican',
  'Japanese',
  'Indian',
  'Thai',
  'American',
  'French',
  'Chinese',
  'Middle Eastern',
] as const;

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;
const TIMER_SOUNDS = ['Classic', 'Chime', 'Bell', 'Soft'] as const;
const SERVING_OPTIONS = [1, 2, 3, 4, 6, 8, 10, 12] as const;

type DietaryKey = 'vegetarian' | 'vegan' | 'glutenFree';

export default function RecipesSettingsScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [defaultServings, setDefaultServings] = useState('4');
  const [measurementSystem, setMeasurementSystem] = useState('metric');
  const [preferredCuisine, setPreferredCuisine] = useState<string>('Mediterranean');
  const [skillLevel, setSkillLevel] = useState<string>('Intermediate');
  const [timerSound, setTimerSound] = useState<string>('Classic');
  const [dietary, setDietary] = useState<Record<DietaryKey, boolean>>({
    vegetarian: false,
    vegan: true,
    glutenFree: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      setDefaultServings(getSetting(db, 'defaultServings') ?? '4');
      setMeasurementSystem(getSetting(db, 'measurementSystem') ?? 'metric');
      setPreferredCuisine(getSetting(db, 'preferredCuisine') ?? 'Mediterranean');
      setSkillLevel(getSetting(db, 'skillLevel') ?? 'Intermediate');
      setTimerSound(getSetting(db, 'timerSound') ?? 'Classic');
      setDietary({
        vegetarian: getSetting(db, 'dietVegetarian') === 'true',
        vegan: (getSetting(db, 'dietVegan') ?? 'true') === 'true',
        glutenFree: getSetting(db, 'dietGlutenFree') === 'true',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const persistServings = (value: number) => {
    setSetting(db, 'defaultServings', String(value));
    setDefaultServings(String(value));
  };

  const persistMeasurement = (value: 'metric' | 'us') => {
    setSetting(db, 'measurementSystem', value);
    setMeasurementSystem(value);
  };

  const persistCuisine = (value: string) => {
    setSetting(db, 'preferredCuisine', value);
    setPreferredCuisine(value);
  };

  const persistSkill = (value: string) => {
    setSetting(db, 'skillLevel', value);
    setSkillLevel(value);
  };

  const persistTimerSound = (value: string) => {
    setSetting(db, 'timerSound', value);
    setTimerSound(value);
  };

  const persistDietary = (key: DietaryKey, value: boolean) => {
    const settingKey =
      key === 'vegetarian'
        ? 'dietVegetarian'
        : key === 'vegan'
          ? 'dietVegan'
          : 'dietGlutenFree';
    setSetting(db, settingKey, value ? 'true' : 'false');
    setDietary((prev) => ({ ...prev, [key]: value }));
  };

  const handleServings = () => {
    Alert.alert(
      'Default Servings',
      'Choose your default serving count',
      [
        ...SERVING_OPTIONS.map((n) => ({
          text: `${n} ${n === 1 ? 'Person' : 'People'}`,
          onPress: () => persistServings(n),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const handleMeasurementToggle = () => {
    const next = measurementSystem === 'metric' ? 'us' : 'metric';
    persistMeasurement(next);
  };

  const handleCuisine = () => {
    Alert.alert(
      'Preferred Cuisine',
      'Pick a cuisine to highlight',
      [
        ...CUISINES.map((c) => ({ text: c, onPress: () => persistCuisine(c) })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const handleSkill = () => {
    Alert.alert(
      'Skill Level',
      'Influences recipe difficulty filters',
      [
        ...SKILL_LEVELS.map((s) => ({ text: s, onPress: () => persistSkill(s) })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const handleTimerSound = () => {
    Alert.alert(
      'Timer Sound',
      'Chime when cooking timer ends',
      [
        ...TIMER_SOUNDS.map((s) => ({
          text: s,
          onPress: () => persistTimerSound(s),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const handleExport = async () => {
    try {
      const recipes = getRecipes(db, {});
      const payload = {
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        recipeCount: recipes.length,
        recipes,
      };
      const json = JSON.stringify(payload, null, 2);
      await Share.share({
        title: 'BestChef Export',
        message: json,
      });
    } catch (err) {
      Alert.alert(
        'Export Failed',
        err instanceof Error ? err.message : 'Could not export recipes.',
      );
    }
  };

  const handleImport = () => {
    router.push('/(recipes)/import-source');
  };

  const handleDeleteAll = () => {
    Alert.alert(
      'Delete All Recipes',
      'This permanently removes every recipe, ingredient, and step from your local vault. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Deletion',
              'Are you absolutely sure? Tap Delete to permanently erase all recipes.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    try {
                      db.execute('DELETE FROM rc_recipe_tags');
                      db.execute('DELETE FROM rc_ingredients');
                      db.execute('DELETE FROM rc_steps');
                      db.execute('DELETE FROM rc_recipe_collections');
                      db.execute('DELETE FROM rc_recipes');
                      Alert.alert('Done', 'All recipes were deleted.');
                    } catch (err) {
                      Alert.alert(
                        'Delete Failed',
                        err instanceof Error
                          ? err.message
                          : 'Could not delete recipes.',
                      );
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const measurementLabel = useMemo(
    () => (measurementSystem === 'metric' ? 'Metric' : 'Imperial'),
    [measurementSystem],
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState rows={3} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>
          Tailor your culinary archive to your lifestyle.
        </Text>
      </View>

      {/* Defaults */}
      <SectionHeading icon={<Sliders size={16} color={RECIPES_ACCENT} />} label="DEFAULTS" />
      <View style={styles.row2}>
        <Pressable style={styles.cellHalf} onPress={handleServings}>
          <GlassCard level={1} style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>DEFAULT SERVINGS</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldValue}>
                {defaultServings} {defaultServings === '1' ? 'Person' : 'People'}
              </Text>
              <View style={styles.iconChip}>
                <Edit3 size={14} color={colors.textSecondary} />
              </View>
            </View>
          </GlassCard>
        </Pressable>
        <Pressable style={styles.cellHalf} onPress={handleMeasurementToggle}>
          <GlassCard level={1} style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>MEASUREMENT UNITS</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldValue}>{measurementLabel}</Text>
              <View style={styles.iconChip}>
                <SettingsIcon size={14} color={colors.textSecondary} />
              </View>
            </View>
          </GlassCard>
        </Pressable>
      </View>
      <Pressable onPress={handleCuisine}>
        <GlassCard level={1} style={[styles.fieldCard, styles.fullWidth]}>
          <Text style={styles.fieldLabel}>PREFERRED CUISINE</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldValue}>{preferredCuisine}</Text>
            <ChevronDown size={18} color={colors.textSecondary} />
          </View>
        </GlassCard>
      </Pressable>

      {/* Dietary Restrictions */}
      <SectionHeading
        icon={<Leaf size={16} color={RECIPES_ACCENT} />}
        label="DIETARY RESTRICTIONS"
      />
      <GlassCard level={1} style={styles.listCard}>
        <DietaryRow
          icon={<Salad size={18} color={colors.textSecondary} />}
          label="Vegetarian"
          value={dietary.vegetarian}
          onValueChange={(v) => persistDietary('vegetarian', v)}
        />
        <View style={styles.listDivider} />
        <DietaryRow
          icon={<Leaf size={18} color={colors.textSecondary} />}
          label="Vegan"
          value={dietary.vegan}
          onValueChange={(v) => persistDietary('vegan', v)}
        />
        <View style={styles.listDivider} />
        <DietaryRow
          icon={<WheatOff size={18} color={colors.textSecondary} />}
          label="Gluten-Free"
          value={dietary.glutenFree}
          onValueChange={(v) => persistDietary('glutenFree', v)}
        />
      </GlassCard>

      {/* Cooking Preferences */}
      <SectionHeading
        icon={<Flame size={16} color={RECIPES_ACCENT} />}
        label="COOKING PREFERENCES"
      />
      <Pressable onPress={handleSkill}>
        <GlassCard level={1} style={styles.prefCard}>
          <View style={styles.prefBody}>
            <Text style={styles.prefTitle}>Skill Level</Text>
            <Text style={styles.prefSubtitle}>
              Influences recipe difficulty filters
            </Text>
          </View>
          <View style={styles.skillPill}>
            <Text style={styles.skillPillText}>{skillLevel}</Text>
          </View>
        </GlassCard>
      </Pressable>
      <Pressable onPress={handleTimerSound}>
        <GlassCard level={1} style={styles.prefCard}>
          <View style={styles.prefBody}>
            <Text style={styles.prefTitle}>Timer Sound</Text>
            <Text style={styles.prefSubtitle}>Chime when cooking timer ends</Text>
          </View>
          <View style={styles.prefValueRow}>
            <Text style={styles.prefValueText}>{timerSound}</Text>
            <ChevronRight size={16} color={RECIPES_ACCENT} />
          </View>
        </GlassCard>
      </Pressable>

      {/* Storage & Data */}
      <View style={styles.bentoRow}>
        <GlassCard level={1} style={styles.storageCard}>
          <Database size={22} color={RECIPES_SECONDARY} />
          <View>
            <Text style={styles.storageValue}>{STORAGE_LABEL}</Text>
            <Text style={styles.storageLabel}>LOCAL CACHE</Text>
          </View>
        </GlassCard>
        <View style={styles.bentoColumn}>
          <Pressable onPress={handleExport} style={styles.bentoButtonWrap}>
            <GlassCard level={1} style={styles.bentoButton}>
              <Upload size={18} color={RECIPES_TERTIARY} />
              <Text style={styles.bentoButtonText}>Export</Text>
            </GlassCard>
          </Pressable>
          <Pressable onPress={handleImport} style={styles.bentoButtonWrap}>
            <GlassCard level={1} style={styles.bentoButton}>
              <Download size={18} color={RECIPES_TERTIARY} />
              <Text style={styles.bentoButtonText}>Import</Text>
            </GlassCard>
          </Pressable>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.dangerSection}>
        <View style={styles.dangerDivider} />
        <Pressable onPress={handleDeleteAll} style={styles.dangerButton}>
          <Trash2 size={18} color={RECIPES_DANGER} />
          <Text style={styles.dangerButtonText}>Delete All Recipes</Text>
        </Pressable>
        <Text style={styles.versionText}>
          VERSION {APP_VERSION}  •  OBSIDIAN NOIR
        </Text>
      </View>
    </ScrollView>
  );
}

function SectionHeading({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      {icon}
      <Text style={styles.sectionHeadingText}>{label}</Text>
    </View>
  );
}

function DietaryRow({
  icon,
  label,
  value,
  onValueChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.dietaryRow}>
      <View style={styles.dietaryLabelGroup}>
        {icon}
        <Text style={styles.dietaryLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: RECIPES_SURFACES.highest, true: RECIPES_ACCENT }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={RECIPES_SURFACES.highest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 64,
    gap: 24,
  },
  header: {
    gap: 6,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 30,
    color: colors.text,
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  sectionHeadingText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: RECIPES_ACCENT,
  },
  row2: {
    flexDirection: 'row',
    gap: 12,
  },
  cellHalf: {
    flex: 1,
  },
  fieldCard: {
    padding: 18,
    gap: 14,
    borderRadius: 18,
  },
  fullWidth: {
    width: '100%',
  },
  fieldLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textSecondary,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldValue: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 19,
    color: colors.text,
  },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    padding: 0,
    overflow: 'hidden',
    borderRadius: 18,
  },
  listDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
  },
  dietaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dietaryLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dietaryLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  prefCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
  },
  prefBody: {
    flex: 1,
    paddingRight: 12,
    gap: 4,
  },
  prefTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  prefSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  skillPill: {
    backgroundColor: RECIPES_SURFACES.highest,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  skillPillText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  prefValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  prefValueText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: RECIPES_ACCENT,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  storageCard: {
    flex: 1,
    aspectRatio: 1,
    padding: 18,
    justifyContent: 'space-between',
    borderRadius: 18,
  },
  storageValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 26,
    color: colors.text,
  },
  storageLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bentoColumn: {
    flex: 1,
    gap: 12,
  },
  bentoButtonWrap: {
    flex: 1,
  },
  bentoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
  },
  bentoButtonText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  dangerSection: {
    marginTop: 8,
    gap: 16,
  },
  dangerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(147, 0, 10, 0.2)',
  },
  dangerButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: RECIPES_DANGER,
  },
  versionText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
