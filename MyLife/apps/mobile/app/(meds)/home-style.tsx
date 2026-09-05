import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  GlassCard,
  MD_ACCENT_LIGHT,
  MD_CHROME_GOLD,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  MaterialSymbol,
  SectionHeader,
  withAlpha,
} from '@mylife/meds/ui';
import {
  DEFAULT_MEDS_DASHBOARD_SECTIONS,
  FilterChip,
  ScreenTitleBlock,
  SectionStack,
  parseMedsDashboardSections,
  type MedsDashboardSectionConfig,
  type MedsHomeStyle,
} from '../../components/meds/phase1';
import { useDatabase } from '../../components/DatabaseProvider';

const STYLE_OPTIONS: Array<{ description: string; id: MedsHomeStyle; label: string }> = [
  {
    description: 'Chronological schedule at the top with dense reminder actions.',
    id: 'timeline',
    label: 'Timeline',
  },
  {
    description: 'Group doses into Morning, Midday, Evening, and Bedtime buckets.',
    id: 'pillbox',
    label: 'Pillbox',
  },
  {
    description: 'Compact command center with smaller section cards and a flatter list.',
    id: 'simple',
    label: 'Simple',
  },
];

function moveSection(
  sections: MedsDashboardSectionConfig[],
  index: number,
  direction: -1 | 1,
) {
  const target = index + direction;
  if (target < 0 || target >= sections.length) {
    return sections;
  }

  const next = [...sections];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

export default function HomeStyleScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [homeStyle, setHomeStyle] = useState<MedsHomeStyle>('timeline');
  const [sections, setSections] = useState<MedsDashboardSectionConfig[]>(
    DEFAULT_MEDS_DASHBOARD_SECTIONS.map((section) => ({ ...section })),
  );

  const loadConfig = useCallback(() => {
    const homeStyleRows = db.query<{ value: string }>(
      'SELECT value FROM hub_settings WHERE key = ?',
      ['meds.home_style'],
    );
    const sectionsRows = db.query<{ value: string }>(
      'SELECT value FROM hub_settings WHERE key = ?',
      ['meds.dashboard_sections'],
    );

    const nextStyle = (homeStyleRows[0]?.value as MedsHomeStyle | undefined) ?? 'timeline';
    const nextSections = parseMedsDashboardSections(sectionsRows[0]?.value);

    setHomeStyle(nextStyle);
    setSections(nextSections.map((section) => ({ ...section })));
  }, [db]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConfig();
    setTimeout(() => setRefreshing(false), 250);
  }, [loadConfig]);

  const activeSections = useMemo(
    () => sections.filter((section) => section.enabled),
    [sections],
  );

  const saveConfig = useCallback(() => {
    db.execute(
      `INSERT INTO hub_settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['meds.home_style', homeStyle],
    );
    db.execute(
      `INSERT INTO hub_settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['meds.dashboard_sections', JSON.stringify(sections)],
    );
    Alert.alert('Saved', 'Dashboard layout preferences updated.');
  }, [db, homeStyle, sections]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          colors={[MD_ACCENT_LIGHT]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          tintColor={MD_ACCENT_LIGHT}
        />
      }
      style={styles.screen}
    >
      <SectionStack>
        <ScreenTitleBlock
          subtitle="Choose a Today-tab layout, reorder dashboard modules, and decide which sections stay visible."
          title="Customize Dashboard"
        />

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader
            action={(
              <Pressable onPress={saveConfig} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>Save layout</Text>
              </Pressable>
            )}
            title="Layout style"
          />
          <View style={styles.optionStack}>
            {STYLE_OPTIONS.map((option) => (
              <Pressable key={option.id} onPress={() => setHomeStyle(option.id)}>
                <GlassCard
                  padding={16}
                  style={[
                    styles.optionCard,
                    homeStyle === option.id ? styles.optionCardSelected : null,
                  ]}
                >
                  <View style={styles.optionHeader}>
                    <Text style={styles.optionTitle}>{option.label}</Text>
                    {homeStyle === option.id ? (
                      <FilterChip label="Selected" selected />
                    ) : null}
                  </View>
                  <Text style={styles.optionBody}>{option.description}</Text>
                </GlassCard>
              </Pressable>
            ))}
          </View>
        </GlassCard>

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader title="Dashboard modules" />
          <View style={styles.moduleStack}>
            {sections.map((section, index) => (
              <GlassCard key={section.id} padding={14} style={styles.moduleCard}>
                <View style={styles.moduleHeader}>
                  <View style={styles.moduleCopy}>
                    <Text style={styles.moduleTitle}>{section.label}</Text>
                    <Text style={styles.moduleBody}>{section.description}</Text>
                  </View>
                  <FilterChip
                    label={section.enabled ? 'On' : 'Off'}
                    onPress={() => setSections((current) =>
                      current.map((item) =>
                        item.id === section.id
                          ? { ...item, enabled: !item.enabled }
                          : item,
                      ),
                    )}
                    selected={section.enabled}
                  />
                </View>
                <View style={styles.moduleFooter}>
                  <View style={styles.chipRail}>
                    <FilterChip
                      label="Compact"
                      onPress={() => setSections((current) =>
                        current.map((item) =>
                          item.id === section.id
                            ? { ...item, density: 'compact' }
                            : item,
                        ),
                      )}
                      selected={section.density === 'compact'}
                    />
                    <FilterChip
                      label="Expanded"
                      onPress={() => setSections((current) =>
                        current.map((item) =>
                          item.id === section.id
                            ? { ...item, density: 'expanded' }
                            : item,
                        ),
                      )}
                      selected={section.density === 'expanded'}
                    />
                  </View>
                  <View style={styles.orderButtons}>
                    <Pressable
                      onPress={() => setSections((current) => moveSection(current, index, -1))}
                      style={styles.orderButton}
                    >
                      <Text style={styles.orderButtonText}>Up</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setSections((current) => moveSection(current, index, 1))}
                      style={styles.orderButton}
                    >
                      <Text style={styles.orderButtonText}>Down</Text>
                    </Pressable>
                  </View>
                </View>
              </GlassCard>
            ))}
          </View>
        </GlassCard>

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader title="Preview" />
          <View style={styles.previewShell}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Today tab preview</Text>
              <Text style={styles.previewMeta}>{homeStyle}</Text>
            </View>
            <View style={styles.previewStack}>
              {activeSections.map((section) => (
                <View
                  key={section.id}
                  style={[
                    styles.previewCard,
                    section.density === 'compact'
                      ? styles.previewCardCompact
                      : styles.previewCardExpanded,
                  ]}
                >
                  <Text style={styles.previewCardTitle}>{section.label}</Text>
                  <Text style={styles.previewCardBody}>{section.density}</Text>
                </View>
              ))}
              {activeSections.length === 0 ? (
                <View style={styles.previewEmpty}>
                  <MaterialSymbol color={MD_TEXT_TERTIARY} name="dashboard_customize" size={18} />
                  <Text style={styles.previewEmptyText}>Enable at least one section to keep Today usable.</Text>
                </View>
              ) : null}
            </View>
          </View>
        </GlassCard>

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader title="Done editing?" />
          <View style={styles.footerActions}>
            <Pressable onPress={saveConfig} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save layout</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Back to More</Text>
            </Pressable>
          </View>
        </GlassCard>
      </SectionStack>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
  },
  panel: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.9),
    gap: 14,
  },
  saveButton: {
    backgroundColor: MD_ACCENT_LIGHT,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveButtonText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_SURFACES.lowest,
  },
  optionStack: {
    gap: 10,
  },
  optionCard: {
    backgroundColor: withAlpha('#FFFFFF', 0.04),
    gap: 6,
  },
  optionCardSelected: {
    shadowColor: MD_ACCENT_LIGHT,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  optionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
  },
  optionBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  moduleStack: {
    gap: 10,
  },
  moduleCard: {
    backgroundColor: withAlpha('#FFFFFF', 0.04),
    gap: 10,
  },
  moduleHeader: {
    gap: 10,
  },
  moduleCopy: {
    gap: 4,
  },
  moduleTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
  },
  moduleBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  moduleFooter: {
    gap: 10,
  },
  chipRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  orderButton: {
    backgroundColor: withAlpha(MD_CHROME_GOLD, 0.16),
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  orderButtonText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_CHROME_GOLD,
  },
  previewShell: {
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 22,
    gap: 12,
    padding: 14,
  },
  previewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
  },
  previewMeta: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  previewStack: {
    gap: 10,
  },
  previewCard: {
    backgroundColor: withAlpha(MD_ACCENT_LIGHT, 0.12),
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  previewCardCompact: {
    minHeight: 64,
  },
  previewCardExpanded: {
    minHeight: 92,
  },
  previewCardTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
  },
  previewCardBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  previewEmpty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  previewEmptyText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
    textAlign: 'center',
  },
  footerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryButton: {
    backgroundColor: withAlpha(MD_CHROME_GOLD, 0.16),
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_CHROME_GOLD,
  },
});
