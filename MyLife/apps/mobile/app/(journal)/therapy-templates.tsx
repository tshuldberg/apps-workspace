import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { THERAPY_TEMPLATES, getTemplateByType, getTemplateSections } from '@mylife/journal';
import type { TherapyTemplateType } from '@mylife/journal';
import { Card, Text, colors, spacing } from '@mylife/ui';

const ACCENT = colors.modules.journal;

export default function TherapyTemplatesScreen() {
  const [selected, setSelected] = useState<TherapyTemplateType | null>(null);
  const template = selected ? getTemplateByType(selected) : null;
  const sections = selected ? getTemplateSections(selected) : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Therapy Templates</Text>
      <Text style={styles.subtitle}>Structured journaling for therapeutic practice.</Text>

      {!selected ? (
        <View style={styles.grid}>
          {THERAPY_TEMPLATES.map((t) => (
            <Pressable key={t.type} onPress={() => setSelected(t.type)}>
              <Card style={styles.templateCard}>
                <Text style={styles.templateName}>{t.name}</Text>
                <Text style={styles.templateDesc}>{t.description}</Text>
                <Text style={styles.templateSections}>{t.sections.length} sections</Text>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <Pressable style={styles.backBtn} onPress={() => setSelected(null)}>
            <Text style={styles.backText}>Back to Templates</Text>
          </Pressable>
          {template && (
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>{template.name}</Text>
              <Text style={styles.sectionDesc}>{template.description}</Text>
            </Card>
          )}
          {sections.map((s, i) => (
            <Card key={`${s}-${i}`} style={styles.section}>
              <Text style={styles.promptLabel}>Section {i + 1}</Text>
              <Text style={styles.promptText}>{s}</Text>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary },
  grid: { gap: spacing.sm },
  templateCard: { padding: spacing.md, gap: spacing.xs },
  templateName: { fontSize: 16, fontWeight: '700', color: colors.text },
  templateDesc: { fontSize: 13, color: colors.textSecondary },
  templateSections: { fontSize: 11, color: ACCENT },
  backBtn: { padding: spacing.sm },
  backText: { fontSize: 14, color: ACCENT },
  section: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  sectionDesc: { fontSize: 14, color: colors.textSecondary },
  promptLabel: { fontSize: 11, color: ACCENT, fontWeight: '600', textTransform: 'uppercase' },
  promptText: { fontSize: 15, color: colors.text, lineHeight: 22 },
});
