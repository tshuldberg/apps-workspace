import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AreaChip,
  GlassCard,
  HABIT_TEMPLATES,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_HABIT_TYPES,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  SectionHeader,
  type HabitTemplate,
} from '@mylife/habits';

const FILTERS = ['All', 'Health', 'Fitness', 'Mindfulness', 'Learning', 'Work', 'Personal'] as const;

function getTemplateDifficulty(template: HabitTemplate) {
  if (template.habitType === 'negative') return 'Disciplined';
  if (template.habitType === 'timed' && template.targetCount >= 1800) return 'Deep';
  if (template.habitType === 'measurable' && template.targetCount >= 8) return 'Steady';
  return 'Easy Start';
}

function getTemplateDescription(template: HabitTemplate) {
  if (template.habitType === 'timed') {
    return `${Math.round(template.targetCount / 60)} minutes during the ${template.timeOfDay}.`;
  }
  if (template.habitType === 'measurable' && template.unit) {
    return `${template.targetCount} ${template.unit} on a ${template.frequency} rhythm.`;
  }
  if (template.habitType === 'negative') {
    return 'A sobriety-style template focused on keeping your streak protected.';
  }
  return `A ${template.frequency} routine built for ${template.areaName.toLowerCase()}.`;
}

export default function HabitTemplatesScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const templates = useMemo(() => HABIT_TEMPLATES, []);
  const visibleTemplates = useMemo(() => (
    templates.filter((template) => {
      if (filter !== 'All' && template.areaName !== filter) {
        return false;
      }

      if (!search.trim()) {
        return true;
      }

      return `${template.name} ${template.areaName}`.toLowerCase().includes(search.toLowerCase());
    })
  ), [filter, search, templates]);

  const selectedTemplate = selectedIndex != null ? templates[selectedIndex] : null;
  const relatedTemplates = useMemo(() => {
    if (!selectedTemplate) {
      return [];
    }

    return templates.filter((template) => (
      template.name !== selectedTemplate.name
      && (template.areaName === selectedTemplate.areaName || template.habitType === selectedTemplate.habitType)
    )).slice(0, 3);
  }, [selectedTemplate, templates]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard level={2} contentStyle={styles.headerCard}>
          <Pressable onPress={() => router.back()} style={styles.headerAction}>
            <Text style={styles.headerActionText}>Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Templates</Text>
        </GlassCard>

        <GlassCard level={4} contentStyle={styles.heroCard}>
          <Text style={styles.heroTitle}>Start with a proven habit.</Text>
          <Text style={styles.heroCopy}>
            Browse prebuilt routines, inspect the cadence, then send one back into the wizard with all the defaults filled in.
          </Text>
        </GlassCard>

        <View style={styles.filterRail}>
          {FILTERS.map((value) => (
            <Pressable
              key={value}
              onPress={() => setFilter(value)}
              style={[styles.filterChip, filter === value ? styles.filterChipActive : null]}
            >
              <Text style={[styles.filterChipText, filter === value ? styles.filterChipTextActive : null]}>
                {value}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search template names"
          placeholderTextColor={HB_TEXT_TERTIARY}
          style={styles.searchInput}
        />

        <View style={styles.grid}>
          {visibleTemplates.map((template) => {
            const templateIndex = templates.findIndex((entry) => entry.name === template.name);
            return (
              <Pressable
                key={template.name}
                onPress={() => setSelectedIndex(templateIndex)}
                style={styles.gridCell}
              >
                <GlassCard level={2} contentStyle={styles.templateCard}>
                  <View style={[styles.templateIcon, { backgroundColor: `${template.color}24` }]}>
                    <Text style={styles.templateIconText}>{template.icon}</Text>
                  </View>
                  <Text style={styles.templateTitle}>{template.name}</Text>
                  <AreaChip area={{ name: template.areaName, color: template.color }} />
                  <Text style={styles.templateDifficulty}>{getTemplateDifficulty(template)}</Text>
                  <Text style={styles.templateCopy}>{getTemplateDescription(template)}</Text>
                </GlassCard>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={selectedTemplate != null}
        onRequestClose={() => setSelectedIndex(null)}
      >
        <Pressable onPress={() => setSelectedIndex(null)} style={styles.sheetBackdrop}>
          <Pressable style={styles.sheetWrap}>
            <GlassCard level={4} contentStyle={styles.sheetCard}>
              {selectedTemplate ? (
                <>
                  <SectionHeader title={selectedTemplate.name} action={{ label: 'Close', onPress: () => setSelectedIndex(null) }} />
                  <View style={[styles.previewHero, { backgroundColor: `${selectedTemplate.color}20` }]}>
                    <Text style={styles.previewHeroIcon}>{selectedTemplate.icon}</Text>
                    <View style={styles.previewHeroCopy}>
                      <Text style={styles.previewHeroTitle}>{selectedTemplate.name}</Text>
                      <Text style={styles.previewHeroSubtitle}>{getTemplateDescription(selectedTemplate)}</Text>
                    </View>
                  </View>

                  <View style={styles.previewMetaRail}>
                    <AreaChip area={{ name: selectedTemplate.areaName, color: selectedTemplate.color }} />
                    <AreaChip area={{ name: selectedTemplate.habitType, color: HB_ACCENT_LIGHT }} />
                    <AreaChip area={{ name: selectedTemplate.frequency, color: HB_HABIT_TYPES.timed }} />
                    <AreaChip area={{ name: getTemplateDifficulty(selectedTemplate), color: HB_ACCENT }} />
                  </View>

                  <Text style={styles.previewBody}>
                    This template preloads the habit type, cadence, time-of-day hint, and goal amount so you can adjust the final details in the wizard instead of rebuilding everything from scratch.
                  </Text>

                  {relatedTemplates.length > 0 ? (
                    <View style={styles.relatedSection}>
                      <SectionHeader title="Related templates" />
                      <View style={styles.relatedList}>
                        {relatedTemplates.map((template) => {
                          const index = templates.findIndex((entry) => entry.name === template.name);
                          return (
                            <Pressable key={template.name} onPress={() => setSelectedIndex(index)} style={styles.relatedItem}>
                              <Text style={styles.relatedItemTitle}>{template.name}</Text>
                              <Text style={styles.relatedItemCopy}>{template.areaName}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={() => router.replace(`/(habits)/add-habit?templateId=${selectedIndex}&mode=template`)}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>Use Template</Text>
                  </Pressable>
                </>
              ) : null}
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
    backgroundColor: HB_SURFACES.base,
  },
  content: {
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 120,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAction: {
    borderRadius: 999,
    backgroundColor: `${HB_ACCENT}18`,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  headerActionText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  headerTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
  },
  heroCard: {
    gap: 10,
    paddingTop: 20,
    paddingBottom: 20,
  },
  heroTitle: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
  },
  heroCopy: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  filterRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    backgroundColor: HB_SURFACES.lowest,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: HB_ACCENT,
  },
  filterChipText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_SECONDARY,
  },
  filterChipTextActive: {
    color: HB_SURFACES.lowest,
  },
  searchInput: {
    ...HB_TYPOGRAPHY.bodyMd,
    borderRadius: 16,
    backgroundColor: HB_SURFACES.lowest,
    color: HB_TEXT,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCell: {
    width: '47%',
  },
  templateCard: {
    gap: 10,
    minHeight: 220,
  },
  templateIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  templateIconText: {
    fontSize: 22,
  },
  templateTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 18,
    lineHeight: 22,
  },
  templateDifficulty: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  templateCopy: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 18,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.66)',
  },
  sheetWrap: {
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  sheetCard: {
    gap: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  previewHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  previewHeroIcon: {
    fontSize: 28,
  },
  previewHeroCopy: {
    flex: 1,
    gap: 4,
  },
  previewHeroTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
  },
  previewHeroSubtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  previewMetaRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  relatedSection: {
    gap: 10,
  },
  relatedList: {
    gap: 8,
  },
  relatedItem: {
    borderRadius: 16,
    backgroundColor: HB_SURFACES.lowest,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  relatedItemTitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
  },
  relatedItemCopy: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: HB_ACCENT,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_SURFACES.lowest,
  },
});
