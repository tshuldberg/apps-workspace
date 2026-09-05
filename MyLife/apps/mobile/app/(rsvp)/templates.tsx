import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getTemplates, applyTemplate, createEvent } from '@mylife/rsvp';
import type { EventTemplate } from '@mylife/rsvp';
import { Card, Text, EmptyState, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.rsvp;

export default function TemplatesScreen() {
  const db = useDatabase();
  const router = useRouter();
  const templates = useMemo(() => getTemplates(), []);

  const handleUseTemplate = (template: EventTemplate) => {
    const applied = applyTemplate(template.id);
    if (!applied) return;
    const startAt = new Date(Date.now() + 7 * 86400000).toISOString();
    const endAt = new Date(Date.now() + 7 * 86400000 + applied.suggestedDurationHours * 3600000).toISOString();
    const id = `evt_${Date.now()}`;
    createEvent(db, id, {
      title: applied.templateName,
      startAt,
      endAt,
      description: applied.suggestedDescription,
      visibility: 'private',
      requiresApproval: false,
    });
    router.push(`/(rsvp)/event/${id}`);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Event Templates</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Choose a template to quickly create a pre-filled event.
        </Text>
      </Card>

      <View style={styles.grid}>
        {templates.map((template) => (
          <Pressable
            key={template.id}
            style={styles.templateCard}
            onPress={() => handleUseTemplate(template)}
          >
            <Text style={styles.templateIcon}>{template.icon}</Text>
            <Text variant="body">{template.name}</Text>
            <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
              {template.description}
            </Text>
            <Text variant="caption" color={ACCENT}>
              ~{template.suggestedDurationHours}h
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  templateCard: {
    width: '48%' as unknown as number,
    padding: spacing.md, borderRadius: 12, gap: spacing.xs,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  templateIcon: { fontSize: 32 },
});
