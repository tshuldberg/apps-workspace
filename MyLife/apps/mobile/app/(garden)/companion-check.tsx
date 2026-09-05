import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import {
  ArrowLeftRight,
  CheckCircle2,
  Search,
  Sparkles,
  XCircle,
} from 'lucide-react-native';
import {
  GARDEN_ACCENT,
  GARDEN_ACCENT_LIGHT,
  GARDEN_DANGER,
  GARDEN_GOLD,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  GradientButton,
  checkCompatibility,
  getAllCompanionPlants,
  getCompanions,
  getPlants,
  type Plant,
} from '@mylife/garden';
import { colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

type ActiveField = 'plantA' | 'plantB';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function resultMeta(relationship: 'companion' | 'antagonist' | 'neutral') {
  if (relationship === 'companion') {
    return {
      title: 'Compatible!',
      score: 94,
      tone: GARDEN_ACCENT,
      Icon: CheckCircle2,
      bullets: [
        'Supports pest deterrence and pollinator activity.',
        'Spacing and nutrient demand align well for shared beds.',
      ],
    };
  }

  if (relationship === 'antagonist') {
    return {
      title: 'Incompatible',
      score: 18,
      tone: GARDEN_DANGER,
      Icon: XCircle,
      bullets: [
        'This pairing can compete for roots, light, or shared nutrients.',
        'Separate beds or wider spacing are recommended.',
      ],
    };
  }

  return {
    title: 'Neutral',
    score: 56,
    tone: GARDEN_GOLD,
    Icon: ArrowLeftRight,
    bullets: [
      'No strong companion effect is registered in the current rule set.',
      'Keep an eye on spacing, airflow, and light balance.',
    ],
  };
}

export default function CompanionCheckScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ plantA?: string; plantB?: string }>();

  const [activeField, setActiveField] = useState<ActiveField>('plantA');
  const [plantA, setPlantA] = useState(params.plantA ?? '');
  const [plantB, setPlantB] = useState(params.plantB ?? '');
  const [query, setQuery] = useState(params.plantA ?? '');
  const [checked, setChecked] = useState(Boolean(params.plantA && params.plantB));

  const inventory: Plant[] = useMemo(() => {
    try {
      return getPlants(db);
    } catch {
      return [];
    }
  }, [db]);

  const lookupOptions = useMemo(() => {
    const merged = new Map<string, string>();
    for (const plant of inventory) {
      merged.set(normalize(plant.name), plant.name);
    }
    for (const value of getAllCompanionPlants()) {
      const key = normalize(value);
      if (!merged.has(key)) merged.set(key, titleCase(value));
    }
    return [...merged.values()].sort((a, b) => a.localeCompare(b));
  }, [inventory]);

  const filteredOptions = useMemo(() => {
    const term = normalize(query);
    if (!term) return lookupOptions.slice(0, 18);
    return lookupOptions
      .filter((item) => normalize(item).includes(term))
      .slice(0, 18);
  }, [lookupOptions, query]);

  const result = useMemo(() => {
    if (!checked || !plantA || !plantB) return null;
    try {
      return checkCompatibility(plantA, plantB);
    } catch {
      return null;
    }
  }, [checked, plantA, plantB]);

  const meta = result ? resultMeta(result.relationship) : null;

  const relatedSuggestions = useMemo(() => {
    if (!plantA) return [];
    return getCompanions(plantA)
      .slice(0, 5)
      .map((entry) => ({
        name:
          normalize(entry.plantA) === normalize(plantA)
            ? titleCase(entry.plantB)
            : titleCase(entry.plantA),
        benefit: entry.benefit,
      }));
  }, [plantA]);

  const handlePick = (value: string) => {
    if (activeField === 'plantA') setPlantA(value);
    else setPlantB(value);
    setQuery(value);
    setChecked(false);
  };

  const handleCheck = () => {
    if (!plantA || !plantB) return;
    setChecked(true);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerBlock}>
        <RNText style={styles.headerLabel}>PAIR LOOKUP</RNText>
        <RNText style={styles.headerTitle}>Check Companion Fit</RNText>
        <RNText style={styles.headerBody}>
          Compare two plants from your inventory or the companion database to
          see how they behave in the same bed.
        </RNText>
      </View>

      <GlassCard level={2} style={styles.lookupCard}>
        <PickerField
          label="Plant A"
          value={plantA}
          active={activeField === 'plantA'}
          onPress={() => {
            setActiveField('plantA');
            setQuery(plantA);
          }}
        />
        <View style={styles.swapOrb}>
          <ArrowLeftRight size={16} color={GARDEN_ACCENT} strokeWidth={2} />
        </View>
        <PickerField
          label="Plant B"
          value={plantB}
          active={activeField === 'plantB'}
          onPress={() => {
            setActiveField('plantB');
            setQuery(plantB);
          }}
        />

        <View style={styles.searchBar}>
          <Search size={16} color={colors.textSecondary} strokeWidth={1.8} />
          <TextInput
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              if (activeField === 'plantA') setPlantA(value);
              else setPlantB(value);
              setChecked(false);
            }}
            placeholder="Search garden specimens..."
            placeholderTextColor="rgba(214, 195, 181, 0.45)"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.suggestionWrap}>
          {filteredOptions.map((item) => (
            <Pressable
              key={item}
              onPress={() => handlePick(item)}
              style={styles.suggestionChip}
            >
              <RNText style={styles.suggestionText}>{item}</RNText>
            </Pressable>
          ))}
        </View>

        <GradientButton title="Check Compatibility" onPress={handleCheck} />
      </GlassCard>

      {result != null && meta != null && (
        <GlassCard level={3} style={styles.resultCard}>
          <View style={styles.resultTop}>
            <View style={styles.resultCopy}>
              <View style={[styles.badge, { backgroundColor: `${meta.tone}18` }]}>
                <meta.Icon size={16} color={meta.tone} strokeWidth={2} />
                <RNText style={[styles.badgeText, { color: meta.tone }]}>
                  {meta.title}
                </RNText>
              </View>
              <RNText style={styles.pairName}>
                {plantA} + {plantB}
              </RNText>
              <RNText style={styles.resultBody}>{result.benefit}</RNText>
            </View>

            <ScoreRing score={meta.score} color={meta.tone} />
          </View>

          <View style={styles.listBlock}>
            <RNText style={styles.listLabel}>
              {result.relationship === 'antagonist' ? 'Cautions' : 'Benefits'}
            </RNText>
            {[...meta.bullets, result.benefit].slice(0, 3).map((line) => (
              <View key={line} style={styles.bulletRow}>
                <Sparkles
                  size={14}
                  color={
                    result.relationship === 'antagonist'
                      ? GARDEN_DANGER
                      : GARDEN_ACCENT_LIGHT
                  }
                  strokeWidth={2}
                />
                <RNText style={styles.bulletText}>{line}</RNText>
              </View>
            ))}
          </View>

          <View style={styles.footerRow}>
            <RNText style={styles.footerMeta}>
              Category: {result.category.replace(/_/g, ' ')}
            </RNText>
            <Pressable
              onPress={() => router.push('/(garden)/companion-matrix' as never)}
            >
              <RNText style={styles.footerLink}>View Matrix</RNText>
            </Pressable>
          </View>
        </GlassCard>
      )}

      <GlassCard level={1} style={styles.inventoryCard}>
        <RNText style={styles.inventoryTitle}>Inventory context</RNText>
        <RNText style={styles.inventoryBody}>
          {inventory.length} plants in your sanctuary.
          {plantA ? ' These matches are filtered against your current collection.' : ' Select a plant to see companion suggestions.'}
        </RNText>
      </GlassCard>

      {relatedSuggestions.length > 0 && (
        <View style={styles.suggestionSection}>
          <RNText style={styles.listLabel}>Top matches for {plantA}</RNText>
          {relatedSuggestions.map((item) => (
            <GlassCard key={item.name} level={1} style={styles.relatedCard}>
              <RNText style={styles.relatedName}>{item.name}</RNText>
              <RNText style={styles.relatedBenefit}>{item.benefit}</RNText>
            </GlassCard>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function PickerField({
  label,
  value,
  active,
  onPress,
}: {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.fieldCard, active && styles.fieldCardActive]}
    >
      <RNText style={styles.fieldLabel}>{label}</RNText>
      <RNText style={[styles.fieldValue, !value && styles.fieldPlaceholder]}>
        {value || 'Select a plant'}
      </RNText>
    </Pressable>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const size = 92;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <View style={styles.scoreWrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.scoreCenter}>
        <RNText style={[styles.scoreValue, { color }]}>{score}%</RNText>
        <RNText style={styles.scoreLabel}>MATCH</RNText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GARDEN_SURFACES.depth,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  headerBlock: {
    gap: 8,
  },
  headerLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_ACCENT,
    fontSize: 11,
    letterSpacing: 1.1,
  },
  headerTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  headerBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  lookupCard: {
    gap: spacing.md,
  },
  fieldCard: {
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  fieldCardActive: {
    backgroundColor: GARDEN_SURFACES.focus,
  },
  fieldLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: colors.textTertiary,
    fontSize: 10,
    letterSpacing: 1,
  },
  fieldValue: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  fieldPlaceholder: {
    color: colors.textSecondary,
  },
  swapOrb: {
    alignSelf: 'center',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${GARDEN_ACCENT}18`,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: GARDEN_SURFACES.lift,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 15,
  },
  suggestionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.lift,
  },
  suggestionText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  resultCard: {
    gap: spacing.md,
  },
  resultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  resultCopy: {
    flex: 1,
    gap: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  badgeText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
  },
  pairName: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
    fontSize: 18,
  },
  resultBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  scoreWrap: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  scoreValue: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 18,
  },
  scoreLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  listBlock: {
    gap: 8,
  },
  listLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
    color: GARDEN_ACCENT_LIGHT,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletText: {
    flex: 1,
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  footerMeta: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  footerLink: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: GARDEN_ACCENT_LIGHT,
  },
  inventoryCard: {
    gap: 6,
  },
  inventoryTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  inventoryBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  suggestionSection: {
    gap: spacing.sm,
  },
  relatedCard: {
    gap: 6,
  },
  relatedName: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  relatedBenefit: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
