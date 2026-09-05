import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeftRight,
  CheckCircle2,
  LayoutGrid,
  Search,
  Sparkles,
  TriangleAlert,
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
  PlantCard,
  SectionHeader,
  checkCompatibility,
  getAllCompanionPlants,
  getAntagonists,
  getCompanions,
  getPlants,
  type Plant,
} from '@mylife/garden';
import { colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

type ActiveField = 'primary' | 'companion';

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function partnerName(entry: { plantA: string; plantB: string }, plant: string): string {
  return normalize(entry.plantA) === normalize(plant) ? entry.plantB : entry.plantA;
}

function buildMatchMeta(relationship: 'companion' | 'antagonist' | 'neutral') {
  if (relationship === 'companion') {
    return {
      title: 'Compatible',
      score: 94,
      tone: GARDEN_ACCENT,
      icon: CheckCircle2,
      detail: 'Shared growth habits, pest support, and pollinator benefits.',
    };
  }

  if (relationship === 'antagonist') {
    return {
      title: 'Incompatible',
      score: 18,
      tone: GARDEN_DANGER,
      icon: TriangleAlert,
      detail: 'Root competition or pest pressure makes this pairing risky.',
    };
  }

  return {
    title: 'Neutral',
    score: 56,
    tone: GARDEN_GOLD,
    icon: ArrowLeftRight,
    detail: 'No strong interaction detected, but spacing and light still matter.',
  };
}

export default function CompanionsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [activeField, setActiveField] = useState<ActiveField>('primary');
  const [primaryPlant, setPrimaryPlant] = useState('');
  const [companionPlant, setCompanionPlant] = useState('');
  const [query, setQuery] = useState('');
  const [hasChecked, setHasChecked] = useState(false);

  const inventory: Plant[] = useMemo(() => {
    try {
      return getPlants(db);
    } catch {
      return [];
    }
  }, [db]);

  const inventoryNames = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const plant of inventory) {
      const key = normalize(plant.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      names.push(plant.name);
    }
    return names;
  }, [inventory]);

  const allOptions = useMemo(() => {
    const merged = new Map<string, string>();
    for (const name of inventoryNames) {
      merged.set(normalize(name), name);
    }
    for (const name of getAllCompanionPlants()) {
      const key = normalize(name);
      if (!merged.has(key)) {
        merged.set(key, titleCase(name));
      }
    }
    return [...merged.values()].sort((a, b) => a.localeCompare(b));
  }, [inventoryNames]);

  const filteredOptions = useMemo(() => {
    const term = normalize(query);
    if (!term) {
      return allOptions.slice(0, 14);
    }
    return allOptions
      .filter((name) => normalize(name).includes(term))
      .slice(0, 14);
  }, [allOptions, query]);

  const compatibility = useMemo(() => {
    if (!hasChecked || !primaryPlant || !companionPlant) return null;
    try {
      return checkCompatibility(primaryPlant, companionPlant);
    } catch {
      return null;
    }
  }, [companionPlant, hasChecked, primaryPlant]);

  const matchMeta = compatibility
    ? buildMatchMeta(compatibility.relationship)
    : null;

  const topCompanions = useMemo(() => {
    const inGarden = new Set(inventoryNames.map((name) => normalize(name)));
    const seen = new Set<string>();
    const suggestions: Array<{ name: string; benefit: string; sourcePlant: string }> = [];

    for (const plant of inventory) {
      for (const entry of getCompanions(plant.name)) {
        const partner = partnerName(entry, plant.name);
        const key = normalize(partner);
        if (inGarden.has(key) || seen.has(key)) continue;
        seen.add(key);
        suggestions.push({
          name: titleCase(partner),
          benefit: entry.benefit,
          sourcePlant: plant.name,
        });
      }
    }

    return suggestions.slice(0, 6);
  }, [inventory, inventoryNames]);

  const avoidList = useMemo(() => {
    const focusPlant = primaryPlant || inventoryNames[0] || '';
    if (!focusPlant) return [];
    return getAntagonists(focusPlant).slice(0, 6).map((entry) => ({
      name: titleCase(partnerName(entry, focusPlant)),
      warning: entry.benefit,
    }));
  }, [inventoryNames, primaryPlant]);

  const handleFieldPress = (field: ActiveField) => {
    setActiveField(field);
    setQuery(field === 'primary' ? primaryPlant : companionPlant);
  };

  const handlePick = (name: string) => {
    if (activeField === 'primary') {
      setPrimaryPlant(name);
    } else {
      setCompanionPlant(name);
    }
    setQuery(name);
    setHasChecked(false);
  };

  const handleCheck = () => {
    if (!primaryPlant || !companionPlant) return;
    setHasChecked(true);
  };

  const opportunityCount = topCompanions.length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroBlock}>
        <RNText style={styles.heroLabel}>SYNERGY GUIDE</RNText>
        <RNText style={styles.heroTitle}>Companion Planting</RNText>
        <RNText style={styles.heroBody}>
          Optimize your harvest by grouping plants that support each other
          through pest deterrence, nutrient sharing, and pollinator
          attraction.
        </RNText>
      </View>

      <GlassCard level={2} style={styles.lookupCard}>
        <SelectionField
          label="Primary Plant"
          value={primaryPlant}
          active={activeField === 'primary'}
          onPress={() => handleFieldPress('primary')}
        />
        <View style={styles.linkOrb}>
          <ArrowLeftRight size={16} color={GARDEN_ACCENT} strokeWidth={2} />
        </View>
        <SelectionField
          label="Companion Plant"
          value={companionPlant}
          active={activeField === 'companion'}
          onPress={() => handleFieldPress('companion')}
        />

        <View style={styles.searchBar}>
          <Search size={16} color={colors.textSecondary} strokeWidth={1.8} />
          <TextInput
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              if (activeField === 'primary') setPrimaryPlant(value);
              else setCompanionPlant(value);
              setHasChecked(false);
            }}
            placeholder="Search your garden or companion database..."
            placeholderTextColor="rgba(214, 195, 181, 0.45)"
            style={styles.searchInput}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.optionRow}
        >
          {filteredOptions.map((name) => (
            <Pressable
              key={name}
              onPress={() => handlePick(name)}
              style={[
                styles.optionChip,
                query === name && styles.optionChipActive,
              ]}
            >
              <RNText
                style={[
                  styles.optionChipText,
                  query === name && styles.optionChipTextActive,
                ]}
              >
                {name}
              </RNText>
            </Pressable>
          ))}
        </ScrollView>

        <GradientButton title="Check Compatibility" onPress={handleCheck} />
      </GlassCard>

      {compatibility != null && matchMeta != null && (
        <GlassCard level={3} style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={[styles.resultBadge, { backgroundColor: `${matchMeta.tone}20` }]}>
              <matchMeta.icon size={16} color={matchMeta.tone} strokeWidth={2} />
              <RNText style={[styles.resultBadgeText, { color: matchMeta.tone }]}>
                {matchMeta.title}
              </RNText>
            </View>
            <View style={[styles.scoreOrb, { borderColor: `${matchMeta.tone}55` }]}>
              <RNText style={[styles.scoreValue, { color: matchMeta.tone }]}>
                {matchMeta.score}%
              </RNText>
              <RNText style={styles.scoreLabel}>MATCH</RNText>
            </View>
          </View>
          <RNText style={styles.resultDetail}>{matchMeta.detail}</RNText>
          <RNText style={styles.resultBenefit}>{compatibility.benefit}</RNText>

          <View style={styles.resultFooter}>
            <View style={styles.categoryPill}>
              <Sparkles size={14} color={GARDEN_ACCENT_LIGHT} strokeWidth={2} />
              <RNText style={styles.categoryText}>
                {compatibility.category.replace(/_/g, ' ')}
              </RNText>
            </View>
            <Pressable
              onPress={() =>
                router.push(
                  `/(garden)/companion-check?plantA=${encodeURIComponent(
                    primaryPlant,
                  )}&plantB=${encodeURIComponent(companionPlant)}`,
                )
              }
            >
              <RNText style={styles.detailLink}>Open Detailed Pair Lookup</RNText>
            </Pressable>
          </View>
        </GlassCard>
      )}

      <SectionHeader
        label="Top Companions for Your Garden"
        title="Growth Opportunities"
        action={{
          text: 'View Matrix',
          onPress: () => router.push('/(garden)/companion-matrix' as never),
        }}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsRow}
      >
        {topCompanions.length === 0 ? (
          <GlassCard level={1} style={styles.emptyStripCard}>
            <RNText style={styles.emptyStripTitle}>No uncovered pairings yet</RNText>
            <RNText style={styles.emptyStripBody}>
              Add more plant varieties to reveal new companion pairings.
            </RNText>
          </GlassCard>
        ) : (
          topCompanions.map((item) => (
            <GlassCard key={item.name} level={1} style={styles.opportunityCard}>
              <PlantCard
                name={item.name}
                species={`Pairs with ${item.sourcePlant}`}
                zone="Suggested"
                healthStatus="healthy"
              />
              <RNText style={styles.opportunityBenefit}>{item.benefit}</RNText>
              <Pressable
                onPress={() => router.push('/(garden)/add-plant')}
                style={styles.opportunityAction}
              >
                <RNText style={styles.opportunityActionText}>Add to Garden</RNText>
              </Pressable>
            </GlassCard>
          ))
        )}
      </ScrollView>

      <SectionHeader label="Do Not Plant With" title="Avoid List" />
      <View style={styles.avoidGrid}>
        {avoidList.length === 0 ? (
          <GlassCard level={1} style={styles.emptyAvoidCard}>
            <RNText style={styles.emptyStripBody}>
              Select a primary plant to see risky pairings.
            </RNText>
          </GlassCard>
        ) : (
          avoidList.map((item) => (
            <GlassCard key={item.name} level={1} style={styles.avoidCard}>
              <View style={styles.avoidHeader}>
                <TriangleAlert size={16} color={GARDEN_DANGER} strokeWidth={2} />
                <RNText style={styles.avoidName}>{item.name}</RNText>
              </View>
              <RNText style={styles.avoidBody}>{item.warning}</RNText>
            </GlassCard>
          ))
        )}
      </View>

      <View style={styles.integrationCard}>
        <View style={styles.integrationCopy}>
          <RNText style={styles.integrationTitle}>
            Based on your {inventory.length} plants
          </RNText>
          <RNText style={styles.integrationBody}>
            {opportunityCount} new companion opportunities are waiting in your
            sanctuary.
          </RNText>
        </View>
        <Pressable
          style={styles.integrationLink}
          onPress={() => router.push('/(garden)/companion-matrix' as never)}
        >
          <LayoutGrid size={16} color={colors.background} strokeWidth={2} />
          <RNText style={styles.integrationLinkText}>View Matrix</RNText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function SelectionField({
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
        {value || 'Tap to select or type'}
      </RNText>
    </Pressable>
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
  heroBlock: {
    gap: 8,
    paddingTop: spacing.sm,
  },
  heroLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_ACCENT,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  heroTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  heroBody: {
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
  linkOrb: {
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
  optionRow: {
    gap: 10,
    paddingRight: spacing.sm,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.lift,
  },
  optionChipActive: {
    backgroundColor: `${GARDEN_ACCENT}24`,
  },
  optionChipText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  optionChipTextActive: {
    color: GARDEN_ACCENT_LIGHT,
  },
  resultCard: {
    gap: spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resultBadgeText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
  },
  scoreOrb: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  scoreValue: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 18,
  },
  scoreLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    color: colors.textTertiary,
    letterSpacing: 1,
  },
  resultDetail: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.text,
  },
  resultBenefit: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  resultFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.lift,
  },
  categoryText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  detailLink: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: GARDEN_ACCENT_LIGHT,
  },
  cardsRow: {
    gap: spacing.md,
    paddingRight: spacing.sm,
  },
  opportunityCard: {
    width: 232,
    gap: spacing.sm,
  },
  opportunityBenefit: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  opportunityAction: {
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: `${GARDEN_ACCENT}18`,
  },
  opportunityActionText: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: GARDEN_ACCENT_LIGHT,
  },
  emptyStripCard: {
    width: 260,
    gap: 8,
  },
  emptyStripTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  emptyStripBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  avoidGrid: {
    gap: spacing.sm,
  },
  avoidCard: {
    gap: 8,
  },
  avoidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avoidName: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  avoidBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyAvoidCard: {
    gap: 8,
  },
  integrationCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: `${GARDEN_ACCENT}22`,
    gap: spacing.md,
  },
  integrationCopy: {
    gap: 6,
  },
  integrationTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  integrationBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  integrationLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 12,
    backgroundColor: GARDEN_ACCENT,
  },
  integrationLinkText: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: colors.background,
  },
});
